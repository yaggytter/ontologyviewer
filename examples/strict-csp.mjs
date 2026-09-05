const status = document.querySelector("[data-example-status]");

if (location.protocol === "file:") {
  if (status) {
    status.classList.add("example-error");
    status.setAttribute("role", "alert");
    status.textContent = "This example must be served over HTTP. Run \"npm run examples\" and open the displayed URL.";
  }
} else {
  try {
    const { default: ontologyviewer } = await import("../dist/ontologyviewer.esm.mjs");
    const manager = ontologyviewer.initialize({ startOnLoad: true, injectStyles: false });
    await manager.ready;
    if (status) status.hidden = true;
    document.documentElement.dataset.exampleReady = "true";
  } catch (error) {
    if (status) {
      status.classList.add("example-error");
      status.setAttribute("role", "alert");
      status.textContent = `Unable to start the viewer: ${error instanceof Error ? error.message : String(error)} Run \"npm run examples\" and ensure \"npm run build\" succeeds.`;
    }
    console.error("Strict CSP example failed to start", error);
  }
}
