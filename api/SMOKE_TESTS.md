# Smoke Tests - PinPoint API

Automated tests for core user journeys and API resilience.

## Tests Included
### ✅ Daily Puzzle Access (Guest)
- Fetch today's puzzle without auth
- Fetch puzzle for specific date
- Reject invalid date formats

### ✅ Practice Puzzle (Personalized)
- Fetch practice puzzle with no userId
- Fetch practice puzzle with valid userId
- Reject invalid userId
- Validate `bounds` field structure when area-based locations appear

### ✅ Score Submission & Duplicate Prevention
- Accept valid score with auth token
- Reject submission without auth
- **Prevent duplicate submissions** (same user/date = 409 error)
- Validate score bounds (round: 0-5000, total: 0-25000)
- Validate round count (must be exactly 5)
- Enforce payload consistency (rounds sum ≈ total score)
- Reject invalid date formats

### ✅ Clue Feedback
- Accept valid feedback without auth (easy/hard/unclear)
- Validate all three rating values are accepted
- Reject invalid feedback rating
- Reject missing required fields

### ✅ Leaderboard Retrieval
- Fetch daily leaderboard
- Fetch by specific date
- Fetch all-time leaderboard
- Respect limit parameter
- Reject invalid dates

### ✅ User Profile & History
- Reject unauthenticated requests to `/users/{id}/games`, `/users/{id}/stats`, `/users/{id}/games/{date}`
- Reject invalid userId (400)
- Reject invalid date in game check (400)
- Authenticated: fetch games list, verify shape
- Authenticated: fetch stats with numeric fields (or empty defaults for new user)
- Authenticated: check unplayed date returns `completed: false`

### ✅ Error Handling
- Missing required fields (400 + error code)
- Invalid formats (400 + error code)
- Verify all errors include machine-readable codes

### ✅ Telemetry Ingestion
- Accept valid telemetry payloads at `/telemetry`
- Reject invalid event names with `INVALID_EVENT_NAME`

### ✅ Full Journey Integration
- Complete guest daily play flow validation

## Running Tests Locally

### Prerequisites
```bash
cd api
npm install
```

### Run All Smoke Tests
```bash
npm run test:smoke
```

### One Command: Start API + Run Smoke Tests
```bash
npm run test:smoke:local
```

### Run Tests in Watch Mode (for development)
```bash
npm run test:watch
```

### Run with Coverage Report
```bash
npm run test:coverage
```

### Run All Tests
```bash
npm test
```

## Running Tests Against Live API

### 1. Start Your Local API
```bash
# Terminal 1: Start the functions runtime
npm run start
# Runs on http://localhost:7071/api
```

### 2. Run Tests (Terminal 2)
```bash
cd api
npm run test:smoke
```

### 3. Against Remote API (Optional)
```bash
API_URL=https://your-function-app.azurewebsites.net/api npm run test:smoke
```

## Test Environment Variables

| Variable | Default | Usage |
|----------|---------|-------|
| `API_URL` | `http://localhost:7071/api` | API base URL for testing |
| `TEST_AUTH_TOKEN` | not set | Bearer token for auth-required tests |

### Example: Custom Test Setup
```bash
API_URL=https://staging-api.example.com \
TEST_AUTH_TOKEN=your-real-token \
npm run test:smoke
```

## CI/CD Integration

### GitHub Actions (Optional)
A workflow file is available at `.github/workflows/smoke-tests.yml` to run tests on every push/PR:

```bash
# This runs automatically on:
# - Push to main/develop branches
# - Pull requests
# - Can also be triggered manually
```

## Expected Output

```
 PASS  src/__tests__/smoke.test.ts (2.5s)
  PinPoint Core Journey Smoke Tests
    Daily Puzzle Access (Guest)
      ✓ should fetch today's puzzle without authentication (25ms)
      ✓ should fetch puzzle for specific date (22ms)
      ✓ should reject invalid date format (15ms)
    Score Submission & Duplicate Prevention
      ✓ should accept valid score submission with auth (30ms)
      ✓ should reject score without auth token (18ms)
      ✓ should reject duplicate submission (same user/date) (35ms)
      ✓ should reject invalid total score (20ms)
      ✓ should reject invalid round count (18ms)
      ✓ should reject out-of-bounds round score (19ms)
      ✓ should reject payload consistency mismatch (21ms)
    Leaderboard Retrieval
      ✓ should fetch leaderboard for today (28ms)
      ✓ should fetch leaderboard for specific date (24ms)
      ✓ should fetch all-time leaderboard (26ms)
      ✓ should reject invalid date format (16ms)
      ✓ should respect limit parameter (22ms)
    Error Handling & Resilience
      ✓ should handle missing required fields gracefully (17ms)
      ✓ should handle invalid date format in submission (18ms)
      ✓ should use error codes for client differentiation (19ms)
    Integration: Full Daily Play Flow
      ✓ should complete full guest daily puzzle journey (45ms)

Tests:       18 passed, 18 total
Snapshots:   0 total
Time:        2.847s
```

## Troubleshooting

### Tests Fail with "Cannot POST /api/scores"
- **Cause**: Azure Functions not running
- **Fix**: Run `npm run start` in the api directory first

### Tests Fail with "ECONNREFUSED"
- **Cause**: Wrong API URL
- **Fix**: Check API_URL environment variable: `echo $API_URL`

### Auth Tests Skipped
- **Cause**: `TEST_AUTH_TOKEN` is not set
- **Behavior**: Smoke suite automatically skips auth-required tests and still runs all anonymous/public-flow tests
- **Fix**: Set a valid token to include auth-required smoke coverage

### "Module not found: ts-jest"
- **Cause**: Dependencies not installed
- **Fix**: Run `npm install` in api directory

## Next Steps

1. ✅ **Local Validation**: Run tests against local API
2. ✅ **Pre-Deployment**: Include in your deployment checklist
3. ⚡ **CI/CD**: Enable GitHub Actions workflow for automated testing
4. 📊 **Metrics**: Monitor test pass rates in your deployment pipeline
5. 🔄 **Monitoring**: Add production health checks based on these journeys

## Notes

- Tests use unique user IDs (e.g., `test-smoke-user-{timestamp}`) to avoid conflicts
- Duplicate submission test creates real data; clean up via Azure Storage Explorer if needed
- Auth tests use `TEST_AUTH_TOKEN`; for real Google tokens, export a valid token from your auth service
- Auth-required tests are automatically skipped when `TEST_AUTH_TOKEN` is not provided
- Tests are read-mostly (safe to run against production, but submission tests will write data)

