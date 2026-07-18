import type { ScaleKind } from "../ir/types.ts";
import {
  categoricalRange,
  interpolateColorRamp,
  SEQUENTIAL_RAMP,
} from "./palette.ts";
import type { TrainedScale } from "./types.ts";

export function transformFor(
  kind: ScaleKind | undefined,
): (v: number) => number {
  if (kind === "log") return Math.log10;
  if (kind === "sqrt") return Math.sqrt;
  return (v) => v;
}

/**
 * Pad a [lo, hi] range by a multiplicative fraction of its span plus a flat
 * additive amount, mirroring ggplot2's expansion(mult, add). A zero-span
 * range (a single value) is treated as span 1 so it still gets padded.
 */
export function expandRange(
  [lo, hi]: [number, number],
  [mult, add]: [number, number],
): [number, number] {
  const span = hi - lo || 1;
  const pad = span * mult + add;
  return [lo - pad, hi + pad];
}

/**
 * Map a raw data value into the scale's numeric position space: factor-level
 * index for discrete scales, the log10/sqrt-transformed value for those scale
 * kinds, or the plain numeric value otherwise.
 */
export function scalePosition(
  scale: TrainedScale | undefined,
  raw: unknown,
): number {
  if (scale?.kind === "discrete") {
    return (scale.domain as string[]).indexOf(String(raw));
  }
  return transformFor(scale?.kind)(Number(raw));
}

/**
 * Map a raw data value into a hex color: a fixed categorical palette slot for
 * discrete color/fill scales (by factor-level index), or a point on the
 * selected serializable ramp for continuous ones. See scale/palette.ts.
 */
export function scaleColorValue(
  scale: TrainedScale | undefined,
  raw: unknown,
): string {
  if (!scale) return categoricalRange(1)[0];

  const domain = scale.domain;
  if (Array.isArray(domain) && typeof domain[0] === "string") {
    const levels = domain as string[];
    return (scale.range as string[] | undefined)
      ?.[levels.indexOf(String(raw))] ??
      categoricalRange(levels.length)[levels.indexOf(String(raw))];
  }

  const [lo, hi] = domain as [number, number];
  const t = hi > lo ? (Number(raw) - lo) / (hi - lo) : 0;
  return interpolateColorRamp(
    (scale.range as string[] | undefined) ?? SEQUENTIAL_RAMP,
    t,
  );
}

export const DEFAULT_SIZE_RANGE: [number, number] = [1, 6];
export const DEFAULT_ALPHA_RANGE: [number, number] = [0.1, 1];
export const DEFAULT_LINEWIDTH_RANGE: [number, number] = [1, 6];
export const DEFAULT_SHAPE_PALETTE: readonly string[] = [
  "circle",
  "square",
  // UseGPU's Point marker enum is circle/square/diamond plus cardinal wedges;
  // ggplot's triangle/cross/asterisk aliases otherwise downgrade silently to
  // a circle and emit browser warnings.
  "up",
  "diamond",
  "down",
  "left",
  "right",
];
/** Dash/gap lengths in device pixels, accepted directly by use.gpu's Line. */
export const DEFAULT_LINETYPE_PALETTE: readonly (readonly number[])[] = [
  [], // solid
  [8, 5], // dashed
  [1, 4], // dotted
  [1, 4, 8, 4], // dotdash
];

/** Named literal linetypes mirror the first four ggplot2 defaults. */
const NAMED_LINETYPE: Readonly<Record<string, readonly number[]>> = {
  solid: DEFAULT_LINETYPE_PALETTE[0],
  dashed: DEFAULT_LINETYPE_PALETTE[1],
  dotted: DEFAULT_LINETYPE_PALETTE[2],
  dotdash: DEFAULT_LINETYPE_PALETTE[3],
};

/** Linearly interpolate a raw value from a continuous scale's domain into its range. */
function interpolateRange(
  scale: TrainedScale | undefined,
  raw: unknown,
  fallback: [number, number],
): number {
  const [lo, hi] = (scale?.domain as [number, number]) ?? [0, 1];
  const [rLo, rHi] = (scale?.range as [number, number] | undefined) ?? fallback;
  const t = hi > lo ? (Number(raw) - lo) / (hi - lo) : 0;
  return rLo + t * (rHi - rLo);
}

/** Map a raw value to radius using area semantics (radius is proportional to sqrt(value)). */
export function scaleSizeValue(
  scale: TrainedScale | undefined,
  raw: unknown,
): number {
  const [lo, hi] = (scale?.domain as [number, number]) ?? [0, 1];
  const [rLo, rHi] = (scale?.range as [number, number] | undefined) ??
    DEFAULT_SIZE_RANGE;
  const value = Number(raw);
  const t = hi > lo ? Math.max(0, Math.min(1, (value - lo) / (hi - lo))) : 0;
  return rLo + Math.sqrt(t) * (rHi - rLo);
}

/** Map a raw data value to an opacity, linearly interpolated across the alpha range (default [0.1, 1]). */
export function scaleAlphaValue(
  scale: TrainedScale | undefined,
  raw: unknown,
): number {
  return interpolateRange(scale, raw, DEFAULT_ALPHA_RANGE);
}

/** Map a raw data value to a device-pixel line width. */
export function scaleLinewidthValue(
  scale: TrainedScale | undefined,
  raw: unknown,
): number {
  return interpolateRange(scale, raw, DEFAULT_LINEWIDTH_RANGE);
}

/** Resolve a literal linetype name to a use.gpu dash pattern. */
export function namedLinetypeValue(
  value: string | undefined,
): readonly number[] | undefined {
  if (value === undefined || value === "solid") return undefined;
  return NAMED_LINETYPE[value] ?? undefined;
}

/** Map a discrete level to its scale's dash pattern; no dash means solid. */
export function scaleLinetypeValue(
  scale: TrainedScale | undefined,
  raw: unknown,
): readonly number[] | undefined {
  if (!scale) return undefined;
  const levels = scale.domain as string[];
  const index = levels.indexOf(String(raw));
  if (index < 0) return undefined;
  const range = scale.range as number[][] | undefined;
  const dash = range?.[index] ??
    DEFAULT_LINETYPE_PALETTE[index % DEFAULT_LINETYPE_PALETTE.length];
  return dash.length ? dash : undefined;
}

/** Map a raw data value to a glyph name, by factor-level index into a fixed shape palette. */
export function scaleShapeValue(
  scale: TrainedScale | undefined,
  raw: unknown,
): string {
  if (!scale) return DEFAULT_SHAPE_PALETTE[0];
  const levels = scale.domain as string[];
  const idx = levels.indexOf(String(raw));
  return (scale.range as string[] | undefined)?.[idx] ??
    DEFAULT_SHAPE_PALETTE[idx % DEFAULT_SHAPE_PALETTE.length];
}
