# Development

## Requirements

- Node.js 20 or newer for local development; release CI uses Node 24.
- npm 11.5.1 or newer for OIDC Trusted Publishing.

All dependencies are exact versions and `package-lock.json` is committed.

```bash
npm ci
npx playwright install chromium firefox webkit
npm run verify
npm run test:e2e
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint source and E2E TypeScript |
| `npm run typecheck` | Strict TypeScript check |
| `npm test` | Unit/integration tests |
| `npm run test:coverage` | Tests plus 80/80/80/70 thresholds |
| `npm run test:e2e` | Chromium, Firefox, and WebKit journeys |
| `npm run build` | ESM, minified ESM, CSS, declarations |
| `npm run check:tarball` | Manifest, 600 KiB gzip gate, clean consumer import/types |
| `npm run audit` | Production dependency audit |
| `npm run verify` | Non-browser quality gate |
| `npm run verify:full` | Quality gate plus browser E2E |

## TDD workflow

1. Add a failing unit/integration test or Playwright journey.
2. Run it and observe RED.
3. Implement the smallest integrated change for GREEN.
4. Refactor, then run `npm run verify:full`.
5. Record material public decisions and validation in `CHANGELOG.md`, the relevant guide, or the pull request.

## Structure

- `src/index.ts`: scanner, option validation, instance registry, public exports.
- `src/viewer.ts`: instance-owned DOM/Cytoscape lifecycle.
- `src/rdf/`: browser Turtle parser and graph/schema models.
- `src/styles/`: fully scoped CSS and external-CSP artifact.
- `tests/e2e/`: three-engine browser journeys and fixtures.
- `scripts/check-tarball.mjs`: packed consumer and size verification.
- `examples/`: human-readable runnable samples.

No source, build, test, or documentation command reads outside this directory. To prove independence, copy the directory contents to a temporary repository root and run `npm ci && npm run verify`.

## Examples

```bash
npm run examples
```

The command builds `dist/`, starts the local server, and prints its URL. Open `http://127.0.0.1:4173/examples/index.html`. Do not open example HTML through `file:`; browser module CORS rules prevent the ESM bundle from loading. The pages keep startup guidance visible if the protocol is wrong or the bundle is missing.
