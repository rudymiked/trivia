import {
    Coordinates,
    DIFFICULTY_MULTIPLIERS,
    GameState,
    Puzzle,
    RoundResult,
} from '@/types/game';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Haversine formula to calculate distance between two coordinates
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Calculate score based on distance (0-100)
export function calculateScore(distanceKm: number): number {
  // Perfect score at 0km, score decreases as distance increases
  // 5000km away = 0 points
  const maxDistance = 5000;
  const score = Math.max(0, 100 - (distanceKm / maxDistance) * 100);
  return Math.round(score);
}

interface GameStore extends GameState {
  // Actions
  startGame: (puzzle: Puzzle) => void;
  submitGuess: (guess: Coordinates) => RoundResult;
  nextRound: () => void;
  resetGame: () => void;
  getCurrentRoundData: () => Puzzle['rounds'][0] | null;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      puzzle: null,
      currentRound: 0,
      results: [],
      isComplete: false,
      totalScore: 0,

      startGame: (puzzle: Puzzle) => {
        set({
          puzzle,
          currentRound: 0,
          results: [],
          isComplete: false,
          totalScore: 0,
        });
      },

      submitGuess: (guess: Coordinates) => {
        const state = get();
        const round = state.puzzle?.rounds[state.currentRound];

        if (!round) {
          throw new Error('No active round');
        }

        const distanceKm = calculateDistance(guess, round.target);
        const baseScore = calculateScore(distanceKm);
        const multiplier = DIFFICULTY_MULTIPLIERS[round.difficulty];
        const score = baseScore * multiplier;

        const result: RoundResult = {
          roundId: round.id,
          guess,
          target: round.target,
          distanceKm,
          score,
          multiplier,
        };

        const newResults = [...state.results, result];
        const isComplete = newResults.length >= (state.puzzle?.rounds.length || 5);
        const totalScore = newResults.reduce((sum, r) => sum + r.score, 0);

        set({
          results: newResults,
          isComplete,
          totalScore,
        });

        return result;
      },

      nextRound: () => {
        const state = get();
        if (state.currentRound < (state.puzzle?.rounds.length || 5) - 1) {
          set({ currentRound: state.currentRound + 1 });
        }
      },

      resetGame: () => {
        set({
          puzzle: null,
          currentRound: 0,
          results: [],
          isComplete: false,
          totalScore: 0,
        });
      },

      getCurrentRoundData: () => {
        const state = get();
        return state.puzzle?.rounds[state.currentRound] || null;
      },
    }),
    {
      name: 'geotap-game-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Helper hook to get current round
export function useCurrentRound() {
  const puzzle = useGameStore((state) => state.puzzle);
  const currentRound = useGameStore((state) => state.currentRound);
  return puzzle?.rounds[currentRound] || null;
}
