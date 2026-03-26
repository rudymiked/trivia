# API alerting setup

This folder contains Azure Monitor log-alert rules for:

- API error rate
- API p95 latency
- API crash spikes (exceptions)

## Prerequisites

- Azure CLI logged in
- Existing Log Analytics workspace that receives your Application Insights data
- Existing Azure Monitor action group for notifications

## Deploy

From repo root:

```powershell
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/azure/api-alerts.bicep \
  --parameters @infra/azure/api-alerts.parameters.json
```

If you want to use the example file instead, replace all `<...>` placeholders first.

## Notes

- The queries filter by `cloud_RoleName`.
- `api-alerts.parameters.json` is prefilled for your current `geotap-api` component and action group.
- Tune thresholds in parameters file as traffic grows.
- Error-rate and latency alerts evaluate every 5 minutes.
- Crash-spike alert compares exceptions in the last 5 minutes against a 30-minute baseline.
