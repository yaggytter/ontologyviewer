import { COLOR_PALETTE_SIZE } from "./rdf/appearance";

export type Theme = "auto" | "light" | "dark";

export function isDarkTheme(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function paletteColorFor(colorIndex: number, paletteSize: number = COLOR_PALETTE_SIZE, dark = false): string {
  const hue = ((colorIndex % paletteSize) + paletteSize) % paletteSize * (360 / paletteSize);
  const saturation = dark ? 70 : 75;
  const lightness = dark ? 62 : 42;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function paletteSurfaceFor(colorIndex: number, paletteSize: number = COLOR_PALETTE_SIZE, dark = false): string {
  const hue = ((colorIndex % paletteSize) + paletteSize) % paletteSize * (360 / paletteSize);
  return dark ? `hsl(${hue}, 38%, 23%)` : `hsl(${hue}, 62%, 92%)`;
}

export function accessibleTextColor(background: string, canvasBackground = "#ffffff"): "#000000" | "#ffffff" {
  const parsedBg = parseCssColor(background);
  const parsedCanvas = parseCssColor(canvasBackground);
  if (!parsedBg || !parsedCanvas) return "#000000";
  const solid = composite(parsedBg, parsedCanvas);
  const blackContrast = (relativeLuminance(solid) + 0.05) / 0.05;
  const whiteContrast = 1.05 / (relativeLuminance(solid) + 0.05);
  return blackContrast >= whiteContrast ? "#000000" : "#ffffff";
}

interface RgbaColor { r: number; g: number; b: number; a: number }

function parseCssColor(value: string): RgbaColor | undefined {
  const color = value.trim().toLowerCase();
  const hex = color.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex && [3, 4, 6, 8].includes(hex.length)) {
    const expanded = hex.length <= 4 ? [...hex].map((d) => d + d).join("") : hex;
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
      a: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    };
  }
  const hsl = color.match(/^hsla?\(\s*([\d.-]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (hsl) {
    return { ...hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3])), a: hsl[4] === undefined ? 1 : Math.min(1, Number(hsl[4])) };
  }
  const rgb = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (rgb) {
    return { r: Math.min(255, Number(rgb[1])), g: Math.min(255, Number(rgb[2])), b: Math.min(255, Number(rgb[3])), a: rgb[4] === undefined ? 1 : Math.min(1, Number(rgb[4])) };
  }
  return undefined;
}

function hslToRgb(hue: number, saturation: number, lightness: number): { r: number; g: number; b: number } {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = (((hue % 360) + 360) % 360) / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const [r1, g1, b1] =
    segment < 1 ? [chroma, secondary, 0]
      : segment < 2 ? [secondary, chroma, 0]
        : segment < 3 ? [0, chroma, secondary]
          : segment < 4 ? [0, secondary, chroma]
            : segment < 5 ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const offset = l - chroma / 2;
  return { r: (r1 + offset) * 255, g: (g1 + offset) * 255, b: (b1 + offset) * 255 };
}

function composite(fg: RgbaColor, bg: RgbaColor): RgbaColor {
  const alpha = fg.a + bg.a * (1 - fg.a);
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / alpha,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / alpha,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / alpha,
    a: alpha,
  };
}

function relativeLuminance(color: RgbaColor): number {
  const linear = [color.r, color.g, color.b].map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
