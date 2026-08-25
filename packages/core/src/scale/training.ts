import type {
  Aes,
  AesName,
  DataFrame,
  GGSpec,
  PositionAxis,
  Scale,
} from "../ir/types.ts";
import { columnValues, factorLevelsFor, isFactorColumn } from "../data/mod.ts";
import { categoricalRange } from "./palette.ts";
import type { TrainedScale } from "./types.ts";
import {
  DEFAULT_ALPHA_RANGE,
  DEFAULT_LINETYPE_PALETTE,
  DEFAULT_LINEWIDTH_RANGE,
  DEFAULT_SHAPE_PALETTE,
  DEFAULT_SIZE_RANGE,
  expandRange,
  transformFor,
} from "./mapping.ts";

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

function positionGuideFields(
  declared: Scale | undefined,
): Pick<Scale, "name" | "breaks" | "nBreaks"> {
  if (
    declared?.nBreaks != null &&
    (!Number.isInteger(declared.nBreaks) || declared.nBreaks < 1)
  ) {
    throw new Error("[gggplot] scale nBreaks must be a positive integer");
  }
  return {
    name: declared?.name,
    ...(declared?.breaks ? { breaks: [...declared.breaks] } : {}),
    ...(declared?.nBreaks != null ? { nBreaks: declared.nBreaks } : {}),
  };
}

/** Train one position aesthetic with the same rules for x, y, and z. */
export function trainPositionScale(
  spec: GGSpec,
  perLayer: { data: DataFrame; mapping: Aes }[],
  aesName: PositionAxis,
): TrainedScale | undefined {
  const declared = spec.scales.find((scale) => scale.aes === aesName);
  const guideFields = positionGuideFields(declared);

  if (isDiscreteAes(perLayer, aesName, declared)) {
    const levels = discreteLevels(
      perLayer,
      aesName,
      declared?.domain as string[] | undefined,
    );
    return levels.length > 0
      ? {
        aes: aesName,
        kind: "discrete",
        ...guideFields,
        domain: levels,
      }
      : undefined;
  }

  let lo = Infinity;
  let hi = -Infinity;
  for (const { data, mapping } of perLayer) {
    const cols = aesName === "y"
      ? [mapping.y, mapping.ymin, mapping.ymax, mapping.yend]
      : aesName === "x"
      ? [mapping.x, mapping.xmin, mapping.xmax, mapping.xend]
      // zend widens the z domain exactly as xend/yend widen x/y; without it a
      // 3D segment reaching past the z extent would be scaled off the cube.
      : [mapping.z, mapping.zend];
    for (const col of cols) {
      if (!col || !(col in data)) continue;
      const extent = continuousExtent(columnValues(data, col));
      if (!extent) continue;
      lo = Math.min(lo, extent[0]);
      hi = Math.max(hi, extent[1]);
    }
  }
  if (!(lo <= hi)) return undefined;

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
  return { aes: aesName, kind, ...guideFields, domain };
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
 * Train scales for x, y, z, color, fill, size, alpha, shape, linetype and
 * linewidth by unioning each
 * layer's mapped columns. Returns a map keyed by aesthetic name.
 */
export function trainScales(
  spec: GGSpec,
  perLayer: { data: DataFrame; mapping: Aes }[],
): Map<string, TrainedScale> {
  const trained = new Map<string, TrainedScale>();

  for (const aesName of ["x", "y", "z"] as const) {
    const scale = trainPositionScale(spec, perLayer, aesName);
    if (scale) trained.set(aesName, scale);
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
