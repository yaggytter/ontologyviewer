# ontologyviewer

[日本語](README.ja.md) · [API](docs/API.md) · [Publishing](docs/PUBLISHING.md)

A standalone, read-only Turtle ontology viewer for web pages. It renders class-focused **Schema** diagrams and raw **Triples** graphs with Cytoscape, without a server, account, telemetry, or ontology network requests.

## Quick start

```html
<script type="text/turtle" class="ontologyviewer">
@prefix : <https://example.org/harbor#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:Vendor a owl:Class ; rdfs:label "Vendor" .
:Stall a owl:Class ; rdfs:label "Stall" .
:operates a owl:ObjectProperty ;
  rdfs:label "operates" ; rdfs:domain :Vendor ; rdfs:range :Stall .
</script>

<script type="module">
  import ontologyviewer from "https://cdn.jsdelivr.net/npm/ontologyviewer@0.2.0/dist/ontologyviewer.esm.min.mjs";
  ontologyviewer.initialize({ startOnLoad: true });
</script>
```

The inert `text/turtle` script is retained in the DOM and hidden while its viewer is active. It accepts ordinary Turtle `<...>` IRIs without HTML entity escaping. Avoid a literal `</script>` sequence in that Turtle because HTML treats it as the closing tag. A `<pre class="ontologyviewer">` remains supported, but literal HTML source must write `<` as `&lt;`; `destroy()` restores either source element.

Do not double-click the files under `examples/`: browser ES Modules are commonly blocked on `file:` URLs. Run `npm run examples` and open `http://127.0.0.1:4173/examples/index.html`. The example page now keeps an actionable message visible when it is opened incorrectly or when `dist/` has not been built.

For reproducible pages, pin a complete version (`@0.2.0`). A major selector such as `@10` follows compatible releases but can change the delivered bytes.

## Install from npm

```bash
npm install --save-exact ontologyviewer@0.2.0
```

```ts
import ontologyviewer, { render, getInstance } from "ontologyviewer";

const manager = ontologyviewer.initialize({
  startOnLoad: true,
  theme: "auto",
  locale: "auto",
});
await manager.ready;
```

## Features

- Schema cards with datatype properties, icons, color hints, cardinality, inferred-relation styling, statistics, legend, and read-only Inspector.
- Raw Triples view, search, neighborhood focus, pan, zoom, fit, fCoSE/Dagre layouts, node dragging, and PNG export.
- Compact Triples view (on by default): labels, comments, and standard vocabulary terms are folded into the nodes that reference them, which removed two thirds of the boxes and 70% of the edges on a 1182-triple schema ontology. A toolbar toggle expands them again; set `compactTriples: false` or `data-compact-triples="false"` to start expanded.
- Multiple isolated viewers in one document.
- English and Japanese UI; automatic light/dark theme tracking.
- Optional, validated `localStorage` layout persistence.
- Safe parse failures with line/column information and recovery through `update()`.
- One-import CSS injection, plus an external-CSS mode for restrictive CSPs.
- No editor controls, remote imports, fetch/XHR, telemetry, cookies, or accounts.

## HTML configuration

```html
<script
  type="text/turtle"
  class="ontologyviewer"
  data-height="600px"
  data-theme="dark"
  data-locale="ja"
  data-layout="dagre"
  data-default-view="schema"
  data-compact-triples="true"
  data-base-iri="https://example.org/base/"
  data-storage-key="harbor-market"
>...</script>
```

API options take precedence over `data-*` values. Accepted heights are numeric `px`, `rem`, `em`, `vh`, `vw`, or `%` lengths. Invalid values fall back safely to `600px`.

## Programmatic API

```ts
const source = document.querySelector<HTMLElement>("#ontology")!;
const instance = ontologyviewer.render(source, {
  baseIri: "https://example.org/base/",
  defaultView: "schema",
  compactTriples: true,
  layout: "fcose",
  storageKey: "example-layout", // omit to disable persistence
  onError(error) {
    console.error(error.line, error.column, error.message);
  },
});

await instance.update(nextTurtle);
instance.fit();
instance.runLayout("dagre");
const png: Blob = await instance.exportPng();
instance.destroy();

ontologyviewer.getInstance(source); // undefined after destroy()
```

`initialize()` does not install a `MutationObserver`. For dynamically inserted source elements, call `manager.scan(container)` or `render(element)` explicitly. With `startOnLoad: true`, the initial scan waits for `window.load` unless the document is already complete, avoiding races with Gatsby/React hydration that can replace server-rendered DOM.

See [API.md](docs/API.md) for the complete contracts and lifecycle states.

## Strict CSP / external CSS

Automatic style injection is convenient but requires an inline `<style>`. Disable it and load the published stylesheet when your policy does not allow inline style elements:

```html
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/ontologyviewer@0.2.0/dist/ontologyviewer.css"
      data-ontologyviewer-styles>
<script type="module" src="/assets/start-ontologyviewer.mjs"></script>
```

```js
// /assets/start-ontologyviewer.mjs
import ontologyviewer from "https://cdn.jsdelivr.net/npm/ontologyviewer@0.2.0/dist/ontologyviewer.esm.min.mjs";
ontologyviewer.initialize({ startOnLoad: true, injectStyles: false });
```

Cytoscape positions its canvases with style attributes, so a compatible strict policy permits style attributes while keeping style elements external, for example:

```http
Content-Security-Policy: default-src 'none'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://cdn.jsdelivr.net; style-src-attr 'unsafe-inline'; img-src data: blob:
```

In external-CSS mode the stylesheet's default height is 600px. Set a different height in trusted site CSS rather than `data-height`, because the library deliberately avoids setting a style attribute in this mode.

## Base IRI resolution

The parser resolves relative IRIs using:

1. `options.baseIri` (the deprecated `baseIRI` alias is also accepted)
2. `data-base-iri`
3. a Turtle `@base` directive, interpreted by N3
4. `document.baseURI`

Only Turtle is accepted in version 0.1.x. RDF/XML, JSON-LD, TriG, N-Triples, and Notation3 are not auto-detected.

## Browser support

The ESM bundle targets ES2020 and is tested in CI with current Playwright Chromium, Firefox, and WebKit. The support policy is the latest two stable releases of Chrome/Edge, Firefox, and Safari.

## Development and publishing

This package is self-contained. After cloning, run:

```bash
npm ci
npx playwright install chromium firefox webkit
npm run verify
npm run test:e2e
npm pack
```

- [Getting started](docs/GETTING_STARTED.md)
- [API reference](docs/API.md)
- [Customization and CSP](docs/CUSTOMIZATION.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Development](docs/DEVELOPMENT.md)
- [Publishing to npm/jsDelivr](docs/PUBLISHING.md)
- [Security](docs/SECURITY.md) · [Privacy](docs/PRIVACY.md)
- [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)

## License

MIT. Bundled dependency notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
