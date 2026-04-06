import {
    BoundingBox,
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
// Handles date line wrapping by normalizing longitude difference to shortest arc
function calculateDistanceBetweenPoints(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  
  // Normalize longitude difference to shortest arc across date line
  let dLngDeg = coord2.lng - coord1.lng;
  if (dLngDeg > 180) {
    dLngDeg -= 360;
  } else if (dLngDeg < -180) {
    dLngDeg += 360;
  }
  const dLng = toRad(dLngDeg);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check if a coordinate is inside a bounding box
function isPointInBounds(coord: Coordinates, bounds: BoundingBox): boolean {
  const { nw, se } = bounds;
  // NW has higher lat and lower lng; SE has lower lat and higher lng
  const inLat = coord.lat <= nw.lat && coord.lat >= se.lat;
  const inLng = coord.lng >= nw.lng && coord.lng <= se.lng;
  return inLat && inLng;
}

// Calculate distance from a point to the nearest edge of a bounding box
// Returns 0 if point is inside the box
function calculateDistanceToBounds(coord: Coordinates, bounds: BoundingBox): number {
  if (isPointInBounds(coord, bounds)) {
    return 0;
  }

  const { nw, se } = bounds;
  // Clamp the coordinate to the box bounds
  const clampedLat = Math.max(se.lat, Math.min(coord.lat, nw.lat));
  const clampedLng = Math.max(nw.lng, Math.min(coord.lng, se.lng));
  const clampedCoord = { lat: clampedLat, lng: clampedLng };

  return calculateDistanceBetweenPoints(coord, clampedCoord);
}

// Calculate distance to target (point or area)
export function calculateDistance(
  guess: Coordinates,
  target: Coordinates,
  targetBounds?: BoundingBox
): number {
  if (targetBounds) {
    return calculateDistanceToBounds(guess, targetBounds);
  }
  return calculateDistanceBetweenPoints(guess, target);
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

const DATE_PUZZLE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      puzzle: null,
      currentRound: 0,
      results: [],
      isComplete: false,
      totalScore: 0,
      lastCompletedDate: null,

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

        const distanceKm = calculateDistance(guess, round.target, round.bounds);
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
        const puzzleDate = state.puzzle?.date ?? null;
        const isDatePuzzle = puzzleDate !== null && DATE_PUZZLE_RE.test(puzzleDate);

        set({
          results: newResults,
          isComplete,
          totalScore,
          ...(isComplete && isDatePuzzle ? { lastCompletedDate: puzzleDate } : {}),
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
      name: 'pinpoint-game-storage',
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
