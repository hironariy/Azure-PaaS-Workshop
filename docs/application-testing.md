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
