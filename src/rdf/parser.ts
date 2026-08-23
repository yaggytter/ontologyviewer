/**
 * Browser-only Turtle parser using N3.js synchronous API.
 * Does not use Node streams — safe for bundling as an ES module.
 */
import * as N3 from "n3";

export interface ParseError {
  message: string;
  line?: number;
  column?: number;
}

export interface ParsedTurtle {
  quads: N3.Quad[];
  prefixes: Record<string, string>;
  baseIRI: string;
  errors: ParseError[];
}

/**
 * Parses a Turtle string into RDF/JS quads. Fails closed on errors:
 * if any syntax error is encountered the returned errors array is non-empty.
 */
export function parseTurtle(text: string, baseIRI: string): ParsedTurtle {
  const errors: ParseError[] = [];
  let quads: N3.Quad[] = [];
  let prefixes: Record<string, string> = {};

  try {
    const parser = new N3.Parser({ format: "Turtle", baseIRI });
    quads = parser.parse(text) as unknown as N3.Quad[];
    prefixes = extractPrefixes(text);
  } catch (err) {
    errors.push(toParseError(err));
  }

  return { quads, prefixes, baseIRI, errors };
}

function toParseError(error: unknown): ParseError {
  const message = error instanceof Error ? error.message : String(error);
  const match = /line (\d+)(?:\s*(?:,|:)?\s*column (\d+))?/i.exec(message);
  return {
    message,
    line: match ? Number(match[1]) : undefined,
    column: match?.[2] ? Number(match[2]) : undefined,
  };
}

function extractPrefixes(text: string): Record<string, string> {
  const prefixes: Record<string, string> = Object.create(null) as Record<string, string>;
  const unsafe = new Set(["__proto__", "constructor", "prototype"]);
  const pattern = /(?:@prefix\s+|\bPREFIX\s+)([A-Za-z][\w-]*|)\s*:\s*<([^>]*)>/gi;
  for (const match of text.matchAll(pattern)) {
    if (!unsafe.has(match[1])) prefixes[match[1]] = match[2];
  }
  return prefixes;
}
