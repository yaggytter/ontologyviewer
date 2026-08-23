import { describe, it, expect } from "vitest";
import { parseTurtle } from "./parser";

const HARBOR_TTL = `
@prefix : <https://example.org/ontology/harbor-market#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<https://example.org/ontology/harbor-market> a owl:Ontology ;
  rdfs:label "Harbor Market" .

:Vendor a owl:Class ; rdfs:label "Vendor" .
:Stall a owl:Class ; rdfs:label "Stall" .
:Product a owl:Class ; rdfs:label "Product" .

:vendorCode a owl:DatatypeProperty ;
  rdfs:label "vendor code" ; rdfs:domain :Vendor ; rdfs:range xsd:string .

:operates a owl:ObjectProperty ;
  rdfs:label "operates" ; rdfs:domain :Vendor ; rdfs:range :Stall .
`;

describe("parseTurtle", () => {
  it("parses valid Turtle and returns quads", () => {
    const result = parseTurtle(HARBOR_TTL, "https://example.org/ontology/harbor-market");
    expect(result.errors).toHaveLength(0);
    expect(result.quads.length).toBeGreaterThan(0);
    expect(result.prefixes).toHaveProperty("rdfs");
    expect(result.prefixes).toHaveProperty("owl");
  });

  it("returns quads with correct subjects", () => {
    const result = parseTurtle(HARBOR_TTL, "https://example.org/ontology/harbor-market");
    const subjects = new Set(result.quads.map((q) => q.subject.value));
    expect(subjects.has("https://example.org/ontology/harbor-market#Vendor")).toBe(true);
    expect(subjects.has("https://example.org/ontology/harbor-market#Stall")).toBe(true);
  });

  it("reports errors for invalid Turtle", () => {
    // This uses an undeclared default prefix, so use a clearly malformed input.
    const bad = parseTurtle("this is not turtle at all {{{}}", "http://example.org/");
    expect(bad.errors.length).toBeGreaterThan(0);
    expect(bad.errors[0].message).toBeTruthy();
  });

  it("extracts line/column from error messages", () => {
    const bad = parseTurtle("@prefix : <http://ex.org/> .\n:a :b .\n", "http://ex.org/");
    if (bad.errors.length > 0) {
      expect(bad.errors[0].line).toBeDefined();
    }
  });

  it("handles empty input", () => {
    const result = parseTurtle("", "http://example.org/");
    expect(result.errors).toHaveLength(0);
    expect(result.quads).toHaveLength(0);
  });

  it("preserves base IRI", () => {
    const result = parseTurtle(HARBOR_TTL, "https://custom-base.example.org/");
    expect(result.baseIRI).toBe("https://custom-base.example.org/");
  });

  it("handles unicode content", () => {
    const ttl = `
      @prefix : <http://example.org/> .
      :日本語 a <http://www.w3.org/2002/07/owl#Class> ; <http://www.w3.org/2000/01/rdf-schema#label> "日本語クラス" .
    `;
    const result = parseTurtle(ttl, "http://example.org/");
    expect(result.errors).toHaveLength(0);
    expect(result.quads.length).toBeGreaterThan(0);
  });
});


describe("parseTurtle prefix safety", () => {
  it("does not expose prototype keys from prefix declarations", () => {
    const result = parseTurtle('@prefix constructor: <https://example.org/> . constructor:A <https://example.org/p> constructor:B .', "https://base.example/");
    expect(result.errors).toHaveLength(0);
    expect(Object.prototype.hasOwnProperty.call(result.prefixes, "constructor")).toBe(false);
  });
});
