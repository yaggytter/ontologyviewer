/**
 * Builds a class-centric Schema model from parsed Turtle quads.
 * Simplified from the VS Code extension's schemaModel.ts; retains the
 * same structural output (SchemaModel) without editing support.
 */
import type { Quad } from "n3";
import { localName, findOverrideLiteral } from "./opExtensions";
import {
  assignRelationalAppearance,
  colorOverrideFor,
  DEFAULT_CLASS_ICON,
  DEFAULT_SKOS_ICON,
  iconFor,
  iconOverrideFor,
  type RelationalColorEdge,
} from "./appearance";
import {
  OWL_ANNOTATION_PROPERTY,
  OWL_CLASS,
  OWL_DATATYPE_PROPERTY,
  OWL_NAMED_INDIVIDUAL,
  OWL_OBJECT_PROPERTY,
  OWL_ONTOLOGY,
  OWL_RESTRICTION,
  OWL_THING,
  RDF_PROPERTY,
  RDF_TYPE,
  RDFS_CLASS,
  RDFS_COMMENT,
  RDFS_DOMAIN,
  RDFS_LABEL,
  RDFS_RANGE,
  RDFS_RESOURCE,
  RDFS_SUBCLASS_OF,
  SKOS_BROADER,
  SKOS_CONCEPT,
  SKOS_CONCEPT_SCHEME,
  SKOS_PREF_LABEL,
  XSD,
} from "./vocabulary";

export type PropertyType = "string" | "integer" | "decimal" | "double" | "date" | "datetime" | "boolean" | "enum" | "other";
export type Cardinality = "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many" | "unspecified";
export type EntityOrigin = "owlClass" | "rdfsClass" | "skosConcept" | "inferred";
export type RelationKind = "objectProperty" | "subClassOf" | "skosBroader";
export type Provenance = "declared" | "inferred-union" | "inferred-inverse" | "inferred-restriction" | "inferred-usage" | "default";

export interface SchemaProperty {
  iri: string;
  name: string;
  type: PropertyType;
  datatypeIri?: string;
  isIdentifier?: boolean;
  unit?: string;
  enumValues?: string[];
  description?: string;
  provenance: Provenance;
}

export interface SchemaEntity {
  id: string;
  name: string;
  description?: string;
  origin: EntityOrigin;
  properties: SchemaProperty[];
  instanceCount: number;
  icon: string;
  colorIndex: number;
  connectionGroup: { index: number; count: number; size: number };
  colorOverride?: string;
}

export interface SchemaRelation {
  id: string;
  iri?: string;
  name: string;
  source: string;
  target: string;
  kind: RelationKind;
  cardinality: Cardinality;
  description?: string;
  inverseOfIri?: string;
  provenance: Provenance;
}

export interface SchemaModel {
  title?: string;
  description?: string;
  entities: SchemaEntity[];
  relations: SchemaRelation[];
  isEmpty: boolean;
}

const EXCLUDED_META_CLASS_IRIS = new Set([
  OWL_CLASS, RDFS_CLASS, OWL_OBJECT_PROPERTY, OWL_DATATYPE_PROPERTY,
  OWL_ANNOTATION_PROPERTY, OWL_ONTOLOGY, OWL_NAMED_INDIVIDUAL, RDF_PROPERTY,
  OWL_THING, RDFS_RESOURCE, OWL_RESTRICTION, SKOS_CONCEPT, SKOS_CONCEPT_SCHEME,
]);

// Structural predicates are used in the full extension for filtering usage-based
// property discovery. Retained here as documentation; the simplified model only
// needs the explicit domain/range approach.

const XSD_LOCAL_TO_PROPERTY_TYPE: Record<string, PropertyType> = {
  string: "string", integer: "integer", int: "integer", long: "integer",
  short: "integer", nonNegativeInteger: "integer", positiveInteger: "integer",
  decimal: "decimal", float: "decimal", double: "double", date: "date",
  dateTime: "datetime", boolean: "boolean", anyURI: "other", time: "other",
  duration: "other",
};

const VALID_CARDINALITY_LABELS = new Set<string>(["one-to-one", "one-to-many", "many-to-one", "many-to-many"]);

// OP extension local names used by the full model for filtering. Retained as documentation.

interface QuadIndex {
  typesOf: Map<string, Set<string>>;
  labelOf: Map<string, string>;
  prefLabelOf: Map<string, string>;
  commentOf: Map<string, string>;
}

function buildIndex(quads: Quad[]): QuadIndex {
  const typesOf = new Map<string, Set<string>>();
  const labelOf = new Map<string, string>();
  const prefLabelOf = new Map<string, string>();
  const commentOf = new Map<string, string>();

  for (const quad of quads) {
    if (quad.subject.termType !== "NamedNode") continue;
    const subject = quad.subject.value;
    if (quad.predicate.value === RDF_TYPE && quad.object.termType === "NamedNode") {
      if (!typesOf.has(subject)) typesOf.set(subject, new Set());
      typesOf.get(subject)!.add(quad.object.value);
    } else if (quad.predicate.value === RDFS_LABEL && quad.object.termType === "Literal") {
      labelOf.set(subject, quad.object.value);
    } else if (quad.predicate.value === SKOS_PREF_LABEL && quad.object.termType === "Literal") {
      prefLabelOf.set(subject, quad.object.value);
    } else if (quad.predicate.value === RDFS_COMMENT && quad.object.termType === "Literal") {
      commentOf.set(subject, quad.object.value);
    }
  }
  return { typesOf, labelOf, prefLabelOf, commentOf };
}

function nameForIri(iri: string, index: QuadIndex): string {
  return index.labelOf.get(iri) ?? index.prefLabelOf.get(iri) ?? localName(iri);
}

function propertyTypeFromRange(rangeIri: string | undefined): PropertyType {
  if (!rangeIri) return "string";
  if (rangeIri.startsWith(XSD)) {
    return XSD_LOCAL_TO_PROPERTY_TYPE[localName(rangeIri)] ?? "other";
  }
  return "other";
}

/**
 * Builds the schema model from quads. This is a simplified version
 * that handles common OWL/RDFS/SKOS patterns for the read-only viewer.
 */
export function buildSchemaModel(quads: Quad[]): SchemaModel {
  const index = buildIndex(quads);

  // Identify ontology metadata
  let title: string | undefined;
  let description: string | undefined;
  for (const [iri, types] of index.typesOf) {
    if (types.has(OWL_ONTOLOGY)) {
      title = index.labelOf.get(iri);
      description = index.commentOf.get(iri);
      break;
    }
  }

  // Collect declared classes
  const classIris = new Set<string>();
  const skosConceptIris = new Set<string>();
  for (const [iri, types] of index.typesOf) {
    if (EXCLUDED_META_CLASS_IRIS.has(iri)) continue;
    if (types.has(OWL_CLASS) || types.has(RDFS_CLASS)) {
      classIris.add(iri);
    } else if (types.has(SKOS_CONCEPT)) {
      skosConceptIris.add(iri);
    }
  }

  // Collect subClassOf edges to also treat targets as classes
  for (const quad of quads) {
    if (
      quad.predicate.value === RDFS_SUBCLASS_OF &&
      quad.subject.termType === "NamedNode" &&
      quad.object.termType === "NamedNode" &&
      !EXCLUDED_META_CLASS_IRIS.has(quad.subject.value) &&
      !EXCLUDED_META_CLASS_IRIS.has(quad.object.value)
    ) {
      classIris.add(quad.subject.value);
      classIris.add(quad.object.value);
    }
  }

  // Collect properties declared via rdfs:domain/range
  const domainOf = new Map<string, Set<string>>(); // property -> set of domain classes
  const rangeOf = new Map<string, string>(); // property -> range IRI
  const objectPropertyIris = new Set<string>();
  const datatypePropertyIris = new Set<string>();

  for (const [iri, types] of index.typesOf) {
    if (types.has(OWL_OBJECT_PROPERTY)) objectPropertyIris.add(iri);
    if (types.has(OWL_DATATYPE_PROPERTY)) datatypePropertyIris.add(iri);
  }

  for (const quad of quads) {
    if (quad.subject.termType !== "NamedNode") continue;
    const prop = quad.subject.value;
    if (quad.predicate.value === RDFS_DOMAIN && quad.object.termType === "NamedNode") {
      if (!domainOf.has(prop)) domainOf.set(prop, new Set());
      domainOf.get(prop)!.add(quad.object.value);
    } else if (quad.predicate.value === RDFS_RANGE && quad.object.termType === "NamedNode") {
      rangeOf.set(prop, quad.object.value);
    }
  }

  // Build relations
  const relations: SchemaRelation[] = [];
  const entityPropertyMap = new Map<string, SchemaProperty[]>();

  // subClassOf relations
  for (const quad of quads) {
    if (
      quad.predicate.value === RDFS_SUBCLASS_OF &&
      quad.subject.termType === "NamedNode" &&
      quad.object.termType === "NamedNode" &&
      classIris.has(quad.subject.value) &&
      classIris.has(quad.object.value)
    ) {
      const id = `${quad.subject.value}|subClassOf|${quad.object.value}`;
      if (!relations.some((r) => r.id === id)) {
        relations.push({
          id,
          name: "subClassOf",
          source: quad.subject.value,
          target: quad.object.value,
          kind: "subClassOf",
          cardinality: "unspecified",
          provenance: "declared",
        });
      }
    }
  }

  // SKOS broader relations
  for (const quad of quads) {
    if (
      quad.predicate.value === SKOS_BROADER &&
      quad.subject.termType === "NamedNode" &&
      quad.object.termType === "NamedNode" &&
      skosConceptIris.has(quad.subject.value) &&
      skosConceptIris.has(quad.object.value)
    ) {
      relations.push({
        id: `${quad.subject.value}|skosBroader|${quad.object.value}`,
        name: "broader",
        source: quad.subject.value,
        target: quad.object.value,
        kind: "skosBroader",
        cardinality: "unspecified",
        provenance: "declared",
      });
    }
  }

  // Object property relations (via domain/range pointing to classes)
  for (const propIri of objectPropertyIris) {
    const domains = domainOf.get(propIri);
    const range = rangeOf.get(propIri);
    if (domains && range && classIris.has(range)) {
      for (const domain of domains) {
        if (classIris.has(domain)) {
          const cardLiteral = findOverrideLiteral(quads, propIri, ["cardinality"]);
          const cardinality: Cardinality =
            cardLiteral && VALID_CARDINALITY_LABELS.has(cardLiteral) ? cardLiteral as Cardinality : "unspecified";
          relations.push({
            id: `${domain}|${propIri}|${range}`,
            iri: propIri,
            name: nameForIri(propIri, index),
            source: domain,
            target: range,
            kind: "objectProperty",
            cardinality,
            description: index.commentOf.get(propIri),
            provenance: "declared",
          });
        }
      }
    }
  }

  // Datatype properties → folded into entity properties
  for (const propIri of datatypePropertyIris) {
    const domains = domainOf.get(propIri);
    const range = rangeOf.get(propIri);
    if (domains) {
      const propType = propertyTypeFromRange(range);
      const isId = findOverrideLiteral(quads, propIri, ["isIdentifier"]);
      const unit = findOverrideLiteral(quads, propIri, ["unit"]);
      for (const domain of domains) {
        if (classIris.has(domain)) {
          if (!entityPropertyMap.has(domain)) entityPropertyMap.set(domain, []);
          entityPropertyMap.get(domain)!.push({
            iri: propIri,
            name: nameForIri(propIri, index),
            type: propType,
            datatypeIri: range,
            isIdentifier: isId === "true",
            unit: unit ?? undefined,
            description: index.commentOf.get(propIri),
            provenance: "declared",
          });
        }
      }
    }
  }

  // Count instances
  const instanceCountMap = new Map<string, number>();
  for (const quad of quads) {
    if (quad.predicate.value === RDF_TYPE && quad.subject.termType === "NamedNode" && quad.object.termType === "NamedNode") {
      const classIri = quad.object.value;
      if (classIris.has(classIri) || skosConceptIris.has(classIri)) {
        // Don't count the class's own type assertion
        if (!classIris.has(quad.subject.value) && !skosConceptIris.has(quad.subject.value)) {
          instanceCountMap.set(classIri, (instanceCountMap.get(classIri) ?? 0) + 1);
        }
      }
    }
  }

  // Build relational coloring
  const allEntityIds = [...classIris, ...skosConceptIris];
  const colorEdges: RelationalColorEdge[] = relations.map((r) => ({ source: r.source, target: r.target }));
  const appearances = assignRelationalAppearance(allEntityIds, colorEdges);

  // Build entities
  const entities: SchemaEntity[] = [];
  for (const iri of classIris) {
    const name = nameForIri(iri, index);
    const appearance = appearances.get(iri) ?? { colorIndex: 0, groupIndex: 1, groupCount: 1, groupSize: 1 };
    const icon = iconOverrideFor(quads, iri) ?? iconFor([name, localName(iri)], DEFAULT_CLASS_ICON);
    entities.push({
      id: iri,
      name,
      description: index.commentOf.get(iri),
      origin: index.typesOf.get(iri)?.has(OWL_CLASS) ? "owlClass" : "rdfsClass",
      properties: entityPropertyMap.get(iri) ?? [],
      instanceCount: instanceCountMap.get(iri) ?? 0,
      icon,
      colorIndex: appearance.colorIndex,
      connectionGroup: { index: appearance.groupIndex, count: appearance.groupCount, size: appearance.groupSize },
      colorOverride: colorOverrideFor(quads, iri),
    });
  }
  for (const iri of skosConceptIris) {
    const name = nameForIri(iri, index);
    const appearance = appearances.get(iri) ?? { colorIndex: 0, groupIndex: 1, groupCount: 1, groupSize: 1 };
    const icon = iconOverrideFor(quads, iri) ?? iconFor([name, localName(iri)], DEFAULT_SKOS_ICON);
    entities.push({
      id: iri,
      name,
      description: index.commentOf.get(iri),
      origin: "skosConcept",
      properties: entityPropertyMap.get(iri) ?? [],
      instanceCount: instanceCountMap.get(iri) ?? 0,
      icon,
      colorIndex: appearance.colorIndex,
      connectionGroup: { index: appearance.groupIndex, count: appearance.groupCount, size: appearance.groupSize },
      colorOverride: colorOverrideFor(quads, iri),
    });
  }

  return {
    title,
    description,
    entities,
    relations,
    isEmpty: entities.length === 0 && relations.length === 0,
  };
}
