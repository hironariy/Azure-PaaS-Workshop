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

## Dependency maintenance

Use Node 24's built-in watch mode for backend development (`npm run dev`).
The frontend keeps React 18 and uses React Router 7's compatible declarative
routes and Tailwind 4's PostCSS plugin. Tailwind's JavaScript configuration is
loaded explicitly; the previous workshop colors, small shadows, and border
defaults are preserved. Shared button utilities remain usable with `@apply`.
Stylesheet and route tests cover compilation and URL decoding, not visual
browser equivalence.

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
