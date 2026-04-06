export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  nw: Coordinates; // Northwest corner
  se: Coordinates; // Southeast corner
}

export type ClueFeedbackRating = 'easy' | 'hard' | 'unclear';

export type Category = 'places' | 'questions' | 'geography';

export interface Round {
  id: number;
  locationId?: string; // Actual location ID for tracking seen locations
  clue: string;
  category: Category;
  type: 'landmark' | 'city' | 'country' | 'region' | 'trivia' | 'mountain' | 'river' | 'lake' | 'desert' | 'island' | 'ocean';
  difficulty: 'easy' | 'medium' | 'hard';
  target: Coordinates; // Center point or primary marker
  bounds?: BoundingBox; // Optional area bounds (for large geographic features like Great Barrier Reef, Amazon River)
  country: string;
  answer?: string; // For trivia questions, the name of the place
  acceptRadius?: number; // km - for country/region type clues (deprecated: use bounds instead)
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
  // Set synchronously when the last daily-puzzle round is submitted, so the
  // home screen can check it instantly without waiting on async storage writes.
  lastCompletedDate: string | null;
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
  medium: 1.5;
  hard: 2;
};

export const DIFFICULTY_MULTIPLIERS: Record<string, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
};