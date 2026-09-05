# API Reference

## Exports

```ts
import ontologyviewer, { initialize, render, getInstance } from "ontologyviewer";
```

The default export contains the same three functions.

## `initialize(options?): OntologyViewerManager`

Options extend `OntologyViewerOptions` and add:

- `startOnLoad?: boolean` — scan immediately when the document is already complete; otherwise scan once at `window.load`, after parser-inserted async/deferred scripts and framework hydration have had a chance to finish.
- `selector?: string` — default `pre.ontologyviewer, script[type="text/turtle"].ontologyviewer`.

The manager exposes:

- `ready: Promise<readonly OntologyViewerInstance[]>`
- `instances()`
- `getInstance(element)`
- `scan(root?)` — explicit dynamic-DOM scan; no MutationObserver is installed.
- `destroyAll()`

## `render(element, options?): OntologyViewerInstance`

Rendering the same live source twice returns its existing instance. The source is hidden but retained. Destroying the instance restores the source's prior `hidden` and `aria-hidden` state.

The default scanner accepts both `<pre class="ontologyviewer">` and inert `<script type="text/turtle" class="ontologyviewer">` sources. Prefer the inert script when writing Turtle directly in HTML because it preserves ordinary `<...>` IRIs; a `<pre>` must follow HTML syntax and use `&lt;`. Both are read through `textContent`.

### `OntologyViewerOptions`

| Option | Values | Default |
| --- | --- | --- |
| `height` | numeric CSS length | `600px` |
| `theme` | `auto`, `light`, `dark` | `auto` |
| `locale` | `auto`, `en`, `ja` | `auto` |
| `layout` | `fcose`, `dagre` | `fcose` |
| `defaultView` | `schema`, `triples` | `schema` |
| `compactTriples` | boolean | `true` |
| `baseIri` | absolute or relative IRI | `document.baseURI` |
| `storageKey` | non-empty string, max 200 characters | persistence off |
| `injectStyles` | boolean | `true` |
| `onReady` | `(instance) => void` | — |
| `onError` | `(error, instance) => void` | — |
| `onSelectionChange` | `(id | undefined) => void` | — |

`baseIRI` remains as a deprecated alias for `baseIri`.

## Instance

- `status`: `loading | ready | error | empty | destroyed`
- `error`: the current `{ message, line?, column?, cause? }`
- `container`: generated root element
- `sourceElement`: original source
- `update(turtle): Promise<void>` — reparses and re-renders. Invalid input replaces the graph with an error; a later valid update recovers.
- `fit(): void`
- `runLayout(name?): void`
- `exportPng(): Promise<Blob>`
- `destroy(): void` — idempotent; releases Cytoscape, observers, media listeners, DOM listeners, timers, and map references.

Methods other than `destroy()` throw after destruction.

## Element attributes

`data-height`, `data-theme`, `data-locale`, `data-layout`, `data-default-view`, `data-base-iri`, and `data-storage-key` map to the corresponding options. Explicit API options take precedence.
