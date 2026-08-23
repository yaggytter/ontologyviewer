import type { Quad } from "n3";
import { isKnownVocabularyIri } from "./vocabulary";

/** Falls back to the fragment/last-path-segment of an IRI. */
export function localName(iri: string): string {
  const hashIndex = iri.lastIndexOf("#");
  const slashIndex = iri.lastIndexOf("/");
  const cut = Math.max(hashIndex, slashIndex);
  return cut >= 0 && cut < iri.length - 1 ? iri.slice(cut + 1) : iri;
}

/**
 * Finds a literal value for a subject using candidate local-name predicates
 * in the document's own namespace.
 */
export function findOverrideLiteral(
  quads: Quad[],
  subject: string,
  candidateLocalNames: readonly string[],
): string | undefined {
  for (const quad of quads) {
    if (quad.subject.value !== subject || quad.object.termType !== "Literal") {
      continue;
    }
    if (isKnownVocabularyIri(quad.predicate.value)) {
      continue;
    }
    if (candidateLocalNames.includes(localName(quad.predicate.value))) {
      return quad.object.value;
    }
  }
  return undefined;
}
