import ontologyviewer from "../../dist/ontologyviewer.esm.mjs";

const manager = ontologyviewer.initialize({ startOnLoad: true });
await manager.ready;
const firstSource = document.querySelector("#first");
const secondSource = document.querySelector("#second");

window.harness = {
  manager,
  firstSource,
  secondSource,
  async invalid() {
    await ontologyviewer.getInstance(firstSource).update("@prefix : <https://example.org/> . :Broken a .");
  },
  async valid() {
    await ontologyviewer.getInstance(firstSource).update(`
@prefix : <https://example.org/new#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
:Recovered a owl:Class ; rdfs:label "Recovered" .
`);
  },
  async pngSize() {
    return (await ontologyviewer.getInstance(firstSource).exportPng()).size;
  },
  destroyFirst() {
    ontologyviewer.getInstance(firstSource).destroy();
  },
  addDynamic() {
    const source = document.createElement("pre");
    source.className = "ontologyviewer";
    source.id = "dynamic";
    source.textContent = `
@prefix : <https://example.org/dynamic#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
:Dynamic a owl:Class .`;
    document.body.appendChild(source);
    return source;
  },
  scan() {
    return manager.scan(document).length;
  },
};
document.documentElement.dataset.ready = "true";
