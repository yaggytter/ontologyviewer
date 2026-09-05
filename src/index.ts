/** Public browser API for ontologyviewer. */
import { createViewer } from "./viewer";
import type {
  InitializeOptions,
  LayoutName,
  OntologyViewerInstance,
  OntologyViewerManager,
  OntologyViewerOptions,
  ViewMode,
} from "./types";
import type { Locale } from "./locale";
import type { Theme } from "./theme";

export type {
  InitializeOptions,
  LayoutName,
  OntologyViewerError,
  OntologyViewerInstance,
  OntologyViewerManager,
  OntologyViewerOptions,
  ViewerStatus,
  ViewMode,
} from "./types";
export type { Locale } from "./locale";
export type { Theme } from "./theme";

declare const __ONTOLOGY_VIEWER_CSS__: string | undefined;

const instanceBySource = new WeakMap<HTMLElement, OntologyViewerInstance>();
const activeInstances = new Set<OntologyViewerInstance>();
const styledDocuments = new WeakSet<Document>();
const DEFAULT_SELECTOR = 'pre.ontologyviewer, script[type="text/turtle"].ontologyviewer';

export function render(element: HTMLElement, options: OntologyViewerOptions = {}): OntologyViewerInstance {
  const existing = instanceBySource.get(element);
  if (existing && existing.status !== "destroyed") return existing;

  const resolved = resolveOptions(element, options);
  if (resolved.injectStyles !== false) injectDefaultStyles(element.ownerDocument);

  const originalHidden = element.hidden;
  const originalAriaHidden = element.getAttribute("aria-hidden");
  element.hidden = true;
  element.setAttribute("aria-hidden", "true");

  let instance: OntologyViewerInstance;
  const cleanup = (): void => {
    instanceBySource.delete(element);
    activeInstances.delete(instance);
    element.hidden = originalHidden;
    if (originalAriaHidden === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", originalAriaHidden);
  };

  try {
    instance = createViewer(element, element.textContent ?? "", resolved, cleanup);
  } catch (cause) {
    element.hidden = originalHidden;
    if (originalAriaHidden === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", originalAriaHidden);
    throw cause;
  }
  instanceBySource.set(element, instance);
  activeInstances.add(instance);
  return instance;
}

export function initialize(options: InitializeOptions = {}): OntologyViewerManager {
  const { startOnLoad = false, selector = DEFAULT_SELECTOR, ...viewerOptions } = options;
  const scan = (root: ParentNode = document): readonly OntologyViewerInstance[] => {
    const elements = matchingElements(root, selector);
    return elements.map((element) => render(element, viewerOptions));
  };

  let ready: Promise<readonly OntologyViewerInstance[]> = Promise.resolve([]);
  if (startOnLoad && typeof document !== "undefined") {
    ready = document.readyState === "complete"
      ? Promise.resolve(scan(document))
      : new Promise((resolve, reject) => {
          window.addEventListener("load", () => {
            try {
              resolve(scan(document));
            } catch (error) {
              reject(error);
            }
          }, { once: true });
        });
  }

  return {
    ready,
    instances: () => [...activeInstances],
    getInstance,
    scan,
    destroyAll: () => {
      for (const instance of [...activeInstances]) instance.destroy();
    },
  };
}

export function getInstance(element: HTMLElement): OntologyViewerInstance | undefined {
  const instance = instanceBySource.get(element);
  return instance?.status === "destroyed" ? undefined : instance;
}

function matchingElements(root: ParentNode, selector: string): HTMLElement[] {
  const matches: HTMLElement[] = [];
  if (root instanceof HTMLElement && root.matches(selector)) matches.push(root);
  matches.push(...root.querySelectorAll<HTMLElement>(selector));
  return matches;
}

/** Reads an opt-out boolean from a data attribute. Only "false"/"0"/"off" disable. */
function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "false" || normalized === "0" || normalized === "off") return false;
  if (normalized === "" || normalized === "true" || normalized === "1" || normalized === "on") return true;
  return undefined;
}

function resolveOptions(element: HTMLElement, options: OntologyViewerOptions): OntologyViewerOptions {
  const data = element.dataset;
  const optionBaseIri = options.baseIri ?? options.baseIRI;
  return {
    height: safeHeight(options.height ?? data.height),
    theme: validTheme(options.theme) ?? validTheme(data.theme) ?? "auto",
    locale: validLocale(options.locale) ?? validLocale(data.locale) ?? "auto",
    layout: validLayout(options.layout) ?? validLayout(data.layout) ?? "fcose",
    defaultView: validView(options.defaultView) ?? validView(data.defaultView) ?? "schema",
    compactTriples: options.compactTriples ?? parseBoolean(data.compactTriples) ?? true,
    baseIri: safeBaseIri(optionBaseIri ?? data.baseIri, element.ownerDocument.baseURI),
    storageKey: safeStorageKey(options.storageKey ?? data.storageKey),
    injectStyles: options.injectStyles,
    onReady: options.onReady,
    onError: options.onError,
    onSelectionChange: options.onSelectionChange,
  };
}

function injectDefaultStyles(doc: Document): void {
  if (styledDocuments.has(doc) || doc.querySelector("[data-ontologyviewer-styles]")) {
    styledDocuments.add(doc);
    return;
  }
  const css = typeof __ONTOLOGY_VIEWER_CSS__ === "string" ? __ONTOLOGY_VIEWER_CSS__ : "";
  if (!css) return;
  const style = doc.createElement("style");
  style.setAttribute("data-ontologyviewer-styles", "");
  style.textContent = css;
  (doc.head ?? doc.documentElement).appendChild(style);
  styledDocuments.add(doc);
}

function safeHeight(value: string | undefined): string {
  if (!value) return "600px";
  const normalized = value.trim().toLowerCase();
  return /^(?:0|(?:\d+(?:\.\d+)?)(?:px|rem|em|vh|vw|%))$/.test(normalized) ? normalized : "600px";
}

function safeStorageKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 200 ? normalized : undefined;
}

function safeBaseIri(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    return new URL(value, fallback).href;
  } catch {
    return fallback;
  }
}

function validTheme(value: unknown): Theme | undefined {
  return value === "auto" || value === "light" || value === "dark" ? value : undefined;
}
function validLocale(value: unknown): Locale | undefined {
  return value === "auto" || value === "en" || value === "ja" ? value : undefined;
}
function validLayout(value: unknown): LayoutName | undefined {
  return value === "fcose" || value === "dagre" ? value : undefined;
}
function validView(value: unknown): ViewMode | undefined {
  return value === "schema" || value === "triples" ? value : undefined;
}

const ontologyviewer = { initialize, render, getInstance };
export default ontologyviewer;
