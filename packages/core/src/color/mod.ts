// The one hex-color parser (gggplot-d0g). Previously geom/shared.ts and
// runtime/resident_bar.tsx each carried their own — this module is the single
// definition both the CPU packing path and the resident runtime consume.

/**
 * Recognize a #rgb or #rrggbb hex color and normalize it to a 6-digit hex
 * string, preserving the input's original digit casing. Returns null for
 * anything else (named CSS colors, rgb()/rgba() strings, #rrggbbaa) — those
 * are not hex-parseable by this minimal parser.
 */
export function expandHexColor(color: string): string | null {
  const hex = color.startsWith("#") ? color.slice(1) : color;
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [...hex].map((part) => part + part).join("");
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return hex;
  }
  return null;
}

/**
 * Parse a color string into normalized [r,g,b,a] components in 0..1. Non-hex
 * colors (named CSS colors, rgb()/rgba() strings) fall back to opaque black —
 * there is no CSS named-color table here. `alpha` (default 1) fills the
 * fourth component, clamped to 0..1.
 */
export function parseColorRGBA(
  color: string,
  alpha = 1,
): [number, number, number, number] {
  const hex = expandHexColor(color);
  const a = Math.max(0, Math.min(1, alpha));
  if (hex == null) return [0, 0, 0, a];
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
    a,
  ];
}
