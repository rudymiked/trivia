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
  const locations = (await getLocations()).filter((l) => l.difficulty === 'easy');

  if (locations.length < 5) {
    throw new Error('Not enough locations to generate puzzle');
  }

  // Create seed from date
  const dateParts = date.split('-').map(Number);
  const seed = dateParts[0] * 10000 + dateParts[1] * 100 + dateParts[2];
  const random = seededRandom(seed);

  // Shuffle locations
  const shuffled = [...locations].sort(() => random() - 0.5);

  // Pick 5 locations with variety
  const selected: Location[] = [];
  const usedCountries = new Set<string>();

  for (const loc of shuffled) {
    if (selected.length >= 5) break;
    // Try to avoid repeating countries
    if (usedCountries.has(loc.country) && selected.length < 4) continue;
    selected.push(loc);
    usedCountries.add(loc.country);
  }

  // Fill remaining if needed
  while (selected.length < 5) {
    const remaining = shuffled.find((l) => !selected.includes(l));
    if (remaining) selected.push(remaining);
    else break;
  }

  const difficultyMultiplier: Record<string, number> = {
    easy: 1,
    medium: 1.5,
    hard: 2,
  };

  const rounds = selected.map((loc, index) => ({
    id: index + 1,
    locationId: loc.id, // Include actual location ID
    clue: loc.clue,
    category: loc.category,
    type: loc.type,
    difficulty: loc.difficulty,
    target: loc.target,
    ...(loc.bounds && { bounds: loc.bounds }), // Include bounds if present
    country: loc.country,
    answer: loc.answer,
    multiplier: difficultyMultiplier[loc.difficulty] || 1,
  }));

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

  if (locations.length < 5) {
    throw new Error('Not enough locations to generate puzzle');
  }

  // Create seed from date (and optionally userId for variety)
  const dateParts = date.split('-').map(Number);
  let seed = dateParts[0] * 10000 + dateParts[1] * 100 + dateParts[2];

  // Add userId hash to seed for personalized randomization
  if (userId) {
    let userHash = 0;
    for (let i = 0; i < userId.length; i++) {
      userHash = (userHash * 31 + userId.charCodeAt(i)) & 0x7fffffff;
    }
    seed = (seed + userHash) & 0x7fffffff;
  }

  const random = seededRandom(seed);

  // Shuffle locations
  const shuffled = [...locations].sort(() => random() - 0.5);

  // Pick 5 locations with variety
  const selected: Location[] = [];
  const usedCountries = new Set<string>();

  for (const loc of shuffled) {
    if (selected.length >= 5) break;
    // Try to avoid repeating countries
    if (usedCountries.has(loc.country) && selected.length < 4) continue;
    selected.push(loc);
    usedCountries.add(loc.country);
  }

  // Fill remaining if needed
  while (selected.length < 5) {
    const remaining = shuffled.find((l) => !selected.includes(l));
    if (remaining) selected.push(remaining);
    else break;
  }

  const difficultyMultiplier: Record<string, number> = {
    easy: 1,
    medium: 1.5,
    hard: 2,
  };

  const rounds = selected.map((loc, index) => ({
    id: index + 1,
    locationId: loc.id, // Include actual location ID
    clue: loc.clue,
    category: loc.category,
    type: loc.type,
    difficulty: loc.difficulty,
    target: loc.target,
    ...(loc.bounds && { bounds: loc.bounds }), // Include bounds if present
    country: loc.country,
    answer: loc.answer,
    multiplier: difficultyMultiplier[loc.difficulty] || 1,
  }));

  // Generate a unique puzzle ID for personalized puzzles
  const puzzleId = userId ? `${date}-${userId.substring(0, 8)}` : date;

  return { id: puzzleId, date, rounds };
}
