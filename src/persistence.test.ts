import { describe, it, expect, beforeEach } from "vitest";
import { saveLayout, loadLayout, clearLayout } from "./persistence";

describe("persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads layout data", () => {
    const layout = {
      positions: { "node1": { x: 100, y: 200 }, "node2": { x: 300, y: 400 } },
      zoom: 1.5,
      pan: { x: 50, y: 50 },
    };
    saveLayout("test-key", layout);
    const loaded = loadLayout("test-key");
    expect(loaded).toEqual(layout);
  });

  it("returns undefined for missing key", () => {
    expect(loadLayout("nonexistent")).toBeUndefined();
  });

  it("handles corrupted data gracefully", () => {
    localStorage.setItem("bad-key", "not json");
    expect(loadLayout("bad-key")).toBeUndefined();
  });

  it("handles partial data gracefully", () => {
    localStorage.setItem("partial", JSON.stringify({ positions: {} }));
    expect(loadLayout("partial")).toBeUndefined();
  });

  it("clears layout data", () => {
    saveLayout("del-key", { positions: {}, zoom: 1, pan: { x: 0, y: 0 } });
    clearLayout("del-key");
    expect(loadLayout("del-key")).toBeUndefined();
  });
});


describe("persistence validation", () => {
  beforeEach(() => localStorage.clear());

  it("rejects non-finite coordinates and zoom values", () => {
    localStorage.setItem("invalid", JSON.stringify({
      version: 1,
      positions: { node: { x: null, y: 1 } },
      zoom: 1,
      pan: { x: 0, y: 0 },
    }));
    expect(loadLayout("invalid")).toBeUndefined();
  });

  it("rejects prototype-polluting position keys", () => {
    localStorage.setItem("pollution", '{"version":1,"positions":{"__proto__":{"x":1,"y":2}},"zoom":1,"pan":{"x":0,"y":0}}');
    expect(loadLayout("pollution")).toBeUndefined();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("rejects zoom below 0.1", () => {
    localStorage.setItem("low-zoom", JSON.stringify({
      version: 1,
      positions: {},
      zoom: 0.05,
      pan: { x: 0, y: 0 },
    }));
    expect(loadLayout("low-zoom")).toBeUndefined();
  });

  it("rejects zoom above 10", () => {
    localStorage.setItem("high-zoom", JSON.stringify({
      version: 1,
      positions: {},
      zoom: 15,
      pan: { x: 0, y: 0 },
    }));
    expect(loadLayout("high-zoom")).toBeUndefined();
  });

  it("rejects NaN pan values", () => {
    localStorage.setItem("nan-pan", JSON.stringify({
      version: 1,
      positions: {},
      zoom: 1,
      pan: { x: NaN, y: 0 },
    }));
    expect(loadLayout("nan-pan")).toBeUndefined();
  });

  it("rejects Infinity coordinate values", () => {
    localStorage.setItem("inf-pos", JSON.stringify({
      version: 1,
      positions: { node: { x: Infinity, y: 0 } },
      zoom: 1,
      pan: { x: 0, y: 0 },
    }));
    expect(loadLayout("inf-pos")).toBeUndefined();
  });
});
