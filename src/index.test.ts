import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OntologyViewerInstance, OntologyViewerOptions, ViewerStatus } from "./types";

const factory = vi.hoisted(() => vi.fn());
vi.mock("./viewer", () => ({ createViewer: factory }));

function mockViewer(element: HTMLElement, options: OntologyViewerOptions, cleanup: () => void): OntologyViewerInstance {
  let status: ViewerStatus = "ready";
  const container = document.createElement("section");
  container.className = "ontologyviewer-root";
  element.after(container);
  return {
    container,
    sourceElement: element,
    get status() { return status; },
    error: undefined,
    update: vi.fn(async () => undefined),
    destroy: vi.fn(() => {
      status = "destroyed";
      container.remove();
      cleanup();
    }),
    fit: vi.fn(),
    runLayout: vi.fn(),
    exportPng: vi.fn(async () => new Blob()),
  };
}

describe("public API", () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.replaceChildren();
    document.body.replaceChildren();
    factory.mockReset();
    factory.mockImplementation((element: HTMLElement, _source: string, options: OntologyViewerOptions, cleanup: () => void) => mockViewer(element, options, cleanup));
  });

  it("preserves and restores the source element and deduplicates render calls", async () => {
    const { render, getInstance } = await import("./index");
    const source = document.createElement("pre");
    source.className = "ontologyviewer";
    source.textContent = "@prefix : <https://example.org/> .";
    document.body.appendChild(source);

    const first = render(source);
    const second = render(source);

    expect(first).toBe(second);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(source.hidden).toBe(true);
    expect(source.getAttribute("aria-hidden")).toBe("true");
    expect(getInstance(source)).toBe(first);

    first.destroy();
    expect(source.hidden).toBe(false);
    expect(source.hasAttribute("aria-hidden")).toBe(false);
    expect(getInstance(source)).toBeUndefined();
  });

  it("gives validated API options precedence over data attributes", async () => {
    const { render } = await import("./index");
    const source = document.createElement("pre");
    source.dataset.height = "999px";
    source.dataset.theme = "dark";
    source.dataset.baseIri = "/from-data";
    document.body.appendChild(source);

    render(source, { height: "42rem", theme: "light", baseIri: "/from-api" });
    const passed = factory.mock.calls[0][2] as OntologyViewerOptions;
    expect(passed.height).toBe("42rem");
    expect(passed.theme).toBe("light");
    expect(passed.baseIri).toBe(new URL("/from-api", document.baseURI).href);
  });

  it("rejects unsafe dimensions and invalid enum data", async () => {
    const { render } = await import("./index");
    const source = document.createElement("pre");
    source.dataset.height = "url(javascript:alert(1))";
    source.dataset.theme = "unknown";
    source.dataset.layout = "evil";
    document.body.appendChild(source);
    render(source);
    const passed = factory.mock.calls[0][2] as OntologyViewerOptions;
    expect(passed.height).toBe("600px");
    expect(passed.theme).toBe("auto");
    expect(passed.layout).toBe("fcose");
  });

  it("scans a custom selector and forwards initialize options", async () => {
    const { initialize } = await import("./index");
    const source = document.createElement("code");
    source.className = "custom-ontology";
    document.body.appendChild(source);
    const manager = initialize({ startOnLoad: true, selector: ".custom-ontology", locale: "ja" });
    const instances = await manager.ready;
    expect(instances).toHaveLength(1);
    expect((factory.mock.calls[0][2] as OntologyViewerOptions).locale).toBe("ja");
    manager.destroyAll();
    expect(manager.instances()).toHaveLength(0);
  });

  it("waits for window load when initialized during loading", async () => {
    Object.defineProperty(document, "readyState", { value: "loading", configurable: true });
    try {
      const { initialize } = await import("./index");
      const source = document.createElement("pre");
      source.className = "ontologyviewer";
      document.body.appendChild(source);
      const manager = initialize({ startOnLoad: true });
      expect(factory).not.toHaveBeenCalled();
      document.dispatchEvent(new Event("DOMContentLoaded"));
      expect(factory).not.toHaveBeenCalled();
      window.dispatchEvent(new Event("load"));
      expect(await manager.ready).toHaveLength(1);
    } finally {
      Object.defineProperty(document, "readyState", { value: "complete", configurable: true });
    }
  });

  it("scans the post-hydration DOM when initialized during interactive", async () => {
    Object.defineProperty(document, "readyState", { value: "interactive", configurable: true });
    try {
      const { initialize } = await import("./index");
      const serverSource = document.createElement("pre");
      serverSource.id = "server-source";
      serverSource.className = "ontologyviewer";
      serverSource.textContent = "@prefix : <https://example.org/server#> .";
      document.body.appendChild(serverSource);

      const manager = initialize({ startOnLoad: true });
      expect(factory).not.toHaveBeenCalled();

      const hydratedSource = document.createElement("pre");
      hydratedSource.id = "hydrated-source";
      hydratedSource.className = "ontologyviewer";
      hydratedSource.textContent = "@prefix : <https://example.org/hydrated#> .";
      serverSource.replaceWith(hydratedSource);
      window.dispatchEvent(new Event("load"));

      const instances = await manager.ready;
      expect(instances).toHaveLength(1);
      expect(instances[0]?.sourceElement).toBe(hydratedSource);
      expect(factory.mock.calls[0]?.[1]).toContain("https://example.org/hydrated#");
    } finally {
      Object.defineProperty(document, "readyState", { value: "complete", configurable: true });
    }
  });

  it("destroyAll immediately after initialize does not throw", async () => {
    const { initialize } = await import("./index");
    const source = document.createElement("pre");
    source.className = "ontologyviewer";
    document.body.appendChild(source);
    const manager = initialize({ startOnLoad: true });
    await manager.ready;
    expect(() => manager.destroyAll()).not.toThrow();
    expect(manager.instances()).toHaveLength(0);
  });

  it("rejects storageKey values exceeding 200 characters", async () => {
    const { render } = await import("./index");
    const source = document.createElement("pre");
    document.body.appendChild(source);
    render(source, { storageKey: "a".repeat(201) });
    const passed = factory.mock.calls[0][2] as OntologyViewerOptions;
    expect(passed.storageKey).toBeUndefined();
  });

  it("accepts storageKey values within 200 characters", async () => {
    const { render } = await import("./index");
    const source = document.createElement("pre");
    document.body.appendChild(source);
    render(source, { storageKey: "valid-key" });
    const passed = factory.mock.calls[0][2] as OntologyViewerOptions;
    expect(passed.storageKey).toBe("valid-key");
  });

  it("treats baseIRI as deprecated alias for baseIri", async () => {
    const { render } = await import("./index");
    const source = document.createElement("pre");
    document.body.appendChild(source);
    render(source, { baseIRI: "https://example.org/deprecated" });
    const passed = factory.mock.calls[0][2] as OntologyViewerOptions;
    expect(passed.baseIri).toBe("https://example.org/deprecated");
  });

  it("renders after a prior destroyed instance on the same element", async () => {
    const { render } = await import("./index");
    const source = document.createElement("pre");
    source.textContent = "@prefix : <https://ex.org/> .";
    document.body.appendChild(source);

    const first = render(source);
    first.destroy();
    const second = render(source);
    expect(second).not.toBe(first);
    expect(factory).toHaveBeenCalledTimes(2);
    second.destroy();
  });

  it("scans inert Turtle script sources with raw angle brackets", async () => {
    const { initialize } = await import("./index");
    const source = document.createElement("script");
    source.type = "text/turtle";
    source.className = "ontologyviewer";
    source.textContent = "@prefix : <https://example.org/> .\n:Thing a <http://www.w3.org/2002/07/owl#Class> .";
    source.dataset.height = "420px";
    document.body.appendChild(source);

    const manager = initialize({ startOnLoad: true });
    const instances = await manager.ready;

    expect(instances).toHaveLength(1);
    expect(factory.mock.calls[0][1]).toContain("<https://example.org/>");
    expect((factory.mock.calls[0][2] as OntologyViewerOptions).height).toBe("420px");
  });
});
