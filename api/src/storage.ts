import { TableClient, TableServiceClient } from '@azure/data-tables';

let serviceClient: TableServiceClient | null = null;
const tableClients: Record<string, TableClient> = {};

export function getTableServiceClient(): TableServiceClient {
  if (!serviceClient) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    }
    serviceClient = TableServiceClient.fromConnectionString(connectionString);
  }
  return serviceClient;
}

export function getTableClient(tableName: string): TableClient {
  if (!tableClients[tableName]) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    }
    tableClients[tableName] = TableClient.fromConnectionString(connectionString, tableName);
  }
  return tableClients[tableName];
}

// Initialize tables
export async function initializeTables(): Promise<void> {
  const tables = ['puzzles', 'scores', 'users', 'locations'];

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
  category: 'places' | 'questions';
  type: string;
  difficulty: 'easy' | 'medium' | 'hard';
  target: { lat: number; lng: number };
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
    clue: loc.clue,
    category: loc.category,
    type: loc.type,
    difficulty: loc.difficulty,
    target: loc.target,
    country: loc.country,
    answer: loc.answer,
    multiplier: difficultyMultiplier[loc.difficulty] || 1,
  }));

  return { id: date, date, rounds };
}
