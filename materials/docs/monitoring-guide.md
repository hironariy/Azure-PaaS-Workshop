# Monitoring Guide (Azure Monitor + Application Insights + Log Analytics)

This guide explains how to monitor and troubleshoot the Azure PaaS Workshop blog application.

- **Frontend**: Azure Static Web Apps
- **Backend**: Azure App Service (`/health`, `/api/health`)
- **Database**: Azure Cosmos DB for MongoDB vCore
- **Telemetry**: Application Insights (workspace-based) + Log Analytics

---

## 1. Monitoring Objectives

For workshop operations, answer these three questions quickly:

1. **Is it available?** (uptime, health checks, error rates)
2. **Is it healthy?** (dependency health, DB connectivity, auth flow)
3. **Is it performant?** (API latency, failures, saturation)

---

## 2. What Is Already Deployed by Bicep

From `materials/bicep/modules/monitoring.bicep`, the template creates:

- Log Analytics workspace (`PerGB2018`)
- Application Insights linked to that workspace
- workspace daily cap for workshop cost control

From `materials/bicep/modules/appservice.bicep`, the backend includes:

- `APPLICATIONINSIGHTS_CONNECTION_STRING`
- Node.js Application Insights extension settings
- App Service health check path: `/health`

---

## 3. Recommended Signal Map

## 3.1 Availability Signals

- App Service health endpoint status (`/health`)
- API route health through SWA (`/api/health`)
- HTTP status distribution (2xx/4xx/5xx)

## 3.2 Reliability Signals

- failed requests and exceptions in Application Insights
- Key Vault reference failures (app settings resolution issues)
- Cosmos DB connectivity failures from backend logs

## 3.3 Performance Signals

- request duration percentile (P50/P95/P99)
- dependency call duration and failures
- App Service CPU/memory trends

---

## 4. Practical Setup Steps

### 4.1 Verify App Service Health Checks

1. Confirm `/health` returns HTTP 200 in normal state.
2. Confirm `/api/health` is reachable through the frontend route.
3. Ensure unauthenticated health paths remain excluded in EasyAuth configuration.

### 4.2 Enable Diagnostic Settings (If Missing)

For production-like observability, route platform logs/metrics to Log Analytics for:

- App Service
- Static Web Apps (where supported categories are available)
- Key Vault
- Cosmos DB cluster resources

> The workshop Bicep baseline creates monitoring resources but does not enforce every resource diagnostic setting by default.

### 4.3 Standardize Application Logging

- keep structured logs (JSON-friendly)
- include correlation-friendly fields when possible (request id, user id, operation)
- avoid logging secrets / tokens / PII

---

## 5. Starter KQL Queries

> In Log Analytics workspace Logs, workspace-based Application Insights uses `AppRequests` / `AppExceptions`. In Application Insights resource Logs, the `requests` / `exceptions` aliases may also be available. The queries below assume Log Analytics workspace Logs.

### 5.1 Quick Table and Telemetry Check

```kusto
search *
| where TimeGenerated > ago(24h)
| summarize Records=count() by $table
| order by Records desc
```

### 5.2 App Service HTTP Failures (Application Insights)

```kusto
AppRequests
| where TimeGenerated > ago(1h)
| where Success == false or ResultCode startswith "5"
| project TimeGenerated, Name, ResultCode, DurationMs, OperationId, AppRoleName
| order by TimeGenerated desc
```

### 5.3 Slow API Requests (P95)

```kusto
AppRequests
| where TimeGenerated > ago(24h)
| summarize P95DurationMs=percentile(DurationMs, 95) by Name
| order by P95DurationMs desc
```

### 5.4 Exceptions by Type

```kusto
AppExceptions
| where TimeGenerated > ago(24h)
| summarize Exceptions=count() by ExceptionType
| order by Exceptions desc
```

### 5.5 If Tables Are Missing

If `AppRequests` / `AppExceptions` do not appear, first generate backend traffic so Application Insights has telemetry to ingest.

```bash
curl -fsS "https://${APP_SERVICE_NAME}.azurewebsites.net/health" | jq .
curl -fsS "https://${SWA_HOSTNAME}/api/health" | jq .
```

If `AppRequests` still does not appear after a few minutes, confirm that the App Service `APPLICATIONINSIGHTS_CONNECTION_STRING` app setting is not empty.

```bash
az webapp config appsettings list \
	--resource-group "$RESOURCE_GROUP" \
	--name "$APP_SERVICE_NAME" \
	--query "[?name=='APPLICATIONINSIGHTS_CONNECTION_STRING'].{name:name,value:value}" \
	-o table
```

After adding or updating the connection string, restart App Service and call `/health` again.

---

## 6. Alerting Baseline (Minimum)

Create alert rules for:

- HTTP 5xx ratio above threshold (e.g., 5% for 5 minutes)
- health check failures (`/health`) consecutive threshold
- abnormal latency (P95 duration increase)
- exception spike compared to baseline

Notification targets:

- email / Teams / PagerDuty (based on your team practice)

---

## 7. Troubleshooting Flow (Workshop)

Use this order to isolate issues quickly:

1. **Frontend reachability** (SWA is serving static content)
2. **API health via SWA** (`/api/health`)
3. **Direct backend health** (`/health`)
4. **Application Insights failures/exceptions**
5. **Database dependency status** (connection failures, timeout patterns)

---

## 8. Operational Good Practices

- keep one Log Analytics workspace per environment for clarity
- align alert thresholds with user-facing SLOs
- test alerts monthly (do not wait for real incidents)
- track MTTA/MTTR and review after each incident

---

## 9. Next Improvements (Optional)

- add dashboard/workbook for workshop instructors
- codify diagnostic settings and alerts in Bicep modules
- add synthetic probes for end-to-end login + post creation flow
