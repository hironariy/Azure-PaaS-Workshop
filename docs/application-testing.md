# Application and IaC maintenance acceptance

This main-targeted adoption is the application wave in
[the merge strategy](../design/WorkshopImprovementPlan.md#pr-merge-strategy).
It uses the final application source from #49, not intermediate mirrored
dependency candidates. CI also compiles the adopted IaC and checks distributed
artifact parity. Azure deployment, optional deployment Actions and live learner
acceptance remain separate gates.

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

CI also clones each tracked application into an isolated runner fixture and
confirms that intentional type, lint, build and test failures return nonzero
with the expected diagnostic. This never modifies the production source or
build artifact and never copies personal untracked configuration.

The suites cover Unicode/legacy slugs, bounded unique-index collision retries,
encoded routes, sanitization, draft/ownership boundaries, signed API token
audience/issuer/delegated permission, runtime API dispatch and configuration
retry. JWT signatures are real fixture RSA signatures; Microsoft key retrieval
alone is mocked. No production authentication bypass is introduced.

## Verify public dependencies and production artifacts

```bash
node scripts/check-public-lock.cjs materials/backend/package-lock.json
node scripts/check-public-lock.cjs materials/frontend/package-lock.json
npm --prefix materials/backend audit --audit-level=none
npm --prefix materials/backend audit --omit=dev --audit-level=none
npm --prefix materials/backend audit --package-lock-only --audit-level=none
npm --prefix materials/frontend audit --audit-level=none
npm --prefix materials/frontend audit --omit=dev --audit-level=none
npm --prefix materials/frontend audit --package-lock-only --audit-level=none
```

CI explicitly uses public npm and reports findings in every application scope,
including the extracted backend production ZIP. The adopted informational audit
policy does not fail on advisory severity, but registry/audit-service errors,
invalid provenance, installation failures and application failures still fail.
An exit code of zero with `--audit-level=none` is not evidence of zero findings;
read the report. Remediation acceptance remains tracked separately in #15.
CI verifies that
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

## Compile IaC without Azure credentials

CI pins Bicep **0.44.1**, compiles `materials/bicep/main.bicep` with diagnostics
visible, and requires byte-for-byte equality with the distributed `main.json`.
It also compiles all four tracked standard/fastpath parameter templates.
From the repository root:

```bash
az bicep install --version v0.44.1
CHECK_DIR="$(mktemp -d)"
az bicep build --file materials/bicep/main.bicep --outfile "$CHECK_DIR/main.json"
diff -u materials/bicep/main.json "$CHECK_DIR/main.json"
for parameter_file in \
  materials/bicep/main.bicepparam \
  materials/bicep/dev.bicepparam \
  materials/bicep/main.fastpath.bicepparam \
  materials/bicep/dev.fastpath.bicepparam
do
  az bicep build-params --file "$parameter_file" \
    --outfile "$CHECK_DIR/$(basename "$parameter_file").json"
done
```

Compiler errors, invalid parameter types and stale distributed JSON must fail.
Existing unused-parameter warnings remain visible; they are not suppressed or
claimed to be fixed. The template samples contain placeholders and do not prove
valid Entra IDs, compatible service SKUs, available capacity or deployment
readiness. Do not use personal `*.local.bicepparam` files in credential-free CI.

After intentional source changes, regenerate `main.json` with this pinned
compiler and review its diff. Compiler upgrades require deliberate artifact
regeneration and review, not switching to latest silently.

## Required checks

After a successful PR run, a maintainer with repository administration
permissions can configure **Settings > Rules > Rulesets** for `main`, enable
**Require status checks to pass**, and select these exact job names:

- `GitHub workflow expression validation`
- `Application helper contracts`
- `Public npm evidence (backend)`
- `Public npm evidence (frontend)`
- `Application (backend)`
- `Application (frontend)`
- `Database HTTP contracts`
- `Bicep artifact parity`

Require the branch to be up to date before merging. If a check is not available
in the selector, run the workflow on the PR first. Existing branch protection
can require the same check names. This document does not change repository
settings, add credentials or authorize a merge. Contributors should run the
local commands above and resolve every failed check rather than bypass it.
Do not require the post-merge Pages deployment as a pre-merge application check.

## CI and release boundaries

The application workflow runs on every pull request, including docs-only PRs,
so a future required check is not left pending by top-level PR path filters.
Relevant pushes include application, Bicep, workflow and helper changes.
It validates active workflow expressions, helpers, public provenance,
applications, fixture database contracts and IaC without Azure credentials.

This workflow does not install or deploy with SWA CLI or adopt the operational
workflow/templates. Existing operational tooling reports still contain
unresolved CLI findings and #15 remains open, even when informational audit jobs
succeed. Do not force dependency downgrades, hide reports or ignore execution
errors.

Application CI does not prove real Entra user consent, MSAL interaction, Azure
DocumentDB/private DNS/Key Vault access, SWA routing, telemetry, recovery,
Cloud Shell reconnect or safe infrastructure replay. The learner baseline is
subscription Owner, separate from Entra Application Developer and Principal
self-consent. Owner live rehearsal and independent learner acceptance must be
recorded separately; Owner credentials must never be supplied to this CI.
