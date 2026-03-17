export interface Coordinates {
  lat: number;
  lng: number;
}

export type Category = 'places' | 'questions' | 'geography';

export interface Round {
  id: number;
  clue: string;
  category: Category;
  type: 'landmark' | 'city' | 'country' | 'region' | 'trivia' | 'mountain' | 'river' | 'lake' | 'desert' | 'island' | 'ocean';
  difficulty: 'easy' | 'medium' | 'hard';
  target: Coordinates;
  country: string;
  answer?: string; // For trivia questions, the name of the place
  acceptRadius?: number; // km - for country/region type clues
  multiplier?: number; // Difficulty multiplier from API
}

export interface Puzzle {
  id: string;
  date: string;
  rounds: Round[];
}

export interface RoundResult {
  roundId: number;
  guess: Coordinates;
  target: Coordinates;
  distanceKm: number;
  score: number;
  multiplier: number;
}

export interface GameState {
  puzzle: Puzzle | null;
  currentRound: number;
  results: RoundResult[];
  isComplete: boolean;
  totalScore: number;
}

export interface UserStats {
  id: string;
  displayName: string;
  streak: number;
  totalScore: number;
  gamesPlayed: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  score: number;
  rank: number;
}

export type DifficultyMultiplier = {
  easy: 1;
  medium: 2;
  hard: 3;
};

export const DIFFICULTY_MULTIPLIERS: DifficultyMultiplier = {
  easy: 1,
  medium: 2,
  hard: 3,
};
