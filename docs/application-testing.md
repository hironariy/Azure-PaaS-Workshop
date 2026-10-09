# Application regression tests

Run from the repository root with Node.js 24:

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

After successful runs, maintainers can separately require **Application
(backend)**, **Application (frontend)**, **Database HTTP contracts**, and **Bicep artifact parity** in branch
protection/rulesets. This change does not modify those settings or merge PRs.
