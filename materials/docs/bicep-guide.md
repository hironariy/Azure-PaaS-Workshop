# Bicep Guide (Azure PaaS Workshop Blog Application)

This guide explains how the Bicep templates in this workshop are structured, how to customize parameters, and how to operate deployments safely.

The executable path is the [Japanese learner guide](learner/day-1-deploy-infrastructure.ja.html).
Baseline: **B1 / M25 / HA=false / SWA Standard**, public App Service HTTPS and
outbound VNet integration. B1 has no slots/zone redundancy; M25 has no HA.
Contributor-only/no-organizer preparation remains blocked by the required role
assignment, and Entra registration/consent is a separate policy plane.

Directory:

```
materials/bicep/
├── main.bicep
├── *.bicepparam
└── modules/
    ├── network.bicep
    ├── monitoring.bicep
    ├── keyvault.bicep
    ├── keyvault-rbac.bicep
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
6. Static Web Apps Standard with required linked backend
7. EasyAuth override for API-safe behavior (`Return401`, excluded paths)

Entry point:

- `materials/bicep/main.bicep`

---

## 2. Main Parameters You Should Understand

Important parameters in `main.bicep`:

- `environment`: `dev`, `staging`, `prod`
- `location`: primary Azure region
- `baseName`: base naming stem for resources
- `deploymentMode`: use `standard` for the learner path
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
- endpoint and DNS group; this is their sole writer

Design intent:

- no inline secrets in app settings or source files

### `keyvault-rbac.bicep`

Assigns Secrets User to the App Service MI on the **existing** vault, preserving
scope/principal/role/deterministic GUID. It does not write the vault or endpoint.
Contributor cannot perform roleAssignments/write. Do not skip RBAC or downgrade
to access policies. The pinned cluster API does not expose publicNetworkAccess;
verify effective DB firewall/DNS/routes, not just endpoint existence.

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

- orchestrator requires Standard; standalone Free is only for deployments without a linked backend

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
- local copies such as `*.local.bicepparam`

Recommended workflow:

1. Copy from the closest baseline (`dev` for workshop).
2. Set Entra IDs and secure password values.
3. Keep `deploymentMode = 'standard'` for the learner path.
4. Keep local overrides in non-committed local parameter files.

Use the state directory's private PARAM_FILE with a generated `using` path.
Generate its password only on first creation, preserve it on repeat, and never
print/store secrets in JSON state or Git. Existing M30+ deployments must preserve
their actual tier explicitly; the fresh M25 default is not a downgrade command.
M30+ cannot scale back to M25.

---

## 5. Deployment Commands (Reference)

Only run after permissions/consent/provider/region/quota/tier/capacity/cost checks:

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load identity || exit 1
az deployment group validate \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$WORKSHOP_REPO_DIR/materials/bicep/main.bicep" \
  --parameters "$PARAM_FILE" || exit 1
```

Deploy:

```bash
az deployment group create \
  --subscription "$SUBSCRIPTION_ID" --name main \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$WORKSHOP_REPO_DIR/materials/bicep/main.bicep" \
  --parameters "$PARAM_FILE" || exit 1
```

Read outputs:

```bash
az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query '{state:properties.provisioningState,started:properties.timestamp,outputs:properties.outputs}' \
  -o jsonc || exit 1
```

Confirm this operation's start/correlation ID/Succeeded, not previous outputs.
Failure/cancellation is not permission to save state or deploy code. Regenerate
distributed main.json with **Bicep 0.44.1** and check exact artifact parity.
Compilation alone is not live validation or idempotence.

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

- `deploymentMode` not set to `standard`
- missing Entra IDs in parameter files
- forgetting to update local parameter copy before deployment
- assuming SWA linked backend behavior while using Free SKU constraints
- not checking EasyAuth behavior after auth-related changes

---

## 8. Post-Deployment Tasks (Operational)

- use the state-scoped frontend script, which passes its token through environment without printing it
- deploy backend ZIP artifact to App Service
- validate `/health` and `/api/health`
- confirm Key Vault secret resolution works in App Service runtime
- confirm telemetry flows to Application Insights / Log Analytics

---

## 9. Next Improvements (Optional)

- codify diagnostic settings and alerts as additional Bicep modules
- add secondary-region Bicep parameter baseline for DR drills
- add policy/guardrails for SKU and network security defaults
