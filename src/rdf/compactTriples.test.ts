import { describe, expect, it } from "vitest";
import { parseTurtle } from "./parser";
import { buildGraphModel } from "./graphModel";
import { compactTriples } from "./compactTriples";

const PREFIXES = `
@prefix : <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
`;

function compactFor(turtle: string) {
  const { quads, errors } = parseTurtle(`${PREFIXES}${turtle}`, "http://example.org/");
  expect(errors).toEqual([]);
  const full = buildGraphModel(quads);
  return { full, compact: compactTriples(full) };
}

function labelsOf(nodes: { label: string }[]): string[] {
  return nodes.map((n) => n.label);
}

describe("compactTriples", () => {
  it("drops rdfs:label literal nodes without restating them, since the label is already on the node", () => {
    // buildGraphModel copies rdfs:label into node.label *and* emits a literal
    // node for the same statement, so the box is pure duplication.
    const { full, compact } = compactFor(`:Tenant a owl:Class ; rdfs:label "Tenant" .`);

    expect(labelsOf(full.nodes)).toContain('"Tenant"');
    expect(labelsOf(compact.nodes)).not.toContain('"Tenant"');

    const tenant = compact.nodes.find((n) => n.id === "http://example.org/Tenant");
    expect(tenant?.label).toBe("Tenant");
    // No `label: ...` fact line — the node title already says it.
    expect(compact.foldedFacts.get("http://example.org/Tenant") ?? []).not.toContain('label: "Tenant"');
  });

  it("drops rdfs:comment literal nodes, which the node already carries as its comment", () => {
    const { compact } = compactFor(`:Tenant a owl:Class ; rdfs:comment "A customer account." .`);
    const tenant = compact.nodes.find((n) => n.id === "http://example.org/Tenant");
    expect(tenant?.comment).toBe("A customer account.");
    expect(compact.nodes.filter((n) => n.kind === "literal")).toEqual([]);
    expect(compact.foldedFacts.get("http://example.org/Tenant") ?? []).toEqual(["type: owl:Class"]);
  });

  it("folds a datatype range into the property node", () => {
    const { compact } = compactFor(`:createdAt a owl:DatatypeProperty ; rdfs:range xsd:dateTime .`);
    expect(labelsOf(compact.nodes)).not.toContain("dateTime");
    expect(compact.foldedFacts.get("http://example.org/createdAt")).toEqual([
      "type: owl:DatatypeProperty",
      "range: dateTime",
    ]);
  });

  it("folds a data literal as a fact line, keeping the value visible", () => {
    // Unlike a label, this literal is the information — so it is restated.
    const { compact } = compactFor(`:crackers :unitPrice 480 .`);
    expect(compact.nodes.filter((n) => n.kind === "literal")).toEqual([]);
    expect(compact.foldedFacts.get("http://example.org/crackers")).toEqual(["unitPrice: 480"]);
  });

  it("keeps a resource that other nodes point at but which also points somewhere", () => {
    // :Feature is a target of range, but it says something itself, so it is
    // structure rather than a leaf annotation.
    const { compact } = compactFor(`
      :offers a owl:ObjectProperty ; rdfs:range :Feature .
      :Feature a owl:Class ; rdfs:subClassOf :Thing .
    `);
    expect(compact.nodes.map((n) => n.id)).toContain("http://example.org/Feature");
  });

  it("keeps a vocabulary term the document describes", () => {
    const { compact } = compactFor(`
      :p a owl:DatatypeProperty ; rdfs:range xsd:string .
      xsd:string rdfs:comment "described here" .
    `);
    // xsd:string now has an outgoing edge, so it is no longer a leaf.
    expect(compact.nodes.map((n) => n.id)).toContain("http://www.w3.org/2001/XMLSchema#string");
  });

  it("trims the vocabulary prefix off folded predicate labels", () => {
    const { compact } = compactFor(`:p rdfs:range xsd:string .`);
    expect(compact.foldedFacts.get("http://example.org/p")).toEqual(["range: string"]);
  });

  it("deduplicates identical folded facts", () => {
    const { compact } = compactFor(`
      :a :tag "x" .
      :a :tag "x" .
    `);
    expect(compact.foldedFacts.get("http://example.org/a")).toEqual(["tag: x"]);
  });

  it("does not mutate the input graph", () => {
    const { quads } = parseTurtle(`${PREFIXES}:p rdfs:range xsd:string .`, "http://example.org/");
    const full = buildGraphModel(quads);
    const nodeCount = full.nodes.length;
    const edgeCount = full.edges.length;
    compactTriples(full);
    expect(full.nodes).toHaveLength(nodeCount);
    expect(full.edges).toHaveLength(edgeCount);
  });

  it("leaves a graph of pure resource-to-resource links untouched", () => {
    const { full, compact } = compactFor(`:a :knows :b . :b :knows :c .`);
    expect(compact.nodes).toEqual(full.nodes);
    expect(compact.edges).toEqual(full.edges);
    expect(compact.removedNodeCount).toBe(0);
    expect(compact.removedEdgeCount).toBe(0);
    expect(compact.foldedFacts.size).toBe(0);
  });

  it("reports how much it removed", () => {
    const { compact } = compactFor(`:p a owl:DatatypeProperty ; rdfs:label "p" ; rdfs:range xsd:string .`);
    // Folded away: the "p" literal, xsd:string, owl:DatatypeProperty.
    expect(compact.removedNodeCount).toBe(3);
    expect(compact.removedEdgeCount).toBe(3);
  });

  /**
   * The pathology that motivated the feature, reproduced deterministically: a
   * schema-heavy ontology where every datatype property declares a label and a
   * range, so each one contributes two extra boxes and the ranges all converge
   * on one `xsd:string` hub.
   */
  it("collapses label duplication and datatype hubs on a schema-heavy ontology", () => {
    const properties = Array.from({ length: 40 }, (_, i) => i);
    const { full, compact } = compactFor(`
      :Thing a owl:Class .
      ${properties
        .map(
          (i) =>
            `:prop${i} a owl:DatatypeProperty ; rdfs:label "prop ${i}" ; rdfs:domain :Thing ; rdfs:range xsd:string .`,
        )
        .join("\n      ")}
    `);

    // Before: one literal box per label, plus the shared xsd:string hub.
    expect(full.nodes.filter((n) => n.kind === "literal")).toHaveLength(properties.length);
    const hubDegree = full.edges.filter(
      (e) => e.target === "http://www.w3.org/2001/XMLSchema#string",
    ).length;
    expect(hubDegree).toBe(properties.length);

    // After: only the class and the properties remain as boxes.
    expect(compact.nodes).toHaveLength(properties.length + 1);
    expect(compact.nodes.filter((n) => n.kind === "literal")).toEqual([]);
    // Every property keeps its type and range as stated facts.
    expect(compact.foldedFacts.get("http://example.org/prop0")).toEqual([
      "type: owl:DatatypeProperty",
      "range: string",
    ]);
    // The domain edges survive, so nothing became isolated.
    expect(compact.edges).toHaveLength(properties.length);
  });
});
