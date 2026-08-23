import { describe, it, expect } from "vitest";
import { parseTurtle } from "./parser";
import { buildGraphModel } from "./graphModel";

const SIMPLE_TTL = `
@prefix : <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

:Dog a owl:Class ; rdfs:label "Dog" ; rdfs:comment "A canine." .
:Cat a owl:Class ; rdfs:label "Cat" .
:Dog rdfs:subClassOf :Cat .
`;

describe("buildGraphModel", () => {
  it("builds nodes from quads", () => {
    const { quads } = parseTurtle(SIMPLE_TTL, "http://example.org/");
    const model = buildGraphModel(quads);
    expect(model.nodes.length).toBeGreaterThan(0);
    const dog = model.nodes.find((n) => n.label === "Dog");
    expect(dog).toBeDefined();
    expect(dog!.kind).toBe("class");
    expect(dog!.comment).toBe("A canine.");
  });

  it("builds edges from triples", () => {
    const { quads } = parseTurtle(SIMPLE_TTL, "http://example.org/");
    const model = buildGraphModel(quads);
    expect(model.edges.length).toBeGreaterThan(0);
    const subClassEdge = model.edges.find((e) => e.predicateLabel === "rdfs:subClassOf");
    expect(subClassEdge).toBeDefined();
  });

  it("assigns kind=class for owl:Class types", () => {
    const { quads } = parseTurtle(SIMPLE_TTL, "http://example.org/");
    const model = buildGraphModel(quads);
    const cat = model.nodes.find((n) => n.label === "Cat");
    expect(cat?.kind).toBe("class");
  });

  it("handles empty quads", () => {
    const model = buildGraphModel([]);
    expect(model.nodes).toHaveLength(0);
    expect(model.edges).toHaveLength(0);
  });

  it("detects blank nodes", () => {
    const ttl = `
      @prefix : <http://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      :X a owl:Class ; owl:equivalentClass [ a owl:Class ] .
    `;
    const { quads } = parseTurtle(ttl, "http://example.org/");
    const model = buildGraphModel(quads);
    const blanks = model.nodes.filter((n) => n.isBlankNode);
    expect(blanks.length).toBeGreaterThan(0);
  });

  it("represents every parsed quad as a Triples edge", () => {
    const { quads } = parseTurtle(SIMPLE_TTL, "http://example.org/");
    const model = buildGraphModel(quads);

    expect(model.edges).toHaveLength(quads.length);
    expect(model.edges.map((edge) => edge.predicateLabel)).toEqual(expect.arrayContaining([
      "rdf:type",
      "rdfs:label",
      "rdfs:comment",
      "rdfs:subClassOf",
    ]));
  });

  it("formats literal terms as quoted, typed Triples nodes", () => {
    const ttl = `
      @prefix : <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      :X :icon "⛺" ; :count "42"^^xsd:integer ; :name "Harbor"@en .
    `;
    const { quads } = parseTurtle(ttl, "http://example.org/");
    const model = buildGraphModel(quads);
    const literals = model.nodes.filter((node) => node.kind === "literal");

    expect(literals).toHaveLength(3);
    expect(literals.map((node) => node.label)).toEqual(expect.arrayContaining([
      "\"⛺\"",
      "\"42\"^^xsd:integer",
      "\"Harbor\"@en",
    ]));
    expect(literals.every((node) => !node.isBlankNode)).toBe(true);
    expect(new Set(literals.map((node) => node.id)).size).toBe(literals.length);
  });
});
