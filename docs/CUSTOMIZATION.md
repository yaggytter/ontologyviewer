# Customization and CSP

## Themes and locale

Use `theme: "auto"` to follow `prefers-color-scheme`; live OS theme changes are observed and released by `destroy()`. `locale: "auto"` selects Japanese for `ja-*` browser locales and English otherwise.

Viewer CSS is scoped below `.ontologyviewer-root`. Override tokens without targeting internal DOM:

```css
.ontologyviewer-root {
  --ov-bg: #fff;
  --ov-fg: #1f2937;
  --ov-muted: #64748b;
  --ov-border: #d7dde5;
  --ov-toolbar-bg: #f8fafc;
  --ov-input-bg: #fff;
  --ov-hover: #eef2f7;
}
```

## Appearance hints

The existing ontology vocabulary conventions are supported:

```turtle
@prefix view: <https://example.org/ontology#> .
:Person a owl:Class ; view:icon "👤" ; view:color "#2563EB" .
```

Only validated `#RRGGBB`-family color hints are accepted by the model.

## External CSS / CSP

Set `injectStyles: false` and load `ontologyviewer.css` using a link. Cytoscape needs style attributes for canvas positioning, but its normally injected fixed style element is suppressed by ontologyviewer and the equivalent rule ships in the CSS file.

Recommended minimum directives depend on hosting. A CDN example is:

```http
Content-Security-Policy: default-src 'none'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://cdn.jsdelivr.net; style-src-attr 'unsafe-inline'; img-src data: blob:
```

The module itself performs no network requests. `script-src` and `style-src` only authorize the browser to download files explicitly referenced by the host page.

External-CSS mode does not set an inline height. Its CSS default is 600px; override `.ontologyviewer-root { height: ... }` in trusted site CSS.
