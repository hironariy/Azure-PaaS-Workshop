# FastPath E2E Validation Report (macOS + Docker Hub)

Date: 2026-02-16

## Scope

This validation reran FastPath E2E with the following requirements:
- Use Docker Hub (not ACR) for backend container image
- Use a newly created resource group
- Verify end-to-end health for both:
  - App Service direct endpoint (`/health`)
  - Static Web Apps routed endpoint (`/api/health`)

## Environment

- OS: macOS
- Azure subscription: `ME-MngEnvMCAP668092-hiyam-1`
- New resource group: `rg-fastpath-macos-dh-0216-5630`

## Container Image (Docker Hub)

- Repository: `docker.io/hironariy/azure-paas-workshop-backend`
- Tag: `fastpathfix-20260216-2`
- Digest: `sha256:7af2ad591a0d791f37810cd9d1349faee7e982f4c1fa337f0cf0d7157d84f964`
- FastPath parameter used:
  - `appServiceContainerImage = 'docker.io/hironariy/azure-paas-workshop-backend@sha256:7af2ad591a0d791f37810cd9d1349faee7e982f4c1fa337f0cf0d7157d84f964'`

## Root Cause from Earlier Failure

Previous FastPath image failed to start with:
- `Error: Cannot find module '/app/dist/app.js'`

Cause:
- Runtime entrypoint path did not match TypeScript build output path.

Fix applied:
- Updated backend runtime entrypoint to:
  - `node dist/src/app.js`

## E2E Execution Summary

1. Deployed infrastructure with FastPath parameters in new RG.
2. Verified backend direct health endpoint.
3. Verified SWA API endpoint.
4. Deployed frontend artifacts to SWA using `scripts/deploy-frontend.sh`.
5. Re-verified both health endpoints.

## Results

### After Bicep deployment (before frontend artifact deployment)
- App Service `/health`: `200` (`healthy`)
- SWA `/api/health`: `404`

### After frontend deployment to SWA
- App Service `/health`: `200` (`healthy`)
- SWA `/api/health`: `200` (`healthy`)

## Observations

- In this environment, SWA `/api/health` returned `404` until frontend artifacts were deployed to SWA.
- Backend container startup is now stable with the Docker Hub digest above.

## Recommended Documentation Updates (reflected in README)

- Clarify that FastPath flow is executable on macOS/Linux with equivalent bash commands.
- Clarify staged health expectations:
  - App Service health can be validated immediately after Bicep
  - SWA `/api/health` should be validated after frontend deployment
- Add note that custom container image startup command must match actual build output path.
