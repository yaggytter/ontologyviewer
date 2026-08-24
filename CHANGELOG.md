# Changelog

All notable changes to `ontologyviewer` are recorded here. The format follows Keep a Changelog and Semantic Versioning.

## [0.1.2] — 2026-08-24

### Fixed

- point repository, issues, homepage, and release links at the standalone yaggytter/ontologyviewer repository

## [0.1.1] — 2026-08-24

### Added

- Inert `<script type="text/turtle" class="ontologyviewer">` sources for raw, unescaped Turtle IRIs.
- Example index navigation and a raw-Turtle embedding demo.

### Fixed

- Correct package repository, issue, and homepage metadata to point to the standalone `ontologyviewer` repository.
- Defer `startOnLoad` scanning until the page load is stable so Gatsby/React hydration cannot remove an early Viewer on intermittent first visits.
- Use Cytoscape's default wheel sensitivity to avoid console warnings while preserving browser-appropriate mouse-wheel zoom.
- Keep multiline Schema labels inside their cards.
- Represent every parsed quad in Triples view and distinguish quoted literal nodes from resources.

[0.1.1]: https://github.com/yaggytter/ontologyviewer/releases/tag/v0.1.2

## [0.1.0] — 2026-08-19

### Added

- Standalone browser/npm/CDN ESM package for read-only Turtle visualization.
- Schema cards and raw Triples view with fCoSE and Dagre layouts.
- Search, neighborhood focus, Inspector, statistics, legend, pan/zoom/fit, node dragging, and PNG Blob export.
- Multiple isolated instances with explicit scan/update/destroy lifecycle.
- Safe syntax-error UI and recovery through `update()`.
- Optional, validated and view-namespaced localStorage persistence.
- Light/dark/auto themes and English/Japanese/auto locale.
- Scoped CSS and external-CSS CSP mode.
- Default/named JavaScript exports and TypeScript declarations.
- Unit/integration coverage gates and Chromium/Firefox/WebKit E2E tests.
- Packed-consumer, declaration, manifest, and 600 KiB gzip checks.
- Independent CI and tokenless npm OIDC Trusted Publishing workflow.
- English/Japanese README, API, customization, troubleshooting, development, publishing, security, privacy, and contribution documentation.

### Security

- Ontology-derived content is rendered through DOM `textContent`, never an HTML parser sink.
- No network/telemetry APIs or editor write operations are present.
- Exact dependency versions and a committed lockfile; clean audit at release preparation.

[0.1.0]: https://github.com/yaggytter/ontologyviewer/releases/tag/v0.1.0
