import type { Quad, Quad_Object } from "n3";
import { RDF_FIRST, RDF_REST } from "./vocabulary";

/**
 * Walks an RDF collection starting at `head` and returns IRIs of NamedNode members.
 */
export function readRdfList(quads: Quad[], head: Quad_Object): string[] {
  const members: string[] = [];
  const visited = new Set<string>();
  let current = head;

  while (current.termType === "BlankNode") {
    if (visited.has(current.value)) {
      break;
    }
    visited.add(current.value);

    const firstQuad = quads.find(
      (q) =>
        q.subject.termType === "BlankNode" &&
        q.subject.value === current.value &&
        q.predicate.value === RDF_FIRST,
    );
    if (!firstQuad) {
      break;
    }
    if (firstQuad.object.termType === "NamedNode") {
      members.push(firstQuad.object.value);
    }

    const restQuad = quads.find(
      (q) =>
        q.subject.termType === "BlankNode" &&
        q.subject.value === current.value &&
        q.predicate.value === RDF_REST,
    );
    if (!restQuad) {
      break;
    }
    current = restQuad.object;
  }

  return members;
}
