# Troubleshooting

## An example shows no viewer

Do not open `examples/*.html` directly with a `file:` URL. Browsers block the relative ESM import from an opaque `null` origin. Run `npm run examples`, then open `http://127.0.0.1:4173/examples/index.html`. If `dist/` is missing or cannot load, the page displays this command instead of failing silently.

## The source remains visible

Wait for `manager.ready`, confirm the selector matches, and serve the page over HTTP(S). Invalid selectors throw rather than silently scanning the wrong elements.

## A parse error is shown

Version 0.1.x accepts Turtle only and fails closed. The error includes N3's line/column when available. Fix the source or call `await instance.update(validTurtle)`; the same instance recovers.

## Relative IRIs resolve unexpectedly

Check, in order: `baseIri`, `data-base-iri`, Turtle `@base`, and the page's `document.baseURI`.

## Styles are missing

The default module injects CSS. Under CSP, load `dist/ontologyviewer.css`, add `data-ontologyviewer-styles` to the link, and pass `injectStyles: false`. See [CUSTOMIZATION.md](CUSTOMIZATION.md).

## The Viewer appears only after reloading a framework-rendered page

Gatsby, React, and similar frameworks can hydrate server-rendered HTML while module and `async` bundles are loading. Older ontologyviewer builds could scan during `document.readyState === "interactive"`; a later hydration pass could then replace the source subtree and remove the generated Viewer. The outcome depended on network and browser cache timing, so it was intermittent.

Use a build where `startOnLoad: true` waits for `window.load` whenever the document is not yet complete. Keep the source element in the hydrated output and await `manager.ready` before assuming initialization finished. No persistent DOM observer is installed.

## A dynamic element is not initialized

This is intentional: no DOM observer runs in the background. Call `manager.scan(parent)` or `ontologyviewer.render(element)`.

## Positions are shared unexpectedly

Give each viewer a unique `storageKey`. Positions are namespaced by Schema/Triples view, validated before use, and disabled entirely when no key is supplied.

## PNG export fails

Wait until `status === "ready"`. `exportPng()` rejects for empty/error/destroyed instances. Browser download policies may require the UI button or another direct user gesture.

## The graph is initially off-screen

The instance observes size changes and refits after a zero-sized container becomes renderable. Avoid permanently placing it inside `display:none`; call `fit()` after revealing unusual host layouts.
