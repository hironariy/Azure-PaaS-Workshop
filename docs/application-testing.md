# Application and IaC maintenance acceptance

This main-targeted adoption integrates the application, IaC, and operational
helper waves in [the merge strategy](../design/WorkshopImprovementPlan.md#pr-merge-strategy).
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
npm --prefix materials/frontend run type-check
npm --prefix materials/frontend run lint
npm --prefix materials/frontend test
```

The backend uses Node's built-in test runner with the existing `ts-node` support.
`npm --prefix materials/backend run test:coverage` collects native coverage.
Tests are separately type-checked and excluded from production compilation.
Frontend tests use Vitest; `test:watch` is the interactive development command.
The normal test commands finish and fail when tests fail or no tests are found.

Fixtures contain no real credentials. Default model, sanitization, runtime configuration,
and isolated HTTP tests do not connect to Azure or MongoDB. They do not prove real
Entra consent, database persistence, Key Vault access, or Static Web Apps routing.
Use the learner validation and authorized Azure rehearsal for those checks.

## Signed API token contracts

The database-free suite separately exercises the production identity middleware
with locally generated RSA signatures and fixture public JWKs. Only JWKS key
retrieval is mocked; JWT decoding, key selection/conversion, signature, issuer,
audience, expiry and delegated permission checks are real.

The Backend API accepts its own GUID audience (v1/v2) and resource URI (v1),
never the separate SPA application's audience. A delegated user token must
include `access_as_user` in `scp` and nonempty `oid`/`sub`. ID tokens and
app-only role tokens are not substitutes. Invalid tokens return 401; a valid
user resource token missing the required delegated permission returns 403.
Optional authentication remains anonymous for invalid/insufficient tokens;
it cannot make draft ownership visible.

These signatures prove middleware contracts, not real Microsoft-issued keys,
tenant registration/consent, MSAL interaction or live browser/API acceptance.
No production verification bypass or reusable signing secret is introduced.

## Frontend runtime request contracts

The API client reads the successfully loaded runtime `apiBaseUrl` when each
request starts, not a possibly stale build-time API host. The workshop `/api`
routes remain same-origin; local backend origins and gateway prefixes are
preserved without duplicating `/api`. Unicode permalink encoding is unchanged.
API roots must be HTTP(S), without credentials, query parameters or fragments.
Invalid roots fail before token acquisition or transport without echoing values.

Tests use real Axios URL joining/interceptors and the real delegated scope
builder, with a fixture transport and fake MSAL responses. They verify exact
request URLs, Backend API scope and authorization dispatch without network
access. Failed production configuration validation must not populate the cache:
corrected inline or JSON configuration can be loaded on a subsequent attempt.
Existing development warning/fallback behavior is preserved.

These contracts do not prove real browser/MSAL interaction, CORS or SWA Linked
Backend routing. Those still require the learner validation and Azure rehearsal.

## Isolated database HTTP contracts

`test:integration` exercises the full Express application with real Mongoose
queries, persistence and unique indexes against a disposable local MongoDB
fixture. It covers Unicode/emoji creation, concurrent slug collisions, draft
visibility, ownership, pagination, historical ASCII permalinks, sanitized edits,
profile creation, disconnected health, reconnect/read and owned deletion.
Authentication alone uses explicit fake identities; this is not an Entra
token/consent test or proof of Azure DocumentDB compatibility, TLS, Key Vault,
private networking, SWA routing, telemetry or browser behavior.

With Docker running, use the immutable multi-architecture fixture image.
The port is published **only on loopback** and chosen by Docker. No existing
database, Azure credentials or production connection string is used:

```bash
(
  set -euo pipefail
  fixture_name="paas-api-test-$(node -p 'require("node:crypto").randomUUID()')"
  fixture_id="$(docker run --detach --rm --name "$fixture_name" --memory=1g \
    --publish 127.0.0.1::27017 \
    mongo:8.0@sha256:d0d926f94df099bff534b7ee5b5986458131a22489dfff8664509af0c1e2ca9c)"
  trap 'docker stop "$fixture_id" >/dev/null' EXIT
  ready=false
  for attempt in {1..30}; do
    if docker exec "$fixture_id" mongosh --quiet \
      --eval 'quit(db.adminCommand({ping:1}).ok ? 0 : 1)' >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 2
  done
  if [ "$ready" != true ]; then
    echo "MongoDB fixture did not become ready" >&2
    docker logs --tail 30 "$fixture_id" >&2
    exit 1
  fi
  fixture_address="$(docker port "$fixture_id" 27017/tcp)"
  WORKSHOP_TEST_MONGO_PORT="${fixture_address##*:}" \
    npm --prefix materials/backend run test:integration
)
```

Each run creates a new `workshop-integration-<UUID>` database and ignores
inherited cloud connection strings. An absent/invalid port fails before any
connection; the tests never silently skip. The trap stops only the container
created above, and Docker removes its owned disposable data. No global prune
or existing-container/database cleanup is performed.

The independent **Database HTTP contracts** CI job uses the same pinned image,
explicit health readiness, a random service port and no Azure/OIDC credentials.
Default unit tests remain fast and database-free.

## Candidate dependency maintenance

The ARM frontend candidate is exercised without Azure or artifact-host
credentials by `node --test scripts/test/swa-arm-deployment.test.cjs`.
Tests create actual ZIPs and receipts, run checksum/config/target validation,
and exercise the production transport/LRO/readiness state machine with fixture
HTTP responses. They cover redirects, foreign polling targets, failures,
timeouts, attempt limits, stale HTML, token-context mismatch and secret-safe
errors. Shell preparation tests use fake npm/Azure, real ZIP tools and real
configuration writing. Token-boundary tests invoke a fake Azure executable;
they do not use a real access token.

The runtime uses Node built-ins, existing Azure CLI and ZIP tools; no new npm
dependency is added. The separate legacy SWA CLI audit remains visible and
failing. These tests do not prove service-side URL reachability, actual Azure
upload, artifact expiry/deletion, Entra/browser or Contributor-only fresh RBAC.
The approved hosted artifact and real release acceptance remain necessary.

Use Node 24's built-in watch mode for backend development (`npm run dev`).
The candidate frontend keeps React 18 and uses React Router 7's declarative
routes and Tailwind 4's PostCSS plugin. Tailwind's JavaScript configuration is
loaded explicitly; the previous workshop colors, small shadows, and border
defaults are preserved. Shared button utilities remain usable with `@apply`.
Stylesheet and route tests cover compilation and URL decoding, not visual
browser equivalence.

**Public-source acceptance:** #41 imports exact public-npm generated lockfiles
from the independent runner rather than rewriting mirror URLs. Actual run
`37952822043` verified public clean installation, application checks and all
application audit scopes, including the extracted backend production ZIP,
with zero findings. #44 also verified the combined operational/application
source. Earlier local stale metadata/E404 did not establish upstream release
absence. The original mirrored #27/#30 still require this follow-up stack;
their standalone portability and unmerged main are not accepted by these runs.

Deployment builds use `npm ci --include=dev`; backend ZIP dependencies use
`npm ci --omit=dev`. Recheck both installed and lockfile dependency trees:

```bash
npm --prefix materials/backend audit
npm --prefix materials/backend audit --omit=dev
npm --prefix materials/backend audit --package-lock-only
npm --prefix materials/frontend audit
npm --prefix materials/frontend audit --omit=dev
npm --prefix materials/frontend audit --package-lock-only
```

Audit SWA CLI separately: a clean application audit does not establish that its
deployment tool is clean. Do not use `npm audit fix --force`, ignore registry
errors, or report unresolved upstream advisories as fixed.

## Pull request quality gates

`.github/workflows/quality.yml` runs the application type-check, lint, tests,
production build, and all three audit scopes with clean Node 24 installs.
It separately runs persisted HTTP/database contracts against an owned fixture.
It rejects non-public npm tarball sources before dependency installation. The
original mirror-only candidates fail intentionally; reviewed public locks pass.
A green local audit alone is not sufficient to pass it.
Frontend `tsconfig.json` includes `src`, so the check covers application/test
code rather than an empty project. The jobs need no Azure credentials.
New Actions are pinned to immutable revisions.

The distributed `materials/bicep/main.json` remains supported. Its reproducible
compiler is Bicep **0.44.1**; CI compiles and requires byte-for-byte artifact
parity. From the repository root, regenerate deliberately after Bicep edits:

```bash
az bicep install --version v0.44.1
az bicep build --file materials/bicep/main.bicep
git diff -- materials/bicep/main.json
```

Compiler warnings remain visible. Updating the compiler requires reviewing and
regenerating the distributed artifact, not silently compiling with latest.
Pages publication is unchanged. CI does not claim Azure deployment, SWA CLI
security, browser consent, Azure database CRUD, or workshop readiness.

Native script regressions also cover state/context, permissions, cleanup,
bounded public/recovery contracts and the shared frontend artifact helper:

```bash
node --test scripts/test/*.test.cjs
```

The optional deployment templates are validated with actionlint alongside
active workflows. Frontend's official action uses a prebuilt artifact and
does not install SWA CLI. Backend uses credential-free build/audit/packaging
and a separate OIDC-only deploy job, with the same `dist/src/app.js` ZIP layout
and shared bounded healthy-JSON checker as Cloud Shell. These contracts and
fixtures do not prove real OIDC, Azure upload or the native client's complete
supply-chain inventory. Missing configuration must fail, not silently skip.

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
