import { describe, it, expect } from "vitest";
import { clampZoom, readableFitZoom, zoomStep, zoomLabel, MIN_ZOOM, MAX_ZOOM } from "./viewport";

describe("viewport", () => {
  describe("clampZoom", () => {
    it("clamps to MIN_ZOOM", () => {
      expect(clampZoom(0.1)).toBe(MIN_ZOOM);
    });
    it("clamps to MAX_ZOOM", () => {
      expect(clampZoom(5)).toBe(MAX_ZOOM);
    });
    it("passes through valid values", () => {
      expect(clampZoom(1)).toBe(1);
    });
  });

  describe("readableFitZoom", () => {
    it("enforces floor for small graphs", () => {
      expect(readableFitZoom(0.5, 10)).toBe(0.8);
    });
    it("uses lower floor for large graphs", () => {
      expect(readableFitZoom(0.5, 50)).toBe(0.6);
    });
    it("does not exceed MAX_ZOOM", () => {
      expect(readableFitZoom(5, 10)).toBe(MAX_ZOOM);
    });
  });

  describe("zoomStep", () => {
    it("zooms in by factor", () => {
      const result = zoomStep(1, "in");
      expect(result).toBeGreaterThan(1);
    });
    it("zooms out by factor", () => {
      const result = zoomStep(1, "out");
      expect(result).toBeLessThan(1);
    });
    it("respects bounds", () => {
      expect(zoomStep(MIN_ZOOM, "out")).toBe(MIN_ZOOM);
      expect(zoomStep(MAX_ZOOM, "in")).toBe(MAX_ZOOM);
    });
  });

  describe("zoomLabel", () => {
    it("formats as percentage", () => {
      expect(zoomLabel(1)).toBe("100%");
      expect(zoomLabel(0.5)).toBe("50%");
      expect(zoomLabel(1.5)).toBe("150%");
    });
  });
});
