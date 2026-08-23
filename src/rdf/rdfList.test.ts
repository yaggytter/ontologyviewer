import { describe, it, expect } from "vitest";
import { readRdfList } from "./rdfList";
import { DataFactory } from "n3";

const { namedNode, blankNode, quad: q } = DataFactory;

describe("readRdfList", () => {
  const RDF_FIRST = "http://www.w3.org/1999/02/22-rdf-syntax-ns#first";
  const RDF_REST = "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest";
  const RDF_NIL = "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil";

  it("reads a simple list", () => {
    const b1 = blankNode("b1");
    const b2 = blankNode("b2");
    const quads = [
      q(b1, namedNode(RDF_FIRST), namedNode("http://ex.org/A"), namedNode("")),
      q(b1, namedNode(RDF_REST), b2, namedNode("")),
      q(b2, namedNode(RDF_FIRST), namedNode("http://ex.org/B"), namedNode("")),
      q(b2, namedNode(RDF_REST), namedNode(RDF_NIL), namedNode("")),
    ];
    const result = readRdfList(quads, b1);
    expect(result).toEqual(["http://ex.org/A", "http://ex.org/B"]);
  });

  it("returns empty for non-blank-node head", () => {
    const result = readRdfList([], namedNode("http://ex.org/not-a-list"));
    expect(result).toEqual([]);
  });

  it("returns empty for blank node with no first", () => {
    const b1 = blankNode("b1");
    const result = readRdfList([], b1);
    expect(result).toEqual([]);
  });

  it("handles cycles gracefully", () => {
    const b1 = blankNode("b1");
    const quads = [
      q(b1, namedNode(RDF_FIRST), namedNode("http://ex.org/A"), namedNode("")),
      q(b1, namedNode(RDF_REST), b1, namedNode("")), // cycle!
    ];
    const result = readRdfList(quads, b1);
    expect(result).toEqual(["http://ex.org/A"]);
  });
});
