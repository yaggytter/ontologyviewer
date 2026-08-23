import type { Locale } from "./locale";
import type { Theme } from "./theme";

export type ViewMode = "schema" | "triples";
export type LayoutName = "fcose" | "dagre";
export type ViewerStatus = "loading" | "ready" | "error" | "empty" | "destroyed";

export interface OntologyViewerError {
  message: string;
  line?: number;
  column?: number;
  cause?: unknown;
}

export interface OntologyViewerOptions {
  /** Initial CSS height. Safe numeric CSS lengths only. Default: 600px. */
  height?: string;
  /** Theme; auto follows prefers-color-scheme. */
  theme?: Theme;
  /** Locale; auto follows navigator.language. */
  locale?: Locale;
  /** Automatic graph layout. */
  layout?: LayoutName;
  /** Initial graph view. */
  defaultView?: ViewMode;
  /** Base IRI used when the Turtle source has no @base directive. */
  baseIri?: string;
  /** @deprecated Use baseIri. */
  baseIRI?: string;
  /** Opt-in localStorage namespace. Omit to disable persistence. */
  storageKey?: string;
  /** Inject the bundled stylesheet. Set false when loading style.css under strict CSP. */
  injectStyles?: boolean;
  /** Called after a valid graph has rendered. */
  onReady?: (instance: OntologyViewerInstance) => void;
  /** Called for parse or rendering failures. */
  onError?: (error: OntologyViewerError, instance: OntologyViewerInstance) => void;
  /** Called whenever the selected graph element changes. */
  onSelectionChange?: (id: string | undefined) => void;
}

export interface InitializeOptions extends OntologyViewerOptions {
  /** Scan matching source elements. */
  startOnLoad?: boolean;
  /** Selector used by the scanner. Default: pre.ontologyviewer plus inert text/turtle script sources. */
  selector?: string;
}

export interface OntologyViewerInstance {
  readonly container: HTMLElement;
  readonly sourceElement: HTMLElement;
  readonly status: ViewerStatus;
  readonly error: OntologyViewerError | undefined;
  update(turtle: string): Promise<void>;
  destroy(): void;
  fit(): void;
  runLayout(name?: LayoutName): void;
  exportPng(): Promise<Blob>;
}

export interface OntologyViewerManager {
  /** Resolves after the initial scan (if requested) has completed. */
  readonly ready: Promise<readonly OntologyViewerInstance[]>;
  instances(): readonly OntologyViewerInstance[];
  getInstance(element: HTMLElement): OntologyViewerInstance | undefined;
  /** Manually scan this document or subtree; no MutationObserver is installed. */
  scan(root?: ParentNode): readonly OntologyViewerInstance[];
  destroyAll(): void;
}
