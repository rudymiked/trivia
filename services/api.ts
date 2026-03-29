import { ClueFeedbackRating, LeaderboardEntry, Puzzle } from '@/types/game';

// API base URL - update this for production
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:7071/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  errorCode?: string;
  status?: number;
}

function mapApiErrorMessage(status: number, code?: string, fallback?: string): string {
  if (code === 'DUPLICATE_SUBMISSION') {
    return 'Score already submitted for today.';
  }

  if (code === 'AUTH_REQUIRED' || code === 'INVALID_AUTH_TOKEN') {
    return 'Please sign in again to sync your score.';
  }

  if (code === 'ADMIN_ACCESS_DENIED') {
    return 'Your account is not allowed to access this admin report.';
  }

  if (code === 'DATE_SCORE_MISMATCH' || code === 'INVALID_TOTAL_SCORE' || code === 'INVALID_ROUND_SCORE') {
    return 'Invalid score payload. Please try again.';
  }

  if (status >= 500) {
    return 'Server error. Please try again shortly.';
  }

  return fallback || `HTTP ${status}`;
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorCode = typeof errorData.code === 'string' ? errorData.code : undefined;
      const rawError = typeof errorData.error === 'string' ? errorData.error : undefined;

      return {
        error: mapApiErrorMessage(response.status, errorCode, rawError),
        errorCode,
        status: response.status,
      };
    }

    const data = await response.json();
    return { data, status: response.status };
  } catch (error) {
    console.error('API Error:', error);
    return { error: 'Network error', errorCode: 'NETWORK_ERROR' };
  }
}

// Get daily puzzle from API
export async function fetchPuzzle(date?: string): Promise<ApiResponse<Puzzle>> {
  const endpoint = date ? `/puzzle/${date}` : '/puzzle';
  return fetchApi<Puzzle>(endpoint);
}

// Get personalized puzzle for Play Modes (excludes locations user has seen)
export async function fetchPersonalizedPuzzle(
  userId?: string,
  category?: string,
  difficulty: 'all' | 'easy' | 'medium' | 'hard' = 'all'
): Promise<ApiResponse<Puzzle>> {
  const searchParams = new URLSearchParams();
  if (userId) {
    searchParams.set('userId', userId);
  }
  if (category && category !== 'all' && category !== 'random') {
    searchParams.set('category', category);
  }
  if (difficulty !== 'all') {
    searchParams.set('difficulty', difficulty);
  }

  const params = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return fetchApi<Puzzle>(`/puzzle/practice${params}`);
}

// Submit score to API
export async function submitScore(
  date: string,
  userId: string,
  displayName: string,
  totalScore: number,
  rounds: number[],
  authToken?: string,
  locationIds?: string[]
): Promise<ApiResponse<{ success: boolean }>> {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  return fetchApi('/scores', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      date,
      userId,
      displayName,
      totalScore,
      rounds,
      locationIds,
    }),
  });
}

// Get leaderboard from API
export async function fetchLeaderboard(
  date?: string,
  limit = 10
): Promise<ApiResponse<{ date: string; leaderboard: LeaderboardEntry[] }>> {
  const endpoint = date
    ? `/leaderboard/${date}?limit=${limit}`
    : `/leaderboard?limit=${limit}`;
  return fetchApi(endpoint);
}

// Get all-time leaderboard from API
export async function fetchAllTimeLeaderboard(
  limit = 10
): Promise<ApiResponse<{ date: string; leaderboard: LeaderboardEntry[] }>> {
  return fetchApi(`/leaderboard/alltime?limit=${limit}`);
}

// Check if API is available
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/puzzle`, {
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// User game data types
export interface UserGame {
  date: string;
  totalScore: number;
  rounds: number[];
  completedAt: string;
  puzzleType: string;
}

export interface UserStats {
  userId: string;
  displayName: string;
  streak: number;
  totalScore: number;
  gamesPlayed: number;
  highScore: number;
  lastPlayedDate: string | null;
}

export interface UserGameCheck {
  completed: boolean;
  date: string;
  totalScore?: number;
  rounds?: number[];
  completedAt?: string;
}

// Get user's game history
export async function fetchUserGames(
  userId: string,
  authToken: string,
  limit = 30
): Promise<ApiResponse<{ userId: string; games: UserGame[]; total: number }>> {
  return fetchApi(`/users/${encodeURIComponent(userId)}/games?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
}

// Check if user completed a specific date's puzzle
export async function checkUserGame(
  userId: string,
  date: string,
  authToken: string
): Promise<ApiResponse<UserGameCheck>> {
  return fetchApi(`/users/${encodeURIComponent(userId)}/games/${date}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
}

// Get user stats
export async function fetchUserStats(
  userId: string,
  authToken: string
): Promise<ApiResponse<UserStats>> {
  return fetchApi(`/users/${encodeURIComponent(userId)}/stats`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
}

export interface TelemetryEventPayload {
  name: string;
  timestamp: string;
  payload: Record<string, string | number | boolean | null>;
}

export interface ClueFeedbackSubmission {
  puzzleDate: string;
  locationId: string;
  feedback: ClueFeedbackRating;
  clue: string;
  country: string;
  answer?: string;
}

export interface LowRatedClueSummary {
  locationId: string;
  clue: string;
  country: string;
  answer?: string;
  easyCount: number;
  hardCount: number;
  unclearCount: number;
  lowRatingCount: number;
  lastPuzzleDate?: string;
  lastSubmittedAt?: string;
}

export async function sendTelemetryEvent(
  event: TelemetryEventPayload
): Promise<ApiResponse<{ success: boolean; accepted: boolean }>> {
  return fetchApi('/telemetry', {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function submitClueFeedback(
  feedback: ClueFeedbackSubmission
): Promise<ApiResponse<{ success: boolean }>> {
  return fetchApi('/feedback/clues', {
    method: 'POST',
    body: JSON.stringify(feedback),
  });
}

export async function fetchLowRatedClues(
  authToken: string,
  limit = 25,
  minCount = 1
): Promise<ApiResponse<{ clues: LowRatedClueSummary[]; count: number }>> {
  return fetchApi(`/manage/clue-feedback/low?limit=${limit}&minCount=${minCount}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
}
