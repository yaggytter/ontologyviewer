import { isKnownVocabularyIri, RDFS_COMMENT, RDFS_LABEL } from "./vocabulary";
import type { OntologyEdge, OntologyGraph, OntologyNode } from "./graphModel";

export interface CompactTriplesResult {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
  /**
   * Statements absorbed into a node because their object was folded away,
   * keyed by node id — e.g. `":createdAt" -> ["range: dateTime"]`. Rendered on
   * the node so nothing the document states disappears from view.
   */
  foldedFacts: Map<string, string[]>;
  removedNodeCount: number;
  removedEdgeCount: number;
}

/**
 * Folds leaf annotation nodes out of the triples graph so the remaining boxes
 * are the things the ontology is actually about.
 *
 * Measured on a 1182-triple schema-heavy ontology, the raw triples view drew
 * 741 nodes and 1182 edges. Two thirds of those boxes carried no structure:
 *
 *  - **485 literal nodes (65% of all boxes).** Every `rdfs:label` and
 *    `rdfs:comment` became its own box even though `buildGraphModel` already
 *    copies those values onto the subject's `label`/`comment` fields — the
 *    same fact drawn twice.
 *  - **A handful of enormous vocabulary hubs.** `owl:ObjectProperty` reached
 *    degree 105, `owl:DatatypeProperty` 95, `xsd:string` 56, `owl:Class` 49.
 *    No force-directed layout can arrange a 105-way hub, and none of them says
 *    anything as a node.
 *
 * Folding both takes that document to 246 nodes (-67%) and 349 edges (-70%).
 *
 * A node is folded when all three hold, which keeps the rule principled rather
 * than a hardcoded blocklist:
 *  1. it has no outgoing edges — it is purely something other nodes point at,
 *  2. it has at least one incoming edge, and
 *  3. it is a literal, or its IRI is in a standard vocabulary namespace
 *     (rdf, rdfs, owl, xsd, skos, dcterms, foaf).
 *
 * Condition 1 is what protects real structure: a document that states
 * `xsd:string rdfs:comment "..."` has described that term, so it keeps its box.
 *
 * `rdfs:label` and `rdfs:comment` are folded *without* a fact line, because the
 * node already displays them — restating them would reintroduce the very
 * duplication being removed. Every other folded statement becomes a fact line.
 *
 * Note what this deliberately does **not** do: hide property nodes. On a
 * schema-heavy ontology the property node is the hinge connecting one class to
 * another (`Class <-domain- property -range-> Class`), so hiding those shatters
 * the graph. The transformation that removes properties *and* keeps the graph
 * connected is what the schema view already does, by rewiring domain/range
 * into a direct class-to-class edge.
 *
 * Pure, and never mutates its input: the `OntologyGraph` stays a faithful
 * representation of the parsed triples, and this compaction is a presentation
 * choice the viewer can turn off.
 */
export function compactTriples(graph: OntologyGraph): CompactTriplesResult {
  const hasOutgoing = new Set<string>();
  const hasIncoming = new Set<string>();
  for (const edge of graph.edges) {
    hasOutgoing.add(edge.source);
    hasIncoming.add(edge.target);
  }

  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const foldedIds = new Set<string>();
  for (const node of graph.nodes) {
    if (hasOutgoing.has(node.id) || !hasIncoming.has(node.id)) {
      continue;
    }
    const isLeafAnnotation = node.kind === "literal" || (!node.isBlankNode && isKnownVocabularyIri(node.id));
    if (isLeafAnnotation) {
      foldedIds.add(node.id);
    }
  }

  if (foldedIds.size === 0) {
    return {
      nodes: graph.nodes,
      edges: graph.edges,
      foldedFacts: new Map(),
      removedNodeCount: 0,
      removedEdgeCount: 0,
    };
  }

  const foldedFacts = new Map<string, string[]>();
  const edges: OntologyEdge[] = [];

  for (const edge of graph.edges) {
    if (!foldedIds.has(edge.target)) {
      edges.push(edge);
      continue;
    }
    if (edge.predicate === RDFS_LABEL || edge.predicate === RDFS_COMMENT) {
      // Already shown as the node's own label/comment.
      continue;
    }
    const fact = `${factPredicateLabel(edge.predicateLabel)}: ${factObjectLabel(byId.get(edge.target))}`;
    const existing = foldedFacts.get(edge.source);
    if (!existing) {
      foldedFacts.set(edge.source, [fact]);
    } else if (!existing.includes(fact)) {
      existing.push(fact);
    }
  }

  const nodes = graph.nodes.filter((node) => !foldedIds.has(node.id));

  return {
    nodes,
    edges,
    foldedFacts,
    removedNodeCount: graph.nodes.length - nodes.length,
    removedEdgeCount: graph.edges.length - edges.length,
  };
}

/**
 * Trims a vocabulary prefix off a predicate label so a folded statement reads
 * `range: string` rather than `rdfs:range: string`. The prefix carries nothing
 * here — the fact is already anchored to the node it belongs to.
 */
function factPredicateLabel(predicateLabel: string): string {
  const colon = predicateLabel.indexOf(":");
  return colon >= 0 ? predicateLabel.slice(colon + 1) : predicateLabel;
}

/**
 * Renders a folded object. Literal nodes are labelled in their quoted RDF form
 * (`"480"^^xsd:integer`), which is noise once the value sits on a labelled
 * line, so the raw value is used instead.
 */
function factObjectLabel(node: OntologyNode | undefined): string {
  if (!node) {
    return "";
  }
  return node.kind === "literal" ? (node.literalValue ?? node.label) : node.label;
}
