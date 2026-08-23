import type { Literal, Quad } from "n3";
import {
  isClassTypeIri,
  isPropertyTypeIri,
  lookupKnownTerm,
  OWL_NAMED_INDIVIDUAL,
  RDF_TYPE,
  RDFS_COMMENT,
  RDFS_LABEL,
  RDFS_SUBCLASS_OF,
  XSD,
} from "./vocabulary";

export type NodeKind = "class" | "property" | "individual" | "resource" | "literal";

export interface OntologyNode {
  id: string;
  kind: NodeKind;
  label: string;
  comment?: string;
  isBlankNode: boolean;
  literalValue?: string;
  datatypeIri?: string;
  language?: string;
}

export interface OntologyEdge {
  id: string;
  source: string;
  predicate: string;
  predicateLabel: string;
  target: string;
}

export interface OntologyGraph {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
}

export function buildGraphModel(quads: Quad[]): OntologyGraph {
  const nodes = new Map<string, OntologyNode>();
  const edges: OntologyEdge[] = [];

  const nodeFor = (id: string, isBlankNode: boolean): OntologyNode => {
    let node = nodes.get(id);
    if (!node) {
      node = { id, kind: "resource", label: shortLabel(id, isBlankNode), isBlankNode };
      nodes.set(id, node);
    }
    return node;
  };

  for (const [quadIndex, quad] of quads.entries()) {
    if (quad.subject.termType !== "NamedNode" && quad.subject.termType !== "BlankNode") {
      continue;
    }
    const subjectId = subjectKey(quad);
    const subject = nodeFor(subjectId, quad.subject.termType === "BlankNode");

    if (quad.object.termType === "Literal") {
      if (quad.predicate.value === RDFS_LABEL) subject.label = quad.object.value;
      if (quad.predicate.value === RDFS_COMMENT) subject.comment = quad.object.value;
      const literalNodeId = `_:literal:${quadIndex}`;
      nodes.set(literalNodeId, {
        id: literalNodeId,
        kind: "literal",
        label: literalLabel(quad.object),
        isBlankNode: false,
        literalValue: quad.object.value,
        datatypeIri: quad.object.datatype.value,
        language: quad.object.language || undefined,
      });
      pushEdge(edges, subject.id, quad.predicate.value, literalNodeId);
      continue;
    }

    if (quad.object.termType !== "NamedNode" && quad.object.termType !== "BlankNode") {
      continue;
    }
    const objectId = objectKey(quad);
    nodeFor(objectId, quad.object.termType === "BlankNode");

    if (quad.predicate.value === RDF_TYPE && quad.object.termType === "NamedNode") {
      applyTypeAnnotation(subject, quad.object.value);
    }
    if (quad.predicate.value === RDFS_SUBCLASS_OF) {
      subject.kind = subject.kind === "resource" ? "class" : subject.kind;
    }

    pushEdge(edges, subject.id, quad.predicate.value, objectId);
  }

  return { nodes: [...nodes.values()], edges };
}

function applyTypeAnnotation(node: OntologyNode, typeIri: string): void {
  if (isClassTypeIri(typeIri)) {
    node.kind = "class";
  } else if (isPropertyTypeIri(typeIri)) {
    node.kind = "property";
  } else if (typeIri === OWL_NAMED_INDIVIDUAL) {
    node.kind = node.kind === "resource" ? "individual" : node.kind;
  } else if (node.kind === "resource") {
    node.kind = "individual";
  }
}

function pushEdge(edges: OntologyEdge[], source: string, predicate: string, target: string): void {
  edges.push({
    id: `${source}|${predicate}|${target}|${edges.length}`,
    source,
    predicate,
    predicateLabel: lookupKnownTerm(predicate)?.label ?? shortLabel(predicate, false),
    target,
  });
}

function subjectKey(quad: Quad): string {
  return quad.subject.termType === "BlankNode" ? `_:${quad.subject.value}` : quad.subject.value;
}

function literalLabel(literal: Literal): string {
  const escaped = literal.value
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r");
  const quoted = `"${escaped}"`;
  if (literal.language) return `${quoted}@${literal.language}`;
  if (literal.datatype.value === `${XSD}string`) return quoted;
  const datatype = lookupKnownTerm(literal.datatype.value)?.label
    ?? (literal.datatype.value.startsWith(XSD) ? `xsd:${literal.datatype.value.slice(XSD.length)}` : `<${literal.datatype.value}>`);
  return `${quoted}^^${datatype}`;
}

function objectKey(quad: Quad): string {
  return quad.object.termType === "BlankNode" ? `_:${quad.object.value}` : quad.object.value;
}

function shortLabel(id: string, isBlankNode: boolean): string {
  if (isBlankNode) {
    return id.startsWith("_:literal:") ? id : `[blank node ${id.slice(2)}]`;
  }
  const known = lookupKnownTerm(id);
  if (known) {
    return known.label;
  }
  const hashIndex = id.lastIndexOf("#");
  const slashIndex = id.lastIndexOf("/");
  const cut = Math.max(hashIndex, slashIndex);
  return cut >= 0 && cut < id.length - 1 ? id.slice(cut + 1) : id;
}
