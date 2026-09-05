const status = document.querySelector("[data-example-status]");
const controls = [...document.querySelectorAll(".controls button")];

if (location.protocol === "file:") {
  if (status) {
    status.classList.add("example-error");
    status.setAttribute("role", "alert");
    status.textContent = "This example must be served over HTTP. Run \"npm run examples\" and open the displayed URL.";
  }
} else {
  try {
    const { render } = await import("../dist/ontologyviewer.esm.mjs");
    const source = document.querySelector("#viewer-target");
    const instance = render(source, { theme: "light", layout: "fcose" });
    controls.forEach((control) => { control.disabled = false; });
    if (status) status.hidden = true;
    document.documentElement.dataset.exampleReady = "true";

    document.querySelector("#btn-fit").addEventListener("click", () => instance.fit());
    document.querySelector("#btn-layout-fcose").addEventListener("click", () => instance.runLayout("fcose"));
    document.querySelector("#btn-layout-dagre").addEventListener("click", () => instance.runLayout("dagre"));
    document.querySelector("#btn-update").addEventListener("click", () => instance.update(`
@prefix : <http://example.org/colors#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
:Color a owl:Class ; rdfs:label "Color" .
:Red a owl:Class ; rdfs:label "Red" ; rdfs:subClassOf :Color .
:Green a owl:Class ; rdfs:label "Green" ; rdfs:subClassOf :Color .
:Blue a owl:Class ; rdfs:label "Blue" ; rdfs:subClassOf :Color .
:mixesWith a owl:ObjectProperty ; rdfs:label "mixes with" ; rdfs:domain :Color ; rdfs:range :Color .
    `));
    document.querySelector("#btn-export").addEventListener("click", async () => {
      const blob = await instance.exportPng();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ontology-diagram.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
    document.querySelector("#btn-destroy").addEventListener("click", () => {
      instance.destroy();
      controls.forEach((control) => { control.disabled = true; });
    });
  } catch (error) {
    if (status) {
      status.classList.add("example-error");
      status.setAttribute("role", "alert");
      status.textContent = `Unable to start the viewer: ${error instanceof Error ? error.message : String(error)} Run \"npm run examples\" and ensure \"npm run build\" succeeds.`;
    }
    console.error("Programmatic example failed to start", error);
  }
}
