import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { generatePuzzleForDate, getTableClient } from '../storage.js';

interface ScoreSubmission {
  date: string;
  userId: string;
  displayName: string;
  totalScore: number;
  rounds: number[];
}

// Get daily puzzle - dynamically generated from locations
app.http('getPuzzle', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'puzzle/{date?}',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const date = request.params.date || new Date().toISOString().split('T')[0];

    try {
      // Generate puzzle dynamically from locations table
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

// Submit score
app.http('submitScore', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'scores',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as ScoreSubmission;
      const { date, userId, displayName, totalScore, rounds } = body;

      if (!date || !userId || totalScore === undefined) {
        return {
          status: 400,
          jsonBody: { error: 'Missing required fields: date, userId, totalScore' },
        };
      }

      const client = getTableClient('scores');
      const scoreEntity = {
        partitionKey: date,
        rowKey: userId,
        displayName: displayName || 'Anonymous',
        totalScore,
        rounds: JSON.stringify(rounds),
        completedAt: new Date().toISOString(),
      };

      await client.upsertEntity(scoreEntity);

      // Update user stats
      await updateUserStats(userId, displayName, totalScore, date);

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
    const limit = parseInt(request.query.get('limit') || '10', 10);

    try {
      const client = getTableClient('scores');
      const scores: Array<{ userId: string; displayName: string; score: number }> = [];

      // Query scores for this date
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
