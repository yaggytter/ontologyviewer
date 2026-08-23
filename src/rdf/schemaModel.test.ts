import { describe, it, expect } from "vitest";
import { parseTurtle } from "./parser";
import { buildSchemaModel } from "./schemaModel";

const HARBOR_TTL = `
@prefix : <https://example.org/ontology/harbor-market#> .
@prefix view: <https://example.org/ontology/harbor-market#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<https://example.org/ontology/harbor-market> a owl:Ontology ;
  rdfs:label "Harbor Market" ;
  rdfs:comment "A fictional marketplace model." .

:Vendor a owl:Class ; rdfs:label "Vendor" ; view:icon "⛺" ; view:color "#2563EB" .
:Stall a owl:Class ; rdfs:label "Stall" ; view:icon "🏪" .
:Product a owl:Class ; rdfs:label "Product" .

:vendorCode a owl:DatatypeProperty ;
  rdfs:label "vendor code" ; rdfs:domain :Vendor ; rdfs:range xsd:string ; view:isIdentifier true .
:stallNumber a owl:DatatypeProperty ;
  rdfs:label "stall number" ; rdfs:domain :Stall ; rdfs:range xsd:string .

:operates a owl:ObjectProperty ;
  rdfs:label "operates" ; rdfs:domain :Vendor ; rdfs:range :Stall .

:blueSailFoods a :Vendor ; rdfs:label "Blue Sail Foods" .
`;

describe("buildSchemaModel", () => {
  it("extracts ontology title and description", () => {
    const { quads } = parseTurtle(HARBOR_TTL, "https://example.org/ontology/harbor-market");
    const model = buildSchemaModel(quads);
    expect(model.title).toBe("Harbor Market");
    expect(model.description).toBe("A fictional marketplace model.");
  });

  it("identifies OWL classes", () => {
    const { quads } = parseTurtle(HARBOR_TTL, "https://example.org/ontology/harbor-market");
    const model = buildSchemaModel(quads);
    expect(model.entities.length).toBe(3);
    const names = model.entities.map((e) => e.name).sort();
    expect(names).toEqual(["Product", "Stall", "Vendor"]);
  });

  it("extracts icon overrides", () => {
    const { quads } = parseTurtle(HARBOR_TTL, "https://example.org/ontology/harbor-market");
    const model = buildSchemaModel(quads);
    const vendor = model.entities.find((e) => e.name === "Vendor")!;
    expect(vendor.icon).toBe("⛺");
    const stall = model.entities.find((e) => e.name === "Stall")!;
    expect(stall.icon).toBe("🏪");
  });

  it("extracts color overrides", () => {
    const { quads } = parseTurtle(HARBOR_TTL, "https://example.org/ontology/harbor-market");
    const model = buildSchemaModel(quads);
    const vendor = model.entities.find((e) => e.name === "Vendor")!;
    expect(vendor.colorOverride).toBe("#2563EB");
  });

  it("attaches datatype properties to entities", () => {
    const { quads } = parseTurtle(HARBOR_TTL, "https://example.org/ontology/harbor-market");
    const model = buildSchemaModel(quads);
    const vendor = model.entities.find((e) => e.name === "Vendor")!;
    expect(vendor.properties.length).toBe(1);
    expect(vendor.properties[0].name).toBe("vendor code");
    expect(vendor.properties[0].type).toBe("string");
    expect(vendor.properties[0].isIdentifier).toBe(true);
  });

  it("builds object property relations", () => {
    const { quads } = parseTurtle(HARBOR_TTL, "https://example.org/ontology/harbor-market");
    const model = buildSchemaModel(quads);
    const operatesRel = model.relations.find((r) => r.name === "operates");
    expect(operatesRel).toBeDefined();
    expect(operatesRel!.kind).toBe("objectProperty");
  });

  it("counts instances", () => {
    const { quads } = parseTurtle(HARBOR_TTL, "https://example.org/ontology/harbor-market");
    const model = buildSchemaModel(quads);
    const vendor = model.entities.find((e) => e.name === "Vendor")!;
    expect(vendor.instanceCount).toBe(1); // blueSailFoods
  });

  it("handles empty input", () => {
    const model = buildSchemaModel([]);
    expect(model.isEmpty).toBe(true);
    expect(model.entities).toHaveLength(0);
    expect(model.relations).toHaveLength(0);
  });

  it("handles SKOS concepts", () => {
    const skos = `
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix : <http://example.org/> .
      :A a skos:Concept ; skos:prefLabel "Concept A" .
      :B a skos:Concept ; skos:prefLabel "Concept B" .
      :A skos:broader :B .
    `;
    const { quads } = parseTurtle(skos, "http://example.org/");
    const model = buildSchemaModel(quads);
    expect(model.entities.some((e) => e.origin === "skosConcept")).toBe(true);
    expect(model.relations.some((r) => r.kind === "skosBroader")).toBe(true);
  });

  it("handles subClassOf relationships", () => {
    const ttl = `
      @prefix : <http://example.org/> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      :Animal a owl:Class ; rdfs:label "Animal" .
      :Dog a owl:Class ; rdfs:label "Dog" .
      :Dog rdfs:subClassOf :Animal .
    `;
    const { quads } = parseTurtle(ttl, "http://example.org/");
    const model = buildSchemaModel(quads);
    expect(model.relations.some((r) => r.kind === "subClassOf")).toBe(true);
  });

  it("assigns connection groups", () => {
    const { quads } = parseTurtle(HARBOR_TTL, "https://example.org/ontology/harbor-market");
    const model = buildSchemaModel(quads);
    for (const entity of model.entities) {
      expect(entity.connectionGroup.index).toBeGreaterThan(0);
      expect(entity.connectionGroup.count).toBeGreaterThan(0);
      expect(entity.connectionGroup.size).toBeGreaterThan(0);
    }
  });
});
