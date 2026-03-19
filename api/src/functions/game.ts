import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { extractBearerToken, verifyGoogleToken } from '../auth.js';
import { generatePersonalizedPuzzleForDate, generatePuzzleForDate, getTableClient, trackSeenLocations } from '../storage.js';

interface ScoreSubmission {
  date: string;
  userId: string;
  displayName: string;
  totalScore: number;
  rounds: number[];
  locationIds?: string[]; // Optional: track which locations were played
}

// Validation helpers
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DISPLAY_NAME_LENGTH = 50;
const MAX_SCORE = 25000; // 5 rounds * 5000 max per round
// Allow alphanumeric, hyphens, underscores, and periods (covers Google IDs and other OAuth providers)
const SAFE_USERID_REGEX = /^[a-zA-Z0-9._-]+$/;

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
    try {
      const body = (await request.json()) as ScoreSubmission;
      const { date, userId, displayName, totalScore, rounds } = body;

      // Validate required fields
      if (!date || !userId || totalScore === undefined) {
        return {
          status: 400,
          jsonBody: { error: 'Missing required fields: date, userId, totalScore' },
        };
      }

      // Validate date format
      if (!isValidDate(date)) {
        return {
          status: 400,
          jsonBody: { error: 'Invalid date format. Use YYYY-MM-DD.' },
        };
      }

      // Validate score is reasonable
      if (typeof totalScore !== 'number' || totalScore < 0 || totalScore > MAX_SCORE) {
        return {
          status: 400,
          jsonBody: { error: 'Invalid score' },
        };
      }

      // Check for auth token and validate if present
      const authHeader = request.headers.get('authorization');
      const token = extractBearerToken(authHeader);
      let verifiedUserId = userId;
      let verifiedDisplayName = sanitizeDisplayName(displayName);
      let isVerified = false;

      if (token) {
        const verifiedUser = await verifyGoogleToken(token);
        if (verifiedUser) {
          // Use the verified user's ID instead of the client-provided one
          verifiedUserId = verifiedUser.userId;
          verifiedDisplayName = sanitizeDisplayName(verifiedUser.name);
          isVerified = true;
        } else {
          // Token was provided but invalid
          return {
            status: 401,
            jsonBody: { error: 'Invalid authentication token' },
          };
        }
      }

      // Validate userId format
      if (!isValidUserId(verifiedUserId)) {
        return {
          status: 400,
          jsonBody: { error: 'Invalid userId' },
        };
      }

      const client = getTableClient('scores');
      const scoreEntity = {
        partitionKey: date,
        rowKey: verifiedUserId,
        displayName: verifiedDisplayName,
        totalScore,
        rounds: JSON.stringify(rounds),
        completedAt: new Date().toISOString(),
        isVerified,
      };

      await client.upsertEntity(scoreEntity);

      // Also save to games table (partitioned by userId for user queries)
      const gamesClient = getTableClient('games');
      await gamesClient.upsertEntity({
        partitionKey: verifiedUserId,
        rowKey: date,
        displayName: verifiedDisplayName,
        totalScore,
        rounds: JSON.stringify(rounds),
        completedAt: new Date().toISOString(),
        isVerified,
        puzzleType: 'daily',
      });

      // Update user stats
      await updateUserStats(verifiedUserId, verifiedDisplayName, totalScore, date);

      // Track seen locations for personalized puzzles (if locationIds provided)
      if (body.locationIds && body.locationIds.length > 0 && isVerified) {
        await trackSeenLocations(verifiedUserId, body.locationIds);
      }

      return {
        status: 201,
        jsonBody: { success: true, score: scoreEntity },
      };
    } catch (error) {
      context.error('Error submitting score:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to submit score' },
      };
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

    // Validate date format to prevent OData injection
    if (!isValidDate(date)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid date format. Use YYYY-MM-DD.' },
      };
    }

    const limitParam = request.query.get('limit') || '10';
    const limit = Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 100);

    try {
      const client = getTableClient('scores');
      const scores: Array<{ userId: string; displayName: string; score: number }> = [];

      // Query scores for this date (date is now validated)
      const entities = client.listEntities({
        queryOptions: { filter: `PartitionKey eq '${date}'` },
      });

      for await (const entity of entities) {
        scores.push({
          userId: entity.rowKey as string,
          displayName: entity.displayName as string,
          score: entity.totalScore as number,
        });
      }

      // Sort by score descending and assign ranks
      scores.sort((a, b) => b.score - a.score);
      const leaderboard = scores.slice(0, limit).map((s, i) => ({
        rank: i + 1,
        userId: s.userId,
        displayName: s.displayName,
        score: s.score,
      }));

      return {
        jsonBody: { date, leaderboard },
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
