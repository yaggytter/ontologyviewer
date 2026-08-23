/** A single, fully isolated ontology viewer instance. */
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import dagre from "cytoscape-dagre";
import type { LayoutName, OntologyViewerError, OntologyViewerInstance, OntologyViewerOptions, ViewerStatus, ViewMode } from "./types";
import { parseTurtle } from "./rdf/parser";
import { buildGraphModel, type OntologyGraph } from "./rdf/graphModel";
import { buildSchemaModel, type SchemaEntity, type SchemaModel, type SchemaRelation } from "./rdf/schemaModel";
import { COLOR_PALETTE_SIZE } from "./rdf/appearance";
import { accessibleTextColor, isDarkTheme, paletteColorFor, paletteSurfaceFor } from "./theme";
import { getMessages, type Messages } from "./locale";
import { searchSchema, type SearchResult } from "./search";
import { DEFAULT_ZOOM, readableFitZoom, zoomLabel, zoomStep } from "./viewport";
import { layoutStorageKey, loadLayout, saveLayout } from "./persistence";

let pluginsRegistered = false;
function registerPlugins(): void {
  if (pluginsRegistered) return;
  cytoscape.use(fcose);
  cytoscape.use(dagre);
  pluginsRegistered = true;
}

interface ViewerDom {
  toolbar: HTMLElement;
  schemaButton: HTMLButtonElement;
  triplesButton: HTMLButtonElement;
  search: HTMLInputElement;
  searchResults: HTMLElement;
  layout: HTMLSelectElement;
  zoomLabel: HTMLElement;
  stage: HTMLElement;
  graph: HTMLElement;
  message: HTMLElement;
  inspector: HTMLElement;
  stats: HTMLElement;
  legend: HTMLElement;
}

export function createViewer(
  sourceElement: HTMLElement,
  initialTurtle: string,
  options: OntologyViewerOptions,
  onDestroy: () => void,
): OntologyViewerInstance {
  registerPlugins();
  const doc = sourceElement.ownerDocument;
  ensureCytoscapeStyleMarker(doc);
  const messages = getMessages(options.locale ?? "auto");
  const root = doc.createElement("section");
  root.className = "ontologyviewer-root";
  if (options.injectStyles !== false) root.style.height = options.height ?? "600px";
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", messages.schemaView);
  sourceElement.insertAdjacentElement("afterend", root);

  const dom = createDom(doc, root, messages, options);
  let status: ViewerStatus = "loading";
  let currentError: OntologyViewerError | undefined;
  let schema: SchemaModel = { entities: [], relations: [], isEmpty: true };
  let graph: OntologyGraph = { nodes: [], edges: [] };
  let currentView: ViewMode = options.defaultView ?? "schema";
  let currentLayout: LayoutName = options.layout ?? "fcose";
  let dark = isDarkTheme(options.theme ?? "auto");
  let cy: cytoscape.Core | undefined;
  let destroyed = false;
  let focusedId: string | undefined;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  const abort = new AbortController();
  const { signal } = abort;

  applyTheme(root, dark);

  const instance: OntologyViewerInstance = {
    container: root,
    sourceElement,
    get status() { return status; },
    get error() { return currentError; },
    async update(turtle: string): Promise<void> {
      ensureAlive();
      sourceElement.textContent = turtle;
      renderSource(turtle);
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      status = "destroyed";
      if (persistTimer) clearTimeout(persistTimer);
      abort.abort();
      resizeObserver?.disconnect();
      if (mediaQuery) mediaQuery.removeEventListener("change", onThemeChange);
      cy?.destroy();
      cy = undefined;
      root.remove();
      onDestroy();
    },
    fit(): void {
      ensureAlive();
      fitReadable();
    },
    runLayout(name?: LayoutName): void {
      ensureAlive();
      if (name) {
        currentLayout = name;
        dom.layout.value = name;
      }
      runLayout();
    },
    async exportPng(): Promise<Blob> {
      ensureAlive();
      if (!cy || cy.elements().empty()) throw new Error("The ontology graph is not ready.");
      const dataUrl = cy.png({ full: true, scale: 2, bg: dark ? "#1e1e1e" : "#ffffff" });
      return dataUrlToBlob(dataUrl);
    },
  };

  function ensureAlive(): void {
    if (destroyed) throw new Error("This Ontology Viewer instance has been destroyed.");
  }

  function renderSource(turtle: string): void {
    status = "loading";
    currentError = undefined;
    const parsed = parseTurtle(turtle, options.baseIri ?? options.baseIRI ?? doc.baseURI);
    if (parsed.errors.length > 0) {
      const first = parsed.errors[0];
      const error: OntologyViewerError = { ...first, cause: first.message };
      showFailure(error);
      return;
    }

    schema = buildSchemaModel(parsed.quads);
    graph = buildGraphModel(parsed.quads);
    if (schema.isEmpty && graph.nodes.length === 0) {
      status = "empty";
      currentError = undefined;
      destroyCy();
      setUiAvailable(false);
      showMessage(messages.emptyOntology, "status");
      updateStats();
      return;
    }

    if (currentView === "schema" && schema.isEmpty) currentView = "triples";
    status = "ready";
    setUiAvailable(true);
    clearMessage();
    clearInspector();
    renderGraph();
    updateStats();
    updateViewButtons();
    queueMicrotask(() => {
      if (!destroyed && status === "ready") options.onReady?.(instance);
    });
  }

  function showFailure(error: OntologyViewerError): void {
    status = "error";
    currentError = error;
    destroyCy();
    setUiAvailable(false);
    const text = messages.parseError
      .replace("{line}", String(error.line ?? "?"))
      .replace("{col}", String(error.column ?? "?"))
      .replace("{msg}", error.message);
    showMessage(text, "alert");
    queueMicrotask(() => {
      if (!destroyed && currentError === error) options.onError?.(error, instance);
    });
  }

  function renderGraph(): void {
    destroyCy();
    focusedId = undefined;
    const view = effectiveView();
    const elements = view === "schema" ? schemaElements(schema) : graphElements(graph);
    cy = cytoscape({
      container: dom.graph,
      elements,
      style: view === "schema" ? schemaStyles(dark) : triplesStyles(dark),
      layout: { name: "preset" },
      minZoom: 0.35,
      maxZoom: 2.5,
      wheelSensitivity: 0.25,
    });

    const restored = restoreLayout(cy, view);
    bindGraphEvents(cy, view);
    if (restored) {
      cy.layout({ name: "preset", fit: false }).run();
      fitReadable(false);
    } else {
      runLayout();
    }
    dom.zoomLabel.textContent = zoomLabel(cy.zoom());
  }

  function bindGraphEvents(core: cytoscape.Core, view: ViewMode): void {
    core.on("select", "node", (event) => {
      updateInspectorForNode(event.target.id(), view);
      options.onSelectionChange?.(event.target.id());
    });
    core.on("select", "edge", (event) => {
      updateInspectorForRelation(event.target.id(), view);
      options.onSelectionChange?.(event.target.id());
    });
    core.on("tap", (event) => {
      if (event.target !== core) return;
      core.elements().unselect();
      clearFocus();
      clearInspector();
      options.onSelectionChange?.(undefined);
    });
    core.on("dbltap", "node", (event) => toggleFocus(event.target.id()));
    core.on("dragfree", "node", schedulePersist);
    core.on("zoom", () => {
      dom.zoomLabel.textContent = zoomLabel(core.zoom());
      schedulePersist();
    });
    core.on("pan", schedulePersist);
  }

  function effectiveView(): ViewMode {
    return currentView === "schema" && schema.isEmpty ? "triples" : currentView;
  }

  function runLayout(): void {
    if (!cy || cy.elements().empty()) return;
    cy.one("layoutstop", () => {
      fitReadable();
      schedulePersist();
    });
    cy.layout(layoutOptions(currentLayout)).run();
  }

  function fitReadable(recalculate = true): void {
    if (!cy || cy.elements().empty()) return;
    if (recalculate) cy.fit(cy.elements(), 42);
    const next = readableFitZoom(cy.zoom(), cy.nodes().length);
    if (next > cy.zoom()) {
      cy.zoom(next);
      cy.center(cy.elements());
    }
  }

  function restoreLayout(core: cytoscape.Core, view: ViewMode): boolean {
    if (!options.storageKey) return false;
    const saved = loadLayout(layoutStorageKey(options.storageKey, view));
    if (!saved) return false;
    let restored = 0;
    for (const [id, position] of Object.entries(saved.positions)) {
      const node = core.getElementById(id);
      if (node.nonempty()) {
        node.position(position);
        restored += 1;
      }
    }
    if (restored === 0) return false;
    core.zoom(saved.zoom);
    core.pan(saved.pan);
    return true;
  }

  function schedulePersist(): void {
    if (!options.storageKey || !cy || destroyed) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      if (!cy || !options.storageKey || destroyed) return;
      const positions: Record<string, { x: number; y: number }> = Object.create(null) as Record<string, { x: number; y: number }>;
      cy.nodes().forEach((node) => { positions[node.id()] = { ...node.position() }; });
      saveLayout(layoutStorageKey(options.storageKey, effectiveView()), {
        positions,
        zoom: cy.zoom(),
        pan: { ...cy.pan() },
      });
    }, 100);
  }

  function toggleFocus(id: string): void {
    if (!cy) return;
    if (focusedId === id) {
      clearFocus();
      return;
    }
    focusedId = id;
    const node = cy.getElementById(id);
    cy.elements().removeClass("dimmed");
    cy.elements().not(node.closedNeighborhood()).addClass("dimmed");
    cy.fit(node.closedNeighborhood(), 70);
  }

  function clearFocus(): void {
    focusedId = undefined;
    cy?.elements().removeClass("dimmed");
  }

  function destroyCy(): void {
    cy?.destroy();
    cy = undefined;
    dom.graph.replaceChildren();
  }

  function setUiAvailable(available: boolean): void {
    dom.toolbar.hidden = !available;
    dom.graph.hidden = !available;
    dom.inspector.hidden = !available;
    dom.stats.hidden = !available;
    dom.legend.hidden = !available;
  }

  function showMessage(text: string, role: "alert" | "status"): void {
    dom.message.replaceChildren();
    const paragraph = doc.createElement("p");
    paragraph.textContent = text;
    dom.message.appendChild(paragraph);
    dom.message.className = role === "alert" ? "ov-message ov-error" : "ov-message ov-empty";
    dom.message.setAttribute("role", role);
    dom.message.hidden = false;
  }

  function clearMessage(): void {
    dom.message.hidden = true;
    dom.message.removeAttribute("role");
    dom.message.className = "ov-message";
    dom.message.replaceChildren();
  }

  function updateViewButtons(): void {
    dom.schemaButton.classList.toggle("active", currentView === "schema");
    dom.triplesButton.classList.toggle("active", currentView === "triples");
    dom.schemaButton.setAttribute("aria-pressed", String(currentView === "schema"));
    dom.triplesButton.setAttribute("aria-pressed", String(currentView === "triples"));
  }

  function updateStats(): void {
    dom.stats.textContent = `${messages.entities}: ${schema.entities.length} · ${messages.relations}: ${schema.relations.length} · ${messages.triples}: ${graph.edges.length}`;
  }

  function resetInspector(): void {
    dom.inspector.hidden = false;
    dom.inspector.replaceChildren();
    dom.inspector.appendChild(button(doc, messages.close, "ov-inspector-close", "×"));
  }

  function clearInspector(): void {
    resetInspector();
    const empty = doc.createElement("p");
    empty.className = "ov-inspector-empty";
    empty.textContent = messages.inspector;
    dom.inspector.appendChild(empty);
  }

  function updateInspectorForNode(id: string, view: ViewMode): void {
    resetInspector();
    if (view === "schema") {
      const entity = schema.entities.find((candidate) => candidate.id === id);
      if (!entity) return clearInspector();
      renderEntityInspector(doc, dom.inspector, entity, schema, messages);
      return;
    }
    const node = graph.nodes.find((candidate) => candidate.id === id);
    if (!node) return clearInspector();
    appendHeading(doc, dom.inspector, node.label);
    if (node.kind === "literal") {
      const details: Array<[string, string]> = [
        ["Value", node.literalValue ?? ""],
        ["Datatype", node.datatypeIri ?? ""],
      ];
      if (node.language) details.push(["Language", node.language]);
      appendDefinitionList(doc, dom.inspector, details);
      return;
    }
    if (node.comment) appendParagraph(doc, dom.inspector, node.comment, "ov-inspector-desc");
    appendDefinitionList(doc, dom.inspector, [[messages.type, node.kind], ["IRI", node.id]]);
  }

  function updateInspectorForRelation(id: string, view: ViewMode): void {
    resetInspector();
    if (view === "schema") {
      const relation = schema.relations.find((candidate) => candidate.id === id);
      if (!relation) return clearInspector();
      renderRelationInspector(doc, dom.inspector, relation, schema, messages);
      return;
    }
    const edge = graph.edges.find((candidate) => candidate.id === id);
    if (!edge) return clearInspector();
    appendHeading(doc, dom.inspector, edge.predicateLabel);
    appendDefinitionList(doc, dom.inspector, [["Source", edge.source], ["Predicate", edge.predicate], ["Target", edge.target]]);
  }

  function performSearch(): void {
    dom.searchResults.replaceChildren();
    const query = dom.search.value.trim();
    if (!query) {
      dom.searchResults.hidden = true;
      clearFocus();
      return;
    }
    const results = searchSchema(schema, query);
    dom.searchResults.hidden = false;
    if (results.length === 0) {
      const empty = doc.createElement("p");
      empty.className = "ov-search-empty";
      empty.textContent = messages.noResults;
      dom.searchResults.appendChild(empty);
      return;
    }
    for (const result of results) dom.searchResults.appendChild(searchResultButton(doc, result, selectSearchResult));
  }

  function selectSearchResult(result: SearchResult): void {
    if (!cy) return;
    const id = result.ownerId ?? result.id;
    const element = cy.getElementById(id);
    if (element.empty()) return;
    cy.elements().unselect();
    element.select();
    cy.elements().removeClass("dimmed");
    const neighborhood = result.kind === "relation"
      ? element.connectedNodes().union(element)
      : element.closedNeighborhood();
    cy.elements().not(neighborhood).addClass("dimmed");
    cy.fit(neighborhood, 70);
    dom.search.value = "";
    dom.searchResults.hidden = true;
  }

  function downloadPng(): void {
    void instance.exportPng().then((blob) => {
      const url = URL.createObjectURL(blob);
      const link = doc.createElement("a");
      link.href = url;
      link.download = "ontology-diagram.png";
      link.click();
      // Allow the browser to initiate the download before revoking the URL.
      // A zero-delay revoke can race with slow navigation in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }).catch((cause: unknown) => {
      showFailure({ message: cause instanceof Error ? cause.message : String(cause), cause });
    });
  }

  function onThemeChange(): void {
    const nextDark = isDarkTheme("auto");
    if (nextDark === dark) return;
    dark = nextDark;
    applyTheme(root, dark);
    if (status === "ready") renderGraph();
  }

  dom.schemaButton.addEventListener("click", () => {
    if (schema.isEmpty || currentView === "schema") return;
    currentView = "schema";
    updateViewButtons();
    clearInspector();
    renderGraph();
  }, { signal });
  dom.triplesButton.addEventListener("click", () => {
    if (currentView === "triples") return;
    currentView = "triples";
    updateViewButtons();
    clearInspector();
    renderGraph();
  }, { signal });
  dom.search.addEventListener("input", performSearch, { signal });
  dom.search.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    dom.search.value = "";
    dom.searchResults.hidden = true;
    clearFocus();
  }, { signal });
  root.querySelector<HTMLButtonElement>(".ov-btn-zoom-in")?.addEventListener("click", () => cy?.zoom(zoomStep(cy.zoom(), "in")), { signal });
  root.querySelector<HTMLButtonElement>(".ov-btn-zoom-out")?.addEventListener("click", () => cy?.zoom(zoomStep(cy.zoom(), "out")), { signal });
  root.querySelector<HTMLButtonElement>(".ov-btn-reset-zoom")?.addEventListener("click", () => {
    cy?.zoom(DEFAULT_ZOOM);
    cy?.center();
  }, { signal });
  root.querySelector<HTMLButtonElement>(".ov-btn-fit")?.addEventListener("click", () => fitReadable(), { signal });
  root.querySelector<HTMLButtonElement>(".ov-btn-layout")?.addEventListener("click", () => runLayout(), { signal });
  root.querySelector<HTMLButtonElement>(".ov-btn-export")?.addEventListener("click", downloadPng, { signal });
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(".ov-inspector-close")) dom.inspector.hidden = true;
  }, { signal });
  dom.layout.addEventListener("change", () => {
    currentLayout = dom.layout.value === "dagre" ? "dagre" : "fcose";
    runLayout();
  }, { signal });

  const mediaQuery = options.theme === "auto" && typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : undefined;
  mediaQuery?.addEventListener("change", onThemeChange);

  let wasZeroSize = true;
  const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect;
    if (!box) return;
    root.dataset.compact = String(box.width < 760);
    cy?.resize();
    const isZero = box.width === 0 || box.height === 0;
    if (wasZeroSize && !isZero) fitReadable();
    wasZeroSize = isZero;
  });
  resizeObserver?.observe(root);

  clearInspector();
  renderSource(initialTurtle);
  return instance;
}

function createDom(doc: Document, root: HTMLElement, messages: Messages, options: OntologyViewerOptions): ViewerDom {
  const toolbar = element(doc, "div", "ov-toolbar");
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", messages.layout);
  const viewToggle = element(doc, "div", "ov-view-toggle");
  viewToggle.setAttribute("role", "group");
  const schemaButton = button(doc, messages.schemaView, "ov-btn-schema");
  const triplesButton = button(doc, messages.triplesView, "ov-btn-triples");
  viewToggle.append(schemaButton, triplesButton);

  const search = doc.createElement("input");
  search.type = "search";
  search.className = "ov-search";
  search.placeholder = messages.searchPlaceholder;
  search.setAttribute("aria-label", messages.searchPlaceholder);
  search.setAttribute("aria-controls", "");

  const layout = doc.createElement("select");
  layout.className = "ov-layout-select";
  layout.setAttribute("aria-label", messages.layout);
  for (const name of ["fcose", "dagre"] as const) {
    const option = doc.createElement("option");
    option.value = name;
    option.textContent = name === "fcose" ? "fCoSE" : "Dagre";
    layout.appendChild(option);
  }
  layout.value = options.layout ?? "fcose";

  const controls = element(doc, "div", "ov-controls");
  controls.append(
    button(doc, messages.zoomOut, "ov-btn-zoom-out", "−"),
    button(doc, messages.resetZoom, "ov-btn-reset-zoom", "100%"),
    button(doc, messages.zoomIn, "ov-btn-zoom-in", "+"),
    button(doc, messages.fitToScreen, "ov-btn-fit", "⛶"),
    button(doc, messages.layout, "ov-btn-layout", "↻"),
    button(doc, messages.exportPng, "ov-btn-export", "⇩"),
  );
  toolbar.append(viewToggle, search, layout, controls);

  const searchResults = element(doc, "div", "ov-search-dropdown");
  searchResults.setAttribute("role", "listbox");
  searchResults.hidden = true;

  const body = element(doc, "div", "ov-body");
  const stage = element(doc, "div", "ov-stage");
  const graph = element(doc, "div", "ov-graph");
  const message = element(doc, "div", "ov-message");
  message.hidden = true;
  stage.append(graph, message);

  const inspector = element(doc, "aside", "ov-inspector");
  inspector.setAttribute("aria-label", messages.inspector);
  const close = button(doc, messages.close, "ov-inspector-close", "×");
  inspector.appendChild(close);
  body.append(stage, inspector);

  const footer = element(doc, "footer", "ov-footer");
  const stats = element(doc, "div", "ov-stats");
  stats.setAttribute("role", "status");
  const legend = doc.createElement("details");
  legend.className = "ov-legend";
  const summary = doc.createElement("summary");
  summary.textContent = messages.legend;
  const legendContent = element(doc, "div", "ov-legend-content");
  for (const [label, className] of [["subClassOf", "ov-subclass"], ["skos:broader", "ov-broader"], [messages.inferred, "ov-inferred"]]) {
    const item = element(doc, "span", `ov-legend-item ${className}`);
    item.textContent = label;
    legendContent.appendChild(item);
  }
  legend.append(summary, legendContent);
  footer.append(stats, legend);
  root.append(toolbar, searchResults, body, footer);
  const zoomLabelElement = controls.querySelector<HTMLElement>(".ov-btn-reset-zoom") ?? controls;
  return { toolbar, schemaButton, triplesButton, search, searchResults, layout, zoomLabel: zoomLabelElement, stage, graph, message, inspector, stats, legend };
}

function schemaElements(schema: SchemaModel): cytoscape.ElementDefinition[] {
  const nodes = schema.entities.map((entity) => {
    const properties = entity.properties.slice(0, 7).map((property) => `${property.isIdentifier ? "🔑 " : ""}${property.name}: ${property.type}`);
    const more = entity.properties.length > properties.length ? [`… +${entity.properties.length - properties.length}`] : [];
    return {
      data: {
        id: entity.id,
        label: [`${entity.icon}  ${entity.name}`, ...properties, ...more].join("\n"),
        colorIndex: entity.colorIndex,
        colorOverride: entity.colorOverride ?? null,
        origin: entity.origin,
        height: Math.min(210, 70 + (properties.length + more.length) * 18),
      },
    } satisfies cytoscape.ElementDefinition;
  });
  const seen = new Set<string>();
  const loops = new Map<string, number>();
  const edges: cytoscape.ElementDefinition[] = [];
  for (const relation of schema.relations) {
    if (seen.has(relation.id)) continue;
    seen.add(relation.id);
    const loopIndex = relation.source === relation.target ? loops.get(relation.source) ?? 0 : 0;
    if (relation.source === relation.target) loops.set(relation.source, loopIndex + 1);
    const cardinality = relation.cardinality === "unspecified" ? "" : ` (${cardinalityBadge(relation.cardinality)})`;
    edges.push({ data: {
      id: relation.id,
      source: relation.source,
      target: relation.target,
      edgeLabel: relation.kind === "subClassOf" ? "" : `${relation.name}${cardinality}`,
      kind: relation.kind,
      provenance: relation.provenance,
      loopIndex,
    } });
  }
  return [...nodes, ...edges];
}

function graphElements(graph: OntologyGraph): cytoscape.ElementDefinition[] {
  return [
    ...graph.nodes.map((node) => ({ data: { id: node.id, label: node.label, kind: node.kind } })),
    ...graph.edges.map((edge) => ({ data: { id: edge.id, source: edge.source, target: edge.target, edgeLabel: edge.predicateLabel } })),
  ];
}

function schemaStyles(dark: boolean): cytoscape.StylesheetStyle[] {
  const canvas = dark ? "#1e1e1e" : "#ffffff";
  return [
    { selector: "node", style: {
      label: "data(label)", "text-valign": "center", "text-halign": "center",
      "text-wrap": "wrap", "text-max-width": "190px", "font-size": 12, width: 220, height: "data(height)",
      shape: "round-rectangle", "border-width": 2.5,
      "background-color": (node: cytoscape.NodeSingular) => node.data("colorOverride") as string || paletteSurfaceFor(node.data("colorIndex") as number, COLOR_PALETTE_SIZE, dark),
      "border-color": (node: cytoscape.NodeSingular) => node.data("colorOverride") as string || paletteColorFor(node.data("colorIndex") as number, COLOR_PALETTE_SIZE, dark),
      color: (node: cytoscape.NodeSingular) => accessibleTextColor(node.data("colorOverride") as string || paletteSurfaceFor(node.data("colorIndex") as number, COLOR_PALETTE_SIZE, dark), canvas),
    } as unknown as cytoscape.Css.Node },
    { selector: "node[origin = 'skosConcept']", style: { shape: "ellipse" } as cytoscape.Css.Node },
    { selector: "node[origin = 'inferred']", style: { "border-style": "dashed", opacity: 0.85 } as cytoscape.Css.Node },
    { selector: "node:selected", style: { "border-color": "#007fd4", "border-width": 4 } as cytoscape.Css.Node },
    { selector: "edge", style: edgeStyle(dark) },
    { selector: "edge[kind = 'subClassOf']", style: { "line-color": "#b180d7", "target-arrow-color": "#b180d7", "target-arrow-shape": "triangle-tee" } as cytoscape.Css.Edge },
    { selector: "edge[kind = 'skosBroader']", style: { "line-color": "#16875c", "target-arrow-color": "#16875c" } as cytoscape.Css.Edge },
    { selector: "edge[provenance != 'declared']", style: { "line-style": "dashed", opacity: 0.65 } as cytoscape.Css.Edge },
    { selector: ".dimmed", style: { opacity: 0.1 } },
  ];
}

function triplesStyles(dark: boolean): cytoscape.StylesheetStyle[] {
  return [
    { selector: "node", style: {
      label: "data(label)", "text-valign": "center", "text-halign": "center", "text-wrap": "ellipsis", "text-max-width": "130px",
      width: 154, height: 54, shape: "round-rectangle", "font-size": 11, "border-width": 1.5,
      "background-color": dark ? "#2d2d2d" : "#f1f5f9", "border-color": dark ? "#666" : "#94a3b8", color: dark ? "#eee" : "#1e293b",
    } as cytoscape.Css.Node },
    { selector: "node[kind = 'class']", style: { "background-color": dark ? "#18324b" : "#dbeafe", "border-color": "#3b82f6" } as cytoscape.Css.Node },
    { selector: "node[kind = 'property']", style: { "background-color": dark ? "#3b1f3b" : "#fce7f3", "border-color": "#a855f7" } as cytoscape.Css.Node },
    { selector: "node[kind = 'literal']", style: {
      width: 138, height: 44, "font-size": 10, "border-style": "dashed",
      "background-color": dark ? "#38331f" : "#fef9c3", "border-color": dark ? "#d6b94c" : "#ca8a04",
    } as cytoscape.Css.Node },
    { selector: "node:selected", style: { "border-color": "#007fd4", "border-width": 3 } as cytoscape.Css.Node },
    { selector: "edge", style: edgeStyle(dark) },
    { selector: ".dimmed", style: { opacity: 0.1 } },
  ];
}

function edgeStyle(dark: boolean): cytoscape.Css.Edge {
  return {
    label: "data(edgeLabel)", "font-size": 10, color: dark ? "#aaa" : "#475569",
    "text-background-color": dark ? "#1e1e1e" : "#ffffff", "text-background-opacity": 0.9, "text-background-padding": "4px",
    width: 1.8, "line-color": dark ? "#777" : "#64748b", "target-arrow-color": dark ? "#777" : "#64748b",
    "target-arrow-shape": "triangle", "curve-style": "bezier",
  } as cytoscape.Css.Edge;
}

function layoutOptions(name: LayoutName): cytoscape.LayoutOptions {
  if (name === "dagre") return { name, animate: false, fit: false, padding: 42, nodeSep: 86, edgeSep: 34, rankSep: 118 } as cytoscape.LayoutOptions;
  return { name, animate: false, fit: false, padding: 42, quality: "default", idealEdgeLength: 150, nodeRepulsion: 8800, nodeSeparation: 80 } as cytoscape.LayoutOptions;
}

function renderEntityInspector(doc: Document, panel: HTMLElement, entity: SchemaEntity, schema: SchemaModel, messages: Messages): void {
  appendHeading(doc, panel, `${entity.icon} ${entity.name}`);
  if (entity.description) appendParagraph(doc, panel, entity.description, "ov-inspector-desc");
  appendDefinitionList(doc, panel, [[messages.type, entity.origin], [messages.properties, String(entity.properties.length)], [messages.instances, String(entity.instanceCount)], ["IRI", entity.id]]);
  if (entity.properties.length) {
    appendSubheading(doc, panel, messages.properties);
    const list = element(doc, "ul", "ov-prop-list");
    for (const property of entity.properties) appendListItem(doc, list, `${property.isIdentifier ? "🔑 " : ""}${property.name}: ${property.type}`);
    panel.appendChild(list);
  }
  const incoming = schema.relations.filter((relation) => relation.target === entity.id);
  const outgoing = schema.relations.filter((relation) => relation.source === entity.id);
  appendRelations(doc, panel, "← Incoming", incoming, schema, false);
  appendRelations(doc, panel, "→ Outgoing", outgoing, schema, true);
}

function renderRelationInspector(doc: Document, panel: HTMLElement, relation: SchemaRelation, schema: SchemaModel, messages: Messages): void {
  appendHeading(doc, panel, relation.name);
  if (relation.description) appendParagraph(doc, panel, relation.description, "ov-inspector-desc");
  const source = schema.entities.find((entity) => entity.id === relation.source)?.name ?? relation.source;
  const target = schema.entities.find((entity) => entity.id === relation.target)?.name ?? relation.target;
  appendDefinitionList(doc, panel, [[messages.type, relation.kind], ["Source", source], ["Target", target], ["Cardinality", relation.cardinality], ["Provenance", relation.provenance]]);
}

function appendRelations(doc: Document, panel: HTMLElement, heading: string, relations: SchemaRelation[], schema: SchemaModel, outgoing: boolean): void {
  if (!relations.length) return;
  appendSubheading(doc, panel, heading);
  const list = doc.createElement("ul");
  for (const relation of relations) {
    const otherId = outgoing ? relation.target : relation.source;
    const other = schema.entities.find((entity) => entity.id === otherId)?.name ?? otherId;
    appendListItem(doc, list, `${relation.name} ${outgoing ? "→" : "←"} ${other}`);
  }
  panel.appendChild(list);
}

function searchResultButton(doc: Document, result: SearchResult, select: (result: SearchResult) => void): HTMLButtonElement {
  const item = button(doc, `${result.label}, ${result.meta}`, "ov-search-item");
  item.setAttribute("role", "option");
  const label = element(doc, "span", "ov-search-label");
  label.textContent = result.label;
  const meta = element(doc, "span", "ov-search-meta");
  meta.textContent = result.meta;
  item.replaceChildren(label, meta);
  item.addEventListener("click", () => select(result), { once: true });
  return item;
}

function appendHeading(doc: Document, parent: HTMLElement, text: string): void {
  const heading = doc.createElement("h3");
  heading.textContent = text;
  parent.appendChild(heading);
}
function appendSubheading(doc: Document, parent: HTMLElement, text: string): void {
  const heading = doc.createElement("h4");
  heading.textContent = text;
  parent.appendChild(heading);
}
function appendParagraph(doc: Document, parent: HTMLElement, text: string, className?: string): void {
  const paragraph = doc.createElement("p");
  if (className) paragraph.className = className;
  paragraph.textContent = text;
  parent.appendChild(paragraph);
}
function appendDefinitionList(doc: Document, parent: HTMLElement, entries: Array<[string, string]>): void {
  const list = doc.createElement("dl");
  for (const [term, description] of entries) {
    const dt = doc.createElement("dt");
    dt.textContent = term;
    const dd = doc.createElement("dd");
    dd.textContent = description;
    list.append(dt, dd);
  }
  parent.appendChild(list);
}
function appendListItem(doc: Document, list: HTMLElement, text: string): void {
  const item = doc.createElement("li");
  item.textContent = text;
  list.appendChild(item);
}
function button(doc: Document, label: string, className: string, text = label): HTMLButtonElement {
  const result = doc.createElement("button");
  result.type = "button";
  result.className = className;
  result.textContent = text;
  result.setAttribute("aria-label", label);
  return result;
}
function element<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string): HTMLElementTagNameMap[K] {
  const result = doc.createElement(tag);
  result.className = className;
  return result;
}
function applyTheme(root: HTMLElement, dark: boolean): void {
  root.classList.toggle("ov-dark", dark);
  root.classList.toggle("ov-light", !dark);
  root.dataset.theme = dark ? "dark" : "light";
}
function cardinalityBadge(value: string): string {
  return ({ "one-to-one": "1:1", "one-to-many": "1:N", "many-to-one": "N:1", "many-to-many": "N:N" } as Record<string, string>)[value] ?? "";
}
function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Cytoscape returned an invalid PNG data URL.");
  const mime = match[1] || "image/png";
  const bytes = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
  const array = Uint8Array.from(bytes, (character) => character.charCodeAt(0));
  return new Blob([array], { type: mime });
}

function ensureCytoscapeStyleMarker(doc: Document): void {
  // Cytoscape 3.30.4 checks only this id before injecting its fixed inline
  // style. The equivalent rule ships in ontologyviewer.css.
  if (doc.getElementById("__________cytoscape_stylesheet")) return;
  const marker = doc.createElement("meta");
  marker.id = "__________cytoscape_stylesheet";
  marker.setAttribute("data-ontologyviewer-cytoscape-style", "external");
  (doc.head ?? doc.documentElement).prepend(marker);
}
