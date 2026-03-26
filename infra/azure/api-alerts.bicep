@description('Name prefix used for alert rule resources')
param namePrefix string = 'pinpoint-api'

@description('Azure region for alert resources')
param location string = resourceGroup().location

@description('Resource ID used as alert scope (App Insights component or Log Analytics workspace)')
param monitorScopeResourceId string

@description('Target resource type for scope (microsoft.insights/components or microsoft.operationalinsights/workspaces)')
param monitorScopeType string = 'microsoft.insights/components'

@description('Resource ID of the action group used for alert notifications')
param actionGroupResourceId string

@description('cloud_RoleName value emitted by the API telemetry')
param roleName string = 'pinpoint-api'

@description('Error-rate alert threshold in percent over the evaluation window')
param errorRateThresholdPct int = 5

@description('Minimum request count required before evaluating error-rate alert')
param minRequestsForRate int = 20

@description('p95 latency threshold in milliseconds over the evaluation window')
param p95LatencyMs int = 1200

@description('Minimum request count required before evaluating p95 latency alert')
param minRequestsForLatency int = 20

@description('Minimum exception count in recent window before evaluating crash-spike alert')
param minCrashCount int = 10

@description('Multiplier over baseline exceptions per window to trigger crash-spike alert')
param crashSpikeMultiplier int = 3

@description('Optional tags applied to all alert resources')
param tags object = {}

var errorRateQuery = concat(
  'let timeframe = 5m;\n',
  'let minRequests = ', string(minRequestsForRate), ';\n',
  'let thresholdPct = ', string(errorRateThresholdPct), ';\n',
  'let roleFilter = "', roleName, '";\n',
  'requests\n',
  '| where timestamp > ago(timeframe)\n',
  '| where cloud_RoleName =~ roleFilter\n',
  '| summarize total = count(), failures = countif(success == false)\n',
  '| extend errorRatePct = iff(total == 0, 0.0, todouble(failures) * 100.0 / todouble(total))\n',
  '| where total >= minRequests and errorRatePct >= thresholdPct\n'
)

var latencyP95Query = concat(
  'let timeframe = 5m;\n',
  'let minRequests = ', string(minRequestsForLatency), ';\n',
  'let thresholdMs = ', string(p95LatencyMs), ';\n',
  'let roleFilter = "', roleName, '";\n',
  'requests\n',
  '| where timestamp > ago(timeframe)\n',
  '| where cloud_RoleName =~ roleFilter\n',
  '| summarize total = count(), p95Ms = percentile(duration, 95)\n',
  '| where total >= minRequests and p95Ms >= thresholdMs\n'
)

var crashSpikeQuery = concat(
  'let recentWindow = 5m;\n',
  'let baselineWindow = 30m;\n',
  'let minCrashes = ', string(minCrashCount), ';\n',
  'let spikeMultiplier = ', string(crashSpikeMultiplier), ';\n',
  'let roleFilter = "', roleName, '";\n',
  'let recent = toscalar(\n',
  '  exceptions\n',
  '  | where timestamp > ago(recentWindow)\n',
  '  | where cloud_RoleName =~ roleFilter\n',
  '  | summarize c = count()\n',
  ');\n',
  'let baseline = toscalar(\n',
  '  exceptions\n',
  '  | where timestamp between (ago(recentWindow + baselineWindow) .. ago(recentWindow))\n',
  '  | where cloud_RoleName =~ roleFilter\n',
  '  | summarize c = count()\n',
  ');\n',
  'let baselinePerWindow = iif(baseline == 0, 0.0, todouble(baseline) / 6.0);\n',
  'print recent = recent, baselinePerWindow = baselinePerWindow\n',
  '| where recent >= minCrashes and (baselinePerWindow == 0.0 or todouble(recent) >= baselinePerWindow * spikeMultiplier)\n'
)

resource errorRateAlert 'Microsoft.Insights/scheduledQueryRules@2022-06-15' = {
  name: '${namePrefix}-error-rate'
  location: location
  kind: 'LogAlert'
  tags: tags
  properties: {
    description: 'API error rate exceeded threshold'
    displayName: '${namePrefix} API Error Rate'
    enabled: true
    severity: 2
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    scopes: [
      monitorScopeResourceId
    ]
    targetResourceTypes: [
      monitorScopeType
    ]
    criteria: {
      allOf: [
        {
          query: errorRateQuery
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    autoMitigate: true
    actions: {
      actionGroups: [
        actionGroupResourceId
      ]
      customProperties: {
        signal: 'api_error_rate'
      }
    }
  }
}

resource latencyP95Alert 'Microsoft.Insights/scheduledQueryRules@2022-06-15' = {
  name: '${namePrefix}-latency-p95'
  location: location
  kind: 'LogAlert'
  tags: tags
  properties: {
    description: 'API p95 latency exceeded threshold'
    displayName: '${namePrefix} API p95 Latency'
    enabled: true
    severity: 2
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    scopes: [
      monitorScopeResourceId
    ]
    targetResourceTypes: [
      monitorScopeType
    ]
    criteria: {
      allOf: [
        {
          query: latencyP95Query
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    autoMitigate: true
    actions: {
      actionGroups: [
        actionGroupResourceId
      ]
      customProperties: {
        signal: 'api_latency_p95'
      }
    }
  }
}

resource crashSpikeAlert 'Microsoft.Insights/scheduledQueryRules@2022-06-15' = {
  name: '${namePrefix}-crash-spike'
  location: location
  kind: 'LogAlert'
  tags: tags
  properties: {
    description: 'API exception count spiked vs baseline'
    displayName: '${namePrefix} API Crash Spike'
    enabled: true
    severity: 1
    evaluationFrequency: 'PT5M'
    windowSize: 'PT45M'
    scopes: [
      monitorScopeResourceId
    ]
    targetResourceTypes: [
      monitorScopeType
    ]
    criteria: {
      allOf: [
        {
          query: crashSpikeQuery
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    autoMitigate: true
    actions: {
      actionGroups: [
        actionGroupResourceId
      ]
      customProperties: {
        signal: 'api_crash_spike'
      }
    }
  }
}
