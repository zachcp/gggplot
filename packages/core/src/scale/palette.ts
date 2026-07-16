// Default color/fill palettes — the dataviz skill's validated reference
// instance (references/palette.md). Categorical hues are a fixed order (never
// cycled by rank); the sequential ramp is one hue, light -> dark.

/** Fixed categorical hue order, validated for CVD-safe adjacent contrast. */
export const CATEGORICAL_PALETTE: readonly string[] = [
  "#2a78d6", // blue
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
  "#e87ba4", // magenta
  "#eb6834", // orange
];

/** Fold color for series beyond the categorical palette's 8 hues ("Other"). */
export const OTHER_COLOR = "#898781";

/** Sequential ramp (blue, light -> dark), steps 100..700 from palette.md. */
export const SEQUENTIAL_RAMP: readonly string[] = [
  "#cde2fb",
  "#b7d3f6",
  "#9ec5f4",
  "#86b6ef",
  "#6da7ec",
  "#5598e7",
  "#3987e5",
  "#2a78d6",
  "#256abf",
  "#1c5cab",
  "#184f95",
  "#104281",
  "#0d366b",
];

/** Perceptually ordered viridis anchors for continuous color/fill scales. */
export const VIRIDIS_RAMP: readonly string[] = [
  "#440154",
  "#482878",
  "#3e4989",
  "#31688e",
  "#26828e",
  "#1f9e89",
  "#35b779",
  "#6ece58",
  "#b5de2b",
  "#fde725",
];

/** Blue-white-red diverging anchors, suitable for a midpoint-centered scale. */
export const GRADIENT2_RAMP: readonly string[] = [
  "#b2182b",
  "#f7f7f7",
  "#2166ac",
];

/** A fixed categorical slot by index; indices beyond the palette fold to "Other". */
export function categoricalColor(index: number): string {
  if (index < 0 || index >= CATEGORICAL_PALETTE.length) return OTHER_COLOR;
  return CATEGORICAL_PALETTE[index];
}

/** Assign one color per level, in fixed order; warns once if levels overflow the palette. */
export function categoricalRange(levelCount: number): string[] {
  if (levelCount > CATEGORICAL_PALETTE.length) {
    console.warn(
      `[gggplot] ${levelCount} categorical levels exceeds the ${CATEGORICAL_PALETTE.length}-color palette; extra levels fold into "Other" (${OTHER_COLOR})`,
    );
  }
  return Array.from({ length: levelCount }, (_, i) => categoricalColor(i));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return "#" +
    [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}

/** Interpolate any serializable hex ramp at t in [0,1]. */
export function interpolateColorRamp(
  ramp: readonly string[],
  t: number,
): string {
  if (ramp.length === 0) return "#000000";
  if (ramp.length === 1) return ramp[0];
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (ramp.length - 1);
  const i0 = Math.floor(scaled);
  const i1 = Math.min(i0 + 1, ramp.length - 1);
  const frac = scaled - i0;
  const c0 = hexToRgb(ramp[i0]);
  const c1 = hexToRgb(ramp[i1]);
  return rgbToHex([
    c0[0] + (c1[0] - c0[0]) * frac,
    c0[1] + (c1[1] - c0[1]) * frac,
    c0[2] + (c1[2] - c0[2]) * frac,
  ]);
}

/** Interpolate the default sequential ramp at t in [0,1]. */
export function sequentialColor(t: number): string {
  return interpolateColorRamp(SEQUENTIAL_RAMP, t);
}
