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
  const TEST_USER_ID = 'smoke-test-user'; // matches the userId returned by the smoke bypass
  // Use a real Google token if provided, otherwise fall back to the local smoke secret.
  // The smoke secret is set in local.settings.json and only honoured when SMOKE_TEST_SECRET
  // is configured on the Functions host — it is never set in production.
  const TEST_AUTH_TOKEN = (process.env.TEST_AUTH_TOKEN?.trim()) ||
    (process.env.SMOKE_TEST_SECRET?.trim()) ||
    'smoke-test-secret-local';
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
    // Use a fixed past date to avoid re-run conflicts with today's real puzzle date.
    // The duplicate-prevention test relies on submitting twice to the same date.
    const SCORE_TEST_DATE = '2019-12-31';
    const validScorePayload = {
      date: SCORE_TEST_DATE,
      userId: TEST_USER_ID, // must match token userId returned by bypass
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

        // 201 on first run, 409 on subsequent runs (duplicate prevention is also correct)
        expect([201, 409]).toContain(status);
        if (status === 201) {
          expect(body.success).toBe(true);
          expect(body.score).toBeDefined();
          expect(body.score.totalScore).toBe(18500);
        }
      });

      it('should reject duplicate submission (same user/date)', async () => {
        // Ensure at least one submission exists first
        await makeRequest(`/scores`, {
          method: 'POST',
          body: JSON.stringify(validScorePayload),
          headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` },
        });

        // Second attempt must always be rejected
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

    describeAuth('Score appears on leaderboard after submission', () => {
      // Use a fixed past date so this submit is isolated from real daily puzzles.
      // userId must match what the smoke bypass token returns ('smoke-test-user').
      const smokeDate = '2020-01-01';
      const smokeUserId = TEST_USER_ID; // 'smoke-test-user' — matches bypass token
      const smokeScore = 15000;
      const smokeRounds = [3000, 3000, 3000, 3000, 3000];
      const smokeDisplayName = 'Leaderboard Smoke User';

      it('should submit a score and find it on the leaderboard', async () => {
        // Step 1: Submit score
        const submitRes = await makeRequest('/scores', {
          method: 'POST',
          body: JSON.stringify({
            date: smokeDate,
            userId: smokeUserId,
            displayName: smokeDisplayName,
            totalScore: smokeScore,
            rounds: smokeRounds,
          }),
          headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` },
        });

        // Accept 201 (new) or 409 (already submitted on a re-run)
        expect([201, 409]).toContain(submitRes.status);

        // Step 2: Read the leaderboard for that date
        const lbRes = await makeRequest(`/leaderboard/${smokeDate}`);

        expect(lbRes.status).toBe(200);
        expect(lbRes.body.date).toBe(smokeDate);
        expect(Array.isArray(lbRes.body.leaderboard)).toBe(true);

        // Step 3: Our submission must be present
        const entry = lbRes.body.leaderboard.find(
          (e: any) => e.userId === smokeUserId
        );
        expect(entry).toBeDefined();
        expect(entry.score).toBe(smokeScore);
        // displayName is set from the auth token (bypass returns 'Smoke Test User'),
        // so we just verify it's a non-empty string
        expect(typeof entry.displayName).toBe('string');
        expect(typeof entry.rank).toBe('number');
      }, 15000);

      it('should reflect score in all-time leaderboard after submission', async () => {
        // Depends on the submission from the previous test having run first.
        // Use the same smokeUserId so we can find it.
        const lbRes = await makeRequest('/leaderboard/alltime');

        expect(lbRes.status).toBe(200);
        expect(Array.isArray(lbRes.body.leaderboard)).toBe(true);

        const entry = lbRes.body.leaderboard.find(
          (e: any) => e.userId === smokeUserId
        );
        expect(entry).toBeDefined();
        expect(entry.score).toBeGreaterThanOrEqual(smokeScore);
      }, 15000);
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

  describe('Practice Puzzle (Personalized)', () => {
    it('should fetch a practice puzzle without userId', async () => {
      const { body, status } = await makeRequest('/puzzle/practice');

      expect(status).toBe(200);
      expect(body.rounds).toBeDefined();
      expect(body.rounds.length).toBe(5);
      expect(body.rounds[0]).toHaveProperty('clue');
      expect(body.rounds[0]).toHaveProperty('target');
    }, 10000);

    it('should fetch a practice puzzle with valid userId', async () => {
      const { body, status } = await makeRequest(`/puzzle/practice?userId=${TEST_USER_ID}`);

      expect(status).toBe(200);
      expect(body.rounds).toBeDefined();
      expect(body.rounds.length).toBe(5);
    });

    it('should reject invalid userId in practice puzzle', async () => {
      const { body, status } = await makeRequest('/puzzle/practice?userId=<script>bad</script>');

      expect(status).toBe(400);
      expect(body.error).toBeDefined();
    });

    it('should include bounds for area-based locations when present', async () => {
      const { body, status } = await makeRequest('/puzzle');

      expect(status).toBe(200);
      // If any round has bounds, validate structure
      const boundsRound = body.rounds.find((r: any) => r.bounds);
      if (boundsRound) {
        expect(boundsRound.bounds).toHaveProperty('nw');
        expect(boundsRound.bounds).toHaveProperty('se');
        expect(boundsRound.bounds.nw).toHaveProperty('lat');
        expect(boundsRound.bounds.nw).toHaveProperty('lng');
        expect(boundsRound.bounds.se).toHaveProperty('lat');
        expect(boundsRound.bounds.se).toHaveProperty('lng');
      }
    }, 10000);
  });

  describe('Clue Feedback', () => {
    it('should accept valid clue feedback without auth', async () => {
      const { body, status } = await makeRequest('/feedback/clues', {
        method: 'POST',
        body: JSON.stringify({
          puzzleDate: TEST_DATE,
          locationId: 'smoke-test-loc-' + Date.now(),
          feedback: 'hard',
          clue: 'Smoke test clue',
          country: 'Test Country',
        }),
      });

      expect(status).toBe(201);
      expect(body.success).toBe(true);
    });

    it('should accept all valid feedback ratings', async () => {
      const ratings = ['easy', 'hard', 'unclear'] as const;
      for (const rating of ratings) {
        const { status } = await makeRequest('/feedback/clues', {
          method: 'POST',
          body: JSON.stringify({
            puzzleDate: TEST_DATE,
            locationId: `smoke-rating-${rating}-${Date.now()}`,
            feedback: rating,
          }),
        });
        expect(status).toBe(201);
      }
    }, 15000);

    it('should reject feedback with invalid rating', async () => {
      const { body, status } = await makeRequest('/feedback/clues', {
        method: 'POST',
        body: JSON.stringify({
          puzzleDate: TEST_DATE,
          locationId: 'smoke-test-loc-invalid',
          feedback: 'very_hard', // Not a valid rating
        }),
      });

      expect(status).toBe(400);
      expect(body.code).toBe('INVALID_CLUE_FEEDBACK');
    });

    it('should reject feedback with missing required fields', async () => {
      const { body, status } = await makeRequest('/feedback/clues', {
        method: 'POST',
        body: JSON.stringify({
          puzzleDate: TEST_DATE,
          // Missing locationId and feedback
        }),
      });

      expect(status).toBe(400);
      expect(body.code).toBe('INVALID_CLUE_FEEDBACK');
    });
  });

  describe('User Profile & History (Auth Required)', () => {
    const FAKE_USER_ID = 'smoke-test-user-99999';

    it('should reject user games request without auth', async () => {
      const { body, status } = await makeRequest(`/users/${FAKE_USER_ID}/games`);

      expect(status).toBe(401);
      expect(body.error).toBeDefined();
    });

    it('should reject user stats request without auth', async () => {
      const { body, status } = await makeRequest(`/users/${FAKE_USER_ID}/stats`);

      expect(status).toBe(401);
      expect(body.error).toBeDefined();
    });

    it('should reject user game check request without auth', async () => {
      const { body, status } = await makeRequest(`/users/${FAKE_USER_ID}/games/${TEST_DATE}`);

      expect(status).toBe(401);
      expect(body.error).toBeDefined();
    });

    it('should reject invalid userId in user games route', async () => {
      // Must send auth header to pass the auth gate; invalid ID rejected first
      const { status } = await makeRequest(`/users/<bad-id>/games`, {
        headers: { Authorization: 'Bearer fake-token' },
      });

      // 400 for invalid id (evaluated before auth token verification)
      expect(status).toBe(400);
    });

    it('should reject invalid date in user game check', async () => {
      const { status } = await makeRequest(`/users/${FAKE_USER_ID}/games/not-a-date`, {
        headers: { Authorization: 'Bearer fake-token' },
      });

      expect(status).toBe(400);
    });

    describeAuth('Authenticated user endpoints', () => {
      it('should return user games list', async () => {
        const { body, status } = await makeRequest(
          `/users/${TEST_USER_ID}/games`,
          { headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` } }
        );

        // 200 or 403 if token userId doesn't match TEST_USER_ID
        expect([200, 403]).toContain(status);
        if (status === 200) {
          expect(body.userId).toBeDefined();
          expect(Array.isArray(body.games)).toBe(true);
        }
      });

      it('should return user stats (or empty defaults for new user)', async () => {
        const { body, status } = await makeRequest(
          `/users/${TEST_USER_ID}/stats`,
          { headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` } }
        );

        expect([200, 403]).toContain(status);
        if (status === 200) {
          expect(body.userId).toBeDefined();
          expect(typeof body.gamesPlayed).toBe('number');
          expect(typeof body.totalScore).toBe('number');
          expect(typeof body.streak).toBe('number');
        }
      });

      it('should return completed: false for a date not yet played', async () => {
        const futureDate = '2099-12-31';
        const { body, status } = await makeRequest(
          `/users/${TEST_USER_ID}/games/${futureDate}`,
          { headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}` } }
        );

        expect([200, 403]).toContain(status);
        if (status === 200) {
          // Should return { completed: false } for unplayed date
          expect(body.completed).toBe(false);
          expect(body.date).toBe(futureDate);
        }
      });
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
    }, 15000);
  });
});
