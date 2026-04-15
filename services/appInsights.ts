import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { Platform } from 'react-native';

let client: ApplicationInsights | null = null;

export function initAppInsights(): void {
  if (Platform.OS !== 'web') return;
  if (client) return;

  const connectionString = process.env.EXPO_PUBLIC_APPINSIGHTS_CONNECTION_STRING;
  if (!connectionString) return;

  client = new ApplicationInsights({
    config: {
      connectionString,
      enableAutoRouteTracking: true,
      disableFetchTracking: false,
      enableCorsCorrelation: false,
    },
  });

  client.loadAppInsights();
  client.trackPageView();
}

export function trackAppInsightsEvent(
  name: string,
  properties?: Record<string, string | number | boolean | null>
): void {
  if (!client) return;
  client.trackEvent({ name }, properties ?? undefined);
}

export function trackAppInsightsException(
  error: Error,
  properties?: Record<string, string | number | boolean | null>
): void {
  if (!client) return;
  client.trackException({ exception: error, properties: properties ?? undefined });
}
