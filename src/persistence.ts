/** Opt-in, validated layout persistence. */
import type { ViewMode } from "./types";

const VERSION = 1;
const MAX_PERSISTED_NODES = 100_000;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export interface PersistedLayout {
  positions: Record<string, { x: number; y: number }>;
  zoom: number;
  pan: { x: number; y: number };
}

interface StoredLayout extends PersistedLayout {
  version: number;
}

export function layoutStorageKey(storageKey: string, view: ViewMode): string {
  return `ontologyviewer:${storageKey}:${view}`;
}

export function saveLayout(storageKey: string, layout: PersistedLayout): void {
  const validated = validateLayout(layout);
  if (!validated) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version: VERSION, ...validated } satisfies StoredLayout));
  } catch {
    // Storage can be disabled, full, or unavailable in sandboxed documents.
  }
}

export function loadLayout(storageKey: string): PersistedLayout | undefined {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== VERSION) return undefined;
    return validateLayout(parsed);
  } catch {
    return undefined;
  }
}

export function clearLayout(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Storage is optional.
  }
}

function validateLayout(value: unknown): PersistedLayout | undefined {
  if (!isRecord(value) || !isRecord(value.positions) || !isRecord(value.pan)) return undefined;
  if (!isFiniteNumber(value.zoom) || value.zoom < 0.1 || value.zoom > 10) return undefined;
  if (!isFiniteNumber(value.pan.x) || !isFiniteNumber(value.pan.y)) return undefined;

  const entries = Object.entries(value.positions);
  if (entries.length > MAX_PERSISTED_NODES) return undefined;
  const positions: Record<string, { x: number; y: number }> = Object.create(null) as Record<string, { x: number; y: number }>;
  for (const [id, position] of entries) {
    if (UNSAFE_KEYS.has(id) || !isRecord(position) || !isFiniteNumber(position.x) || !isFiniteNumber(position.y)) {
      return undefined;
    }
    positions[id] = { x: position.x, y: position.y };
  }
  return { positions, zoom: value.zoom, pan: { x: value.pan.x, y: value.pan.y } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
