# Bicep Guide (Azure PaaS Workshop Blog Application)

This guide explains how the Bicep templates in this workshop are structured, how to customize parameters, and how to operate deployments safely.

Directory:

```
materials/bicep/
├── main.bicep
├── *.bicepparam
└── modules/
    ├── network.bicep
    ├── monitoring.bicep
    ├── keyvault.bicep
    ├── cosmosdb.bicep
    ├── appservice.bicep
    ├── appservice-auth.bicep
    └── staticwebapp.bicep
```

---

## 1. Deployment Architecture Implemented by Bicep

The Bicep templates deploy this PaaS topology:

1. Networking foundation (VNet, subnets, NAT Gateway, private DNS zones)
2. Monitoring foundation (Log Analytics + Application Insights)
3. Key Vault (with private endpoint)
4. Cosmos DB for MongoDB vCore (with private endpoint)
5. App Service (Linux) with VNet integration and managed identity
6. Static Web Apps (with optional linked backend)
7. EasyAuth override for API-safe behavior (`Return401`, excluded paths)

Entry point:

- `materials/bicep/main.bicep`

---

## 2. Main Parameters You Should Understand

Important parameters in `main.bicep`:

- `environment`: `dev`, `staging`, `prod`
- `location`: primary Azure region
- `baseName`: base naming stem for resources
- `deploymentMode`: `standard` or `fastpath-container`
- `appServiceContainerImage`: required when using container fast path
- `groupId`: workshop multi-group identifier (`A`-`J`)
- `entraTenantId`, `entraBackendClientId`, `entraFrontendClientId`
- `cosmosDbAdminPassword` (secure)
- `appServiceSku`, `cosmosDbTier`, `cosmosDbEnableHa`
- `staticWebAppSku`, `staticWebAppLocation`

---

## 3. Module-by-Module Explanation

## 3.1 `network.bicep`

Creates:

- VNet with `snet-appservice` and `snet-privateendpoint`
- NAT Gateway + public IP for outbound traffic
- private DNS zones for Cosmos DB and Key Vault private endpoints

Design intent:

- keep App Service outbound stable and controlled
- keep data-plane services reachable through private networking

## 3.2 `monitoring.bicep`

Creates:

- Log Analytics workspace
- workspace-based Application Insights

Design intent:

- central telemetry sink for application and platform troubleshooting

## 3.3 `keyvault.bicep`

Creates:

- Key Vault with private endpoint
- RBAC path for App Service managed identity to read secrets

Design intent:

- no inline secrets in app settings or source files

## 3.4 `cosmosdb.bicep`

Creates:

- Cosmos DB for MongoDB vCore cluster
- private endpoint + DNS zone group
- stores connection string and admin password into Key Vault

Design intent:

- backend receives DB connection via Key Vault reference, not plaintext config

## 3.5 `appservice.bicep`

Creates:

- App Service Plan (Linux)
- App Service with system-assigned managed identity
- VNet integration
- app settings including App Insights connection string and Key Vault reference
- health check path `/health`

Design intent:

- managed runtime + secure secret flow + health-aware operation

## 3.6 `staticwebapp.bicep`

Creates:

- Static Web App resource
- linked backend only when `sku == 'Standard'` and backend ID is provided

Design intent:

- simple frontend hosting path; optional direct SWA-to-App Service routing capability

## 3.7 `appservice-auth.bicep`

Configures App Service `authsettingsV2` after SWA/backend linkage:

- `unauthenticatedClientAction: 'Return401'`
- excluded paths include `/health`, `/api/health`, and public-read post paths
- enables Entra ID and Azure Static Web Apps identity provider

Design intent:

- avoid login redirects for API calls and preserve health checks

---

## 4. Parameter File Strategy

Available examples:

- `main.bicepparam`, `dev.bicepparam`
- `main.fastpath.bicepparam`, `dev.fastpath.bicepparam`
- local copies such as `*.local.bicepparam`

Recommended workflow:

1. Copy from the closest baseline (`dev` for workshop).
2. Set Entra IDs and secure password values.
3. For `fastpath-container`, set immutable container image reference.
4. Keep local overrides in non-committed local parameter files.

---

## 5. Deployment Commands (Reference)

Validate before deployment:

```bash
az deployment group validate \
  --resource-group <resource-group-name> \
  --template-file materials/bicep/main.bicep \
  --parameters materials/bicep/dev.fastpath.local.bicepparam
```

Deploy:

```bash
az deployment group create \
  --resource-group <resource-group-name> \
  --template-file materials/bicep/main.bicep \
  --parameters materials/bicep/dev.fastpath.local.bicepparam
```

Read outputs:

```bash
az deployment group show \
  --resource-group <resource-group-name> \
  --name main \
  --query properties.outputs
```

---

## 6. Safe Change Management for Bicep

When updating templates:

1. Change one module concern at a time.
2. Run `validate` before `create`.
3. Use a temporary resource group for destructive-risk checks.
4. Review resulting outputs and dependent service connectivity.
5. Document parameter changes in deployment notes.

---

## 7. Common Pitfalls

- mismatch between `deploymentMode` and `appServiceContainerImage`
- missing Entra IDs in parameter files
- forgetting to update local parameter copy before deployment
- assuming SWA linked backend behavior while using Free SKU constraints
- not checking EasyAuth behavior after auth-related changes

---

## 8. Post-Deployment Tasks (Operational)

- retrieve SWA deployment token if needed for frontend deployment pipeline
- deploy backend artifact/container to App Service
- validate `/health` and `/api/health`
- confirm Key Vault secret resolution works in App Service runtime
- confirm telemetry flows to Application Insights / Log Analytics

---

## 9. Next Improvements (Optional)

- codify diagnostic settings and alerts as additional Bicep modules
- add secondary-region Bicep parameter baseline for DR drills
- add policy/guardrails for SKU and network security defaults
