const status = document.querySelector("[data-example-status]");

if (location.protocol === "file:") {
  if (status) {
    status.hidden = false;
    status.classList.add("example-error");
    status.setAttribute("role", "alert");
    status.textContent = "This example must be served over HTTP. Run \"npm run examples\", then open the displayed http://127.0.0.1 URL.";
  }
} else {
  try {
    const { default: ontologyviewer } = await import("../dist/ontologyviewer.esm.mjs");
    const manager = ontologyviewer.initialize({ startOnLoad: true });
    const instances = await manager.ready;
    if (instances.length === 0) throw new Error("No matching ontology source element was found.");
    if (status) status.hidden = true;
    document.documentElement.dataset.exampleReady = "true";
  } catch (error) {
    if (status) {
      status.hidden = false;
      status.classList.add("example-error");
      status.setAttribute("role", "alert");
      status.textContent = `Unable to start the viewer: ${error instanceof Error ? error.message : String(error)} Run \"npm run examples\" and open the displayed http://127.0.0.1 URL. Also ensure \"npm run build\" succeeds.`;
    }
    console.error("Ontology Viewer example failed to start", error);
  }
}
