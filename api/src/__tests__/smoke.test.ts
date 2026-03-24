/// <reference types="jest" />
/**
 * Smoke Tests: Core Journey Validation
 * 
 * Tests critical paths:
 * - Guest access to daily puzzles (no auth required)
 * - Score submission with duplicate prevention
 * - Leaderboard retrieval
 * - Error handling (auth failures, invalid data)
 */

describe('PinPoint Core Journey Smoke Tests', () => {
  const API_BASE = process.env.API_URL || 'http://localhost:7071/api';
  const TEST_DATE = new Date().toISOString().split('T')[0];
  const TEST_USER_ID = 'test-smoke-user-' + Date.now();
  const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN?.trim();
  const HAS_AUTH_TOKEN = Boolean(TEST_AUTH_TOKEN);
  const describeAuth = HAS_AUTH_TOKEN ? describe : describe.skip;

  // Helper: Make API request
  async function makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ body: any; status: number }> {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    const body = await response.json().catch(() => null);
    return { body, status: response.status };
  }

  describe('Daily Puzzle Access (Guest)', () => {
    it('should fetch today\'s puzzle without authentication', async () => {
      const { body, status } = await makeRequest(`/puzzle`);

      expect(status).toBe(200);
      expect(body).toBeDefined();
      expect(body.rounds).toBeDefined();
      expect(body.rounds.length).toBe(5);
      expect(body.rounds[0]).toHaveProperty('clue');
      expect(body.rounds[0]).toHaveProperty('target');
      expect(body.rounds[0].target).toHaveProperty('lat');
      expect(body.rounds[0].target).toHaveProperty('lng');
    });

    it('should fetch puzzle for specific date', async () => {
      const testDate = '2025-01-15';
      const { body, status } = await makeRequest(`/puzzle/${testDate}`);

      expect(status).toBe(200);
      expect(body.rounds).toBeDefined();
      expect(body.rounds.length).toBe(5);
    });

    it('should reject invalid date format', async () => {
      const { body, status } = await makeRequest(`/puzzle/invalid-date`);

      expect(status).toBe(400);
      expect(body.error).toBeDefined();
    });
  });

  describe('Score Submission & Duplicate Prevention', () => {
    const validScorePayload = {
      date: TEST_DATE,
      userId: TEST_USER_ID,
      displayName: 'Smoke Test User',
      totalScore: 18500,
      rounds: [4000, 3500, 3500, 4000, 3500],
      locationIds: ['loc-1', 'loc-2', 'loc-3', 'loc-4', 'loc-5'],
    };

    describeAuth('Authenticated score submissions', () => {
      it('should accept valid score submission with auth', async () => {
        const { body, status } = await makeRequest(`/scores`, {
          method: 'POST',
          body: JSON.stringify(validScorePayload),
          headers: {
            Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
          },
        });

        expect(status).toBe(201);
        expect(body.success).toBe(true);
        expect(body.score).toBeDefined();
        expect(body.score.totalScore).toBe(18500);
      });

      it('should reject duplicate submission (same user/date)', async () => {
        // First submission
        await makeRequest(`/scores`, {
          method: 'POST',
          body: JSON.stringify(validScorePayload),
          headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` },
        });

        // Duplicate attempt
        const { body, status } = await makeRequest(`/scores`, {
          method: 'POST',
          body: JSON.stringify(validScorePayload),
          headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` },
        });

        expect(status).toBe(409);
        expect(body.code).toBe('DUPLICATE_SUBMISSION');
      });
    });

    it('should reject score without auth token', async () => {
      const { body, status } = await makeRequest(`/scores`, {
        method: 'POST',
        body: JSON.stringify(validScorePayload),
      });

      expect(status).toBe(401);
      expect(body.code).toBe('AUTH_REQUIRED');
    });

    it('should reject invalid total score', async () => {
      const { body, status } = await makeRequest(`/scores`, {
        method: 'POST',
        body: JSON.stringify({
          ...validScorePayload,
          userId: TEST_USER_ID + '-invalid-score',
          totalScore: 30000, // Exceeds max of 25000
        }),
      });

      expect(status).toBe(400);
      expect(body.code).toBe('INVALID_TOTAL_SCORE');
    });

    it('should reject invalid round count', async () => {
      const { body, status } = await makeRequest(`/scores`, {
        method: 'POST',
        body: JSON.stringify({
          ...validScorePayload,
          userId: TEST_USER_ID + '-invalid-rounds',
          rounds: [3000, 3000, 3000], // Should be 5
        }),
      });

      expect(status).toBe(400);
      expect(body.code).toBe('INVALID_ROUNDS_COUNT');
    });

    it('should reject out-of-bounds round score', async () => {
      const { body, status } = await makeRequest(`/scores`, {
        method: 'POST',
        body: JSON.stringify({
          ...validScorePayload,
          userId: TEST_USER_ID + '-invalid-round-score',
          rounds: [6000, 3000, 3000, 3000, 3000], // First round > 5000 max
        }),
      });

      expect(status).toBe(400);
      expect(body.code).toBe('INVALID_ROUND_SCORE');
    });

    it('should reject payload consistency mismatch', async () => {
      const { body, status } = await makeRequest(`/scores`, {
        method: 'POST',
        body: JSON.stringify({
          ...validScorePayload,
          userId: TEST_USER_ID + '-mismatch',
          totalScore: 5000, // Doesn't match round sum (18500)
        }),
      });

      expect(status).toBe(400);
      expect(body.code).toBe('DATE_SCORE_MISMATCH');
    });
  });

  describe('Leaderboard Retrieval', () => {
    it('should fetch leaderboard for today', async () => {
      const { body, status } = await makeRequest(`/leaderboard`);

      expect(status).toBe(200);
      expect(body.date).toBeDefined();
      expect(body.leaderboard).toBeDefined();
      expect(Array.isArray(body.leaderboard)).toBe(true);
      
      // If entries exist, validate format
      if (body.leaderboard.length > 0) {
        const entry = body.leaderboard[0];
        expect(entry.rank).toBeDefined();
        expect(entry.userId).toBeDefined();
        expect(entry.displayName).toBeDefined();
        expect(entry.score).toBeDefined();
      }
    });

    it('should fetch leaderboard for specific date', async () => {
      const { body, status } = await makeRequest(`/leaderboard/2025-01-15`);

      expect(status).toBe(200);
      expect(body.date).toBe('2025-01-15');
      expect(body.leaderboard).toBeDefined();
    });

    it('should fetch all-time leaderboard', async () => {
      const { body, status } = await makeRequest(`/leaderboard/alltime`);

      expect(status).toBe(200);
      expect(body.date).toBe('alltime');
      expect(body.leaderboard).toBeDefined();
    });

    it('should reject invalid date format', async () => {
      const { body, status } = await makeRequest(`/leaderboard/not-a-date`);

      expect(status).toBe(400);
      expect(body.error).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      const { body, status } = await makeRequest(`/leaderboard?limit=5`);

      expect(status).toBe(200);
      expect(body.leaderboard.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Error Handling & Resilience', () => {
    it('should handle missing required fields gracefully', async () => {
      const { body, status } = await makeRequest(`/scores`, {
        method: 'POST',
        body: JSON.stringify({
          userId: TEST_USER_ID,
          // Missing: date, totalScore, rounds
        }),
      });

      expect(status).toBe(400);
      expect(body.code).toBe('MISSING_REQUIRED_FIELDS');
      expect(body.error).toBeDefined();
    });

    it('should handle invalid date format in submission', async () => {
      const { body, status } = await makeRequest(`/scores`, {
        method: 'POST',
        body: JSON.stringify({
          date: '15-01-2025', // Wrong format
          userId: TEST_USER_ID + '-bad-date',
          totalScore: 5000,
          rounds: [1000, 1000, 1000, 1000, 1000],
        }),
      });

      expect(status).toBe(400);
      expect(body.code).toBe('INVALID_DATE_FORMAT');
    });

    it('should use error codes for client differentiation', async () => {
      // Test that all error responses include a machine-readable code
      const { body, status } = await makeRequest(`/scores`, {
        method: 'POST',
        body: JSON.stringify({ userId: 'test' }),
      });

      if (status >= 400) {
        expect(body.code).toBeDefined();
        expect(body.error).toBeDefined();
      }
    });
  });

  describe('Telemetry Ingestion', () => {
    it('should accept valid telemetry event payload', async () => {
      const { body, status } = await makeRequest('/telemetry', {
        method: 'POST',
        body: JSON.stringify({
          name: 'daily_puzzle_fallback_used',
          timestamp: new Date().toISOString(),
          payload: {
            appVersion: '1.0.0-test',
            sessionId: 'smoke-session',
            platform: 'test',
            hasUser: false,
            retryCount: 1,
          },
        }),
      });

      expect(status).toBe(202);
      expect(body.success).toBe(true);
      expect(typeof body.accepted).toBe('boolean');
    });

    it('should reject telemetry event without valid name', async () => {
      const { body, status } = await makeRequest('/telemetry', {
        method: 'POST',
        body: JSON.stringify({
          name: '',
          timestamp: new Date().toISOString(),
          payload: { test: true },
        }),
      });

      expect(status).toBe(400);
      expect(body.code).toBe('INVALID_EVENT_NAME');
    });
  });

  describe('Integration: Full Daily Play Flow', () => {
    it('should complete full guest daily puzzle journey', async () => {
      // Step 1: Fetch puzzle
      const puzzleRes = await makeRequest(`/puzzle`);
      expect(puzzleRes.status).toBe(200);
      expect(puzzleRes.body.rounds.length).toBe(5);

      // Step 2: Simulate playing and scoring
      const score = {
        date: TEST_DATE,
        userId: 'guest-' + Date.now(),
        displayName: 'Guest Player',
        totalScore: 12000,
        rounds: [2500, 2300, 2500, 2400, 2300],
      };

      // Step 3: Download appears to require auth per new spec
      // (guests can play/see results locally, but not sync)
      // This test validates that without auth, sync is rejected properly
      const submitRes = await makeRequest(`/scores`, {
        method: 'POST',
        body: JSON.stringify(score),
      });

      expect(submitRes.status).toBe(401);
      expect(submitRes.body.code).toBe('AUTH_REQUIRED');
    });
  });
});
