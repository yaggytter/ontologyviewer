import ontologyviewer from "../../dist/ontologyviewer.esm.mjs";
const manager = ontologyviewer.initialize({ startOnLoad: true, injectStyles: false });
await manager.ready;
document.documentElement.dataset.ready = "true";
