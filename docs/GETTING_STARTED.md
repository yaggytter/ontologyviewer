# Getting Started

## CDN

1. Add an inert `<script type="text/turtle" class="ontologyviewer">` containing Turtle. This raw-text form accepts ordinary `<...>` IRIs without HTML escaping.
2. Import the pinned ESM file.
3. Call `initialize({ startOnLoad: true })`.

```html
<script type="text/turtle" class="ontologyviewer" data-height="600px">
@prefix : <https://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
:Thing a owl:Class .
</script>
<script type="module">
  import ontologyviewer from "https://cdn.jsdelivr.net/npm/ontologyviewer@0.2.0/dist/ontologyviewer.esm.min.mjs";
  ontologyviewer.initialize({ startOnLoad: true });
</script>
```

Serve the page over HTTP(S); browsers commonly restrict module imports from `file:` URLs. To run the repository examples, use:

```bash
npm run examples
# open http://127.0.0.1:4173/examples/index.html
```

The examples display an actionable startup message when opened through `file:` or when `dist/` cannot be loaded.

`startOnLoad: true` scans immediately if the document is already complete. During the initial page load it waits for `window.load`, so Gatsby/React and similar frameworks can hydrate their server-rendered DOM before ontologyviewer replaces the source with its Viewer. This is a one-shot delay and does not install a `MutationObserver`.

## npm

```bash
npm install --save-exact ontologyviewer@0.2.0
```

```ts
import ontologyviewer from "ontologyviewer";
const manager = ontologyviewer.initialize({ startOnLoad: true });
await manager.ready;
```

The library reads source `textContent`, never source HTML. Prefer the inert `text/turtle` script form when authoring Turtle directly because `<` and `>` remain raw text. A legacy `<pre class="ontologyviewer">` is still supported, but HTML syntax requires `<` to be written as `&lt;` there. Avoid a literal `</script>` sequence inside the inert script source because HTML uses it as the closing tag.

## Next steps

- Select a node or relation to open the Inspector.
- Double-click a node to focus its neighborhood.
- Switch between Schema and Triples.
- Supply a unique `data-storage-key` to opt into position persistence.
- Use [API.md](API.md) for dynamic content and lifecycle management.
