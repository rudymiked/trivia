targetScope = 'subscription'

param subscriptionId string
param budgetName string = 'Trivia-Monthly-20'
param monthlyLimit int = 20
param notificationEmail string = 'rudymiked@gmail.com'
param startDate string = '2026-03-01'

// Create cost budget with alerts at 80% and 100%
resource costBudget 'Microsoft.CostManagement/budgets@2021-10-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: monthlyLimit
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: startDate
      endDate: '2099-12-31'
    }
    filter: {
      dimensions: {
        name: 'ResourceGroupName'
        operator: 'In'
        values: [
          'Trivia'
        ]
      }
    }
    notifications: {
      notificationDefault: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 90
        thresholdType: 'Forecasted'
        contactEmails: [
          notificationEmail
        ]
      }
      notificationActual: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: [
          notificationEmail
        ]
      }
    }
  }
}

output budgetId string = costBudget.id
output budgetName string = costBudget.name
