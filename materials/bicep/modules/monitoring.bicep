// =============================================================================
// Monitoring Module - Log Analytics Workspace and Application Insights
// =============================================================================
// This module creates:
// - Log Analytics Workspace
// - Application Insights (workspace-based)
// =============================================================================

@description('Environment name (dev, staging, prod)')
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Base name for resources')
param baseName string

@description('Log Analytics retention in days')
@minValue(30)
@maxValue(730)
param retentionInDays int = 30

@description('Tags to apply to all resources')
param tags object = {}

// =============================================================================
// Variables
// =============================================================================

var logAnalyticsName = 'log-${baseName}-${environment}'
var appInsightsName = 'appi-${baseName}-${environment}'

// =============================================================================
// Log Analytics Workspace
// =============================================================================

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionInDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: 1 // Limit for workshop cost control
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// =============================================================================
// Application Insights
// =============================================================================

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Request_Source: 'rest'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    DisableIpMasking: false
    DisableLocalAuth: false
    RetentionInDays: 90
  }
}

// =============================================================================
// Outputs
// =============================================================================

output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name
output logAnalyticsWorkspaceCustomerId string = logAnalyticsWorkspace.properties.customerId

output appInsightsId string = appInsights.id
output appInsightsName string = appInsights.name
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output appInsightsConnectionString string = appInsights.properties.ConnectionString
