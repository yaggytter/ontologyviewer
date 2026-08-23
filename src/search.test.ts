import { describe, it, expect } from "vitest";
import { searchSchema } from "./search";
import type { SchemaModel } from "./rdf/schemaModel";

const MOCK_SCHEMA: SchemaModel = {
  title: "Test",
  description: "Test schema",
  entities: [
    {
      id: "http://ex.org/Vendor",
      name: "Vendor",
      origin: "owlClass",
      properties: [
        { iri: "http://ex.org/vendorCode", name: "vendor code", type: "string", provenance: "declared" },
      ],
      instanceCount: 3,
      icon: "📦",
      colorIndex: 0,
      connectionGroup: { index: 1, count: 1, size: 3 },
    },
    {
      id: "http://ex.org/Product",
      name: "Product",
      origin: "owlClass",
      properties: [
        { iri: "http://ex.org/productName", name: "product name", type: "string", provenance: "declared" },
      ],
      instanceCount: 5,
      icon: "📦",
      colorIndex: 1,
      connectionGroup: { index: 1, count: 1, size: 3 },
    },
    {
      id: "http://ex.org/Stall",
      name: "Stall",
      origin: "owlClass",
      properties: [],
      instanceCount: 2,
      icon: "📦",
      colorIndex: 2,
      connectionGroup: { index: 1, count: 1, size: 3 },
    },
  ],
  relations: [
    {
      id: "http://ex.org/Vendor|operates|http://ex.org/Stall",
      name: "operates",
      source: "http://ex.org/Vendor",
      target: "http://ex.org/Stall",
      kind: "objectProperty",
      cardinality: "one-to-many",
      provenance: "declared",
    },
  ],
  isEmpty: false,
};

describe("searchSchema", () => {
  it("returns empty for empty query", () => {
    expect(searchSchema(MOCK_SCHEMA, "")).toHaveLength(0);
    expect(searchSchema(MOCK_SCHEMA, "  ")).toHaveLength(0);
  });

  it("finds entities by name", () => {
    const results = searchSchema(MOCK_SCHEMA, "Vendor");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].label).toBe("Vendor");
    expect(results[0].kind).toBe("entity");
  });

  it("finds properties by name", () => {
    const results = searchSchema(MOCK_SCHEMA, "vendor code");
    expect(results.some((r) => r.kind === "property")).toBe(true);
  });

  it("finds relations by name", () => {
    const results = searchSchema(MOCK_SCHEMA, "operates");
    expect(results.some((r) => r.kind === "relation")).toBe(true);
  });

  it("is case-insensitive", () => {
    const results = searchSchema(MOCK_SCHEMA, "vendor");
    expect(results.length).toBeGreaterThan(0);
  });

  it("respects limit", () => {
    const results = searchSchema(MOCK_SCHEMA, "a", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("ranks exact matches higher", () => {
    const results = searchSchema(MOCK_SCHEMA, "product");
    const entityResult = results.find((r) => r.kind === "entity");
    expect(entityResult?.label).toBe("Product");
  });
});
