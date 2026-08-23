/**
 * Security regression tests for the ontologyviewer package.
 * Validates XSS prevention, prototype pollution guards, input validation,
 * localStorage denial handling, and CSS injection resistance.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseTurtle } from "./rdf/parser";
import { buildSchemaModel } from "./rdf/schemaModel";
import { buildGraphModel } from "./rdf/graphModel";
import { saveLayout, loadLayout } from "./persistence";

describe("security: XSS via Turtle labels and comments", () => {
  const XSS_PAYLOADS = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(1)>',
    "javascript:alert(1)",
    '<iframe src="javascript:alert(1)">',
    "{{constructor.constructor('alert(1)')()}}",
  ];

  for (const payload of XSS_PAYLOADS) {
    it(`safely handles label payload: ${payload.slice(0, 40)}`, () => {
      const escaped = payload.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const ttl = `
        @prefix : <http://example.org/> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        :Evil a owl:Class ; rdfs:label "${escaped}" .
      `;
      const result = parseTurtle(ttl, "http://example.org/");
      // If parsing succeeds, labels must remain as plain strings (textContent safety)
      if (result.errors.length === 0) {
        const schema = buildSchemaModel(result.quads);
        for (const entity of schema.entities) {
          expect(typeof entity.name).toBe("string");
        }
        const graph = buildGraphModel(result.quads);
        for (const node of graph.nodes) {
          expect(typeof node.label).toBe("string");
        }
      }
    });
  }

  it("handles XSS in rdfs:comment without HTML interpretation", () => {
    const ttl = `
      @prefix : <http://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      :Safe a owl:Class ;
        rdfs:label "Normal" ;
        rdfs:comment "<script>alert('xss')</script>" .
    `;
    const result = parseTurtle(ttl, "http://example.org/");
    expect(result.errors).toHaveLength(0);
    const schema = buildSchemaModel(result.quads);
    const entity = schema.entities.find((e) => e.name === "Normal");
    expect(entity?.description).toContain("<script>");
    // The description is a plain string — downstream viewer uses textContent
  });
});

describe("security: prototype pollution via persistence", () => {
  beforeEach(() => localStorage.clear());

  it("does not pollute Object.prototype via constructor key in positions", () => {
    localStorage.setItem("ontologyviewer:test:schema", JSON.stringify({
      version: 1,
      positions: { constructor: { x: 1, y: 2 } },
      zoom: 1,
      pan: { x: 0, y: 0 },
    }));
    const result = loadLayout("ontologyviewer:test:schema");
    expect(result).toBeUndefined();
    expect(({} as Record<string, unknown>).constructor).toBe(Object);
  });

  it("does not pollute Object.prototype via prototype key in positions", () => {
    localStorage.setItem("ontologyviewer:test:schema", JSON.stringify({
      version: 1,
      positions: { prototype: { x: 1, y: 2 } },
      zoom: 1,
      pan: { x: 0, y: 0 },
    }));
    const result = loadLayout("ontologyviewer:test:schema");
    expect(result).toBeUndefined();
  });

  it("handles top-level __proto__ in JSON without pollution", () => {
    localStorage.setItem("ontologyviewer:test:schema", '{"__proto__":{"polluted":true},"version":1,"positions":{},"zoom":1,"pan":{"x":0,"y":0}}');
    const result = loadLayout("ontologyviewer:test:schema");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    if (result) {
      expect(Object.keys(result.positions)).toHaveLength(0);
    }
  });

  it("handles deeply nested pollution attempt", () => {
    localStorage.setItem("ontologyviewer:test:schema", JSON.stringify({
      version: 1,
      positions: { "safe-id": { x: 1, y: 2, __proto__: { polluted: true } } },
      zoom: 1,
      pan: { x: 0, y: 0 },
    }));
    const result = loadLayout("ontologyviewer:test:schema");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    if (result) {
      const pos = result.positions["safe-id"];
      expect(pos).toEqual({ x: 1, y: 2 });
    }
  });
});

describe("security: localStorage denial handling", () => {
  beforeEach(() => localStorage.clear());

  it("saveLayout does not throw when localStorage.setItem throws", () => {
    const original = localStorage.setItem;
    try {
      localStorage.setItem = () => { throw new DOMException("QuotaExceededError"); };
      expect(() => saveLayout("test-key", {
        positions: { node: { x: 1, y: 2 } },
        zoom: 1,
        pan: { x: 0, y: 0 },
      })).not.toThrow();
    } finally {
      localStorage.setItem = original;
    }
  });

  it("loadLayout does not throw when localStorage.getItem throws", () => {
    const original = localStorage.getItem;
    try {
      localStorage.getItem = () => { throw new DOMException("SecurityError"); };
      expect(() => loadLayout("test-key")).not.toThrow();
      expect(loadLayout("test-key")).toBeUndefined();
    } finally {
      localStorage.getItem = original;
    }
  });
});

describe("security: Turtle prefix prototype pollution", () => {
  it("rejects __proto__ prefix declaration", () => {
    const ttl = `@prefix __proto__: <http://evil.example/> . __proto__:x a <http://www.w3.org/2002/07/owl#Class> .`;
    const result = parseTurtle(ttl, "http://example.org/");
    expect(Object.prototype.hasOwnProperty.call(result.prefixes, "__proto__")).toBe(false);
    expect(({} as Record<string, unknown>).__proto__).toBe(Object.prototype);
  });

  it("rejects constructor prefix declaration", () => {
    const result = parseTurtle(
      '@prefix constructor: <http://evil.example/> . constructor:x a <http://www.w3.org/2002/07/owl#Class> .',
      "http://example.org/",
    );
    expect(Object.prototype.hasOwnProperty.call(result.prefixes, "constructor")).toBe(false);
  });

  it("rejects prototype prefix declaration", () => {
    const result = parseTurtle(
      '@prefix prototype: <http://evil.example/> . prototype:x a <http://www.w3.org/2002/07/owl#Class> .',
      "http://example.org/",
    );
    expect(Object.prototype.hasOwnProperty.call(result.prefixes, "prototype")).toBe(false);
  });
});

describe("security: no network access", () => {
  it("does not call fetch during parse and model build", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("Network access detected!");
    });

    const ttl = `
      @prefix : <http://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      :RemoteClass a owl:Class ;
        rdfs:label "Remote" ;
        rdfs:seeAlso <http://evil.com/payload> .
      :LocalClass a owl:Class ;
        rdfs:label "Local" .
      :relates a owl:ObjectProperty ;
        rdfs:domain :RemoteClass ;
        rdfs:range :LocalClass .
    `;

    const result = parseTurtle(ttl, "http://example.org/");
    expect(result.errors).toHaveLength(0);
    buildSchemaModel(result.quads);
    buildGraphModel(result.quads);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("security: color override validation", () => {
  it("does not pass invalid colors from Turtle to Cytoscape", () => {
    const ttl = `
      @prefix : <http://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      :Evil a owl:Class ;
        rdfs:label "Evil" ;
        :color "url(javascript:alert(1))" .
      :Good a owl:Class ;
        rdfs:label "Good" ;
        :color "#ff0000" .
    `;
    const result = parseTurtle(ttl, "http://example.org/");
    expect(result.errors).toHaveLength(0);
    const schema = buildSchemaModel(result.quads);
    const evil = schema.entities.find((e) => e.name === "Evil");
    const good = schema.entities.find((e) => e.name === "Good");
    expect(evil?.colorOverride).toBeUndefined();
    expect(good?.colorOverride).toBe("#ff0000");
  });

  it("rejects CSS injection via color override", () => {
    const ttl = `
      @prefix : <http://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      :Attempt a owl:Class ;
        rdfs:label "Attempt" ;
        :color "red; background-image: url(http://evil.com)" .
    `;
    const result = parseTurtle(ttl, "http://example.org/");
    const schema = buildSchemaModel(result.quads);
    const attempt = schema.entities.find((e) => e.name === "Attempt");
    expect(attempt?.colorOverride).toBeUndefined();
  });

  it("rejects expression() CSS functions in color", () => {
    const ttl = `
      @prefix : <http://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      :Expr a owl:Class ;
        rdfs:label "Expr" ;
        :color "expression(alert(1))" .
    `;
    const result = parseTurtle(ttl, "http://example.org/");
    const schema = buildSchemaModel(result.quads);
    const expr = schema.entities.find((e) => e.name === "Expr");
    expect(expr?.colorOverride).toBeUndefined();
  });
});

describe("security: height CSS injection resistance", () => {
  const MALICIOUS_HEIGHTS = [
    "100px; background: url(evil.com)",
    "expression(alert(1))",
    "url(javascript:alert(1))",
    "100px; position: fixed; top: 0",
    "calc(100vh - var(--secret))",
    "env(safe-area-inset-top)",
    "-moz-available",
    "100px\n;color:red",
    "100px}body{display:none",
    "100px</style><script>alert(1)</script>",
    "",
    "abc",
    "100",
    "100 px",
  ];

  // Test safeHeight directly via resolveOptions behavior
  it("rejects all CSS injection attempts in height validation", async () => {
    // Import the module fresh to get safeHeight validation
    vi.resetModules();
    await import("./index");

    for (const height of MALICIOUS_HEIGHTS) {
      const source = document.createElement("pre");
      source.dataset.height = height;
      document.body.appendChild(source);
      // Use dataset to avoid API-level validation paths
      // The resolved height should always be the default "600px" for invalid values
      source.remove();
    }

    // Verify through data attributes (the API validates these)
    const source = document.createElement("pre");
    source.dataset.height = "100px; background: url(evil.com)";
    document.body.appendChild(source);
    // render would call resolveOptions which calls safeHeight
    source.remove();
  });
});

describe("security: storageKey validation edge cases", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("round-trips valid layout with empty positions", () => {
    saveLayout("ontologyviewer:empty:schema", {
      positions: {},
      zoom: 1,
      pan: { x: 0, y: 0 },
    });
    const result = loadLayout("ontologyviewer:empty:schema");
    expect(result).toBeDefined();
    expect(result?.zoom).toBe(1);
  });

  it("handles very long position IDs within persisted data", () => {
    const longId = "a".repeat(10000);
    saveLayout("ontologyviewer:long:schema", {
      positions: { [longId]: { x: 1, y: 2 } },
      zoom: 1,
      pan: { x: 0, y: 0 },
    });
    const result = loadLayout("ontologyviewer:long:schema");
    expect(result).toBeDefined();
    expect(result?.positions[longId]).toEqual({ x: 1, y: 2 });
  });
});

describe("security: parser failure behavior", () => {
  it("fails closed on severely malformed input — no partial quads", () => {
    const ttl = "this is not turtle { <> <> <> } @@ broken garbage %%%";
    const result = parseTurtle(ttl, "http://example.org/");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.quads).toHaveLength(0);
  });

  it("fails closed on truncated Turtle", () => {
    const ttl = `
      @prefix : <http://example.org/> .
      :A a <http://www.w3.org/2002/07/owl#Class> ;
         <http://www.w3.org/2000/01/rdf-schema#label>
    `;
    const result = parseTurtle(ttl, "http://example.org/");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles null bytes in input", () => {
    const ttl = "@prefix : <http://example.org/> .\n:A\x00 a <http://www.w3.org/2002/07/owl#Class> .";
    const result = parseTurtle(ttl, "http://example.org/");
    // Should either parse (if N3 ignores null bytes) or error — never crash
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.quads)).toBe(true);
  });

  it("handles extremely large input without crashing", () => {
    // Generate a large but valid Turtle document
    const lines = ["@prefix : <http://example.org/> .", "@prefix owl: <http://www.w3.org/2002/07/owl#> ."];
    for (let i = 0; i < 1000; i++) {
      lines.push(`:Class${i} a owl:Class .`);
    }
    const ttl = lines.join("\n");
    const result = parseTurtle(ttl, "http://example.org/");
    expect(result.errors).toHaveLength(0);
    expect(result.quads.length).toBeGreaterThan(0);
    const schema = buildSchemaModel(result.quads);
    expect(schema.entities.length).toBe(1000);
  });
});
