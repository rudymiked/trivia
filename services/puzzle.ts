import locationsData from '@/data/locations.json';
import { Puzzle, Round } from '@/types/game';

// Generate a seeded random number based on date
function seededRandom(seed: number): () => number {
  return function () {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Convert date string to seed number
function dateToSeed(dateStr: string): number {
  const parts = dateStr.split('-').map(Number);
  return parts[0] * 10000 + parts[1] * 100 + parts[2];
}

// Get today's date in YYYY-MM-DD format
export function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Shuffle array using seeded random
function shuffleArray<T>(array: T[], random: () => number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Generate daily puzzle based on date
export function generateDailyPuzzle(date: string = getTodayDate()): Puzzle {
  const seed = dateToSeed(date);
  const random = seededRandom(seed);

  const locations = locationsData.locations as Array<Omit<Round, 'id'>>;
  const shuffled = shuffleArray(locations, random);

  // Select 5 locations for today's puzzle
  const selectedLocations = shuffled.slice(0, 5);

  const rounds: Round[] = selectedLocations.map((loc, index) => ({
    id: index + 1,
    clue: loc.clue,
    type: loc.type as Round['type'],
    difficulty: loc.difficulty as Round['difficulty'],
    target: loc.target,
    country: loc.country,
  }));

  return {
    id: date,
    date,
    rounds,
  };
}

// Check if user has already played today
export function hasPlayedToday(lastPlayedDate: string | null): boolean {
  if (!lastPlayedDate) return false;
  return lastPlayedDate === getTodayDate();
}

// Calculate time until next puzzle (midnight)
export function getTimeUntilNextPuzzle(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const diff = tomorrow.getTime() - now.getTime();

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { hours, minutes, seconds };
}
