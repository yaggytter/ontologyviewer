import type { Quad } from "n3";
import { findOverrideLiteral } from "./opExtensions";

export const COLOR_PALETTE_SIZE = 48;

export interface RelationalColorEdge {
  source: string;
  target: string;
}

export interface RelationalAppearance {
  colorIndex: number;
  groupIndex: number;
  groupCount: number;
  groupSize: number;
}

/**
 * Assigns each entity a hue-wheel position based on graph structure.
 */
export function assignRelationalAppearance(
  entityIds: readonly string[],
  edges: readonly RelationalColorEdge[],
  paletteSize: number = COLOR_PALETTE_SIZE,
): Map<string, RelationalAppearance> {
  const adjacency = new Map<string, string[]>();
  for (const id of entityIds) {
    adjacency.set(id, []);
  }
  for (const { source, target } of edges) {
    if (source === target || !adjacency.has(source) || !adjacency.has(target)) {
      continue;
    }
    adjacency.get(source)!.push(target);
    adjacency.get(target)!.push(source);
  }

  const visited = new Set<string>();
  const components: string[][] = [];

  function collectComponent(start: string): string[] {
    const stack = [start];
    const members: string[] = [];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (visited.has(node)) {
        continue;
      }
      visited.add(node);
      members.push(node);
      const neighbors = [...new Set(adjacency.get(node))].sort().reverse();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }
    return members;
  }

  for (const id of [...entityIds].sort()) {
    if (!visited.has(id)) {
      components.push(collectComponent(id));
    }
  }

  const appearanceById = new Map<string, RelationalAppearance>();
  if (components.length === 0) {
    return appearanceById;
  }

  const perComponentSlots = paletteSize / components.length;
  const maxArcSlots = paletteSize / 3;
  const arcSlots = Math.min(perComponentSlots * 0.6, maxArcSlots);

  components.forEach((members, componentIndex) => {
    const base = componentIndex * perComponentSlots;
    members.forEach((id, memberIndex) => {
      const offset = members.length > 1 ? (memberIndex / (members.length - 1)) * arcSlots : 0;
      appearanceById.set(id, {
        colorIndex: Math.round(base + offset) % paletteSize,
        groupIndex: componentIndex + 1,
        groupCount: components.length,
        groupSize: members.length,
      });
    });
  });

  return appearanceById;
}

const ICON_RULES: { tokens: string[]; icon: string }[] = [
  { tokens: ["pizza"], icon: "🍕" },
  { tokens: ["cheese"], icon: "🧀" },
  { tokens: ["vegetable", "veggie", "plant"], icon: "🥬" },
  { tokens: ["meat"], icon: "🥩" },
  { tokens: ["food", "meal", "dish", "topping", "ingredient", "recipe"], icon: "🍽️" },
  { tokens: ["person", "people", "human", "agent", "user", "member", "customer"], icon: "👤" },
  { tokens: ["organization", "org", "company", "institution", "department", "team"], icon: "🏢" },
  { tokens: ["place", "location", "city", "country", "region", "address", "site"], icon: "📍" },
  { tokens: ["author", "writer", "creator"], icon: "✍️" },
  { tokens: ["book", "publication", "library", "catalog"], icon: "📚" },
  { tokens: ["document", "doc", "file", "report", "paper", "article"], icon: "📄" },
  { tokens: ["event", "meeting", "conference", "session"], icon: "📅" },
  { tokens: ["time", "date", "period", "interval", "duration"], icon: "🕐" },
  { tokens: ["money", "price", "cost", "payment", "invoice", "order"], icon: "💰" },
  { tokens: ["vehicle", "car", "truck", "ship", "aircraft", "train"], icon: "🚗" },
  { tokens: ["device", "sensor", "machine", "equipment", "asset", "component"], icon: "⚙️" },
  { tokens: ["project", "task", "activity", "process", "workflow", "step"], icon: "📋" },
  { tokens: ["system", "service", "application", "software", "platform"], icon: "💻" },
  { tokens: ["network", "graph", "link", "connection"], icon: "🔗" },
  { tokens: ["message", "email", "mail", "note", "comment"], icon: "✉️" },
  { tokens: ["role", "position", "job", "title"], icon: "🎖️" },
  { tokens: ["concept", "category", "type", "taxonomy", "scheme", "term"], icon: "🏷️" },
  { tokens: ["measurement", "metric", "unit", "quantity", "value"], icon: "📏" },
  { tokens: ["health", "patient", "medical", "disease", "treatment"], icon: "🏥" },
  { tokens: ["law", "policy", "rule", "regulation", "contract", "license"], icon: "⚖️" },
  { tokens: ["education", "course", "student", "teacher", "school", "lesson"], icon: "🎓" },
  { tokens: ["animal", "species", "organism"], icon: "🐾" },
  { tokens: ["energy", "power", "electricity"], icon: "⚡" },
  { tokens: ["store", "shop"], icon: "🏪" },
  { tokens: ["supplier", "shipment", "delivery"], icon: "📦" },
];

export const DEFAULT_CLASS_ICON = "📦";
export const DEFAULT_SKOS_ICON = "🏷️";
export const DEFAULT_INFERRED_ICON = "⬜";

function tokenize(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_\-0-9]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0);
}

export function iconFor(candidateNames: string[], fallback: string): string {
  const tokens = new Set(candidateNames.flatMap(tokenize));
  for (const rule of ICON_RULES) {
    if (rule.tokens.some((t) => tokens.has(t))) {
      return rule.icon;
    }
  }
  return fallback;
}

const ICON_OVERRIDE_LOCAL_NAMES = ["icon", "emoji"];
const COLOR_OVERRIDE_LOCAL_NAMES = ["color", "colour", "fillColor"];

function looksLikeIcon(value: string): boolean {
  const codePoints = [...value];
  if (codePoints.length < 1 || codePoints.length > 4) {
    return false;
  }
  return !/[ -]/.test(value);
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function looksLikeColor(value: string): boolean {
  return HEX_COLOR.test(value.trim());
}

export function iconOverrideFor(quads: Quad[], subjectIri: string): string | undefined {
  const value = findOverrideLiteral(quads, subjectIri, ICON_OVERRIDE_LOCAL_NAMES);
  return value !== undefined && looksLikeIcon(value) ? value : undefined;
}

export function colorOverrideFor(quads: Quad[], subjectIri: string): string | undefined {
  const value = findOverrideLiteral(quads, subjectIri, COLOR_OVERRIDE_LOCAL_NAMES);
  return value !== undefined && looksLikeColor(value) ? value.trim() : undefined;
}
