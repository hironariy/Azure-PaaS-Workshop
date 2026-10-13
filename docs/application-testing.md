# Application maintenance acceptance

This main-targeted adoption is the application wave in
[the merge strategy](../design/WorkshopImprovementPlan.md#pr-merge-strategy).
It uses the final application source from #49, not intermediate mirrored
dependency candidates. Deployment, IaC, optional deployment Actions and live
learner acceptance are separate adoption gates.

## Run application checks

Use Node.js 24 from the repository root:

```bash
npm --prefix materials/backend ci --include=dev --registry=https://registry.npmjs.org
npm --prefix materials/frontend ci --include=dev --registry=https://registry.npmjs.org
npm --prefix materials/backend run type-check
npm --prefix materials/backend run lint
npm --prefix materials/backend test
npm --prefix materials/backend run build
npm --prefix materials/frontend run type-check
npm --prefix materials/frontend run lint
npm --prefix materials/frontend test
npm --prefix materials/frontend run build
node --test scripts/test/*.test.cjs
```

Backend tests use Node's built-in runner and existing TypeScript support.
Frontend tests use Vitest. Tests fail on failures or missing tests. Test code
is excluded from the production backend build.

The suites cover Unicode/legacy slugs, bounded unique-index collision retries,
encoded routes, sanitization, draft/ownership boundaries, signed API token
audience/issuer/delegated permission, runtime API dispatch and configuration
retry. JWT signatures are real fixture RSA signatures; Microsoft key retrieval
alone is mocked. No production authentication bypass is introduced.

## Verify public dependencies and production artifacts

```bash
node scripts/check-public-lock.cjs materials/backend/package-lock.json
node scripts/check-public-lock.cjs materials/frontend/package-lock.json
npm --prefix materials/backend audit --audit-level=low
npm --prefix materials/backend audit --omit=dev --audit-level=low
npm --prefix materials/backend audit --package-lock-only --audit-level=low
npm --prefix materials/frontend audit --audit-level=low
npm --prefix materials/frontend audit --omit=dev --audit-level=low
npm --prefix materials/frontend audit --package-lock-only --audit-level=low
```

CI explicitly uses public npm and requires zero findings in every application
scope, including the extracted backend production ZIP. It verifies that
`dist/src/app.js` loads without build dependencies and a missing database
returns unhealthy 503, not a success-shaped fallback. The real frontend build
is configured with public fixture GUIDs and same-origin `/api`; routing remains
present. Fixture IDs are never Azure deployment parameters.

## Persisted database contracts

CI runs `npm run test:integration` in `materials/backend` against a disposable,
digest-pinned MongoDB 8 service and its assigned fixture port. The fixture
forces loopback and a newly generated database name, ignoring inherited cloud
connection strings. It covers persisted Unicode CRUD, indexed concurrent
collisions, draft/ownership, exact pagination shape, legacy URLs, reconnect and
owned deletion. Never point these tests at an existing or Azure database.

## CI and release boundaries

The application workflow runs on every pull request, including docs-only PRs,
so a future required check is not left pending by top-level PR path filters.
It validates active workflow expressions, helpers, public provenance,
applications and fixture database contracts without Azure credentials.

This wave does not install or deploy with SWA CLI, adopt the operational
workflow/templates or claim Bicep acceptance. The failed CLI audit in the
existing operational candidates remains visible and #15 remains open.
Registry errors and advisories must fail; do not force dependency downgrades,
relax audit thresholds or hide failures.

Application CI does not prove real Entra user consent, MSAL interaction, Azure
DocumentDB/private DNS/Key Vault access, SWA routing, telemetry, recovery,
Cloud Shell reconnect or a fresh Contributor-only learner path. Owner live
rehearsal and independent learner acceptance must be recorded separately.
