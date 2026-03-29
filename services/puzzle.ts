import locationsData from '@/data/locations.json';
import { Puzzle, Round } from '@/types/game';
import { fetchPuzzle } from './api';

export type DailyPuzzleSource = 'api' | 'local';

export interface DailyPuzzleWithSource {
  puzzle: Puzzle;
  source: DailyPuzzleSource;
}

function createLocalLocationId(location: {
  clue: string;
  category?: string;
  country?: string;
  target: { lat: number; lng: number };
}): string {
  const raw = [
    location.category || 'unknown',
    location.country || 'unknown',
    location.clue,
    location.target.lat,
    location.target.lng,
  ].join('|');

  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

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

// Generate puzzle locally from bundled data (fallback)
function generateLocalPuzzle(date: string = getTodayDate()): Puzzle {
  const seed = dateToSeed(date);
  const random = seededRandom(seed);

  const allLocations = locationsData.locations as Array<Omit<Round, 'id'> & { answer?: string }>;
  const locations = allLocations.filter((l) => l.difficulty === 'easy');
  const shuffled = shuffleArray(locations, random);

  // Select 5 locations for today's puzzle
  const selectedLocations = shuffled.slice(0, 5);

  const difficultyMultiplier: Record<string, number> = {
    easy: 1,
    medium: 1.5,
    hard: 2,
  };

  const rounds: Round[] = selectedLocations.map((loc, index) => ({
    id: index + 1,
    locationId: loc.locationId || createLocalLocationId(loc),
    clue: loc.clue,
    category: (loc.category || 'places') as Round['category'],
    type: loc.type as Round['type'],
    difficulty: loc.difficulty as Round['difficulty'],
    target: loc.target,
    ...(loc.bounds && { bounds: loc.bounds }), // Include bounds if present
    country: loc.country,
    answer: loc.answer,
    multiplier: difficultyMultiplier[loc.difficulty] || 1,
  }));

  return {
    id: date,
    date,
    rounds,
  };
}

// Generate daily puzzle - tries API first, falls back to local
export async function generateDailyPuzzle(date: string = getTodayDate()): Promise<Puzzle> {
  const result = await generateDailyPuzzleWithSource(date);
  return result.puzzle;
}

// Source-aware variant used by UI to show fallback state
export async function generateDailyPuzzleWithSource(
  date: string = getTodayDate()
): Promise<DailyPuzzleWithSource> {
  try {
    // Try to fetch from API first
    const response = await fetchPuzzle(date);
    if (response.data) {
      return {
        puzzle: response.data,
        source: 'api',
      };
    }
  } catch (error) {
    console.log('API unavailable, using local puzzle generation', error);
  }

  // Fall back to local generation
  return {
    puzzle: generateLocalPuzzle(date),
    source: 'local',
  };
}

// Synchronous version for backwards compatibility
export function generateDailyPuzzleSync(date: string = getTodayDate()): Puzzle {
  return generateLocalPuzzle(date);
}

// Get all available categories from the data
export function getCategories(): string[] {
  const locations = locationsData.locations as Array<{ category: string }>;
  const categories = [...new Set(locations.map((loc) => loc.category))];
  return categories;
}

// Generate a puzzle filtered by category
export function generatePuzzleByCategory(
  category: string | 'all' | 'random',
  difficulty: 'all' | Round['difficulty'] = 'all'
): Puzzle {
  const locations = locationsData.locations as Array<Omit<Round, 'id'> & { answer?: string }>;
  const random = () => Math.random();

  let filteredLocations = locations;

  if (category === 'random') {
    // Pick a random category
    const categories = getCategories();
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    filteredLocations = locations.filter((loc) => loc.category === randomCategory);
  } else if (category !== 'all') {
    // Filter by specific category
    filteredLocations = locations.filter((loc) => loc.category === category);
  }

  if (difficulty !== 'all') {
    filteredLocations = filteredLocations.filter((loc) => loc.difficulty === difficulty);
  }

  if (filteredLocations.length < 5) {
    throw new Error('Not enough locations for selected mode and difficulty');
  }

  const shuffled = shuffleArray(filteredLocations, random);
  const selectedLocations = shuffled.slice(0, 5);

  const difficultyMultiplier: Record<string, number> = {
    easy: 1,
    medium: 1.5,
    hard: 2,
  };

  const rounds: Round[] = selectedLocations.map((loc, index) => ({
    id: index + 1,
    locationId: loc.locationId || createLocalLocationId(loc),
    clue: loc.clue,
    category: (loc.category || 'places') as Round['category'],
    type: loc.type as Round['type'],
    difficulty: loc.difficulty as Round['difficulty'],
    target: loc.target,
    country: loc.country,
    answer: loc.answer,
    multiplier: difficultyMultiplier[loc.difficulty] || 1,
  }));

  const puzzleId = `${category}-${Date.now()}`;

  return {
    id: puzzleId,
    date: getTodayDate(),
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
