# Contributing to ontologyviewer

## Setup

Use a current Node.js 20+ installation and the committed lockfile.

```bash
npm ci
npx playwright install chromium firefox webkit
npm run verify:full
```

The contents of this directory can be used as a standalone repository root. See [Development](docs/DEVELOPMENT.md).

## Workflow

1. Search existing issues and create a focused branch from `main`.
2. Add a failing unit/integration test or Playwright journey first.
3. Implement the smallest integrated change and refactor after GREEN.
4. Run `npm run verify:full`.
5. Update public docs and `CHANGELOG.md` when behavior or decisions change.
6. Open a pull request describing behavior, risk, and test evidence.

Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`).

## Standards

- Strict TypeScript; immutable model transformations.
- Keep functions focused and production files below 800 lines.
- Use DOM APIs and `textContent` for untrusted ontology content; do not add HTML parser sinks.
- Validate every public option and persisted value.
- Do not add network requests, telemetry, dynamic code execution, or write/edit controls.
- Keep dependencies exact and explain additions.
- Preserve multi-instance isolation and complete lifecycle cleanup.
- Maintain lines/statements/functions coverage ≥80%, branches ≥70%, and all three browser projects.

Report suspected vulnerabilities privately as described in [Security](docs/SECURITY.md), not in a public issue.

Contributions are licensed under the [MIT License](LICENSE).
