import { Container, CosmosClient, Database } from '@azure/cosmos';

let client: CosmosClient | null = null;
let database: Database | null = null;

const containers: Record<string, Container> = {};

export function getCosmosClient(): CosmosClient {
  if (!client) {
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('COSMOS_CONNECTION_STRING is not set');
    }
    client = new CosmosClient(connectionString);
  }
  return client;
}

export function getDatabase(): Database {
  if (!database) {
    const dbName = process.env.COSMOS_DATABASE_NAME || 'geotap';
    database = getCosmosClient().database(dbName);
  }
  return database;
}

export function getContainer(containerName: string): Container {
  if (!containers[containerName]) {
    containers[containerName] = getDatabase().container(containerName);
  }
  return containers[containerName];
}

// Initialize database and containers
export async function initializeDatabase(): Promise<void> {
  const client = getCosmosClient();
  const dbName = process.env.COSMOS_DATABASE_NAME || 'geotap';

  // Create database if not exists
  await client.databases.createIfNotExists({ id: dbName });

  const db = client.database(dbName);

  // Create containers with partition keys
  await db.containers.createIfNotExists({
    id: 'puzzles',
    partitionKey: { paths: ['/date'] },
  });

  await db.containers.createIfNotExists({
    id: 'users',
    partitionKey: { paths: ['/id'] },
  });

  await db.containers.createIfNotExists({
    id: 'scores',
    partitionKey: { paths: ['/date'] },
  });
}
