// Pure aesthetic-extraction and geometry helpers shared by the per-geom
// lowering modules. These functions were extracted verbatim from the former
// compile/lowering.ts monolith; they take explicit trained scales so they stay
// pure and independent of the LayerContext plumbing. Per-geom `lower`
// implementations read scales off `ctx.scales` and pass them in here.
import type { Aes, DataFrame, GGSpec, Layer } from "../ir/types.ts";
import { columnValues, numericColumnValues } from "../data/mod.ts";
import { sliceRows } from "../group/mod.ts";
import {
  namedLinetypeValue,
  scaleAlphaValue,
  scaleColorValue,
  scaleLinetypeValue,
  scaleLinewidthValue,
  scalePosition,
  scaleShapeValue,
  scaleSizeValue,
  type TrainedScale,
} from "../scale/mod.ts";

export function valuesOf(
  data: DataFrame,
  column: string | undefined,
): unknown[] | undefined {
  return column && column in data ? columnValues(data, column) : undefined;
}

/** Pull an [x,y] position array for a layer from its mapped columns. */
export function positionsOf(
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
): [number, number][] {
  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  if (!xs || !ys || xs.length === 0 || ys.length === 0) return [];
  const n = Math.min(xs.length, ys.length);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    out.push([scalePosition(xScale, xs[i]), scalePosition(yScale, ys[i])]);
  }
  return out;
}

/**
 * Reorder every column by ascending x — geom_line always connects points in
 * x order (so an unsorted dataset still draws a proper line), unlike
 * geom_path, which preserves the data's own row order for trajectories.
 */
export function sortByX(mapping: Aes, data: GGSpec["data"]): GGSpec["data"] {
  const col = mapping.x;
  if (!col || !(col in data)) return data;
  const xs = numericColumnValues(data, col);
  const order = [...Array(xs.length).keys()].sort((a, b) =>
    (xs[a] ?? Number.POSITIVE_INFINITY) - (xs[b] ?? Number.POSITIVE_INFINITY)
  );
  return sliceRows(data, order);
}

export type ColorPreference = "color" | "fill" | "colorOrFill" | "fillOrColor";

/** Per-row hex colors from a mapped color/fill column, or undefined if unmapped. */
export function colorsOf(
  mapping: Aes,
  data: GGSpec["data"],
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
  preference: ColorPreference = "colorOrFill",
): string[] | undefined {
  const aesName = preference === "color"
    ? "color"
    : preference === "fill"
    ? "fill"
    : preference === "fillOrColor" && mapping.fill
    ? "fill"
    : mapping.color
    ? "color"
    : mapping.fill
    ? "fill"
    : undefined;
  const col = aesName ? mapping[aesName] : undefined;
  if (!col || !(col in data)) return undefined;
  const scale = aesName === "fill" ? fillScale : colorScale;
  return columnValues(data, col).map((v) => scaleColorValue(scale, v));
}

/** Per-row point radii from a mapped size column, or undefined if unmapped. */
export function sizesOf(
  mapping: Aes,
  data: GGSpec["data"],
  sizeScale: TrainedScale | undefined,
): number[] | undefined {
  const col = mapping.size;
  if (!col || !(col in data)) return undefined;
  return columnValues(data, col).map((v) => scaleSizeValue(sizeScale, v));
}

/** Per-row opacity from a mapped alpha column; literals remain layer params. */
export function alphasOf(
  mapping: Aes,
  data: GGSpec["data"],
  alphaScale: TrainedScale | undefined,
): number[] | undefined {
  const col = mapping.alpha;
  if (!col || !(col in data)) return undefined;
  return columnValues(data, col).map((v) => scaleAlphaValue(alphaScale, v));
}

/** Encode a mapped opacity into a CSS color the Point adapter can bind per row. */
export function colorWithAlpha(color: string, alpha: number): string {
  const hex = color.startsWith("#") ? color.slice(1) : color;
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const expanded = [...hex].map((part) => part + part).join("");
    return `#${expanded}${
      Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(
        2,
        "0",
      )
    }`;
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return `#${hex}${
      Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(
        2,
        "0",
      )
    }`;
  }
  // CSS rgba() is accepted by UseGPU's color parser for named/non-hex colors.
  return color;
}

/** Per-row point shapes from a mapped shape column, or undefined if unmapped. */
export function shapesOf(
  mapping: Aes,
  data: GGSpec["data"],
  shapeScale: TrainedScale | undefined,
): string[] | undefined {
  const col = mapping.shape;
  if (!col || !(col in data)) return undefined;
  return columnValues(data, col).map((v) => scaleShapeValue(shapeScale, v));
}

/** Per-vertex line widths from a mapped continuous linewidth column. */
export function linewidthsOf(
  mapping: Aes,
  data: GGSpec["data"],
  linewidthScale: TrainedScale | undefined,
): number[] | undefined {
  const col = mapping.linewidth;
  if (!col || !(col in data)) return undefined;
  return columnValues(data, col).map((v) =>
    scaleLinewidthValue(linewidthScale, v)
  );
}

export function strokesOf(
  mapping: Aes,
  data: GGSpec["data"],
  strokeScale: TrainedScale | undefined,
): number[] | undefined {
  const column = mapping.stroke;
  if (!column || !(column in data)) return undefined;
  return columnValues(data, column).map((value) =>
    scaleLinewidthValue(strokeScale, value)
  );
}

/** A connected Line has one dash style; grouping has already isolated its level. */
export function dashOf(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  linetypeScale: TrainedScale | undefined,
): readonly number[] | undefined {
  const literal = layer.params.linetype;
  if (typeof literal === "string") return namedLinetypeValue(literal);
  const col = mapping.linetype;
  if (!col || !(col in data)) return undefined;
  return scaleLinetypeValue(linetypeScale, columnValues(data, col)[0]);
}

export function literalLineProps(
  layer: Layer,
  defaultWidth: number,
): Record<string, unknown> {
  const linetype = layer.params.linetype;
  const dash = typeof linetype === "string"
    ? namedLinetypeValue(linetype)
    : undefined;
  return {
    width: (layer.params.linewidth as number) ??
      (layer.params.width as number) ??
      (layer.params.strokeWidth as number) ?? defaultWidth,
    ...(dash ? { dash } : {}),
  };
}

/**
 * Closed polygon loop for a filled band (geom_area/geom_ribbon): the top edge
 * (ymax, x-ascending) followed by the bottom edge (ymin, x-descending).
 * geom_area defaults ymin to a 0 baseline when unmapped.
 */
export function bandPositions(
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
): [number, number][] {
  const xs = valuesOf(data, mapping.x);
  const ymaxCol = mapping.ymax ?? mapping.y;
  const ymaxs = valuesOf(data, ymaxCol);
  const ymins = valuesOf(data, mapping.ymin);
  if (!xs || !ymaxs) return [];

  const n = Math.min(xs.length, ymaxs.length, ymins ? ymins.length : xs.length);
  const order = [...Array(n).keys()].sort((a, b) =>
    scalePosition(xScale, xs[a]) - scalePosition(xScale, xs[b])
  );

  const top: [number, number][] = order.map((i) => [
    scalePosition(xScale, xs[i]),
    scalePosition(yScale, ymaxs[i]),
  ]);
  const bottom: [number, number][] = order
    .map((i): [number, number] => [
      scalePosition(xScale, xs[i]),
      ymins ? scalePosition(yScale, ymins[i]) : scalePosition(yScale, 0),
    ])
    .reverse();

  return [...top, ...bottom];
}

/** Full band width at a shared position: 1 level-index unit for discrete scales, else the smallest gap between distinct values. */
export function resolutionOf(
  scale: TrainedScale | undefined,
  values: number[],
): number {
  if (scale?.kind === "discrete") return 1;
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  let minGap = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    minGap = Math.min(minGap, sorted[i] - sorted[i - 1]);
  }
  return Number.isFinite(minGap) ? minGap : 1;
}

export function normalizeFontface(
  fontface: unknown,
  fallbackWeight: unknown = "normal",
  fallbackStyle: unknown = "normal",
): { weight: number | string; style: string } {
  const face = String(fontface ?? "").toLowerCase().replaceAll("_", ".");
  if (face === "bold.italic" || face === "bolditalic") {
    return { weight: "bold", style: "italic" };
  }
  if (face === "bold") return { weight: "bold", style: "normal" };
  if (face === "italic") return { weight: "normal", style: "italic" };
  if (face === "plain") return { weight: "normal", style: "normal" };
  return {
    weight: typeof fallbackWeight === "number" ||
        typeof fallbackWeight === "string"
      ? fallbackWeight
      : "normal",
    style: fallbackStyle === "italic" || fallbackStyle === "oblique"
      ? fallbackStyle
      : "normal",
  };
}

export function requiredValues(
  geom: string,
  mapping: Aes,
  data: GGSpec["data"],
  aes: keyof Aes,
): unknown[] {
  const column = mapping[aes];
  const values = valuesOf(data, column);
  if (!values) {
    throw new TypeError(`${geom} requires a mapped ${aes} aesthetic`);
  }
  return values;
}

export function stepPositions(
  positions: [number, number][],
  direction: unknown,
): [number, number][] {
  if (direction !== "hv" && direction !== "vh" && direction !== "mid") {
    throw new TypeError('geomStep direction must be "hv", "vh", or "mid"');
  }
  if (positions.length < 2) return positions;
  const out: [number, number][] = [positions[0]];
  for (let i = 1; i < positions.length; i++) {
    const [x0, y0] = positions[i - 1];
    const [x1, y1] = positions[i];
    if (direction === "hv") out.push([x1, y0]);
    if (direction === "vh") out.push([x0, y1]);
    if (direction === "mid") {
      const midpoint = (x0 + x1) / 2;
      out.push([midpoint, y0], [midpoint, y1]);
    }
    out.push([x1, y1]);
  }
  return out;
}
