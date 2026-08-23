# Privacy Notice — ontologyviewer

## Summary

**ontologyviewer collects no data.** It processes Turtle documents entirely within the browser tab that loads it and has no server-side component.

## Data Flow

```
Turtle text in <pre> element
  → Parsed in-memory (N3 library, no network)
  → Graph model built in JavaScript heap
  → Rendered to a <canvas> via Cytoscape.js
  → User interacts locally
```

No ontology content, user interaction data, or metadata ever leaves the browser.

## Storage

| What | Where | When |
|------|-------|------|
| Node layout positions | `localStorage` | Only when `storageKey` option is explicitly provided |

No cookies, IndexedDB, or session storage are used. If `storageKey` is not set, nothing is persisted.

## Network

The library makes **zero** network requests. It does not:

- Phone home
- Load remote resources
- Send analytics or telemetry beacons
- Use WebSockets or Server-Sent Events
- Access any API endpoints

## Third-Party Code

Bundled dependencies (Cytoscape.js, N3, cytoscape-fcose, cytoscape-dagre) are included in the distributed bundle. None of these libraries perform network I/O in the way ontologyviewer uses them.

## CDN Usage

When loaded via jsDelivr or another CDN, the browser makes a request to that CDN to fetch the script file. This is a standard browser resource fetch and is not controlled by ontologyviewer. The CDN's own privacy policy applies to that request.

## Contact

For privacy questions, open a GitHub issue or contact the maintainer.
