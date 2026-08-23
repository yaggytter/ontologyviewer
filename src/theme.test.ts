import { describe, it, expect } from "vitest";
import { paletteColorFor, paletteSurfaceFor, accessibleTextColor, isDarkTheme } from "./theme";

describe("theme", () => {
  describe("isDarkTheme", () => {
    it("returns true for 'dark'", () => {
      expect(isDarkTheme("dark")).toBe(true);
    });
    it("returns false for 'light'", () => {
      expect(isDarkTheme("light")).toBe(false);
    });
  });

  describe("paletteColorFor", () => {
    it("produces valid hsl strings", () => {
      const color = paletteColorFor(0, 48, false);
      expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    });
    it("uses different saturation/lightness for dark mode", () => {
      const light = paletteColorFor(5, 48, false);
      const dark = paletteColorFor(5, 48, true);
      expect(light).not.toBe(dark);
    });
    it("handles negative indices gracefully", () => {
      const color = paletteColorFor(-1, 48);
      expect(color).toMatch(/^hsl\(/);
    });
  });

  describe("paletteSurfaceFor", () => {
    it("produces valid hsl strings", () => {
      const color = paletteSurfaceFor(0, 48, true);
      expect(color).toMatch(/^hsl\(/);
    });
  });

  describe("accessibleTextColor", () => {
    it("returns black for light backgrounds", () => {
      expect(accessibleTextColor("#ffffff")).toBe("#000000");
    });
    it("returns white for dark backgrounds", () => {
      expect(accessibleTextColor("#000000")).toBe("#ffffff");
    });
    it("handles hsl input", () => {
      expect(accessibleTextColor("hsl(200, 80%, 90%)")).toBe("#000000");
    });
    it("handles invalid input gracefully", () => {
      const result = accessibleTextColor("notacolor");
      expect(result).toBe("#000000");
    });
  });
});
