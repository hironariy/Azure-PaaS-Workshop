# Materials Validation Strategy

This document defines the comprehensive testing strategy for validating Azure PaaS Workshop materials before release.

**Created:** 2026-02-04  
**Status:** Draft

---

## Table of Contents

1. [Validation Overview](#validation-overview)
2. [Phase 1: Local Development Testing](#phase-1-local-development-testing)
3. [Phase 2: Azure E2E Testing](#phase-2-azure-e2e-testing)
4. [Test Cases by Component](#test-cases-by-component)
5. [Success Criteria](#success-criteria)
6. [Known Limitations](#known-limitations)

---

## Validation Overview

### Three-Phase Approach

| Phase | Environment | Purpose | Duration | Cost |
|-------|-------------|---------|----------|------|
| **Phase 1a** | Local (Vite direct + Real Entra ID) | Fast code validation, API contracts, auth flow | 1-2 hours | Free |
| **Phase 1b** | Local (SWA CLI + Real Entra ID) | SWA routing, API proxy, production-like behavior | 1-2 hours | Free |
| **Phase 2** | Azure (Full PaaS stack) | Infrastructure, security, performance, E2E flows | 4-8 hours | ~$5-10 |

### Testing Principles

1. **Fail Fast** - Vite direct catches code issues immediately
2. **Production Parity** - SWA CLI validates production routing behavior
3. **Real Environment** - Azure testing validates what workshop participants will experience
4. **Documented** - All test results should be recorded for workshop iteration
5. **Reproducible** - Tests should be repeatable by workshop facilitators

---

## Phase 1a: Local Development Testing (Vite Direct)

This phase uses Vite's built-in dev server for fast iteration and immediate feedback.

**Entry Point:** `http://localhost:5173`

### 1a.1 Prerequisites Check

Before starting, verify:

```bash
# Required tools
node --version          # >= 18.x
npm --version           # >= 9.x
docker --version        # >= 24.x
docker compose version  # >= 2.x

# Optional but recommended
mongosh --version       # For database inspection
```

### 1a.2 Environment Setup

#### Step 1: Configure Microsoft Entra ID (One-time Setup)

Before starting local development, you must configure Microsoft Entra ID app registrations.

**Create App Registrations in Azure Portal:**

1. **Backend API App Registration**
   - Go to Azure Portal > Microsoft Entra ID > App registrations > + New registration
   - Name: `BlogApp Backend API`
   - Supported account types: Single tenant
   - Go to "Expose an API" and create scope: `access_as_user`

2. **Frontend SPA App Registration**
   - Go to Azure Portal > Microsoft Entra ID > App registrations > + New registration
   - Name: `BlogApp Frontend SPA`
   - Supported account types: Single tenant
   - Redirect URIs (Single-page application):
     - `http://localhost:5173` (Vite direct)
     - `http://localhost:4280` (SWA CLI emulator)
   - Go to "API permissions" and add permission for Backend API's `access_as_user` scope

See [Entra ID Setup Guide](../docs/entra-id-setup.md) for detailed step-by-step instructions.

**Collect Required Values:**

| Value | Where to Find | Used In |
|-------|---------------|---------|
| Tenant ID | Entra ID > Overview | Backend + Frontend |
| Backend API Client ID | Backend app > Overview | Backend + Frontend |
| Frontend SPA Client ID | Frontend app > Overview | Frontend |

**Verification Points:**
- [ ] Backend API app registration created with `access_as_user` scope
- [ ] Frontend SPA app registration created with redirect URIs:
  - `http://localhost:5173` (Vite direct)
  - `http://localhost:4280` (SWA CLI emulator)
- [ ] Frontend has API permission for Backend API
- [ ] All three IDs collected (Tenant ID, Backend Client ID, Frontend Client ID)

#### Step 2: Start Local Database

```bash
cd dev-environment
docker compose up -d
```

**Verification Points:**
- [ ] MongoDB container starts without errors
- [ ] Port 27017 is accessible
- [ ] `docker compose logs mongo` shows "Waiting for connections"

#### Step 3: Start Backend

```bash
cd materials/backend
cp .env.example .env
# Edit .env with your Entra ID values (see below)
npm install
npm run dev
```

**Required `.env` values for Backend:**

```env
# Microsoft Entra ID - REQUIRED
ENTRA_TENANT_ID=<your-tenant-id>           # From Entra ID > Overview
ENTRA_CLIENT_ID=<backend-api-client-id>    # From Backend API app > Overview
```

**Verification Points:**
- [ ] No TypeScript compilation errors
- [ ] Server starts on port 8080
- [ ] Log shows "Connected to database" (or Cosmos DB message)
- [ ] Health endpoint responds: `curl http://localhost:8080/health`

#### Step 4: Start Frontend

```bash
cd materials/frontend
cp .env.example .env.local
# Edit .env.local with your Entra ID values (see below)
npm install
npm run dev
```

**Required `.env.local` values for Frontend:**

```env
# Microsoft Entra ID - REQUIRED
VITE_ENTRA_CLIENT_ID=<frontend-spa-client-id>   # From Frontend SPA app > Overview
VITE_ENTRA_TENANT_ID=<your-tenant-id>           # From Entra ID > Overview
VITE_ENTRA_REDIRECT_URI=http://localhost:5173   # Must match app registration

# Backend API (for token scope)
VITE_API_CLIENT_ID=<backend-api-client-id>      # From Backend API app > Overview
```

**Verification Points:**
- [ ] Vite dev server starts on port 5173
- [ ] No build errors in console
- [ ] Browser opens without errors
- [ ] MSAL initializes without configuration errors

#### Step 5: Verify Entra ID Configuration

**Prerequisites (One-time setup):**
- [ ] Entra ID tenant accessible
- [ ] Frontend SPA app registration created
- [ ] Backend API app registration created
- [ ] Redirect URIs added to Frontend SPA:
  - `http://localhost:5173` (Vite direct)
  - `http://localhost:4280` (SWA CLI emulator)
- [ ] API permissions configured

See [Entra ID Setup Guide](../docs/entra-id-setup.md) for detailed instructions.

**Verification Points:**
- [ ] Backend `.env` has valid ENTRA_TENANT_ID and ENTRA_CLIENT_ID
- [ ] Frontend `.env.local` has valid VITE_ENTRA_* values
- [ ] Login redirects to Microsoft login page
- [ ] After login, token is returned and user is authenticated

---

### 1a.3 Functional Test Cases - Vite Direct

#### 1a.3.1 Public Features (No Authentication)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| L-PUB-01 | Home page loads | Navigate to `/` | Blog listing page displays |
| L-PUB-02 | View published post | Click on a post title | Post content displays correctly |
| L-PUB-03 | Post pagination | Scroll/paginate through posts | Pagination works, posts load |
| L-PUB-04 | Health endpoint | `GET /api/health` | Returns `{ status: 'healthy' }` |
| L-PUB-05 | API returns posts | `GET /api/posts` | Returns JSON array of posts |

#### 1a.3.2 Authentication Flow (Real Microsoft Entra ID)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|------------------|
| L-AUTH-01 | Login page accessible | Navigate to `/login` | Login button displayed |
| L-AUTH-02 | Entra ID login | Click login → authenticate with Microsoft | Redirected back, user shown as logged in |
| L-AUTH-03 | Protected route redirect | Access `/posts/new` when logged out | Redirected to `/login` |
| L-AUTH-04 | Logout flow | Click logout | User session cleared, redirected to home |
| L-AUTH-05 | Token in API requests | Create a post | Bearer token included in Authorization header |
| L-AUTH-06 | Invalid token rejected | Modify token manually, call API | 401 Unauthorized |

#### 1a.3.3 Authenticated Features

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| L-CRUD-01 | Create post (draft) | Fill form, save as draft | Post created, appears in My Posts |
| L-CRUD-02 | Create post (publish) | Fill form, publish | Post created, appears on home page |
| L-CRUD-03 | Edit own post | Edit title/content | Changes saved and displayed |
| L-CRUD-04 | Delete own post | Delete post | Post removed from list |
| L-CRUD-05 | View my posts | Navigate to My Posts | Only user's posts shown (drafts + published) |
| L-CRUD-06 | Profile page | Navigate to Profile | User info displayed |

#### 1a.3.4 Validation & Security

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| L-VAL-01 | Empty title rejected | Submit post with empty title | Validation error displayed |
| L-VAL-02 | XSS prevention | Include `<script>` in content | Script tags sanitized/escaped |
| L-VAL-03 | Unauthorized edit blocked | Try editing another user's post via API | 403 Forbidden |
| L-VAL-04 | Rate limiting | Send 100+ requests rapidly | 429 Too Many Requests |

#### 1a.3.5 Database Operations

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| L-DB-01 | Seed data loads | Run `npm run seed` | Sample posts/users created |
| L-DB-02 | Data persists | Restart backend, check posts | Data still present |
| L-DB-03 | Connection recovery | Stop/start MongoDB | Backend reconnects automatically |

### 1a.4 Phase 1a Success Criteria

- [ ] All L-PUB-* tests pass (public features work)
- [ ] All L-AUTH-* tests pass (auth flow works)
- [ ] All L-CRUD-* tests pass (CRUD operations work)
- [ ] All L-VAL-* tests pass (validation works)
- [ ] No TypeScript/ESLint errors
- [ ] No console errors in browser

---

## Phase 1b: Local Development Testing (SWA CLI Emulator)

This phase uses SWA CLI to emulate Azure Static Web Apps behavior locally.

**Entry Point:** `http://localhost:4280`

### 1b.1 Prerequisites

Phase 1a must be completed first. Backend and database remain running.

```bash
# Install SWA CLI (if not already installed)
npm install -g @azure/static-web-apps-cli

# Verify installation
swa --version
```

### 1b.2 Start SWA CLI Emulator

```bash
# Stop Vite if running on port 5173 (Ctrl+C)
# Keep backend running on port 8080

cd materials/frontend

# Option 1: SWA CLI with Vite dev server (hot reload)
swa start http://localhost:5173 --api-devserver-url http://localhost:8080

# Option 2: SWA CLI with built files (production-like)
npm run build
swa start dist --api-devserver-url http://localhost:8080
```

### 1b.3 Update Frontend Configuration

Update `.env.local` redirect URI for SWA CLI:

```env
# Change redirect URI to SWA CLI port
VITE_ENTRA_REDIRECT_URI=http://localhost:4280
```

**Verification Points:**
- [ ] SWA CLI starts on port 4280
- [ ] Can access `http://localhost:4280`
- [ ] API proxy works: `curl http://localhost:4280/api/health`

### 1b.4 Functional Test Cases - SWA CLI

Re-run the same test cases from Phase 1a, but access via `http://localhost:4280`:

#### 1b.4.1 SWA-Specific Tests

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| L-SWA-01 | SWA routing | Navigate to `/posts/new` directly | SPA routing works (no 404) |
| L-SWA-02 | API proxy | Call `/api/posts` from browser | Proxied to backend correctly |
| L-SWA-03 | Static file serving | Load CSS/JS assets | Assets served correctly |
| L-SWA-04 | Auth redirect | Login flow | Redirects back to :4280 |

#### 1b.4.2 Re-run Phase 1a Tests

| Category | Test IDs | Access URL |
|----------|----------|------------|
| Public Features | L-PUB-01 to L-PUB-05 | `http://localhost:4280` |
| Authentication | L-AUTH-01 to L-AUTH-06 | `http://localhost:4280` |
| CRUD Operations | L-CRUD-01 to L-CRUD-06 | `http://localhost:4280` |
| Validation | L-VAL-01 to L-VAL-04 | `http://localhost:4280` |

### 1b.5 Phase 1b Success Criteria

- [ ] All L-SWA-* tests pass (SWA-specific features work)
- [ ] All Phase 1a tests pass when accessed via port 4280
- [ ] SWA routing matches production behavior
- [ ] API proxy works correctly

---

## Phase 2: Azure E2E Testing

### 2.1 Infrastructure Deployment

#### Step 1: Prepare Bicep Parameters

The bicepparam files are templates. Copy them to local versions before deploying:

```bash
cd materials/bicep

# Copy template to local file (gitignored)
cp dev.bicepparam dev.local.bicepparam

# Edit with your values:
# - entraTenantId: Your Entra ID tenant ID
# - entraBackendClientId: Backend API app registration client ID
# - entraFrontendClientId: Frontend SPA app registration client ID  
# - cosmosDbAdminPassword: Generate with: openssl rand -base64 16
```

#### Step 2: Deploy with Bicep

```bash
# Create resource group
az group create --name rg-blogapp-dev --location japaneast

# Deploy infrastructure with local parameters
az deployment group create \
  --resource-group rg-blogapp-dev \
  --template-file main.bicep \
  --parameters dev.local.bicepparam
```

**Verification Points:**
- [ ] Deployment completes without errors
- [ ] All resources created (check Azure Portal)
- [ ] No deployment warnings related to deprecated features

#### Step 2: Verify Resource Creation

| Resource | Verification |
|----------|--------------|
| **Virtual Network** | Subnets created, NSGs attached |
| **Cosmos DB** | Database exists, connection string accessible |
| **App Service** | Running, VNet integration configured |
| **Static Web Apps** | Deployed, custom domain ready |
| **Key Vault** | Secrets populated |
| **Application Insights** | Connected, receiving telemetry |
| **Application Gateway** | WAF enabled, backend healthy (if deployed) |

### 2.2 Application Deployment

#### Step 1: Deploy Backend to App Service

```bash
cd materials/backend
npm run build

# Deploy via Azure CLI or ZIP deploy
az webapp deploy --resource-group rg-blogapp-dev \
  --name <app-service-name> \
  --src-path dist.zip
```

**Verification Points:**
- [ ] Deployment succeeds
- [ ] App Service shows "Running"
- [ ] Health endpoint responds via private endpoint

#### Step 2: Deploy Frontend to Static Web Apps

```bash
cd materials/frontend
npm run build

# Via SWA CLI or GitHub Actions
swa deploy ./dist --deployment-token <token>
```

**Verification Points:**
- [ ] Deployment succeeds
- [ ] SWA URL accessible
- [ ] Frontend loads without console errors

### 2.3 Functional Test Cases - Azure

#### 2.3.1 Network & Security

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| A-NET-01 | Private endpoint connectivity | App Service calls Cosmos DB | Connection succeeds via private endpoint |
| A-NET-02 | VNet integration | Backend resolves private DNS | No public IP access to Cosmos DB |
| A-NET-03 | WAF protection | Send malicious request | Blocked by Application Gateway WAF |
| A-NET-04 | TLS enforcement | Access via HTTP | Redirected to HTTPS |
| A-NET-05 | CORS validation | Frontend calls API | Requests succeed, CORS headers present |

#### 2.3.2 Authentication (Real Entra ID)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| A-AUTH-01 | Entra ID login | Click login, authenticate | Redirected back with token |
| A-AUTH-02 | Token validation | API receives bearer token | Claims extracted correctly |
| A-AUTH-03 | Token expiry | Wait for token expiry | Auto-refresh works (MSAL) |
| A-AUTH-04 | Invalid token | Send forged token | 401 Unauthorized |

#### 2.3.3 Data Operations

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| A-DATA-01 | Create post | Create via UI | Saved to Cosmos DB |
| A-DATA-02 | Read posts | Load home page | Posts retrieved from Cosmos DB |
| A-DATA-03 | Update post | Edit existing post | Changes persisted |
| A-DATA-04 | Delete post | Delete via UI | Removed from Cosmos DB |
| A-DATA-05 | Concurrent writes | Two users edit same post | Conflict handled gracefully |

#### 2.3.4 Monitoring & Observability

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| A-MON-01 | Request logging | Make API requests | Logs appear in Log Analytics |
| A-MON-02 | Application Insights | Navigate app | Traces and metrics recorded |
| A-MON-03 | Error tracking | Trigger an error | Exception logged with stack trace |
| A-MON-04 | Performance metrics | Check portal | Response times, throughput visible |

#### 2.3.5 Resilience

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| A-RES-01 | App Service restart | Restart via portal | App recovers, no data loss |
| A-RES-02 | Connection pool | High load test | Connections managed properly |
| A-RES-03 | Cosmos DB failover | Simulate region failure (if multi-region) | Automatic failover works |

#### 2.3.6 Cost Validation

| ID | Test Case | Verification |
|----|-----------|--------------|
| A-COST-01 | Dev tier costs | Check Cost Analysis after 24h | Within expected range (~$1-2/day) |
| A-COST-02 | No unexpected resources | Review all resources | Only expected resources present |

---

## Test Cases by Component

### Backend API Test Matrix

| Endpoint | Method | Auth | Test Cases |
|----------|--------|------|------------|
| `/health` | GET | None | L-PUB-04 |
| `/api/posts` | GET | None | L-PUB-05, A-DATA-02 |
| `/api/posts/:slug` | GET | None | L-PUB-02 |
| `/api/posts` | POST | Required | L-CRUD-01, L-CRUD-02, A-DATA-01 |
| `/api/posts/:slug` | PUT | Required | L-CRUD-03, A-DATA-03 |
| `/api/posts/:slug` | DELETE | Required | L-CRUD-04, A-DATA-04 |
| `/api/posts/my` | GET | Required | L-CRUD-05 |
| `/api/users/profile` | GET | Required | L-CRUD-06 |
| `/api/users/profile` | PUT | Required | (Profile update) |

### Frontend Route Test Matrix

| Route | Auth | Test Cases |
|-------|------|------------|
| `/` | None | L-PUB-01 |
| `/posts/:slug` | None | L-PUB-02 |
| `/login` | None | L-AUTH-01 |
| `/posts/new` | Required | L-AUTH-03, L-CRUD-01, L-CRUD-02 |
| `/posts/:slug/edit` | Required | L-CRUD-03 |
| `/my-posts` | Required | L-CRUD-05 |
| `/profile` | Required | L-CRUD-06 |

### Infrastructure Test Matrix

| Component | Phase 1a (Vite) | Phase 1b (SWA CLI) | Phase 2 (Azure) |
|-----------|-----------------|---------------------|-----------------|
| Database | Docker MongoDB | Docker MongoDB | Cosmos DB |
| Backend | Node.js :8080 | Node.js :8080 | App Service |
| Frontend | Vite :5173 | SWA CLI :4280 | Static Web Apps |
| Auth | Real Entra ID | Real Entra ID | Real Entra ID |
| API Proxy | Vite proxy | SWA CLI proxy | SWA backend |
| Network | localhost | localhost | VNet + Private Endpoints |

---

## Success Criteria

### Phase 1a (Vite Direct) - MUST PASS

- [ ] All L-PUB-* tests pass (public features work)
- [ ] All L-AUTH-* tests pass (auth flow works)
- [ ] All L-CRUD-* tests pass (CRUD operations work)
- [ ] All L-VAL-* tests pass (validation works)
- [ ] No TypeScript/ESLint errors
- [ ] No console errors in browser

### Phase 1b (SWA CLI) - MUST PASS

- [ ] All L-SWA-* tests pass (SWA-specific features work)
- [ ] All Phase 1a tests pass when accessed via port 4280
- [ ] SWA routing works correctly
- [ ] API proxy works correctly

### Phase 2 (Azure) - MUST PASS

- [ ] Infrastructure deploys without errors
- [ ] All A-NET-* tests pass (networking secure)
- [ ] All A-AUTH-* tests pass (real auth works)
- [ ] All A-DATA-* tests pass (data operations work)
- [ ] All A-MON-* tests pass (observability works)
- [ ] Costs within expected range

### Release Readiness Checklist

- [ ] Phase 1a complete with all tests passing
- [ ] Phase 1b complete with all tests passing
- [ ] Phase 2 complete with all tests passing
- [ ] Documentation accurate and complete
- [ ] Workshop can be completed by participant in target time
- [ ] Cleanup procedure tested (resource deletion works)

---

## Known Limitations

### Local Development Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| No Cosmos DB Emulator on ARM64 | Cannot test Cosmos-specific behavior | Use Docker MongoDB; behavior is compatible |
| No Application Gateway | Cannot test WAF locally | Must validate in Phase 2 |
| No Private Endpoints | Network topology differs | Must validate in Phase 2 |
| Requires Entra ID setup | Cannot test without Azure tenant | One-time setup; same config works for prod |

### Azure Testing Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| Multi-region requires higher tier | Cannot test geo-redundancy on dev tier | Document limitation; test with prod tier if needed |
| Entra ID requires tenant setup | Requires pre-configured app registrations | Provide setup instructions in workshop |

---

## Appendix: Quick Test Commands

### Phase 1a Smoke Test (Vite Direct)

```bash
# Start all services
cd dev-environment && docker compose up -d
cd ../materials/backend && npm run dev &
cd ../materials/frontend && npm run dev &

# Wait for services
sleep 10

# Test endpoints
curl -s http://localhost:8080/health | jq .
curl -s http://localhost:8080/api/posts | jq .
curl -s http://localhost:5173 | head -20

echo "✅ Phase 1a smoke test complete (Vite direct)"
echo "Access: http://localhost:5173"
echo "Note: Login requires Entra ID configuration in .env files"
```

### Phase 1b Smoke Test (SWA CLI)

```bash
# Assumes backend is already running on :8080
# Stop Vite if running, or let SWA CLI proxy to it

cd materials/frontend

# Build frontend
npm run build

# Start SWA CLI
swa start dist --api-devserver-url http://localhost:8080 &

# Wait for SWA CLI
sleep 5

# Test endpoints via SWA CLI
curl -s http://localhost:4280/api/health | jq .
curl -s http://localhost:4280/api/posts | jq .
curl -s http://localhost:4280 | head -20

echo "✅ Phase 1b smoke test complete (SWA CLI)"
echo "Access: http://localhost:4280"
```

### Azure Smoke Test

```bash
# Replace with your actual URLs
BACKEND_URL="https://app-blogapp-dev.azurewebsites.net"
FRONTEND_URL="https://your-swa.azurestaticapps.net"

# Test endpoints
curl -s "$BACKEND_URL/health" | jq .
curl -s "$BACKEND_URL/api/posts" | jq .
curl -s "$FRONTEND_URL" | head -20

echo "✅ Azure smoke test complete"
```

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-04 | 0.1 | Initial draft |
