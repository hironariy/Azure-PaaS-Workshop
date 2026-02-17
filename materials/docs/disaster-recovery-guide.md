# BCDR Guide (Azure PaaS Workshop Blog Application)

This guide explains a practical **Business Continuity and Disaster Recovery (BCDR)** approach for this workshop's PaaS architecture.

- **Frontend**: Azure Static Web Apps (SWA)
- **Backend**: Azure App Service (Linux, Node.js)
- **Database**: Azure Cosmos DB for MongoDB vCore
- **Secrets**: Azure Key Vault
- **Observability**: Application Insights + Log Analytics

> Scope note: The current Bicep templates deploy a **single-region primary environment**. This guide provides workshop-friendly continuity and DR runbooks on top of that baseline.

---

## 1. Define Continuity Targets (RPO / RTO)

Before implementing DR procedures, define:

- **RPO (Recovery Point Objective)**: acceptable data loss window
- **RTO (Recovery Time Objective)**: acceptable service downtime

Suggested workshop defaults:

- RPO: 1-24 hours (depends on backup frequency)
- RTO: 1-4 hours (depends on failover automation level)

---

## 2. Failure Scenarios for This Architecture

### 2.1 Component-Level Failures (Most Common)

- App Service instance issues
- temporary Cosmos DB connectivity failures
- Key Vault access policy / RBAC misconfiguration
- application-level defects after deployment

Primary controls:

- App Service health checks (`/health`, `/api/health`)
- rapid redeploy of backend/frontend
- rollback to known-good build artifact

### 2.2 Regional Failure (Low Frequency, High Impact)

- primary region outage or severe service degradation

Primary controls:

- pre-defined secondary region resource group
- Bicep-based environment reconstruction
- DNS/cutover runbook

---

## 3. Service-by-Service BCDR Strategy

## 3.1 Static Web Apps (Frontend)

Recovery principle:

- frontend is stateless and rebuilt from source

BCDR actions:

1. Keep source and CI workflow in GitHub (or equivalent source control).
2. Maintain environment variables / app settings as code or documented checklist.
3. For DR, deploy SWA in the secondary region and repoint user traffic.

## 3.2 App Service (Backend)

Recovery principle:

- backend runtime is recoverable from source/artifact and app settings

BCDR actions:

1. Keep backend artifact reproducible (`npm ci`, build, deploy package/container).
2. Store secrets in Key Vault (already implemented via Key Vault reference).
3. Validate readiness using `/health` and `/api/health` before cutover.

## 3.3 Cosmos DB for MongoDB vCore (Data)

Recovery principle:

- data tier drives RPO; treat it as the most critical recovery dependency

BCDR actions (workshop-friendly):

1. Schedule logical backups (`mongodump`) and verify restore (`mongorestore`) regularly.
2. Keep backup retention policy aligned with RPO.
3. Consider enabling higher resiliency features (for example HA and geo strategy) based on production requirements.

> Use current Microsoft service documentation to confirm feature availability and restore options for your selected Cosmos DB for MongoDB vCore tier.

## 3.4 Key Vault (Secrets)

Recovery principle:

- secrets/config must be reproducible and restorable

BCDR actions:

1. Store secret creation/update steps in scripts or runbooks.
2. Keep a secure escrow process for critical bootstrap secrets.
3. Rehydrate secrets in secondary region during failover runbook.

---

## 4. Workshop DR Runbook (Recommended)

### Phase A: Preparation (Normal Operations)

1. Keep Bicep parameter files for primary and secondary region.
2. Test backend and frontend deployment pipelines regularly.
3. Execute periodic data backup and restore drills.
4. Maintain an operational checklist (owners, commands, validation steps).

### Phase B: Incident Declaration

1. Confirm impact and scope (component vs regional outage).
2. Freeze non-essential deployments.
3. Declare DR mode and assign incident commander + communication owner.

### Phase C: Recovery Execution

1. Provision or validate secondary region resources using Bicep.
2. Restore database from the latest valid backup (or use pre-provisioned standby design).
3. Deploy backend and verify health endpoints.
4. Deploy frontend and validate login + API traffic.
5. Update DNS/entrypoint to secondary environment.

### Phase D: Post-Failover Validation

1. Validate core user journeys:
   - browse posts
   - sign in
   - create/edit post
2. Validate telemetry in Application Insights / Log Analytics.
3. Record actual RTO/RPO and improvement actions.

---

## 5. Recovery Validation Checklist

- Bicep deployment succeeds in secondary region
- backend health endpoints return expected status
- database connectivity and CRUD operations succeed
- authentication flow (Entra ID) works after cutover
- monitoring and alerts continue in DR environment
- runbook can be completed within target RTO

---

## 6. Minimum Quarterly DR Exercise

Run at least one simulation each quarter:

1. Simulate primary unavailability.
2. Execute secondary deployment from Bicep.
3. Restore data from latest backup.
4. Cut traffic and run smoke tests.
5. Capture lessons learned and update runbook.

---

## 7. Next Improvements (Optional)

- automate failover runbook with Azure DevOps/GitHub Actions
- introduce multi-region active-passive topology
- harden backup automation and integrity checks
- add service-level alerts tied to RTO/RPO SLOs
