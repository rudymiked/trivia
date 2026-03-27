import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { getTelemetryClient } from '../appInsights.js';
import { extractBearerToken, verifyGoogleToken } from '../auth.js';
import {
    generatePersonalizedPuzzleForDate,
    generatePuzzleForDate,
    getTableClient,
    initializeTables,
    trackSeenLocations,
} from '../storage.js';

interface ScoreSubmission {
  date: string;
  userId: string;
  displayName: string;
  totalScore: number;
  rounds: number[];
  locationIds?: string[]; // Optional: track which locations were played
}

type ClueFeedbackRating = 'easy' | 'hard' | 'unclear';

interface ClueFeedbackSubmission {
  puzzleDate: string;
  locationId: string;
  feedback: ClueFeedbackRating;
  clue?: string;
  country?: string;
  answer?: string;
}

// Validation helpers
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DISPLAY_NAME_LENGTH = 50;
const EXPECTED_DAILY_ROUNDS = 5;
const MAX_ROUND_SCORE = 5000;
const MAX_TOTAL_SCORE = EXPECTED_DAILY_ROUNDS * MAX_ROUND_SCORE;
const MAX_METADATA_LENGTH = 500;
// Allow alphanumeric, hyphens, underscores, and periods (covers Google IDs and other OAuth providers)
const SAFE_USERID_REGEX = /^[a-zA-Z0-9._-]+$/;
const SMOKE_TEST_USER_ID = 'smoke-test-user';

function isValidDate(date: string): boolean {
  if (!DATE_REGEX.test(date)) return false;
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

function isValidUserId(userId: string): boolean {
  if (!userId || userId.length < 1 || userId.length > 128) return false;
  // Only allow safe characters to prevent OData injection
  return SAFE_USERID_REGEX.test(userId);
}

// Escape single quotes for OData filter strings (double single quotes)
function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function sanitizeDisplayName(name: string | undefined): string {
  if (!name) return 'Anonymous';
  // Remove any HTML/script tags and trim
  return name
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'&]/g, '')
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LENGTH) || 'Anonymous';
}

function rejectionResponse(status: number, code: string, message: string): HttpResponseInit {
  return {
    status,
    jsonBody: {
      code,
      error: message,
    },
  };
}

function isValidFeedbackRating(value: unknown): value is ClueFeedbackRating {
  return value === 'easy' || value === 'hard' || value === 'unclear';
}

function sanitizeMetadata(value: string | undefined): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_METADATA_LENGTH) : '';
}

// Get daily puzzle - dynamically generated from locations
app.http('getPuzzle', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'puzzle/{date?}',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const date = request.params.date || new Date().toISOString().split('T')[0];

    // Validate date format
    if (!isValidDate(date)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid date format. Use YYYY-MM-DD.' },
      };
    }

    try {
      // Generate puzzle dynamically from locations table
      // Daily puzzles are the same for everyone (no userId personalization)
      const puzzle = await generatePuzzleForDate(date);

      return {
        jsonBody: puzzle,
      };
    } catch (error: any) {
      context.error('Error generating puzzle:', error);
      
      const telemetryClient = getTelemetryClient();
      if (telemetryClient) {
        telemetryClient.trackEvent({
          name: 'puzzle_load_failure',
          properties: {
            reason: error.message || 'unknown',
            date: date,
          },
        });
      }

      if (error.message === 'Not enough locations to generate puzzle') {
        return {
          status: 503,
          jsonBody: { error: 'Not enough locations in database. Run seed first.' },
        };
      }

      return {
        status: 500,
        jsonBody: { error: 'Failed to generate puzzle' },
      };
    }
  },
});

// Get personalized puzzle for Play Modes - excludes locations the user has seen
app.http('getPersonalizedPuzzle', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'puzzle/practice',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const userId = request.query.get('userId');
    const category = request.query.get('category'); // Optional: filter by category

    // Validate userId if provided
    if (userId && !isValidUserId(userId)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid userId' },
      };
    }

    try {
      // Generate a unique date-like seed for this practice puzzle
      const now = new Date();
      const seed = `${now.toISOString()}-${Math.random().toString(36).substring(7)}`;

      // Generate personalized puzzle excluding seen locations
      const puzzle = await generatePersonalizedPuzzleForDate(seed, userId || undefined);

      return {
        jsonBody: puzzle,
      };
    } catch (error: any) {
      context.error('Error generating personalized puzzle:', error);
      
      const telemetryClient = getTelemetryClient();
      if (telemetryClient) {
        telemetryClient.trackEvent({
          name: 'puzzle_load_failure',
          properties: {
            reason: error.message || 'unknown',
            type: 'personalized',
            userId: userId || 'anonymous',
          },
        });
      }

      if (error.message === 'Not enough locations to generate puzzle') {
        return {
          status: 503,
          jsonBody: { error: 'Not enough locations in database. Run seed first.' },
        };
      }

      return {
        status: 500,
        jsonBody: { error: 'Failed to generate puzzle' },
      };
    }
  },
});

// Submit score
app.http('submitScore', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'scores',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    let submittedDate = 'unknown';
    let submittedUserId = 'unknown';

    try {
      const body = (await request.json()) as ScoreSubmission;
      const { date, userId, displayName, totalScore, rounds } = body;
      submittedDate = date || 'unknown';
      submittedUserId = userId || 'unknown';

      // Validate required fields
      if (!date || !userId || totalScore === undefined) {
        context.log('[submitScore] rejected: missing required fields');
        return rejectionResponse(400, 'MISSING_REQUIRED_FIELDS', 'Missing required fields: date, userId, totalScore');
      }

      // Validate date format
      if (!isValidDate(date)) {
        context.log(`[submitScore] rejected: invalid date format (${date})`);
        return rejectionResponse(400, 'INVALID_DATE_FORMAT', 'Invalid date format. Use YYYY-MM-DD.');
      }

      // Validate rounds payload and bounds
      if (!Array.isArray(rounds) || rounds.length !== EXPECTED_DAILY_ROUNDS) {
        context.log(`[submitScore] rejected: invalid rounds length (${Array.isArray(rounds) ? rounds.length : 'not-array'})`);
        return rejectionResponse(
          400,
          'INVALID_ROUNDS_COUNT',
          `Invalid rounds payload: expected ${EXPECTED_DAILY_ROUNDS} round scores.`
        );
      }

      const hasInvalidRoundScore = rounds.some(
        (roundScore) =>
          typeof roundScore !== 'number' ||
          !Number.isFinite(roundScore) ||
          roundScore < 0 ||
          roundScore > MAX_ROUND_SCORE
      );

      if (hasInvalidRoundScore) {
        context.log('[submitScore] rejected: one or more round scores are out of bounds');
        return rejectionResponse(
          400,
          'INVALID_ROUND_SCORE',
          `Each round score must be a number between 0 and ${MAX_ROUND_SCORE}.`
        );
      }

      // Validate total score bounds
      if (
        typeof totalScore !== 'number' ||
        !Number.isFinite(totalScore) ||
        totalScore < 0 ||
        totalScore > MAX_TOTAL_SCORE
      ) {
        context.log(`[submitScore] rejected: total score out of bounds (${totalScore})`);
        return rejectionResponse(
          400,
          'INVALID_TOTAL_SCORE',
          `Total score must be a number between 0 and ${MAX_TOTAL_SCORE}.`
        );
      }

      // Validate date/score payload consistency (date present and total roughly matches rounds)
      const roundsSum = rounds.reduce((sum, score) => sum + score, 0);
      if (Math.abs(roundsSum - totalScore) > EXPECTED_DAILY_ROUNDS) {
        context.log(
          `[submitScore] rejected: payload mismatch (totalScore=${totalScore}, roundsSum=${roundsSum}, date=${date})`
        );
        return rejectionResponse(
          400,
          'DATE_SCORE_MISMATCH',
          'Payload mismatch: totalScore does not match round scores for the submitted date.'
        );
      }

      // Check for auth token and validate if present
      const authHeader = request.headers.get('authorization');
      const token = extractBearerToken(authHeader);
      if (!token) {
        context.log(`[submitScore] rejected: missing auth token for userId=${userId}, date=${date}`);
        const telemetryClient = getTelemetryClient();
        if (telemetryClient) {
          telemetryClient.trackEvent({
            name: 'auth_failure',
            properties: {
              reason: 'missing_token',
              userId: userId,
              date: date,
            },
          });
        }
        return rejectionResponse(401, 'AUTH_REQUIRED', 'Authentication is required to submit scores.');
      }

      let verifiedUserId = userId;
      let verifiedDisplayName = sanitizeDisplayName(displayName);
      let isVerified = false;

      const verifiedUser = await verifyGoogleToken(token);
      if (verifiedUser) {
        // Reject submissions where payload userId doesn't match authenticated user
        if (verifiedUser.userId !== userId) {
          context.log(
            `[submitScore] rejected: user mismatch payload=${userId} token=${verifiedUser.userId} date=${date}`
          );
          const telemetryClient = getTelemetryClient();
          if (telemetryClient) {
            telemetryClient.trackEvent({
              name: 'auth_failure',
              properties: {
                reason: 'user_id_mismatch',
                payloadUserId: userId,
                tokenUserId: verifiedUser.userId,
                date: date,
              },
            });
          }
          return rejectionResponse(
            403,
            'USER_ID_MISMATCH',
            'Authenticated user does not match payload userId.'
          );
        }

        verifiedUserId = verifiedUser.userId;
        verifiedDisplayName = sanitizeDisplayName(verifiedUser.name);
        isVerified = true;
      } else {
        context.log(`[submitScore] rejected: invalid authentication token for userId=${userId}, date=${date}`);
        const telemetryClient = getTelemetryClient();
        if (telemetryClient) {
          telemetryClient.trackEvent({
            name: 'auth_failure',
            properties: {
              reason: 'invalid_token',
              userId: userId,
              date: date,
            },
          });
        }
        return rejectionResponse(401, 'INVALID_AUTH_TOKEN', 'Invalid authentication token');
      }

      // Validate userId format
      if (!isValidUserId(verifiedUserId)) {
        context.log(`[submitScore] rejected: invalid userId format (${verifiedUserId})`);
        return rejectionResponse(400, 'INVALID_USER_ID', 'Invalid userId');
      }

      const client = getTableClient('scores');
      const gamesClient = getTableClient('games');

      // Enforce one daily submission per user/date
      try {
        await gamesClient.getEntity(verifiedUserId, date);
        context.log(`[submitScore] rejected: duplicate submission userId=${verifiedUserId}, date=${date}`);
        return rejectionResponse(
          409,
          'DUPLICATE_SUBMISSION',
          'A score for this user and date already exists.'
        );
      } catch (error: any) {
        if (error.statusCode !== 404) {
          throw error;
        }
      }

      const completedAt = new Date().toISOString();
      const scoreEntity = {
        partitionKey: date,
        rowKey: verifiedUserId,
        displayName: verifiedDisplayName,
        totalScore,
        rounds: JSON.stringify(rounds),
        completedAt,
        isVerified,
      };

      // Primary write — score must be saved before we respond
      await client.upsertEntity(scoreEntity);

      // Secondary writes — wrap individually so a failure here doesn't
      // return 500 after the score is already committed to the scores table.
      try {
        await gamesClient.upsertEntity({
          partitionKey: verifiedUserId,
          rowKey: date,
          displayName: verifiedDisplayName,
          totalScore,
          rounds: JSON.stringify(rounds),
          completedAt,
          isVerified,
          puzzleType: 'daily',
        });
      } catch (e) {
        context.log('[submitScore] non-critical: failed to write games table:', e);
      }

      try {
        await updateUserStats(verifiedUserId, verifiedDisplayName, totalScore, date);
      } catch (e) {
        context.log('[submitScore] non-critical: failed to update user stats:', e);
      }

      // Track seen locations for personalized puzzles (if locationIds provided)
      if (body.locationIds && body.locationIds.length > 0 && isVerified) {
        try {
          await trackSeenLocations(verifiedUserId, body.locationIds);
        } catch (e) {
          context.log('[submitScore] non-critical: failed to track seen locations:', e);
        }
      }

      return {
        status: 201,
        jsonBody: { success: true, score: scoreEntity },
      };
    } catch (error) {
      context.error('Error submitting score:', error);
      const telemetryClient = getTelemetryClient();
      if (telemetryClient) {
        telemetryClient.trackEvent({
          name: 'submit_failure',
          properties: {
            reason: error instanceof Error ? error.message : 'unknown',
            userId: submittedUserId,
            date: submittedDate,
          },
        });
      }
      return {
        status: 500,
        jsonBody: { error: 'Failed to submit score' },
      };
    }
  },
});

app.http('submitClueFeedback', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'feedback/clues',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      await initializeTables();

      const body = (await request.json()) as ClueFeedbackSubmission;
      const puzzleDate = sanitizeMetadata(body.puzzleDate);
      const locationId = sanitizeMetadata(body.locationId);
      const feedback = body.feedback;

      if (!puzzleDate || !locationId || !isValidFeedbackRating(feedback)) {
        return rejectionResponse(
          400,
          'INVALID_CLUE_FEEDBACK',
          'puzzleDate, locationId, and feedback are required.'
        );
      }

      const clue = sanitizeMetadata(body.clue);
      const country = sanitizeMetadata(body.country);
      const answer = sanitizeMetadata(body.answer);
      const submittedAt = new Date().toISOString();

      const feedbackClient = getTableClient('clueFeedback');
      const summaryClient = getTableClient('clueFeedbackSummary');

      await feedbackClient.upsertEntity({
        partitionKey: puzzleDate,
        rowKey: `${locationId}_${submittedAt}_${randomUUID()}`,
        locationId,
        feedback,
        clue,
        country,
        answer,
        submittedAt,
      });

      let easyCount = 0;
      let hardCount = 0;
      let unclearCount = 0;
      let existingClue = clue;
      let existingCountry = country;
      let existingAnswer = answer;

      try {
        const existing = await summaryClient.getEntity('location', locationId);
        easyCount = Number(existing.easyCount || 0);
        hardCount = Number(existing.hardCount || 0);
        unclearCount = Number(existing.unclearCount || 0);
        existingClue = clue || String(existing.clue || '');
        existingCountry = country || String(existing.country || '');
        existingAnswer = answer || String(existing.answer || '');
      } catch (error: any) {
        if (error.statusCode !== 404) {
          throw error;
        }
      }

      if (feedback === 'easy') easyCount += 1;
      if (feedback === 'hard') hardCount += 1;
      if (feedback === 'unclear') unclearCount += 1;

      await summaryClient.upsertEntity({
        partitionKey: 'location',
        rowKey: locationId,
        clue: existingClue,
        country: existingCountry,
        answer: existingAnswer,
        easyCount,
        hardCount,
        unclearCount,
        lowRatingCount: hardCount + unclearCount,
        lastFeedback: feedback,
        lastPuzzleDate: puzzleDate,
        lastSubmittedAt: submittedAt,
      });

      return {
        status: 201,
        jsonBody: { success: true },
      };
    } catch (error) {
      context.error('Error submitting clue feedback:', error);
      return rejectionResponse(500, 'CLUE_FEEDBACK_FAILED', 'Failed to store clue feedback.');
    }
  },
});

// Get leaderboard
app.http('getLeaderboard', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'leaderboard/{date?}',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const date = request.params.date || new Date().toISOString().split('T')[0];
    const isAllTime = date === 'alltime';

    // Validate date format to prevent OData injection
    if (!isAllTime && !isValidDate(date)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid date format. Use YYYY-MM-DD or alltime.' },
      };
    }

    const limitParam = request.query.get('limit') || '10';
    const limit = Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 100);

    try {
      const client = getTableClient('scores');
      const scoresMap = new Map<string, { userId: string; displayName: string; totalScore: number }>();

      if (isAllTime) {
        // Query all scores and aggregate by userId
        const entities = client.listEntities();

        for await (const entity of entities) {
          const userId = entity.rowKey as string;
          if (userId === SMOKE_TEST_USER_ID) {
            continue;
          }

          const displayName = entity.displayName as string;
          const score = entity.totalScore as number;

          const existing = scoresMap.get(userId);
          if (existing) {
            existing.totalScore += score;
          } else {
            scoresMap.set(userId, { userId, displayName, totalScore: score });
          }
        }
      } else {
        // Query scores for specific date
        const entities = client.listEntities({
          queryOptions: { filter: `PartitionKey eq '${date}'` },
        });

        for await (const entity of entities) {
          const userId = entity.rowKey as string;
          if (userId === SMOKE_TEST_USER_ID) {
            continue;
          }

          scoresMap.set(userId, {
            userId,
            displayName: entity.displayName as string,
            totalScore: entity.totalScore as number,
          });
        }
      }

      // Sort by score descending and assign ranks
      const scores = Array.from(scoresMap.values());
      scores.sort((a, b) => b.totalScore - a.totalScore);
      const leaderboard = scores.slice(0, limit).map((s, i) => ({
        rank: i + 1,
        userId: s.userId,
        displayName: s.displayName,
        score: s.totalScore,
      }));

      return {
        jsonBody: { date: isAllTime ? 'alltime' : date, leaderboard },
      };
    } catch (error) {
      context.error('Error fetching leaderboard:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch leaderboard' },
      };
    }
  },
});

// Helper to update user stats
async function updateUserStats(
  userId: string,
  displayName: string,
  score: number,
  date: string
): Promise<void> {
  const client = getTableClient('users');

  try {
    // Try to get existing user
    const existingUser = await client.getEntity('user', userId);

    // Calculate new streak
    const lastPlayed = existingUser.lastPlayedDate as string;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const currentStreak = (existingUser.streak as number) || 0;
    const newStreak = lastPlayed === yesterdayStr ? currentStreak + 1 : 1;

    await client.upsertEntity({
      partitionKey: 'user',
      rowKey: userId,
      displayName,
      streak: newStreak,
      totalScore: ((existingUser.totalScore as number) || 0) + score,
      gamesPlayed: ((existingUser.gamesPlayed as number) || 0) + 1,
      highScore: Math.max((existingUser.highScore as number) || 0, score),
      lastPlayedDate: date,
    });
  } catch {
    // User doesn't exist, create new one
    await client.upsertEntity({
      partitionKey: 'user',
      rowKey: userId,
      displayName,
      streak: 1,
      totalScore: score,
      gamesPlayed: 1,
      highScore: score,
      lastPlayedDate: date,
      createdAt: new Date().toISOString(),
    });
  }
}

// Get user's game history
app.http('getUserGames', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users/{userId}/games',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const userId = request.params.userId;

    if (!isValidUserId(userId)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid userId' },
      };
    }

    // Verify authentication - users can only access their own data
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);
    if (!token) {
      return {
        status: 401,
        jsonBody: { error: 'Authentication required' },
      };
    }

    const verifiedUser = await verifyGoogleToken(token);
    if (!verifiedUser) {
      return {
        status: 401,
        jsonBody: { error: 'Invalid authentication token' },
      };
    }

    if (verifiedUser.userId !== userId) {
      return {
        status: 403,
        jsonBody: { error: 'Access denied' },
      };
    }

    const limitParam = request.query.get('limit') || '30';
    const limit = Math.min(Math.max(parseInt(limitParam, 10) || 30, 1), 100);

    try {
      const client = getTableClient('games');
      const games: Array<{
        date: string;
        totalScore: number;
        rounds: number[];
        completedAt: string;
        puzzleType: string;
      }> = [];

      // Use escaped userId in OData filter for extra safety
      const entities = client.listEntities({
        queryOptions: { filter: `PartitionKey eq '${escapeODataString(userId)}'` },
      });

      for await (const entity of entities) {
        games.push({
          date: entity.rowKey as string,
          totalScore: entity.totalScore as number,
          rounds: JSON.parse(entity.rounds as string),
          completedAt: entity.completedAt as string,
          puzzleType: (entity.puzzleType as string) || 'daily',
        });
      }

      // Sort by date descending (most recent first)
      games.sort((a, b) => b.date.localeCompare(a.date));

      return {
        jsonBody: { userId, games: games.slice(0, limit), total: games.length },
      };
    } catch (error) {
      context.error('Error fetching user games:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch user games' },
      };
    }
  },
});

// Check if user completed a specific date's puzzle
app.http('getUserGame', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users/{userId}/games/{date}',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const userId = request.params.userId;
    const date = request.params.date;

    if (!isValidUserId(userId)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid userId' },
      };
    }

    if (!date || !isValidDate(date)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid date format. Use YYYY-MM-DD.' },
      };
    }

    // Verify authentication - users can only access their own data
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);
    if (!token) {
      return {
        status: 401,
        jsonBody: { error: 'Authentication required' },
      };
    }

    const verifiedUser = await verifyGoogleToken(token);
    if (!verifiedUser) {
      return {
        status: 401,
        jsonBody: { error: 'Invalid authentication token' },
      };
    }

    if (verifiedUser.userId !== userId) {
      return {
        status: 403,
        jsonBody: { error: 'Access denied' },
      };
    }

    try {
      const client = getTableClient('games');
      const entity = await client.getEntity(userId, date);

      return {
        jsonBody: {
          completed: true,
          date: entity.rowKey as string,
          totalScore: entity.totalScore as number,
          rounds: JSON.parse(entity.rounds as string),
          completedAt: entity.completedAt as string,
        },
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          jsonBody: { completed: false, date },
        };
      }
      context.error('Error checking user game:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to check user game' },
      };
    }
  },
});

// Get user stats
app.http('getUserStats', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users/{userId}/stats',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const userId = request.params.userId;

    if (!isValidUserId(userId)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid userId' },
      };
    }

    // Verify authentication - users can only access their own data
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);
    if (!token) {
      return {
        status: 401,
        jsonBody: { error: 'Authentication required' },
      };
    }

    const verifiedUser = await verifyGoogleToken(token);
    if (!verifiedUser) {
      return {
        status: 401,
        jsonBody: { error: 'Invalid authentication token' },
      };
    }

    if (verifiedUser.userId !== userId) {
      return {
        status: 403,
        jsonBody: { error: 'Access denied' },
      };
    }

    try {
      const client = getTableClient('users');
      const entity = await client.getEntity('user', userId);

      return {
        jsonBody: {
          userId,
          displayName: entity.displayName as string,
          streak: entity.streak as number,
          totalScore: entity.totalScore as number,
          gamesPlayed: entity.gamesPlayed as number,
          highScore: entity.highScore as number,
          lastPlayedDate: entity.lastPlayedDate as string,
        },
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          jsonBody: {
            userId,
            displayName: 'Anonymous',
            streak: 0,
            totalScore: 0,
            gamesPlayed: 0,
            highScore: 0,
            lastPlayedDate: null,
          },
        };
      }
      context.error('Error fetching user stats:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch user stats' },
      };
    }
  },
});
