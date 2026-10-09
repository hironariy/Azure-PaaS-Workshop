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

Fixtures contain no real credentials. Model, sanitization, runtime configuration,
and isolated HTTP tests do not connect to Azure or MongoDB. They do not prove real
Entra consent, database persistence, Key Vault access, or Static Web Apps routing.
Use the learner validation and authorized Azure rehearsal for those checks.

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
security, browser consent, real database CRUD, or workshop readiness.

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
(backend)**, **Application (frontend)**, and **Bicep artifact parity** in branch
protection/rulesets. This change does not modify those settings or merge PRs.
