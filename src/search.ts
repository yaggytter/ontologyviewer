import type { SchemaModel } from "./rdf/schemaModel";

export type SearchResultKind = "entity" | "relation" | "property";

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  label: string;
  meta: string;
  ownerId?: string;
}

interface RankedResult extends SearchResult {
  score: number;
}

const KIND_ORDER: Record<SearchResultKind, number> = { entity: 0, relation: 1, property: 2 };

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

function labelScore(label: string, query: string): number | undefined {
  const n = normalize(label);
  if (n === query) return 0;
  if (n.startsWith(query)) return 1;
  if (n.split(/[\s._:/-]+/).some((p) => p.startsWith(query))) return 2;
  if (n.includes(query)) return 3;
  return undefined;
}

export function searchSchema(schema: SchemaModel, rawQuery: string, limit = 8): SearchResult[] {
  const query = normalize(rawQuery.trim());
  if (!query || limit <= 0) return [];

  const entityNames = new Map(schema.entities.map((e) => [e.id, e.name]));
  const ranked: RankedResult[] = [];

  for (const entity of schema.entities) {
    const score = labelScore(entity.name, query);
    if (score !== undefined) {
      ranked.push({
        id: entity.id,
        kind: "entity",
        label: entity.name,
        meta: `${entity.properties.length} properties · ${entity.instanceCount} instances`,
        score,
      });
    }
    for (const prop of entity.properties) {
      const ps = labelScore(prop.name, query);
      if (ps !== undefined) {
        ranked.push({
          id: prop.iri,
          ownerId: entity.id,
          kind: "property",
          label: prop.name,
          meta: `${entity.name} · ${prop.type}`,
          score: ps,
        });
      }
    }
  }

  for (const rel of schema.relations) {
    const sn = entityNames.get(rel.source) ?? rel.source;
    const tn = entityNames.get(rel.target) ?? rel.target;
    const score = labelScore(rel.name, query);
    if (score !== undefined) {
      ranked.push({
        id: rel.id,
        kind: "relation",
        label: rel.name,
        meta: `${sn} → ${tn}`,
        score,
      });
    }
  }

  return ranked
    .sort((a, b) => a.score - b.score || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ score: _, ...r }) => r);
}
