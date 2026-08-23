# Security Policy

## Threat model

`ontologyviewer` renders untrusted Turtle in the browser. It is read-only and has no extension host, backend, authentication, or remote ontology loader.

## Controls

- N3 parses Turtle and failures are fail-closed; partial quads are not rendered.
- Ontology labels, comments, IRIs, and search metadata enter the DOM only through `textContent`/DOM properties. Production source contains no `innerHTML`, HTML parser sink, `eval`, or `Function` use.
- Raw Turtle embedding uses only non-executable `<script type="text/turtle">` elements and reads their `textContent`; executable script MIME types are not part of the default selector.
- API/data attributes, dimensions, enum options, base IRIs, storage keys, persisted JSON, coordinates, zoom, and pan are validated at boundaries.
- Prototype-sensitive persisted/prefix keys are rejected.
- There is no `fetch`, XHR, WebSocket, beacon, telemetry, cookie, or external IRI dereference.
- CSS selectors are scoped to `.ontologyviewer-root`.
- `destroy()` releases Cytoscape, observers, media listeners, DOM listeners, timers, root DOM, and registry references.
- Dependencies are exact and locked; CI audits all dependencies and checks the packed consumer.

## CSP

Default style injection requires an inline style element. External-CSS mode (`injectStyles: false`) avoids it. Cytoscape still requires style attributes for its canvas layers, so use `style-src-attr 'unsafe-inline'` while keeping `style-src` restricted to trusted stylesheet origins. This limitation is documented and tested in Chromium, Firefox, and WebKit.

## Supported versions

The latest 0.1.x release receives fixes while 0.1 is current. A formal long-term support policy will begin with 1.0.

## Reporting

Do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting for the repository, or the private contact listed in the parent project's security policy. Include affected version, impact, and a minimal reproduction without real private ontology data.

Maintainers will acknowledge a report as soon as practical, investigate privately, publish a corrected version, and coordinate disclosure. Do not rely on fixed calendar promises for severity-dependent incidents.
