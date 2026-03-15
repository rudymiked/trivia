import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer } from '../cosmos.js';

interface ScoreSubmission {
  date: string;
  userId: string;
  displayName: string;
  totalScore: number;
  rounds: number[];
}

// Get daily puzzle
app.http('getPuzzle', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'puzzle/{date?}',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const date = request.params.date || new Date().toISOString().split('T')[0];

    try {
      const container = getContainer('puzzles');
      const { resource } = await container.item(date, date).read();

      if (!resource) {
        return {
          status: 404,
          jsonBody: { error: 'Puzzle not found for this date' },
        };
      }

      return {
        jsonBody: resource,
      };
    } catch (error) {
      context.error('Error fetching puzzle:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch puzzle' },
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

      const container = getContainer('scores');
      const scoreDoc = {
        id: `${userId}_${date}`,
        date,
        userId,
        displayName: displayName || 'Anonymous',
        totalScore,
        rounds,
        completedAt: new Date().toISOString(),
      };

      await container.items.upsert(scoreDoc);

      // Update user stats
      await updateUserStats(userId, displayName, totalScore, date);

      return {
        status: 201,
        jsonBody: { success: true, score: scoreDoc },
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
      const container = getContainer('scores');
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.date = @date ORDER BY c.totalScore DESC OFFSET 0 LIMIT @limit',
          parameters: [
            { name: '@date', value: date },
            { name: '@limit', value: limit },
          ],
        })
        .fetchAll();

      const leaderboard = resources.map((score, index) => ({
        rank: index + 1,
        userId: score.userId,
        displayName: score.displayName,
        score: score.totalScore,
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
  const container = getContainer('users');

  try {
    const { resource: existingUser } = await container.item(userId, userId).read();

    if (existingUser) {
      // Calculate new streak
      const lastPlayed = existingUser.lastPlayedDate;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const newStreak = lastPlayed === yesterdayStr ? existingUser.streak + 1 : 1;

      await container.items.upsert({
        ...existingUser,
        displayName,
        streak: newStreak,
        totalScore: existingUser.totalScore + score,
        gamesPlayed: existingUser.gamesPlayed + 1,
        highScore: Math.max(existingUser.highScore || 0, score),
        lastPlayedDate: date,
      });
    } else {
      // Create new user
      await container.items.create({
        id: userId,
        displayName,
        streak: 1,
        totalScore: score,
        gamesPlayed: 1,
        highScore: score,
        lastPlayedDate: date,
        createdAt: new Date().toISOString(),
      });
    }
  } catch {
    // User doesn't exist, create new one
    await container.items.create({
      id: userId,
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
