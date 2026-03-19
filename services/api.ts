import { LeaderboardEntry, Puzzle } from '@/types/game';

// API base URL - update this for production
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:7071/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
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
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('API Error:', error);
    return { error: 'Network error' };
  }
}

// Get daily puzzle from API
export async function fetchPuzzle(date?: string): Promise<ApiResponse<Puzzle>> {
  const endpoint = date ? `/puzzle/${date}` : '/puzzle';
  return fetchApi<Puzzle>(endpoint);
}

// Get personalized puzzle for Play Modes (excludes locations user has seen)
export async function fetchPersonalizedPuzzle(userId?: string): Promise<ApiResponse<Puzzle>> {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
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
