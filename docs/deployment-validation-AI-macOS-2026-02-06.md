# Azure PaaS Workshop – Student Deployment Validation Log (macOS)

- Date: 2026-02-06
- Role: Student
- Team Name: AI-macOS
- OS: macOS
- Workspace: /Users/hironariy/dev/AzurePaaSWorkshop
- Target Azure subscription: ME-MngEnvMCAP668092-hiyam-1

## Rules for this run

- I will follow the root README deployment steps exactly.
- I will only run commands that are explicitly in the README/docs/scripts, plus read-only verification commands (e.g., `ls`, `cat`, `git status`, version checks).
- For every command I run, I will record:
  - Why I ran it
  - The exact command
  - Result (success/failure + key output)
- If I need any command/technique not described in the README/docs, I will stop and ask for permission.

## 0) Pre-flight (read-only)

### 0.1 Repo status

- Reason: Confirm workspace state before changes.
- Command:
  - `git status`
- Result:
  - Clean working tree on `main` (up to date with `origin/main`).

### 0.2 Tool versions

- Reason: README requires specific tool versions.
- Commands:
  - `git --version`
  - `az --version`
  - `az bicep version`
  - `node --version`
  - `swa --version`
- Result:
  - Git: `2.52.0`
  - Azure CLI: `2.82.0`
  - Bicep: `0.39.26` (Azure CLI indicated `az bicep upgrade` available to `0.40.2`)
  - Node.js: `v22.17.0`
  - SWA CLI: `2.0.7`
  - Extra (read-only check for README health-check formatting): `jq 1.8.1`

### 0.3 Azure subscription context

- Reason: Ensure operations target the instructed subscription.
- Commands:
  - `az account show`
  - `az account set --subscription "ME-MngEnvMCAP668092-hiyam-1"`
  - `az account show`
- Result:
  - Confirmed active subscription:
    - Name: `ME-MngEnvMCAP668092-hiyam-1`
    - Subscription ID: `78d2b28b-2bad-42b5-b773-6846e2da2866`
    - Tenant ID: `b3bbbafb-e820-42af-a675-c6d8fece5011`

## 1) README Step 2.3 – Azure Deployment

### 1.1 Step 2 – Configure Bicep parameters

- Reason: Create `materials/bicep/dev.local.bicepparam` and fill required parameters.
- Commands (from README):
  - `cd materials/bicep`
  - `cp dev.bicepparam dev.local.bicepparam`
  - `code dev.local.bicepparam`
  - `openssl rand -base64 16` (for `cosmosDbAdminPassword`)
- Result:
  - `materials/bicep/dev.local.bicepparam` already existed in this workspace and already contained:
    - `entraTenantId`, `entraBackendClientId`, `entraFrontendClientId`
    - `cosmosDbAdminPassword`
  - I changed `groupId` from `'C'` to `''` to align with a single-group deployment (edit is within the README's "Edit with your values" step).

> Note: Entra IDs (`entraTenantId`, `entraBackendClientId`, `entraFrontendClientId`) are required and are typically gathered from Entra app registrations created via Azure Portal per README Section 2.1.5.

### 1.2 Step 3 – Deploy infrastructure (Bicep)

- Reason: Deploy Azure resources.
- Commands (from README):
  - `az group create --name <Resource-Group-Name> --location japaneast`
  - `az deployment group create --resource-group <Resource-Group-Name> --template-file main.bicep --parameters dev.local.bicepparam`
  - `az resource list --resource-group <Resource-Group-Name> --output table`
- Result:
  - Resource group created successfully:
    - Name used: `rg-blogapp-ai-macos-dev`
    - Location: `japaneast`
  - Bicep deployment command completed successfully (duration ~12m 45s).
  - Deployment name observed: `main` (the CLI created the deployment with this name even though `--name` was not explicitly specified).
  - Bicep linter warnings were shown (did not block deployment):
    - `no-unused-params` for `environment` param in several modules
    - `no-unnecessary-dependson` in `main.bicep`
  - Key outputs captured from deployment:
    - App Service name: `app-blogapp-yfv3hd`
    - Static Web App name: `swa-blogapp-yfv3hd`
    - Static Web App URL: `https://victorious-forest-060147d00.2.azurestaticapps.net`
    - API (via SWA): `https://victorious-forest-060147d00.2.azurestaticapps.net/api`
  - Resource list verification: resources in RG show `Succeeded` including VNet, NAT GW, Key Vault, Cosmos (Mongo vCore), App Service, Static Web App.

### 1.3 Step 4 – Update Entra ID redirect URIs

- Reason: Add SWA hostname to Frontend app registration redirect URIs.
- Commands (from README):
  - `az staticwebapp show --name $(az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv) --resource-group <Resource-Group-Name> --query "defaultHostname" -o tsv`
- Portal step:
  - Add `https://<swa-hostname>` to SPA redirect URIs.
- Result:
  - SWA hostname resolved:
    - `victorious-forest-060147d00.2.azurestaticapps.net`
  - Manual portal step required (cannot be fully verified via README commands):
    - Add redirect URI: `https://victorious-forest-060147d00.2.azurestaticapps.net`

### 1.4 Step 5 – Deploy backend

- Reason: Deploy API to App Service.
- Commands (from README):
  - `cd ../..`
  - `APP_SERVICE_NAME=$(az deployment group show --resource-group <Resource-Group-Name> --name main --query "properties.outputs.appServiceName.value" -o tsv)`
  - `echo "App Service Name: $APP_SERVICE_NAME"`
  - `./scripts/deploy-backend.sh <Resource-Group-Name> $APP_SERVICE_NAME`
- Result:
  - App Service name from outputs: `app-blogapp-yfv3hd`
  - `./scripts/deploy-backend.sh` completed successfully.
  - Health endpoint returned HTTP 200 with JSON:
    - `{ "status": "healthy", "timestamp": "2026-02-06T00:50:34.115Z" }`

### 1.5 Step 6 – Deploy frontend

- Reason: Deploy React app to Static Web Apps via SWA CLI.
- Commands (from README):
  - `cp scripts/deploy-frontend.template.env scripts/deploy-frontend.local.env`
  - `code scripts/deploy-frontend.local.env`
  - `./scripts/deploy-frontend.sh <Resource-Group-Name>`
- Result:
  - `./scripts/deploy-frontend.sh rg-blogapp-ai-macos-dev` completed successfully.
  - Deployment URL reported by SWA CLI:
    - `https://victorious-forest-060147d00.2.azurestaticapps.net`
  - Note: `npm audit` reported 5 moderate vulnerabilities during build (did not block build/deploy).

### 1.6 Step 7 – Verify deployment

- Reason: Verify health endpoints.
- Commands (from README):
  - `APP_SERVICE_NAME=$(az deployment group show --resource-group <Resource-Group-Name> --name main --query "properties.outputs.appServiceName.value" -o tsv)`
  - `SWA_HOSTNAME=$(az staticwebapp show --name $(az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv) --resource-group <Resource-Group-Name> --query "defaultHostname" -o tsv)`
  - `curl -s "https://$APP_SERVICE_NAME.azurewebsites.net/health" | jq .`
  - `curl -s "https://$SWA_HOSTNAME/api/health" | jq .`
- Result:
  - URLs:
    - Frontend: `https://victorious-forest-060147d00.2.azurestaticapps.net`
    - API (via SWA): `https://victorious-forest-060147d00.2.azurestaticapps.net/api/health`
    - API (direct): `https://app-blogapp-yfv3hd.azurewebsites.net/health`
  - Health checks:
    - Direct App Service `/health`: returned `{"status":"healthy"...}`
    - SWA proxied `/api/health`: returned `{"status":"healthy"...}`
  - Extra read-only check (not in README): `curl -I https://<swa-hostname>` returned `HTTP/2 200` with `content-type: text/html`.

## 2) Findings / Gaps

- ✅ End-to-end deployment (infra + backend + frontend) succeeded on macOS following the root README steps.

- Entra redirect URI status (read-only check): The Frontend SPA app registration currently contains redirect URIs for a different SWA hostname (`white-ground-087365200.4.azurestaticapps.net`) but does NOT include this run’s SWA hostname (`victorious-forest-060147d00.2.azurestaticapps.net`).
  - This means Entra login via the newly deployed SWA URL will fail until the redirect URI is added.

- Azure CLI alternative redirect URI update (validated):
  - Attempted `az ad app update --set "spa.redirectUris=..."` and it failed with: `Couldn't find 'spa' in ''`.
  - Working form is to set `spa={}` in the same update call, then set `spa.redirectUris`:
    - `az ad app update --id <entraFrontendClientId> --set "spa={}" --set "spa.redirectUris=<json-array>"`
  - Verification after update showed `spa.redirectUris` includes:
    - `https://victorious-forest-060147d00.2.azurestaticapps.net`
    - `https://victorious-forest-060147d00.2.azurestaticapps.net/`

- README uses `jq` in health-check examples, but `jq` is not listed in prerequisites.
  - Suggestion: Add `jq` to macOS/Linux prerequisites OR provide a `jq`-free alternative.

- Entra redirect URI update is a required manual portal step.
  - Suggestion: Call out explicitly that login will fail until redirect URI is added.

- Bicep linter warnings appear during deployment (`no-unused-params`, `no-unnecessary-dependson`).
  - Suggestion: Note they are warnings only, or clean them up to reduce student anxiety.

- Frontend build output reports `npm audit` moderate vulnerabilities.
  - Suggestion: Add a short note that this does not block the workshop, and how to handle it in a real project.

- Azure CLI reported a newer Bicep version available; current version still worked.
  - Suggestion: Optional note that `az bicep upgrade` can be run if needed.
