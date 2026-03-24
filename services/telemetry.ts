import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { sendTelemetryEvent } from './api';

type TelemetryValue = string | number | boolean | null;

type TelemetryPayload = Record<string, TelemetryValue>;

export interface TelemetryEvent {
  name: string;
  timestamp: string;
  payload: TelemetryPayload;
}

const STORAGE_KEY = 'pinpoint_telemetry_events';
const MAX_STORED_EVENTS = 100;
const runtimeSessionId = createSessionId();
const appVersion = Constants.expoConfig?.version || 'unknown';

const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },
};

const storage = Platform.OS === 'web' ? webStorage : AsyncStorage;

function createSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizePayload(payload: Record<string, unknown>): TelemetryPayload {
  const result: TelemetryPayload = {};

  for (const [key, value] of Object.entries(payload)) {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      result[key] = value;
    }
  }

  return result;
}

export async function trackTelemetryEvent(
  name: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const sanitizedPayload = sanitizePayload(payload);
  const enrichedPayload: TelemetryPayload = {
    ...sanitizedPayload,
    sessionId: sanitizedPayload.sessionId ?? runtimeSessionId,
    appVersion: sanitizedPayload.appVersion ?? appVersion,
    platform: sanitizedPayload.platform ?? Platform.OS,
  };

  const event: TelemetryEvent = {
    name,
    timestamp: new Date().toISOString(),
    payload: enrichedPayload,
  };

  // Keep console logs for immediate visibility in dev/runtime logs.
  console.log(`[telemetry] ${name}`, event.payload);

  try {
    const existing = await storage.getItem(STORAGE_KEY);
    const events: TelemetryEvent[] = existing ? JSON.parse(existing) : [];
    events.push(event);

    const recentEvents = events.slice(-MAX_STORED_EVENTS);
    await storage.setItem(STORAGE_KEY, JSON.stringify(recentEvents));
  } catch (error) {
    console.error('Failed to persist telemetry event:', error);
  }

  // Best-effort forwarding to backend telemetry ingestion endpoint.
  try {
    const response = await sendTelemetryEvent({
      name,
      timestamp: event.timestamp,
      payload: enrichedPayload,
    });

    if (response.error) {
      console.warn(`[telemetry] backend forward failed for ${name}:`, response.error);
    }
  } catch (error) {
    console.warn(`[telemetry] backend forward threw for ${name}:`, error);
  }
}

export async function getTelemetryEvents(): Promise<TelemetryEvent[]> {
  try {
    const existing = await storage.getItem(STORAGE_KEY);
    return existing ? (JSON.parse(existing) as TelemetryEvent[]) : [];
  } catch {
    return [];
  }
}

export async function clearTelemetryEvents(): Promise<void> {
  try {
    await storage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear telemetry events:', error);
  }
}
