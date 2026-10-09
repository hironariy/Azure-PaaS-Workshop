# Application regression tests

Run from the repository root with Node.js 24:

```bash
npm --prefix materials/backend ci --include=dev
npm --prefix materials/frontend ci --include=dev
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

**Release/provenance blocker:** the candidate dependency lockfiles were generated
through the environment's configured package mirror. Local clean installs and
audit results do not establish ordinary public npm/Cloud Shell reproducibility.
Axios 1.20.0 was not available on public npm when checked; metadata transport
errors for other packages are not successful release verification. Keep this
candidate unmerged until supported sources/versions and the learner install
path are verified. Do not introduce an organization-specific registry as an
implicit workshop prerequisite.

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
It rejects non-public npm tarball sources before dependency installation. This
guard currently blocks the mirrored candidate dependency branch intentionally;
a green local audit is not sufficient to pass it.
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

After successful runs, maintainers can separately require **Application
(backend)**, **Application (frontend)**, and **Bicep artifact parity** in branch
protection/rulesets. This change does not modify those settings or merge PRs.
