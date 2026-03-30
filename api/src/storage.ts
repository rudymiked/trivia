import { TableClient, TableServiceClient } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';

let serviceClient: TableServiceClient | null = null;
const tableClients: Record<string, TableClient> = {};

// Storage account name for Managed Identity auth
const STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME || 'geotapstorage';

function getConnectionString(): string | undefined {
  return process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
}

export function getTableServiceClient(): TableServiceClient {
  if (!serviceClient) {
    const connectionString = getConnectionString();

    if (connectionString) {
      // Use connection string (local development / CI)
      serviceClient = TableServiceClient.fromConnectionString(connectionString);
    } else {
      // Use Managed Identity (production)
      const credential = new DefaultAzureCredential();
      const url = `https://${STORAGE_ACCOUNT_NAME}.table.core.windows.net`;
      serviceClient = new TableServiceClient(url, credential);
    }
  }
  return serviceClient;
}

export function getTableClient(tableName: string): TableClient {
  if (!tableClients[tableName]) {
    const connectionString = getConnectionString();

    if (connectionString) {
      // Use connection string (local development / CI)
      tableClients[tableName] = TableClient.fromConnectionString(connectionString, tableName);
    } else {
      // Use Managed Identity (production)
      const credential = new DefaultAzureCredential();
      const url = `https://${STORAGE_ACCOUNT_NAME}.table.core.windows.net`;
      tableClients[tableName] = new TableClient(url, tableName, credential);
    }
  }
  return tableClients[tableName];
}

// Initialize tables
export async function initializeTables(): Promise<void> {
  const tables = [
    'puzzles',
    'scores',
    'users',
    'locations',
    'games',
    'achievements',
    'seenLocations',
    'clueFeedback',
    'clueFeedbackSummary',
  ];

  for (const tableName of tables) {
    const client = getTableClient(tableName);
    try {
      await client.createTable();
    } catch (error: any) {
      // Table already exists - ignore
      if (error.statusCode !== 409) {
        throw error;
      }
    }
  }
}

// Location interface
export interface Location {
  id: string;
  clue: string;
  category: 'places' | 'questions' | 'geography';
  type: string;
  difficulty: 'easy' | 'medium' | 'hard';
  target: { lat: number; lng: number };
  bounds?: { nw: { lat: number; lng: number }; se: { lat: number; lng: number } }; // Optional area bounds
  country: string;
  answer?: string;
  enabled: boolean;
}

// Get all locations from Table Storage
export async function getLocations(category?: string): Promise<Location[]> {
  const client = getTableClient('locations');
  const locations: Location[] = [];

  const filter = category
    ? `PartitionKey eq 'location' and category eq '${category}' and enabled eq true`
    : `PartitionKey eq 'location' and enabled eq true`;

  const entities = client.listEntities({
    queryOptions: { filter },
  });

  for await (const entity of entities) {
    locations.push({
      id: entity.rowKey as string,
      clue: entity.clue as string,
      category: entity.category as 'places' | 'questions',
      type: entity.type as string,
      difficulty: entity.difficulty as 'easy' | 'medium' | 'hard',
      target: JSON.parse(entity.target as string),
      country: entity.country as string,
      answer: entity.answer as string | undefined,
      enabled: entity.enabled as boolean,
    });
  }

  return locations;
}

// Seeded random number generator for consistent daily puzzles
function seededRandom(seed: number): () => number {
  return function () {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

const DAILY_ROUND_COUNT = 5;
const DAILY_REPEAT_LOOKBACK_DAYS = 2;

function buildSeedFromDate(date: string): number {
  const dateParts = date.split('-').map(Number);
  return dateParts[0] * 10000 + dateParts[1] * 100 + dateParts[2];
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) & 0x7fffffff;
  }
  return hash;
}

function getOffsetDate(date: string, offsetDays: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString().split('T')[0];
}

function shuffleLocations(locations: Location[], seed: number): Location[] {
  const random = seededRandom(seed);
  const shuffled = [...locations];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function normalizePromptToken(value?: string): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildPromptKey(location: Location): string {
  // Use clue text as the uniqueness guard to prevent repeated prompt wording in one puzzle.
  return normalizePromptToken(location.clue);
}

function selectLocationsWithVariety(locations: Location[], count: number): Location[] {
  const selected: Location[] = [];
  const usedCountries = new Set<string>();
  const usedCategories = new Set<string>();
  const usedPromptKeys = new Set<string>();

  for (const loc of locations) {
    if (selected.length >= count) break;

    const promptKey = buildPromptKey(loc);
    if (usedPromptKeys.has(promptKey)) {
      continue;
    }

    const countryAlreadyUsed = usedCountries.has(loc.country);
    const categoryAlreadyUsed = usedCategories.has(loc.category);

    if ((countryAlreadyUsed || categoryAlreadyUsed) && selected.length < count - 1) {
      continue;
    }

    selected.push(loc);
    usedCountries.add(loc.country);
    usedCategories.add(loc.category);
    usedPromptKeys.add(promptKey);
  }

  if (selected.length < count) {
    for (const loc of locations) {
      if (selected.length >= count) break;
      const promptKey = buildPromptKey(loc);
      if (
        !selected.some((selectedLoc) => selectedLoc.id === loc.id) &&
        !usedPromptKeys.has(promptKey)
      ) {
        selected.push(loc);
        usedPromptKeys.add(promptKey);
      }
    }
  }

  return selected;
}

function buildPuzzleRounds(locations: Location[]) {
  const difficultyMultiplier: Record<string, number> = {
    easy: 1,
    medium: 1.5,
    hard: 2,
  };

  return locations.map((loc, index) => ({
    id: index + 1,
    locationId: loc.id,
    clue: loc.clue,
    category: loc.category,
    type: loc.type,
    difficulty: loc.difficulty,
    target: loc.target,
    ...(loc.bounds && { bounds: loc.bounds }),
    country: loc.country,
    answer: loc.answer,
    multiplier: difficultyMultiplier[loc.difficulty] || 1,
  }));
}

function selectDailyLocations(
  date: string,
  locations: Location[],
  historyDepth = DAILY_REPEAT_LOOKBACK_DAYS,
  memo = new Map<string, Location[]>()
): Location[] {
  const memoKey = `${date}:${historyDepth}`;
  const cached = memo.get(memoKey);
  if (cached) {
    return cached;
  }

  const excludedIds = new Set<string>();
  if (historyDepth > 0) {
    for (let dayOffset = 1; dayOffset <= historyDepth; dayOffset += 1) {
      const previousDate = getOffsetDate(date, -dayOffset);
      const previousSelection = selectDailyLocations(previousDate, locations, historyDepth - dayOffset, memo);
      for (const previousLocation of previousSelection) {
        excludedIds.add(previousLocation.id);
      }
    }
  }

  const preferredPool = locations.filter((location) => !excludedIds.has(location.id));
  const candidatePool = preferredPool.length >= DAILY_ROUND_COUNT ? preferredPool : locations;
  const shuffled = shuffleLocations(candidatePool, buildSeedFromDate(date));
  const selection = selectLocationsWithVariety(shuffled, DAILY_ROUND_COUNT);

  memo.set(memoKey, selection);
  return selection;
}

// Generate puzzle from locations for a specific date
export async function generatePuzzleForDate(date: string): Promise<{
  id: string;
  date: string;
  rounds: Array<{
    id: number;
    locationId: string; // Actual location ID for tracking
    clue: string;
    category: string;
    type: string;
    difficulty: string;
    target: { lat: number; lng: number };
    country: string;
    answer?: string;
    multiplier: number;
  }>;
}> {
  const locations = await getLocations();

  if (locations.length < DAILY_ROUND_COUNT) {
    throw new Error('Not enough locations to generate puzzle');
  }
  const selected = selectDailyLocations(date, locations);
  const rounds = buildPuzzleRounds(selected);

  return { id: date, date, rounds };
}

// Track locations that a user has seen
// Table structure: PartitionKey = userId, RowKey = locationId
export async function trackSeenLocations(userId: string, locationIds: string[]): Promise<void> {
  const client = getTableClient('seenLocations');
  const seenAt = new Date().toISOString();

  // Batch insert seen locations
  for (const locationId of locationIds) {
    try {
      await client.upsertEntity({
        partitionKey: userId,
        rowKey: locationId,
        seenAt,
      });
    } catch (error) {
      // Ignore individual insert errors, continue with others
      console.error(`Failed to track location ${locationId} for user ${userId}:`, error);
    }
  }
}

// Get all location IDs a user has seen
export async function getSeenLocationIds(userId: string): Promise<Set<string>> {
  const client = getTableClient('seenLocations');
  const seenIds = new Set<string>();

  try {
    const entities = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${userId}'` },
    });

    for await (const entity of entities) {
      seenIds.add(entity.rowKey as string);
    }
  } catch (error) {
    console.error(`Failed to get seen locations for user ${userId}:`, error);
  }

  return seenIds;
}

// Generate personalized puzzle excluding seen locations
export async function generatePersonalizedPuzzleForDate(
  date: string,
  userId?: string,
  category?: 'places' | 'questions' | 'geography',
  difficulty?: 'easy' | 'medium' | 'hard'
): Promise<{
  id: string;
  date: string;
  rounds: Array<{
    id: number;
    locationId: string;
    clue: string;
    category: string;
    type: string;
    difficulty: string;
    target: { lat: number; lng: number };
    country: string;
    answer?: string;
    multiplier: number;
  }>;
}> {
  let locations = await getLocations();

  if (category) {
    locations = locations.filter((loc) => loc.category === category);
  }

  if (difficulty) {
    locations = locations.filter((loc) => loc.difficulty === difficulty);
  }

  // If userId provided, exclude locations they've seen
  if (userId) {
    const seenIds = await getSeenLocationIds(userId);
    if (seenIds.size > 0) {
      const unseenLocations = locations.filter((loc) => !seenIds.has(loc.id));
      // Only use unseen if we have enough, otherwise fall back to all
      if (unseenLocations.length >= 5) {
        locations = unseenLocations;
      }
      // If not enough unseen locations, use all locations (they've seen everything)
    }
  }

  if (locations.length < DAILY_ROUND_COUNT) {
    throw new Error('Not enough locations to generate puzzle');
  }

  let seed = buildSeedFromDate(date);

  // Add userId hash to seed for personalized randomization
  if (userId) {
    seed = (seed + hashString(userId)) & 0x7fffffff;
  }

  const shuffled = shuffleLocations(locations, seed);
  const selected = selectLocationsWithVariety(shuffled, DAILY_ROUND_COUNT);
  const rounds = buildPuzzleRounds(selected);

  // Generate a unique puzzle ID for personalized puzzles
  const puzzleId = userId ? `${date}-${userId.substring(0, 8)}` : date;

  return { id: puzzleId, date, rounds };
}
