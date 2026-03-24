import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { extractBearerToken, isAdminEmail, verifyGoogleToken } from '../auth.js';
import { getTableClient, initializeTables, Location } from '../storage.js';

function adminRejectionResponse(status: number, code: string, message: string): HttpResponseInit {
  return {
    status,
    jsonBody: {
      code,
      error: message,
    },
  };
}

async function requireAdminUser(request: HttpRequest): Promise<HttpResponseInit | null> {
  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return adminRejectionResponse(401, 'AUTH_REQUIRED', 'Authentication is required.');
  }

  const verifiedUser = await verifyGoogleToken(token);
  if (!verifiedUser) {
    return adminRejectionResponse(401, 'INVALID_AUTH_TOKEN', 'Invalid authentication token.');
  }

  if (!isAdminEmail(verifiedUser.email)) {
    return adminRejectionResponse(403, 'ADMIN_ACCESS_DENIED', 'Admin access denied.');
  }

  return null;
}

// Seed locations from JSON data
app.http('seedLocations', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'manage/seed',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      await initializeTables();
      const body = (await request.json()) as { locations: Array<Omit<Location, 'id' | 'enabled'>> };

      if (!body.locations || !Array.isArray(body.locations)) {
        return {
          status: 400,
          jsonBody: { error: 'Request body must contain a locations array' },
        };
      }

      const client = getTableClient('locations');
      let added = 0;

      for (const loc of body.locations) {
        const id = randomUUID();
        await client.upsertEntity({
          partitionKey: 'location',
          rowKey: id,
          clue: loc.clue,
          category: loc.category,
          type: loc.type,
          difficulty: loc.difficulty,
          target: JSON.stringify(loc.target),
          country: loc.country,
          answer: loc.answer || '',
          enabled: true,
        });
        added++;
      }

      return {
        jsonBody: { success: true, added },
      };
    } catch (error) {
      context.error('Error seeding locations:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to seed locations' },
      };
    }
  },
});

// Get all locations (admin view)
app.http('getLocations', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/locations',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const authFailure = await requireAdminUser(request);
      if (authFailure) {
        return authFailure;
      }

      const client = getTableClient('locations');
      const locations: Array<Location & { partitionKey: string; rowKey: string }> = [];

      const entities = client.listEntities({
        queryOptions: { filter: `PartitionKey eq 'location'` },
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
          partitionKey: entity.partitionKey as string,
          rowKey: entity.rowKey as string,
        });
      }

      return {
        jsonBody: { locations, count: locations.length },
      };
    } catch (error) {
      context.error('Error fetching locations:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch locations' },
      };
    }
  },
});

// Add a single location
app.http('addLocation', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/locations',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const authFailure = await requireAdminUser(request);
      if (authFailure) {
        return authFailure;
      }

      const body = (await request.json()) as Omit<Location, 'id' | 'enabled'>;

      if (!body.clue || !body.category || !body.target) {
        return {
          status: 400,
          jsonBody: { error: 'Missing required fields: clue, category, target' },
        };
      }

      const client = getTableClient('locations');
      const id = randomUUID();

      await client.upsertEntity({
        partitionKey: 'location',
        rowKey: id,
        clue: body.clue,
        category: body.category,
        type: body.type || 'landmark',
        difficulty: body.difficulty || 'medium',
        target: JSON.stringify(body.target),
        country: body.country || 'Unknown',
        answer: body.answer || '',
        enabled: true,
      });

      return {
        status: 201,
        jsonBody: { success: true, id },
      };
    } catch (error) {
      context.error('Error adding location:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to add location' },
      };
    }
  },
});

// Update a location
app.http('updateLocation', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'manage/locations/{id}',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const id = request.params.id;
    if (!id) {
      return {
        status: 400,
        jsonBody: { error: 'Location ID is required' },
      };
    }

    try {
      const authFailure = await requireAdminUser(request);
      if (authFailure) {
        return authFailure;
      }

      const body = (await request.json()) as Partial<Location>;
      const client = getTableClient('locations');

      // Get existing location
      const existing = await client.getEntity('location', id);

      await client.upsertEntity({
        partitionKey: 'location',
        rowKey: id,
        clue: body.clue ?? existing.clue,
        category: body.category ?? existing.category,
        type: body.type ?? existing.type,
        difficulty: body.difficulty ?? existing.difficulty,
        target: body.target ? JSON.stringify(body.target) : existing.target,
        country: body.country ?? existing.country,
        answer: body.answer ?? existing.answer,
        enabled: body.enabled ?? existing.enabled,
      });

      return {
        jsonBody: { success: true, id },
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: 'Location not found' },
        };
      }
      context.error('Error updating location:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to update location' },
      };
    }
  },
});

// Delete a location
app.http('deleteLocation', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'manage/locations/{id}',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const id = request.params.id;
    if (!id) {
      return {
        status: 400,
        jsonBody: { error: 'Location ID is required' },
      };
    }

    try {
      const authFailure = await requireAdminUser(request);
      if (authFailure) {
        return authFailure;
      }

      const client = getTableClient('locations');
      await client.deleteEntity('location', id);

      return {
        jsonBody: { success: true },
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: 'Location not found' },
        };
      }
      context.error('Error deleting location:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to delete location' },
      };
    }
  },
});

// Toggle location enabled status
app.http('toggleLocation', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'manage/locations/{id}/toggle',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const id = request.params.id;
    if (!id) {
      return {
        status: 400,
        jsonBody: { error: 'Location ID is required' },
      };
    }

    try {
      const authFailure = await requireAdminUser(request);
      if (authFailure) {
        return authFailure;
      }

      const client = getTableClient('locations');
      const existing = await client.getEntity('location', id);
      const newEnabled = !(existing.enabled as boolean);

      await client.upsertEntity({
        partitionKey: 'location',
        rowKey: id,
        clue: existing.clue,
        category: existing.category,
        type: existing.type,
        difficulty: existing.difficulty,
        target: existing.target,
        country: existing.country,
        answer: existing.answer,
        enabled: newEnabled,
      });

      return {
        jsonBody: { success: true, enabled: newEnabled },
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: 'Location not found' },
        };
      }
      context.error('Error toggling location:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to toggle location' },
      };
    }
  },
});

app.http('getLowRatedClues', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/clue-feedback/low',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const authFailure = await requireAdminUser(request);
      if (authFailure) {
        return authFailure;
      }

      await initializeTables();

      const limit = Math.min(Math.max(parseInt(request.query.get('limit') || '25', 10) || 25, 1), 100);
      const minCount = Math.min(Math.max(parseInt(request.query.get('minCount') || '1', 10) || 1, 0), 1000);

      const client = getTableClient('clueFeedbackSummary');
      const clues: Array<{
        locationId: string;
        clue: string;
        country: string;
        answer?: string;
        easyCount: number;
        hardCount: number;
        unclearCount: number;
        lowRatingCount: number;
        lastPuzzleDate?: string;
        lastSubmittedAt?: string;
      }> = [];

      const entities = client.listEntities({
        queryOptions: { filter: `PartitionKey eq 'location' and lowRatingCount ge ${minCount}` },
      });

      for await (const entity of entities) {
        clues.push({
          locationId: entity.rowKey as string,
          clue: (entity.clue as string) || '',
          country: (entity.country as string) || '',
          answer: entity.answer as string | undefined,
          easyCount: Number(entity.easyCount || 0),
          hardCount: Number(entity.hardCount || 0),
          unclearCount: Number(entity.unclearCount || 0),
          lowRatingCount: Number(entity.lowRatingCount || 0),
          lastPuzzleDate: entity.lastPuzzleDate as string | undefined,
          lastSubmittedAt: entity.lastSubmittedAt as string | undefined,
        });
      }

      clues.sort((left, right) => {
        if (right.lowRatingCount !== left.lowRatingCount) {
          return right.lowRatingCount - left.lowRatingCount;
        }

        if (right.unclearCount !== left.unclearCount) {
          return right.unclearCount - left.unclearCount;
        }

        return right.hardCount - left.hardCount;
      });

      return {
        jsonBody: {
          clues: clues.slice(0, limit),
          count: clues.length,
        },
      };
    } catch (error) {
      context.error('Error fetching low-rated clues:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch low-rated clues' },
      };
    }
  },
});
