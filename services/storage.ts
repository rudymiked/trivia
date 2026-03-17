import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  LAST_PLAYED_DATE: 'pinpoint_last_played_date',
  STREAK: 'pinpoint_streak',
  TOTAL_SCORE: 'pinpoint_total_score',
  GAMES_PLAYED: 'pinpoint_games_played',
  HIGH_SCORE: 'pinpoint_high_score',
} as const;

export interface UserProgress {
  lastPlayedDate: string | null;
  streak: number;
  totalScore: number;
  gamesPlayed: number;
  highScore: number;
}

// Web fallback for AsyncStorage
const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  },
};

const storage = Platform.OS === 'web' ? webStorage : AsyncStorage;

export async function getUserProgress(): Promise<UserProgress> {
  try {
    const [lastPlayed, streak, totalScore, gamesPlayed, highScore] = await Promise.all([
      storage.getItem(STORAGE_KEYS.LAST_PLAYED_DATE),
      storage.getItem(STORAGE_KEYS.STREAK),
      storage.getItem(STORAGE_KEYS.TOTAL_SCORE),
      storage.getItem(STORAGE_KEYS.GAMES_PLAYED),
      storage.getItem(STORAGE_KEYS.HIGH_SCORE),
    ]);

    return {
      lastPlayedDate: lastPlayed,
      streak: streak ? parseInt(streak, 10) : 0,
      totalScore: totalScore ? parseInt(totalScore, 10) : 0,
      gamesPlayed: gamesPlayed ? parseInt(gamesPlayed, 10) : 0,
      highScore: highScore ? parseInt(highScore, 10) : 0,
    };
  } catch {
    return {
      lastPlayedDate: null,
      streak: 0,
      totalScore: 0,
      gamesPlayed: 0,
      highScore: 0,
    };
  }
}

export async function saveGameResult(
  date: string,
  score: number,
  previousLastPlayed: string | null
): Promise<void> {
  const progress = await getUserProgress();

  // Calculate streak
  let newStreak = 1;
  if (previousLastPlayed) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (previousLastPlayed === yesterdayStr) {
      newStreak = progress.streak + 1;
    }
  }

  // Update high score
  const newHighScore = Math.max(progress.highScore, score);

  await Promise.all([
    storage.setItem(STORAGE_KEYS.LAST_PLAYED_DATE, date),
    storage.setItem(STORAGE_KEYS.STREAK, String(newStreak)),
    storage.setItem(STORAGE_KEYS.TOTAL_SCORE, String(progress.totalScore + score)),
    storage.setItem(STORAGE_KEYS.GAMES_PLAYED, String(progress.gamesPlayed + 1)),
    storage.setItem(STORAGE_KEYS.HIGH_SCORE, String(newHighScore)),
  ]);
}
