import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getTelemetryClient } from '../appInsights.js';

interface TelemetryEnvelope {
  name: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEventName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) return null;
  return trimmed;
}

function splitTelemetryProperties(payload: unknown): {
  properties: Record<string, string>;
  measurements: Record<string, number>;
} {
  if (!isPlainObject(payload)) {
    return { properties: {}, measurements: {} };
  }

  const properties: Record<string, string> = {};
  const measurements: Record<string, number> = {};

  for (const [key, rawValue] of Object.entries(payload)) {
    if (!key || key.length > 64) continue;

    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      measurements[key] = rawValue;
      continue;
    }

    if (
      rawValue === null ||
      typeof rawValue === 'string' ||
      typeof rawValue === 'boolean'
    ) {
      properties[key] = String(rawValue);
    }
  }

  return { properties, measurements };
}

app.http('ingestTelemetry', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'telemetry',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as TelemetryEnvelope;
      const eventName = normalizeEventName(body?.name);

      if (!eventName) {
        return {
          status: 400,
          jsonBody: {
            code: 'INVALID_EVENT_NAME',
            error: 'Event name is required and must be 1-100 characters.',
          },
        };
      }

      const telemetryClient = getTelemetryClient();
      if (!telemetryClient) {
        context.warn('[telemetry] APPLICATIONINSIGHTS_CONNECTION_STRING not configured');
        return {
          status: 202,
          jsonBody: {
            success: true,
            accepted: false,
            reason: 'APPLICATIONINSIGHTS_NOT_CONFIGURED',
          },
        };
      }

      const { properties, measurements } = splitTelemetryProperties(body.payload);
      properties.clientTimestamp = typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString();

      telemetryClient.trackEvent({
        name: eventName,
        properties,
        measurements,
      });

      return {
        status: 202,
        jsonBody: {
          success: true,
          accepted: true,
        },
      };
    } catch (error) {
      context.error('[telemetry] ingestion failed', error);
      return {
        status: 500,
        jsonBody: {
          code: 'TELEMETRY_INGESTION_FAILED',
          error: 'Failed to ingest telemetry event',
        },
      };
    }
  },
});
