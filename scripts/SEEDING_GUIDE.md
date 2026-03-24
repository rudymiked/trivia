# GitHub Actions Setup for Database Seeding

## Prerequisites

1. **GitHub Repository Secrets** (set in Settings → Secrets and Variables → Actions):
   - `AZURE_FUNCTION_KEY`: Your Azure Functions host key for the `/manage/seed` endpoint

2. **GitHub Actions Variables** (set in Settings → Variables → Actions):
   - `API_URL`: Your deployed API URL (e.g., `https://your-api-name.azurewebsites.net/api`)

## Find Your Azure Function Key

If your API is deployed to Azure Functions:

```bash
# Using Azure CLI
az functionapp keys list --name your-api-name --resource-group your-resource-group --query "functionKeys.default" -o tsv

# Or manually in Azure Portal:
# 1. Go to Azure Portal -> Function Apps -> your-api-name
# 2. Navigate to App Keys (under Settings)
# 3. Copy the default function key
```

## Usage

### Add New Locations Locally

Interactive prompt to add locations one at a time:
```bash
npm run add-location
```

Then seed locally:
```bash
npm run seed
```

### Seed Production via GitHub Actions

1. **Manual Trigger** (recommended for testing):
   - Go to GitHub repo → Actions → Seed Database → Run workflow
   - Select environment (production/staging)

2. **Scheduled** (optional):
   - Seed runs automatically (enable in `.github/workflows/seed.yml` cron schedule)

### Seed Production via Command Line

```bash
API_URL=https://your-api-name.azurewebsites.net/api \
FUNCTION_KEY=your-function-key \
npm run seed
```

## Workflow Details

- **Manual trigger**: `workflow_dispatch` - click "Run workflow" in GitHub Actions tab
- **Outputs**: Shows location count by category before seeding
- **Notifications**: Success/failure messages in GitHub Actions logs
- **Rollback**: No automatic rollback; all records are upserted so re-running is safe

## Troubleshooting

### "Failed to seed locations" error

1. Check API is running: `curl https://your-api-name.azurewebsites.net/api/puzzle`
2. Verify AZURE_FUNCTION_KEY is set correctly in GitHub Secrets
3. Verify API_URL in GitHub Variables is correct
4. Check Azure Functions logs in Azure Portal

### Local seeding works but GitHub Actions fails

- Ensure both API_URL and FUNCTION_KEY secrets/variables are set
- Test locally with the same values: `API_URL=... FUNCTION_KEY=... npm run seed`
