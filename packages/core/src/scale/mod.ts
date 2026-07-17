// Scales — stage ② of the pipeline.
//
// Scale training scans the (post-stat) data across all layers to learn each
// aesthetic's data-space domain, so the coord/view can be given a range and
// marks can be mapped into visual space. Continuous/discrete x/y,
// color/fill palettes, and size/alpha/shape are all implemented.

import type {
  Aes,
  AesName,
  DataFrame,
  GGSpec,
  Scale,
  ScaleKind,
} from "../ir/types.ts";
import { columnValues, factorLevelsFor, isFactorColumn } from "../data/mod.ts";
import {
  categoricalRange,
  interpolateColorRamp,
  SEQUENTIAL_RAMP,
} from "./palette.ts";

export interface TrainedScale extends Scale {
  domain: [number, number] | string[];
}

/** Numeric [min,max] extent of a column, ignoring non-finite values. */
function continuousExtent(values: unknown[]): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) {
      if (n < min) min = n;
      if (n > max) max = n;
    }
  }
  return min <= max ? [min, max] : null;
}

/**
 * A column is treated as discrete (a factor) when it holds strings, mirroring
 * R's "character columns become factors" default. An explicit scale kind
 * (`discrete`/`continuous`) always wins over this sniff.
 */
function isDiscreteAes(
  perLayer: { data: DataFrame; mapping: Aes }[],
  aesName: AesName,
  declared?: Scale,
): boolean {
  if (declared?.kind === "discrete") return true;
  if (declared?.kind === "continuous") return false;

  for (const { data, mapping } of perLayer) {
    const col = mapping[aesName];
    if (!col || !(col in data)) continue;
    if (isFactorColumn(data, col)) return true;
    for (const v of columnValues(data, col)) {
      if (v == null) continue;
      return typeof v === "string";
    }
  }
  return false;
}

/**
 * Ordered factor levels for a discrete aesthetic. An explicit `domain` on the
 * declared scale fixes the level order (ggplot2's `limits=`); otherwise
 * levels are the sorted unique values seen across layers.
 */
function discreteLevels(
  perLayer: { data: DataFrame; mapping: Aes }[],
  aesName: AesName,
  declaredDomain?: string[],
): string[] {
  if (declaredDomain) return declaredDomain;

  const levels: string[] = [];
  const seen = new Set<string>();
  const inferred = new Set<string>();
  for (const { data, mapping } of perLayer) {
    const col = mapping[aesName];
    if (!col || !(col in data)) continue;
    const declaredLevels = factorLevelsFor(data, col);
    if (declaredLevels) {
      for (const level of declaredLevels) {
        if (seen.has(level)) continue;
        seen.add(level);
        levels.push(level);
      }
      continue;
    }
    for (const v of columnValues(data, col)) {
      if (v != null) inferred.add(String(v));
    }
  }
  for (const level of [...inferred].sort()) {
    if (seen.has(level)) continue;
    seen.add(level);
    levels.push(level);
  }
  return levels;
}

/** log10/sqrt data transforms for "log"/"sqrt" scale kinds; identity otherwise. */
function transformFor(kind: ScaleKind | undefined): (v: number) => number {
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

const DEFAULT_SIZE_RANGE: [number, number] = [1, 6];
const DEFAULT_ALPHA_RANGE: [number, number] = [0.1, 1];
const DEFAULT_LINEWIDTH_RANGE: [number, number] = [1, 6];
const DEFAULT_SHAPE_PALETTE: readonly string[] = [
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
const DEFAULT_LINETYPE_PALETTE: readonly (readonly number[])[] = [
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

/** Map a raw data value to a point radius, linearly interpolated across the size range (default [1, 6]). */
export function scaleSizeValue(
  scale: TrainedScale | undefined,
  raw: unknown,
): number {
  return interpolateRange(scale, raw, DEFAULT_SIZE_RANGE);
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

/** Train a continuous size/alpha scale: data extent -> a visual [min,max] range. */
function trainContinuousAuxScale(
  perLayer: { data: DataFrame; mapping: Aes }[],
  aesName: "size" | "alpha" | "linewidth" | "stroke",
  declared: Scale | undefined,
  defaultRange: [number, number],
): TrainedScale | undefined {
  let lo = Infinity;
  let hi = -Infinity;
  for (const { data, mapping } of perLayer) {
    const col = mapping[aesName];
    if (!col || !(col in data)) continue;
    const ext = continuousExtent(columnValues(data, col));
    if (!ext) continue;
    lo = Math.min(lo, ext[0]);
    hi = Math.max(hi, ext[1]);
  }
  if (!(lo <= hi)) return undefined;

  return {
    aes: aesName,
    kind: "continuous",
    name: declared?.name,
    domain: (declared?.domain as [number, number]) ?? [lo, hi],
    range: (declared?.range as [number, number] | undefined) ?? defaultRange,
  };
}

/** Train a discrete linetype scale: factor levels -> compact dash patterns. */
function trainLinetypeScale(
  perLayer: { data: DataFrame; mapping: Aes }[],
  declared?: Scale,
): TrainedScale | undefined {
  const levels = discreteLevels(
    perLayer,
    "linetype",
    declared?.domain as string[] | undefined,
  );
  if (levels.length === 0) return undefined;
  const range = declared?.range as number[][] | undefined;
  return {
    aes: "linetype",
    kind: "discrete",
    name: declared?.name,
    domain: levels,
    range: range ?? levels.map((_, index) => [
      ...DEFAULT_LINETYPE_PALETTE[index % DEFAULT_LINETYPE_PALETTE.length],
    ]),
  };
}

/** Train a discrete shape scale: factor levels -> a fixed glyph palette, in level order. */
function trainShapeScale(
  perLayer: { data: DataFrame; mapping: Aes }[],
  declared?: Scale,
): TrainedScale | undefined {
  const levels = discreteLevels(
    perLayer,
    "shape",
    declared?.domain as string[] | undefined,
  );
  if (levels.length === 0) return undefined;

  return {
    aes: "shape",
    kind: "discrete",
    name: declared?.name,
    domain: levels,
    range: (declared?.range as string[] | undefined) ??
      levels.map((_, i) =>
        DEFAULT_SHAPE_PALETTE[i % DEFAULT_SHAPE_PALETTE.length]
      ),
  };
}

/** Train a color/fill palette scale: categorical assignment or a sequential gradient. */
function trainColorScale(
  perLayer: { data: DataFrame; mapping: Aes }[],
  aesName: "color" | "fill",
  declared?: Scale,
): TrainedScale | undefined {
  if (isDiscreteAes(perLayer, aesName, declared)) {
    const levels = discreteLevels(
      perLayer,
      aesName,
      declared?.domain as string[] | undefined,
    );
    if (levels.length === 0) return undefined;
    return {
      aes: aesName,
      kind: "color",
      name: declared?.name,
      guide: declared?.guide,
      domain: levels,
      range: (declared?.range as string[] | undefined) ??
        categoricalRange(levels.length),
    };
  }

  let lo = Infinity;
  let hi = -Infinity;
  for (const { data, mapping } of perLayer) {
    const col = mapping[aesName];
    if (!col || !(col in data)) continue;
    const ext = continuousExtent(columnValues(data, col));
    if (!ext) continue;
    lo = Math.min(lo, ext[0]);
    hi = Math.max(hi, ext[1]);
  }
  if (!(lo <= hi)) return undefined;

  return {
    aes: aesName,
    kind: "color",
    name: declared?.name,
    guide: declared?.guide,
    domain: (declared?.domain as [number, number]) ?? [lo, hi],
    range: declared?.range as string[] | undefined,
  };
}

/**
 * Train scales for x, y, color, fill, size, alpha, shape, linetype and
 * linewidth by unioning each
 * layer's mapped columns. Returns a map keyed by aesthetic name.
 */
export function trainScales(
  spec: GGSpec,
  perLayer: { data: DataFrame; mapping: Aes }[],
): Map<string, TrainedScale> {
  const trained = new Map<string, TrainedScale>();

  for (const aesName of ["x", "y"] as const) {
    const declared = spec.scales.find((s) => s.aes === aesName);

    if (isDiscreteAes(perLayer, aesName, declared)) {
      const levels = discreteLevels(
        perLayer,
        aesName,
        declared?.domain as string[] | undefined,
      );
      if (levels.length > 0) {
        trained.set(aesName, {
          aes: aesName,
          kind: "discrete",
          name: declared?.name,
          domain: levels,
        });
      }
      continue;
    }

    let lo = Infinity;
    let hi = -Infinity;

    // ymin/ymax (geom_ribbon/geom_area's band edges) and xend/yend/xmin/xmax
    // (geom_segment/geom_rect annotations) share the x/y aesthetic's domain.
    for (const { data, mapping } of perLayer) {
      const cols = aesName === "y"
        ? [mapping.y, mapping.ymin, mapping.ymax, mapping.yend]
        : [mapping.x, mapping.xmin, mapping.xmax, mapping.xend];
      for (const col of cols) {
        if (!col || !(col in data)) continue;
        const ext = continuousExtent(columnValues(data, col));
        if (!ext) continue;
        lo = Math.min(lo, ext[0]);
        hi = Math.max(hi, ext[1]);
      }
    }

    if (lo <= hi) {
      const kind = declared?.kind ?? "continuous";
      const transform = transformFor(kind);
      const limits = (declared?.domain as [number, number]) ?? [lo, hi];
      const transformed: [number, number] = [
        transform(limits[0]),
        transform(limits[1]),
      ];
      const domain = declared?.expand
        ? expandRange(transformed, declared.expand)
        : transformed;

      trained.set(aesName, {
        aes: aesName,
        kind,
        name: declared?.name,
        domain,
      });
    }
  }

  for (const aesName of ["color", "fill"] as const) {
    const declared = spec.scales.find((s) => s.aes === aesName);
    const scale = trainColorScale(perLayer, aesName, declared);
    if (scale) trained.set(aesName, scale);
  }

  for (const aesName of ["size", "alpha", "linewidth", "stroke"] as const) {
    const declared = spec.scales.find((s) => s.aes === aesName);
    const defaultRange = aesName === "size"
      ? DEFAULT_SIZE_RANGE
      : aesName === "alpha"
      ? DEFAULT_ALPHA_RANGE
      : aesName === "stroke"
      ? [0.5, 4] as [number, number]
      : DEFAULT_LINEWIDTH_RANGE;
    const scale = trainContinuousAuxScale(
      perLayer,
      aesName,
      declared,
      defaultRange,
    );
    if (scale) trained.set(aesName, scale);
  }

  const shapeDeclared = spec.scales.find((s) => s.aes === "shape");
  const shapeScale = trainShapeScale(perLayer, shapeDeclared);
  if (shapeScale) trained.set("shape", shapeScale);

  const linetypeDeclared = spec.scales.find((s) => s.aes === "linetype");
  const linetypeScale = trainLinetypeScale(perLayer, linetypeDeclared);
  if (linetypeScale) trained.set("linetype", linetypeScale);

  return trained;
}
