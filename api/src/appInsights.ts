import appInsights from 'applicationinsights';

let telemetryClient: appInsights.TelemetryClient | null = null;

export function getTelemetryClient(): appInsights.TelemetryClient | null {
  if (telemetryClient) {
    return telemetryClient;
  }

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString) {
    return null;
  }

  telemetryClient = new appInsights.TelemetryClient(connectionString);
  telemetryClient.commonProperties = {
    service: 'pinpoint-api',
  };

  return telemetryClient;
}
