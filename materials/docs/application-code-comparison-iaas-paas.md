# IaaS vs PaaS Application Code Comparison Guide

This document explains **what changed in the application code when moving from the IaaS workshop implementation to the PaaS workshop implementation**, and why those changes were made.

- Scope: `iaas/materials/backend` vs `materials/backend`, and `iaas/materials/frontend` vs `materials/frontend`
- Focus: **What changed**, **Context**, **Why**
- Out of scope: detailed Bicep infrastructure design (covered in separate guides)

---

## 1. Executive Summary

Core business logic (post CRUD, authenticated operations) is intentionally preserved. Most changes are concentrated in:

1. **Runtime environment adaptation** (port, proxy paths, health checks)
2. **Data connectivity adaptation** (MongoDB replica set → Cosmos DB for MongoDB vCore)
3. **Configuration delivery adaptation** (VM-centric hosting → PaaS-centric hosting)
4. **Operational hardening** (initialization sequence, fallback behavior, diagnostics)

---

## 2. Change Categories

## 2.1 Backend

Main substantive changes:

- `materials/backend/src/config/environment.ts`
- `materials/backend/src/config/database.ts`
- `materials/backend/src/routes/index.ts`
- `materials/backend/src/routes/health.routes.ts` (minor)
- `materials/backend/.env.example`

Notes:

- `auth.middleware.ts` and most API route/service logic remain functionally equivalent
- model layer remains largely compatible (Mongoose continues to work)

## 2.2 Frontend

Main substantive changes:

- `materials/frontend/index.html`
- `materials/frontend/src/config/appConfig.ts`
- `materials/frontend/src/config/msalInstance.ts`
- `materials/frontend/vite.config.ts`
- `materials/frontend/staticwebapp.config.json` (added in PaaS)
- `materials/frontend/.env.example`

Notes:

- `services/api.ts` and major page components are mostly unchanged in behavior

---

## 3. Backend Changes in Detail

## 3.1 `src/config/environment.ts`

### What changed

- default port changed from `3000` to `8080`
- database env key support expanded from only `MONGODB_URI` to also support `COSMOS_CONNECTION_STRING`

### Context and Why

- App Service commonly runs Node apps behind port 8080 conventions
- PaaS deployment injects Cosmos connection via App Settings / Key Vault reference patterns
- backward compatibility is retained for local/IaaS-friendly development paths

## 3.2 `src/config/database.ts`

### What changed

- added URI-based detection for Cosmos vs local MongoDB
- applied Cosmos-specific options (`retryWrites=false`, `tls=true`) only when required
- standardized sanitized connection-string logging

### Context and Why

- Cosmos DB for MongoDB vCore has connection behavior differences that need explicit handling
- the same codebase must support both local Docker MongoDB and Azure-hosted Cosmos
- credential-safe logging is required for secure operations

## 3.3 `src/routes/index.ts`

### What changed

- added `router.use('/api', healthRoutes)`

### Context and Why

- with SWA routing, backend is often reached through `/api/*`, so `/api/health` is useful
- keeping both `/health` and `/api/health` improves path-specific troubleshooting

## 3.4 `src/routes/health.routes.ts`

### What changed

- wording updates to align with App Service health-probe context
- minor response key normalization (`alive` → `live`)

### Context and Why

- documentation and endpoint semantics should match the actual hosting model
- consistent health payloads reduce confusion during operations

## 3.5 `.env.example`

### What changed

- local defaults aligned to 8080-based backend execution
- examples updated for Cosmos/Entra-based PaaS workflows

### Context and Why

- reduce onboarding friction for workshop participants
- reflect the intended production-like PaaS path directly in defaults

---

## 4. Frontend Changes in Detail

## 4.1 `index.html`

### What changed

- added `window.__APP_CONFIG__` placeholder

### Context and Why

- enables deployment-time runtime config injection
- removes hard dependency on VM-file placement patterns and fits PaaS static hosting better

## 4.2 `src/config/appConfig.ts`

### What changed

- production config loading now prefers `window.__APP_CONFIG__`
- retains `/config.json` fallback and build-time env fallback for resilience

### Context and Why

- PaaS deployments benefit from runtime-injected configuration
- layered fallback reduces startup failures across SWA/local/production scenarios

## 4.3 `src/config/msalInstance.ts`

### What changed

- initialization flow and callback timing were clarified/tightened
- redirect handling completion is more explicitly awaited

### Context and Why

- improves account restoration stability after auth redirects
- reduces race-condition risk during initial app bootstrap

## 4.4 `vite.config.ts`

### What changed

- dev proxy target changed from `localhost:3000` to `localhost:8080`

### Context and Why

- aligns local frontend dev flow with PaaS-style backend port conventions

## 4.5 `staticwebapp.config.json` (new)

### What was added

- SPA navigation fallback
- `/api/*` routing rule
- baseline security headers

### Context and Why

- required to run SPA + API path routing correctly on Static Web Apps
- centralizes minimal hosting-layer hardening

## 4.6 `.env.example`

### What changed

- local development guidance updated for PaaS-friendly paths (ports, redirect URI options)
- Entra ID setup instructions strengthened

### Context and Why

- lowers setup errors during workshop execution
- makes local and cloud auth behavior easier to reason about

---

## 5. Areas Intentionally Kept the Same

These were intentionally preserved as much as possible:

- business logic and domain behavior in API handlers
- core Entra JWT validation model
- main user flows in frontend pages/components

Design intent: **change infrastructure assumptions without rewriting domain logic**.

---

## 6. Why This Migration Strategy

1. **Minimize unnecessary code churn**
   - keep learning focus on platform differences rather than rewriting features.

2. **Support both local and Azure execution paths**
   - one codebase, environment-driven behavior.

3. **Improve observability and troubleshooting**
   - endpoint strategy (`/health` + `/api/health`) and safer config/log patterns.

4. **Prepare for repeatable deployments and DR drills**
   - runtime configuration externalization lowers rebuild/recovery friction.

---

## 7. Practical Migration Review Checklist

- [ ] backend starts correctly with `PORT=8080`
- [ ] both `COSMOS_CONNECTION_STRING` and `MONGODB_URI` paths are verified
- [ ] both `/health` and `/api/health` are reachable
- [ ] frontend reads runtime settings from `window.__APP_CONFIG__`
- [ ] `/config.json` fallback still works when needed
- [ ] Vite proxy points to `:8080` during local development
- [ ] SWA config routes and SPA fallback behavior are validated

---

## 8. Related Documents

- `design/IaaS-to-PaaS-Migration-Changes.md` (detailed migration design notes)
- `materials/docs/bicep-guide.md` / `materials/docs/bicep-guide.ja.md`
- `materials/docs/monitoring-guide.md` / `materials/docs/monitoring-guide.ja.md`
- `materials/docs/disaster-recovery-guide.md` / `materials/docs/disaster-recovery-guide.ja.md`
