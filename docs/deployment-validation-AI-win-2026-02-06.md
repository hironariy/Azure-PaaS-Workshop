# Deployment Validation Log (Windows) — AI-win — 2026-02-06

## Purpose
Validate that a student on Windows 11 can deploy Azure resources, backend, and frontend by following the repository instructions.

## Student Profile
- OS: Windows 11
- Team name: AI-win
- Repo name (if needed): Test-PaaS-win (private)

## Rules / Constraints
- Follow README instructions as the source of truth.
- If a command/technique is needed but not documented, pause and ask instructor permission.
- Record every step/command and its result here.

## Timeline
- Start: 2026-02-06

## Step 1 — Tool Check (PowerShell)

Commands executed from repo root.

### `git --version`
- Result: `git version 2.52.0.windows.1`

### `Get-InstalledModule -Name Az | Select-Object Name, Version`
- Result:
	- `Az 15.2.0`

### `bicep --version`
- Result: `Bicep CLI version 0.39.26 (1e90b06e40)`

### `node --version`
- Result: `v24.12.0`
- Note: README expects Node.js 22.x LTS; Node 24 is installed. Proceeding unless we hit compatibility issues.

### `swa --version`
- Result: FAILED (`swa` not recognized)
- Action needed: Install `@azure/static-web-apps-cli` (SWA CLI). README suggests `npm install -g @azure/static-web-apps-cli`.

### Install SWA CLI
- Command: `npm install -g @azure/static-web-apps-cli`
- Result: SUCCESS (installed)
- Notes: npm printed several deprecation warnings during install, but install completed.

### `swa --version` (after install)
- Result: `2.0.8`

### `az --version`
- Result: `azure-cli 2.82.0` (meets README requirement 2.60+)
- Note: CLI reports 2 updates available.

## Step 2 — Azure Login (PowerShell)

### `Connect-AzAccount`
- Result: SUCCESS
- Subscription selected:
	- Name: `ME-MngEnvMCAP668092-hiyam-1`
	- Subscription ID: `78d2b28b-2bad-42b5-b773-6846e2da2866`
	- Tenant ID: `b3bbbafb-e820-42af-a675-c6d8fece5011`
	- Environment: `AzureCloud`

## Step 3 — Local Configuration Files

### Create Bicep local parameters
- Working folder: `materials\\bicep`
- Command: `Copy-Item dev.bicepparam dev.local.bicepparam`
- Edited: `dev.local.bicepparam`
	- `location`: `japanwest` (from template)
	- `environment`: `dev` (from template)
	- `entraTenantId`: `b3bbbafb-e820-42af-a675-c6d8fece5011`
	- `entraBackendClientId`: `16dd2517-ffd4-41eb-a1f0-4f9c937f89fd`
	- `entraFrontendClientId`: `b4f02c6a-dc8b-41e9-a70a-96b3af4afc0f`
	- `cosmosDbAdminPassword`:
		- README method (`openssl rand -base64 16`) could not be used because `openssl` is not available.
		- Set using PowerShell alternative method (crypto RNG) without printing the value.

### Create frontend deploy env file
- Command: `Copy-Item scripts\\deploy-frontend.template.env scripts\\deploy-frontend.local.env`
- Edited: `scripts\\deploy-frontend.local.env`
	- `ENTRA_TENANT_ID`: `b3bbbafb-e820-42af-a675-c6d8fece5011`
	- `ENTRA_FRONTEND_CLIENT_ID`: `b4f02c6a-dc8b-41e9-a70a-96b3af4afc0f`
	- `ENTRA_BACKEND_CLIENT_ID`: `16dd2517-ffd4-41eb-a1f0-4f9c937f89fd`

## Step 4 — Deploy Infrastructure (Bicep)

### Create resource group

### Start deployment
	- `ProvisioningState`: `Running`
	- `Timestamp`: `2026/02/06 2:36:08`
	- `CorrelationId`: `4f8add38-6d71-41bf-ab3a-b5bd80808f26`

### Cancel deployment (took too long)

### Fix: Azure CLI PowerShell redirect URI update (Windows)

- Problem encountered earlier: Azure CLI error `An unexpected 'PrimitiveValue' node was found... A 'StartArray' node was expected.` when trying to set `spa.redirectUris` using a JSON array string.
- Root cause: On Windows, the JSON double-quotes can be stripped/altered when passed through `--set`, causing the CLI to send an invalid type.
- Working fix: pass a Python-style list literal with single quotes.

Commands used (frontend app registration):

```powershell
$frontendAppId = "b4f02c6a-dc8b-41e9-a70a-96b3af4afc0f"
$swaUrl = "https://polite-rock-0c2523400.4.azurestaticapps.net"

$existing = @(az ad app show --id $frontendAppId --query "spa.redirectUris" -o json | ConvertFrom-Json)
$new = @($existing + $swaUrl + "$swaUrl/")
$new = @($new | Sort-Object -Unique)

$newPyList = '[' + (($new | ForEach-Object { "'$_'" }) -join ',') + ']'
az ad app update --id $frontendAppId --set "spa={}" --set "spa.redirectUris=$newPyList"

# Verify
az ad app show --id $frontendAppId --query "spa.redirectUris" -o json | Select-String -Pattern "polite-rock"
```

Result:
- Update succeeded (`update_exit_code=0`)
- Redirect URIs now include:
  - `https://polite-rock-0c2523400.4.azurestaticapps.net`
  - `https://polite-rock-0c2523400.4.azurestaticapps.net/`
- Command: `Stop-AzResourceGroupDeployment -ResourceGroupName "rg-blogapp-ai-win-dev" -Name "main" -Confirm:$false`
- Result: `ProvisioningState` changed to `Canceled`
- Note: `Stop-AzResourceGroupDeployment` on this environment does not support `-Force`.

### Partial resources created
- After cancel, resource group already contains resources (Cosmos DB, Key Vault, VNet, etc.).
- Implication: Re-deploying to a different region with the same names is likely to fail unless we either delete this resource group or deploy into a new resource group.

### Re-deploy using a new resource group (Japan East)
- Selected approach: New resource group (to avoid conflicts with partially created resources)
- New resource group: `rg-blogapp-ai-win-dev-je`
- Resource group location: `japaneast`
- Bicep param `location`: `japaneast`
- Deployment command: `New-AzResourceGroupDeployment -Name main -ResourceGroupName "rg-blogapp-ai-win-dev-je" -TemplateFile "materials\\bicep\\main.bicep" -TemplateParameterFile "materials\\bicep\\dev.local.bicepparam"`
- Result: `ProvisioningState` = `Succeeded`

Key outputs:
- `uniqueSuffix`: `h34asb`
- `appServiceName`: `app-blogapp-h34asb`
- `appServiceUrl`: `https://app-blogapp-h34asb.azurewebsites.net`
- `staticWebAppName`: `swa-blogapp-h34asb`
- `staticWebAppUrl`: `https://polite-rock-0c2523400.4.azurestaticapps.net`
- `apiUrl`: `https://polite-rock-0c2523400.4.azurestaticapps.net/api`

## Step 5 — Backend Deployment (App Service)

### Attempt (Windows PowerShell alternative)
- Target resource group: `rg-blogapp-ai-win-dev-je`
- Target App Service: `app-blogapp-h34asb`
- Steps executed: `npm install`, `npm run build`, package `dist` into `deploy.zip`, set `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, set startup file `node src/app.js`, then `az webapp deploy --async true`.

### Symptom
- `az webapp deploy` showed repeated `Status: Starting the site...` for a long time and did not complete successfully before it was stopped.

### Assumption / Hypothesis (to validate)
- The backend deployment command options/behavior for PowerShell users may not align with the intended workshop deployment flow and could contribute to extended startup or perceived hang.
- Even if the CLI command is stopped locally, the ZIP deploy and site start may still continue server-side; the correct next step is to verify via `/health` and/or check logs.

### Verification
- Direct health endpoint: `https://app-blogapp-h34asb.azurewebsites.net/health`
- Result: `status=healthy` (timestamp `2026/02/06 4:14:34`)

## Step 6 — Frontend Deployment (Static Web Apps)

### Notes / fixes required on Windows

1) **Get-AzStaticWebAppSecret output shape**
- README originally used `.Properties.ApiKey`, but in this environment the token is under `.Property` (a JSON string).
- Working token retrieval:

```powershell
$deploymentToken = ((Get-AzStaticWebAppSecret -ResourceGroupName $rg -Name $swaName).Property | ConvertFrom-Json).apiKey
```

2) **SWA CLI default deploy environment is `preview`**
- `swa deploy dist --deployment-token ...` deploys to a preview URL by default.
- Use `--env production` to deploy to the workshop hostname.

### Commands executed (summary)

- Build:
	- `cd materials\frontend`
	- `npm install`
	- `npm run build`
- Injected runtime config into `dist\index.html` via `window.__APP_CONFIG__=...` (API base `/api`).
- Deploy to production:
	- `swa deploy dist --deployment-token <token> --env production`

### Verification

- Frontend URL: `https://polite-rock-0c2523400.4.azurestaticapps.net`
- API via SWA health: `https://polite-rock-0c2523400.4.azurestaticapps.net/api/health`
- Result: `status=healthy` (timestamp `2026/02/06 5:04:31`)

### Issue: Browser login failed with `AADSTS900144` (missing `client_id`)

- Symptom: App loads, but sign-in fails with `AADSTS900144: The request body must contain the following parameter: 'client_id'`.
- Diagnosis: Deployed `index.html` contained an invalid/empty config assignment:
	- `window.__APP_CONFIG__=;`
	- This breaks runtime config loading, leaving `entraFrontendClientId` empty.

### Fix applied

1) Rebuild the frontend to restore the placeholder:
- `npm run build` (regenerates `dist/index.html` with `window.__APP_CONFIG__=null;`)

2) Inject config using a PowerShell hashtable + `ConvertTo-Json` (avoid fragile escaping), and replace `null`/existing object/**or empty** assignment.

3) Redeploy to SWA production:
- `swa deploy dist --deployment-token <token> --env production`

### Post-fix verification

- Production `index.html` now contains:
	- `window.__APP_CONFIG__={"ENTRA_TENANT_ID":"...","ENTRA_FRONTEND_CLIENT_ID":"...","ENTRA_BACKEND_CLIENT_ID":"...","API_BASE_URL":"/api"}`
- API via SWA health check still returns `healthy` (timestamp `2026/02/06 5:14:34`).

## Step 7 — Application Functional Tests (Browser)

### Authentication Test
- Result: SUCCESS
	- Can sign in
	- Can sign out
	- Profile page loads after login

### CRUD Operations Test
- Result: SUCCESS
	- Create post: OK
	- View post: OK
	- Edit post: OK
	- Delete post: OK

## Final Outcome
- End-to-end deployment validated on Windows 11 by following README instructions (with documented Windows-specific adjustments applied during this run).
