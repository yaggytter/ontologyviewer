import { describe, it, expect } from "vitest";
import { assignRelationalAppearance, iconFor, DEFAULT_CLASS_ICON } from "./appearance";

describe("assignRelationalAppearance", () => {
  it("returns empty map for empty input", () => {
    const result = assignRelationalAppearance([], []);
    expect(result.size).toBe(0);
  });

  it("assigns color indices to all entities", () => {
    const ids = ["a", "b", "c"];
    const edges = [{ source: "a", target: "b" }];
    const result = assignRelationalAppearance(ids, edges, 48);
    expect(result.size).toBe(3);
    for (const [, appearance] of result) {
      expect(appearance.colorIndex).toBeGreaterThanOrEqual(0);
      expect(appearance.colorIndex).toBeLessThan(48);
    }
  });

  it("connected entities get same group", () => {
    const ids = ["a", "b", "c", "d"];
    const edges = [{ source: "a", target: "b" }, { source: "c", target: "d" }];
    const result = assignRelationalAppearance(ids, edges, 48);
    expect(result.get("a")!.groupIndex).toBe(result.get("b")!.groupIndex);
    expect(result.get("c")!.groupIndex).toBe(result.get("d")!.groupIndex);
    expect(result.get("a")!.groupIndex).not.toBe(result.get("c")!.groupIndex);
  });

  it("is deterministic", () => {
    const ids = ["x", "y", "z"];
    const edges = [{ source: "x", target: "y" }];
    const r1 = assignRelationalAppearance(ids, edges, 48);
    const r2 = assignRelationalAppearance(ids, edges, 48);
    expect(r1.get("x")!.colorIndex).toBe(r2.get("x")!.colorIndex);
  });

  it("handles self-loops gracefully", () => {
    const ids = ["a"];
    const edges = [{ source: "a", target: "a" }];
    const result = assignRelationalAppearance(ids, edges, 48);
    expect(result.size).toBe(1);
  });
});

describe("iconFor", () => {
  it("returns matching icon for known tokens", () => {
    expect(iconFor(["Person"], DEFAULT_CLASS_ICON)).toBe("👤");
    expect(iconFor(["Organization"], DEFAULT_CLASS_ICON)).toBe("🏢");
    expect(iconFor(["Event"], DEFAULT_CLASS_ICON)).toBe("📅");
  });

  it("returns fallback for unknown names", () => {
    expect(iconFor(["XyzFoo"], DEFAULT_CLASS_ICON)).toBe(DEFAULT_CLASS_ICON);
  });

  it("handles camelCase tokenization", () => {
    expect(iconFor(["CustomerPerson"], DEFAULT_CLASS_ICON)).toBe("👤");
  });

  it("does not match substring-only tokens", () => {
    // "Classification" should NOT match "class" (it tokenizes to "classification")
    expect(iconFor(["Classification"], DEFAULT_CLASS_ICON)).toBe(DEFAULT_CLASS_ICON);
  });
});
