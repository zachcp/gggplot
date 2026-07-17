// The transpiler core — lowers a GGSpec onto a RenderTree of UseGPU/plot nodes.
//
// Stages: stat transform → scale training → facet → coord → geom lowering →
// guides. The compiler keeps all backend-independent layout decisions here:
// panel/facet construction, shared scale domains, guide nodes, coord swizzles,
// and polar polygon munching before the live/codegen backends consume the tree.

import type {
  Aes,
  DataFrame,
  Facet,
  GGSpec,
  Layer,
  PlotLabels,
  PositionAxis,
  Theme,
} from "../ir/types.ts";
import { node, type RenderNode } from "./rendertree.ts";
import { applyStat } from "../stat/mod.ts";
import { sliceRows, splitByEffectiveGroup } from "../group/mod.ts";
import { columnValues, numericColumnValues } from "../data/mod.ts";
import {
  expandRange,
  namedLinetypeValue,
  scaleAlphaValue,
  scaleColorValue,
  scaleLinetypeValue,
  scaleLinewidthValue,
  scalePosition,
  scaleShapeValue,
  scaleSizeValue,
  type TrainedScale,
  trainScales,
} from "../scale/mod.ts";
import {
  dodge2Bars,
  dodgeBars,
  jitter,
  nudge,
  type PositionedBar,
  stackBars,
} from "../position/mod.ts";
import { residentHistogramProps } from "./resident.ts";

function valuesOf(
  data: DataFrame,
  column: string | undefined,
): unknown[] | undefined {
  return column && column in data ? columnValues(data, column) : undefined;
}

/** Pull an [x,y] position array for a layer from its mapped columns. */
function positionsOf(
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
function sortByX(mapping: Aes, data: GGSpec["data"]): GGSpec["data"] {
  const col = mapping.x;
  if (!col || !(col in data)) return data;
  const xs = numericColumnValues(data, col);
  const order = [...Array(xs.length).keys()].sort((a, b) =>
    (xs[a] ?? Number.POSITIVE_INFINITY) - (xs[b] ?? Number.POSITIVE_INFINITY)
  );
  return sliceRows(data, order);
}

type ColorPreference = "color" | "fill" | "colorOrFill" | "fillOrColor";

/** Per-row hex colors from a mapped color/fill column, or undefined if unmapped. */
function colorsOf(
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
function sizesOf(
  mapping: Aes,
  data: GGSpec["data"],
  sizeScale: TrainedScale | undefined,
): number[] | undefined {
  const col = mapping.size;
  if (!col || !(col in data)) return undefined;
  return columnValues(data, col).map((v) => scaleSizeValue(sizeScale, v));
}

/** Per-row opacity from a mapped alpha column; literals remain layer params. */
function alphasOf(
  mapping: Aes,
  data: GGSpec["data"],
  alphaScale: TrainedScale | undefined,
): number[] | undefined {
  const col = mapping.alpha;
  if (!col || !(col in data)) return undefined;
  return columnValues(data, col).map((v) => scaleAlphaValue(alphaScale, v));
}

/** Encode a mapped opacity into a CSS color the Point adapter can bind per row. */
function colorWithAlpha(color: string, alpha: number): string {
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
function shapesOf(
  mapping: Aes,
  data: GGSpec["data"],
  shapeScale: TrainedScale | undefined,
): string[] | undefined {
  const col = mapping.shape;
  if (!col || !(col in data)) return undefined;
  return columnValues(data, col).map((v) => scaleShapeValue(shapeScale, v));
}

/** Per-vertex line widths from a mapped continuous linewidth column. */
function linewidthsOf(
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

function strokesOf(
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
function dashOf(
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

function literalLineProps(
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
function bandPositions(
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
function resolutionOf(
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

/** Lower a geom_bar/geom_col layer to a single Polygon of bar-rectangle loops, stacked/dodged/filled per layer.position. */
function lowerBarLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
): RenderNode[] {
  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  if (!xs || !ys || xs.length === 0 || ys.length === 0) return [];

  const n = Math.min(xs.length, ys.length);
  const groupCol = mapping.fill ?? mapping.color ?? mapping.group;
  const groupValues = valuesOf(data, groupCol);

  const scaledX = xs.map((v) => scalePosition(xScale, v));
  const bars: PositionedBar[] = [];
  for (let i = 0; i < n; i++) {
    bars.push({
      x: scaledX[i],
      y: scalePosition(yScale, ys[i]),
      groupKey: groupValues ? String(groupValues[i]) : "__single__",
    });
  }

  const width = resolutionOf(xScale, scaledX) * 0.9;
  const placed = layer.position === "dodge2"
    ? dodge2Bars(
      bars.map((bar, i) => ({
        ...bar,
        width: typeof layer.params.width === "number"
          ? layer.params.width
          : undefined,
      })),
      width,
      (layer.params.padding as number) ?? 0.1,
    )
    : layer.position === "dodge"
    ? dodgeBars(bars, width)
    : stackBars(
      bars,
      width,
      layer.position === "fill"
        ? "fill"
        : layer.position === "identity"
        ? "identity"
        : "stack",
    );

  const isFillMapped = groupCol &&
    (mapping.fill === groupCol || mapping.color === groupCol);
  const fillOf = (groupKey: string) =>
    isFillMapped
      ? scaleColorValue(
        mapping.fill === groupCol ? fillScale : colorScale,
        groupKey,
      )
      : (layer.params.fill as string) ?? (layer.params.color as string) ??
        "#3b82f6";

  const positions = placed.map((bar): [number, number][] => {
    const x0 = bar.x + bar.xOffset - bar.width / 2;
    const x1 = bar.x + bar.xOffset + bar.width / 2;
    return [[x0, bar.y0], [x0, bar.y1], [x1, bar.y1], [x1, bar.y0]];
  });
  const fills = placed.map((bar) => fillOf(bar.groupKey));
  // Plot Polygon treats a nested position array as one multi-loop surface;
  // independent rectangles must remain independent faces or the triangulator
  // bridges their top edges and fills the complement between bars.
  return positions.map((position, i) =>
    node("Polygon", { positions: position, fill: fills[i] })
  );
}

/**
 * Lower a geom_tile/geom_raster layer to a single Polygon of full-resolution
 * cell rectangles, one per row, centered on (x,y) and colored by the mapped
 * fill/color. Cell size defaults to each axis's resolution (the smallest gap
 * between distinct values, or 1 level-index unit for a discrete axis) so
 * adjacent cells tile edge-to-edge with no gaps, matching ggplot2's default;
 * `params.width`/`params.height` override it.
 */
function lowerTileLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
): RenderNode[] {
  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  if (!xs || !ys) return [];

  const n = Math.min(xs.length, ys.length);
  const scaledX = xs.map((v) => scalePosition(xScale, v));
  const scaledY = ys.map((v) => scalePosition(yScale, v));
  const width = (layer.params.width as number) ?? resolutionOf(xScale, scaledX);
  const height = (layer.params.height as number) ??
    resolutionOf(yScale, scaledY);
  const productWidth = valuesOf(data, "binwidthX")?.[0];
  const productHeight = valuesOf(data, "binwidthY")?.[0];
  const cellWidth = typeof productWidth === "number" ? productWidth : width;
  const cellHeight = typeof productHeight === "number" ? productHeight : height;

  const positions: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const x = scaledX[i];
    const y = scaledY[i];
    positions.push([
      [x - cellWidth / 2, y - cellHeight / 2],
      [x - cellWidth / 2, y + cellHeight / 2],
      [x + cellWidth / 2, y + cellHeight / 2],
      [x + cellWidth / 2, y - cellHeight / 2],
    ]);
  }

  const colors = colorsOf(mapping, data, colorScale, fillScale, "fillOrColor");
  const fill = (layer.params.fill as string) ??
    (layer.params.color as string) ?? "#3b82f6";

  return colors
    ? positions.map((position, i) =>
      node("Polygon", { positions: position, fill: colors[i] })
    )
    : [node("Polygon", { positions, fill })];
}

function lowerHexLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
): RenderNode[] {
  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  if (!xs || !ys) return [];
  const width = Number(
    valuesOf(data, "binwidthX")?.[0] ?? layer.params.width ?? 1,
  );
  const height = Number(
    valuesOf(data, "binwidthY")?.[0] ?? layer.params.height ?? 1,
  );
  const positions = xs.map((value, i) => {
    const x = scalePosition(xScale, value);
    const y = scalePosition(yScale, ys[i]);
    return Array.from({ length: 6 }, (_, vertex): [number, number] => {
      const angle = Math.PI / 3 * vertex;
      return [
        x + Math.cos(angle) * width / 2,
        y + Math.sin(angle) * height / 2,
      ];
    });
  });
  const colors = colorsOf(mapping, data, colorScale, fillScale, "fillOrColor");
  return colors
    ? positions.map((position, i) =>
      node("Polygon", { positions: position, fill: colors[i] })
    )
    : [node("Polygon", {
      positions,
      fill: (layer.params.fill as string) ?? "#3b82f6",
    })];
}

function lowerPolygonLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
): RenderNode[] {
  const groups = splitByEffectiveGroup(mapping, data);
  const loops: [number, number][][] = [];
  const fills: string[] = [];

  for (const { mapping: m, data: d } of groups) {
    const positions = positionsOf(m, d, xScale, yScale);
    if (positions.length < 3) continue;
    loops.push(positions);
    const colors = colorsOf(m, d, colorScale, fillScale, "fillOrColor");
    fills.push(
      colors?.[0] ?? (layer.params.fill as string) ??
        (layer.params.color as string) ?? "#3b82f6",
    );
  }

  if (loops.length === 0) return [];
  const uniform = fills.every((f) => f === fills[0]);
  return [node("Polygon", {
    positions: loops.length === 1 ? loops[0] : loops,
    ...(uniform ? { fill: fills[0] } : { fills }),
  })];
}

/**
 * Lower a geom_errorbar layer (x, ymin, ymax) to a single Line of disjoint
 * segments: a vertical stem plus a horizontal cap at each end. `params.width`
 * sets the cap width (default: 0.9 * x resolution, ggplot2's bar-style default).
 */
function lowerErrorbarLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
): RenderNode[] {
  const xs = valuesOf(data, mapping.x);
  const ymins = valuesOf(data, mapping.ymin);
  const ymaxs = valuesOf(data, mapping.ymax);
  if (!xs || !ymins || !ymaxs) return [];

  const n = Math.min(xs.length, ymins.length, ymaxs.length);
  const scaledX = xs.map((v) => scalePosition(xScale, v));
  const width = (layer.params.width as number) ??
    resolutionOf(xScale, scaledX) * 0.9;
  const half = width / 2;

  const segments: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const x = scaledX[i];
    const yMin = scalePosition(yScale, ymins[i]);
    const yMax = scalePosition(yScale, ymaxs[i]);
    segments.push([[x - half, yMax], [x + half, yMax]]);
    segments.push([[x, yMax], [x, yMin]]);
    segments.push([[x - half, yMin], [x + half, yMin]]);
  }

  const color = (layer.params.color as string) ?? "#3b82f6";
  return [
    node("Line", {
      positions: segments,
      color,
      ...literalLineProps(layer, 2),
    }),
  ];
}

/**
 * Lower a geom_boxplot layer (x, lower, middle, upper, ymin, ymax) to a box
 * Polygon (lower..upper) plus a Line of disjoint segments for the median and
 * the two whiskers (each with a half-width cap). `params.width` sets the box
 * width (default: 0.75 * x resolution, ggplot2's default).
 */
function lowerBoxplotLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
): RenderNode[] {
  const xs = valuesOf(data, mapping.x);
  const lowers = valuesOf(data, mapping.lower);
  const middles = valuesOf(data, mapping.middle);
  const uppers = valuesOf(data, mapping.upper);
  const ymins = valuesOf(data, mapping.ymin);
  const ymaxs = valuesOf(data, mapping.ymax);
  if (!xs || !lowers || !middles || !uppers || !ymins || !ymaxs) return [];

  const n = Math.min(
    xs.length,
    lowers.length,
    middles.length,
    uppers.length,
    ymins.length,
    ymaxs.length,
  );
  const scaledX = xs.map((v) => scalePosition(xScale, v));
  const width = (layer.params.width as number) ??
    resolutionOf(xScale, scaledX) * 0.75;
  const half = width / 2;
  const capHalf = half / 2;

  const boxes: [number, number][][] = [];
  const segments: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const x = scaledX[i];
    const lo = scalePosition(yScale, lowers[i]);
    const mid = scalePosition(yScale, middles[i]);
    const up = scalePosition(yScale, uppers[i]);
    const yMin = scalePosition(yScale, ymins[i]);
    const yMax = scalePosition(yScale, ymaxs[i]);

    boxes.push([[x - half, lo], [x - half, up], [x + half, up], [
      x + half,
      lo,
    ]]);
    segments.push([[x - half, mid], [x + half, mid]]);
    segments.push([[x, up], [x, yMax]]);
    segments.push([[x - capHalf, yMax], [x + capHalf, yMax]]);
    segments.push([[x, lo], [x, yMin]]);
    segments.push([[x - capHalf, yMin], [x + capHalf, yMin]]);
  }

  const colors = colorsOf(mapping, data, colorScale, fillScale, "fillOrColor");
  const fill = (layer.params.fill as string) ?? "#3b82f6";
  const strokeColor = (layer.params.color as string) ?? "#1a1a1a";
  const strokeWidth = (layer.params.strokeWidth as number) ?? 2;

  return [
    node("Polygon", {
      positions: boxes,
      ...(colors ? { fills: colors } : { fill }),
    }),
    node("Line", {
      positions: segments,
      color: strokeColor,
      width: strokeWidth,
    }),
  ];
}

/** Lower a dense y-density product to one mirrored polygon per group. */
function lowerViolinLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
): RenderNode[] {
  const polygons: RenderNode[] = [];
  for (
    const { mapping: groupedMapping, data: groupedData }
      of splitByEffectiveGroup(mapping, data)
  ) {
    const xs = valuesOf(groupedData, groupedMapping.x);
    const ys = valuesOf(groupedData, groupedMapping.y);
    const densities = valuesOf(groupedData, groupedMapping.density);
    if (!xs?.length || !ys?.length || !densities?.length) continue;
    const center = scalePosition(xScale, xs[0]);
    const numericDensity = densities.map(Number);
    const max = Math.max(...numericDensity, Number.EPSILON);
    const halfWidth = ((layer.params.width as number) ?? 0.9) / 2;
    const right = ys.map((
      value,
      i,
    ): [number, number] => [
      center + numericDensity[i] / max * halfWidth,
      scalePosition(yScale, value),
    ]);
    const left = ys.map((
      value,
      i,
    ): [number, number] => [
      center - numericDensity[i] / max * halfWidth,
      scalePosition(yScale, value),
    ]).reverse();
    const colors = colorsOf(
      groupedMapping,
      groupedData,
      colorScale,
      fillScale,
      "fillOrColor",
    );
    polygons.push(node("Polygon", {
      positions: [...right, ...left],
      fill: colors?.[0] ?? (layer.params.fill as string) ?? "#3b82f6",
    }));
  }
  return polygons;
}

/**
 * Lower a geom_text/geom_label layer to a single Label of per-point text.
 * geom_label's background box isn't rendered (sizing it needs real text
 * metrics from the font pipeline) — both currently render identically.
 * Falls back to the theme's fontFamily/fontSize/textColor when the layer
 * doesn't set its own size/color/family param.
 */
function lowerTextLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
  theme: Theme = {},
): RenderNode[] {
  const positions = positionsOf(mapping, data, xScale, yScale);
  if (positions.length === 0) return [];

  const labelCol = mapping.label;
  if (!labelCol || !(labelCol in data)) return [];
  const labels = columnValues(data, labelCol).map((v) => String(v));

  const colors = colorsOf(mapping, data, colorScale, fillScale, "colorOrFill");
  const color = (layer.params.color as string) ?? theme.textColor ?? "#0b0b0b";
  const size = (layer.params.size as number) ?? theme.fontSize ?? 14;
  const family = (layer.params.family as string) ?? theme.fontFamily;
  const angle = (layer.params.angle as number) ?? 0;

  return [node("Label", {
    positions,
    labels,
    ...(colors ? { colors } : { color }),
    size,
    ...(angle ? { angle } : {}),
    zBias: 2,
    ...(family ? { family } : {}),
  })];
}

/**
 * Lower an annotate("segment", ...)/geom_segment layer (x, y, xend, yend) to a
 * single Line of disjoint segments, one per row.
 */
function lowerSegmentLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
): RenderNode[] {
  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  const xends = valuesOf(data, mapping.xend);
  const yends = valuesOf(data, mapping.yend);
  if (!xs || !ys || !xends || !yends) return [];

  const n = Math.min(xs.length, ys.length, xends.length, yends.length);
  const segments: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    segments.push([
      [scalePosition(xScale, xs[i]), scalePosition(yScale, ys[i])],
      [scalePosition(xScale, xends[i]), scalePosition(yScale, yends[i])],
    ]);
  }

  const color = (layer.params.color as string) ?? "#3b82f6";
  return [
    node("Line", {
      positions: segments,
      color,
      width: (layer.params.strokeWidth as number) ?? 2,
    }),
  ];
}

/**
 * Lower an annotate("rect", ...)/geom_rect layer (xmin, xmax, ymin, ymax) to a
 * single Polygon of rectangle loops, one per row.
 */
function lowerRectLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
): RenderNode[] {
  const xmins = valuesOf(data, mapping.xmin);
  const xmaxs = valuesOf(data, mapping.xmax);
  const ymins = valuesOf(data, mapping.ymin);
  const ymaxs = valuesOf(data, mapping.ymax);
  if (!xmins || !xmaxs || !ymins || !ymaxs) return [];

  const n = Math.min(xmins.length, xmaxs.length, ymins.length, ymaxs.length);
  const positions: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const x0 = scalePosition(xScale, xmins[i]);
    const x1 = scalePosition(xScale, xmaxs[i]);
    const y0 = scalePosition(yScale, ymins[i]);
    const y1 = scalePosition(yScale, ymaxs[i]);
    positions.push([[x0, y0], [x0, y1], [x1, y1], [x1, y0]]);
  }

  const colors = colorsOf(mapping, data, colorScale, fillScale, "fillOrColor");
  const fill = (layer.params.fill as string) ??
    (layer.params.color as string) ?? "#3b82f6";
  return [
    node("Polygon", { positions, ...(colors ? { fills: colors } : { fill }) }),
  ];
}

/** Lower a geom_hline layer (one or more literal yintercepts) to full-width Line segments spanning the panel's x domain. */
function lowerHlineLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  yScale: TrainedScale | undefined,
  xDomain: [number, number],
): RenderNode[] {
  const ys = valuesOf(data, mapping.y);
  if (!ys) return [];

  const segments = ys.map((v): [number, number][] => {
    const y = scalePosition(yScale, v);
    return [[xDomain[0], y], [xDomain[1], y]];
  });
  const color = (layer.params.color as string) ?? "#000000";
  return [
    node("Line", { positions: segments, color, ...literalLineProps(layer, 1) }),
  ];
}

/** Lower a geom_vline layer (one or more literal xintercepts) to full-height Line segments spanning the panel's y domain. */
function lowerVlineLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yDomain: [number, number],
): RenderNode[] {
  const xs = valuesOf(data, mapping.x);
  if (!xs) return [];

  const segments = xs.map((v): [number, number][] => {
    const x = scalePosition(xScale, v);
    return [[x, yDomain[0]], [x, yDomain[1]]];
  });
  const color = (layer.params.color as string) ?? "#000000";
  return [
    node("Line", { positions: segments, color, ...literalLineProps(layer, 1) }),
  ];
}

/** Lower a geom_abline layer (literal slope/intercept, default 1/0) to a single Line spanning the panel's x domain. */
function lowerAblineLayer(
  layer: Layer,
  xDomain: [number, number],
): RenderNode[] {
  const slope = (layer.params.slope as number) ?? 1;
  const intercept = (layer.params.intercept as number) ?? 0;
  const [x0, x1] = xDomain;
  const positions: [number, number][] = [[x0, slope * x0 + intercept], [
    x1,
    slope * x1 + intercept,
  ]];
  const color = (layer.params.color as string) ?? "#000000";
  return [node("Line", { positions, color, ...literalLineProps(layer, 1) })];
}

/** Map one geom layer to its RenderNode(s) — one per group for connected geoms. */
function lowerLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
  sizeScale: TrainedScale | undefined,
  alphaScale: TrainedScale | undefined,
  shapeScale: TrainedScale | undefined,
  linetypeScale: TrainedScale | undefined,
  linewidthScale: TrainedScale | undefined,
  strokeScale: TrainedScale | undefined,
  theme: Theme,
  xDomain: [number, number],
  yDomain: [number, number],
): RenderNode[] {
  const opacity = layer.params.alpha as number | undefined;

  if (layer.geom === "segment") {
    return lowerSegmentLayer(layer, mapping, data, xScale, yScale);
  }

  if (layer.geom === "rect") {
    return lowerRectLayer(
      layer,
      mapping,
      data,
      xScale,
      yScale,
      colorScale,
      fillScale,
    );
  }

  if (layer.geom === "hline") {
    return lowerHlineLayer(layer, mapping, data, yScale, xDomain);
  }

  if (layer.geom === "vline") {
    return lowerVlineLayer(layer, mapping, data, xScale, yDomain);
  }

  if (layer.geom === "abline") {
    return lowerAblineLayer(layer, xDomain);
  }

  if (layer.geom === "area" || layer.geom === "ribbon") {
    const fill = (layer.params.fill as string) ??
      (layer.params.color as string) ?? "#3b82f6";
    return splitByEffectiveGroup(mapping, data)
      .map(({ mapping: m, data: d }) => {
        const positions = bandPositions(m, d, xScale, yScale);
        const colors = colorsOf(m, d, colorScale, fillScale, "fillOrColor");
        return positions.length
          ? node("Polygon", { positions, fill: colors?.[0] ?? fill })
          : null;
      })
      .filter((n): n is RenderNode => n !== null);
  }

  if (layer.geom === "bar" || layer.geom === "col") {
    return lowerBarLayer(
      layer,
      mapping,
      data,
      xScale,
      yScale,
      colorScale,
      fillScale,
    );
  }

  if (layer.geom === "tile") {
    return lowerTileLayer(
      layer,
      mapping,
      data,
      xScale,
      yScale,
      colorScale,
      fillScale,
    );
  }

  if (layer.geom === "hex") {
    return lowerHexLayer(
      layer,
      mapping,
      data,
      xScale,
      yScale,
      colorScale,
      fillScale,
    );
  }

  if (layer.geom === "polygon") {
    return lowerPolygonLayer(
      layer,
      mapping,
      data,
      xScale,
      yScale,
      colorScale,
      fillScale,
    );
  }

  if (layer.geom === "errorbar") {
    return lowerErrorbarLayer(layer, mapping, data, xScale, yScale);
  }

  if (layer.geom === "boxplot") {
    return lowerBoxplotLayer(
      layer,
      mapping,
      data,
      xScale,
      yScale,
      colorScale,
      fillScale,
    );
  }

  if (layer.geom === "violin") {
    return lowerViolinLayer(
      layer,
      mapping,
      data,
      xScale,
      yScale,
      colorScale,
      fillScale,
    );
  }

  if (layer.geom === "text") {
    return lowerTextLayer(
      layer,
      mapping,
      data,
      xScale,
      yScale,
      colorScale,
      fillScale,
      theme,
    );
  }

  if (layer.geom === "point" || layer.geom === "dotplot") {
    let positions = positionsOf(mapping, data, xScale, yScale);
    if (positions.length === 0) return [];
    if (layer.position === "jitter") {
      const xAmount = (layer.params.width as number) ??
        resolutionOf(xScale, positions.map((p) => p[0])) * 0.4;
      const yAmount = (layer.params.height as number) ?? 0.4;
      positions = positions.map((
        [x, y],
      ) => [jitter(x, xAmount), jitter(y, yAmount)]);
    } else if (layer.position === "nudge") {
      positions = nudge(
        positions,
        (layer.params.x as number) ?? (layer.params.nudgeX as number) ?? 0,
        (layer.params.y as number) ?? (layer.params.nudgeY as number) ?? 0,
      );
    } else if (layer.position === "jitterdodge") {
      const groupValues = valuesOf(
        data,
        mapping.group ?? mapping.color ?? mapping.fill ?? mapping.shape,
      );
      const groups = [...new Set((groupValues ?? []).map(String))].sort();
      const dodgeWidth = (layer.params.dodgeWidth as number) ?? 0.75;
      const jitterWidth = (layer.params.jitterWidth as number) ?? 0.1;
      const jitterHeight = (layer.params.jitterHeight as number) ?? 0;
      positions = positions.map(([x, y], i) => {
        const slot = Math.max(0, groups.indexOf(String(groupValues?.[i])));
        const offset = groups.length > 1
          ? (slot - (groups.length - 1) / 2) * dodgeWidth / groups.length
          : 0;
        return [jitter(x + offset, jitterWidth), jitter(y, jitterHeight)];
      });
    }
    const colors = colorsOf(
      mapping,
      data,
      colorScale,
      fillScale,
      "colorOrFill",
    );
    const color = (layer.params.color as string) ?? "#3b82f6";
    const sizes = sizesOf(mapping, data, sizeScale);
    const strokes = strokesOf(mapping, data, strokeScale);
    const alphas = alphasOf(mapping, data, alphaScale);
    const rgbaColors = alphas
      ? positions.map((_, i) => colorWithAlpha(colors?.[i] ?? color, alphas[i]))
      : undefined;
    const shapes = shapesOf(mapping, data, shapeScale);

    if (shapes) {
      const byShape = new Map<string, number[]>();
      shapes.forEach((shape, i) => {
        if (!byShape.has(shape)) byShape.set(shape, []);
        byShape.get(shape)!.push(i);
      });
      return [...byShape.entries()].map(([shape, indices]) =>
        node("Point", {
          positions: indices.map((i) => positions[i]),
          ...(rgbaColors
            ? { colors: indices.map((i) => rgbaColors[i]) }
            : colors
            ? { colors: indices.map((i) => colors[i]) }
            : { color }),
          ...(sizes
            ? { sizes: indices.map((i) => sizes[i]) }
            : { size: (layer.params.size as number) ?? 5 }),
          shape,
          ...(opacity != null ? { opacity } : {}),
        })
      );
    }

    const literalStroke = typeof layer.params.stroke === "number"
      ? layer.params.stroke
      : undefined;
    if (strokes || literalStroke != null) {
      const baseSizes = sizes ??
        positions.map(() => (layer.params.size as number) ?? 5);
      const widths = strokes ?? positions.map(() => literalStroke ?? 0);
      const outerColor = (layer.params.strokeColor as string) ??
        (layer.params.color as string) ?? "#1a1a1a";
      const innerColor = (layer.params.fill as string) ?? color;
      return [
        node("Point", {
          positions,
          sizes: baseSizes.map((size, i) => size + 2 * widths[i]),
          color: outerColor,
          execution: "cpu-outline-fallback",
        }),
        node("Point", {
          positions,
          ...(rgbaColors
            ? { colors: rgbaColors }
            : colors
            ? { colors }
            : { color: innerColor }),
          sizes: baseSizes,
          execution: "cpu-outline-fallback",
          ...(opacity != null ? { opacity } : {}),
        }),
      ];
    }

    return [node("Point", {
      positions,
      ...(rgbaColors
        ? { colors: rgbaColors }
        : colors
        ? { colors }
        : { color }),
      ...(sizes ? { sizes } : {
        size: (layer.params.size as number) ??
          (layer.geom === "dotplot" ? 4 : 5),
      }),
      ...(opacity != null ? { opacity } : {}),
    })];
  }

  if (layer.geom === "smooth") {
    const nodes: RenderNode[] = [];
    for (
      const { mapping: m, data: d } of splitByEffectiveGroup(mapping, data)
    ) {
      const colors = colorsOf(m, d, colorScale, fillScale, "colorOrFill");
      if (m.ymin && m.ymax) {
        const bandPos = bandPositions(m, d, xScale, yScale);
        if (bandPos.length) {
          const ribbonFill = (layer.params.fill as string) ?? "#c7d2fe";
          nodes.push(node("Polygon", { positions: bandPos, fill: ribbonFill }));
        }
      }
      const positions = positionsOf(m, d, xScale, yScale);
      if (positions.length) {
        const color = (layer.params.color as string) ?? colors?.[0] ??
          "#3b82f6";
        nodes.push(
          node("Line", {
            positions,
            color,
            ...literalLineProps(layer, 2),
          }),
        );
      }
    }
    return nodes;
  }

  if (layer.geom === "line" || layer.geom === "path") {
    const color = (layer.params.color as string) ?? "#3b82f6";
    return splitByEffectiveGroup(mapping, data)
      .map(({ mapping: m, data: d }) => {
        const ordered = layer.geom === "line" ? sortByX(m, d) : d;
        const positions = positionsOf(m, ordered, xScale, yScale);
        if (positions.length === 0) return null;
        const colors = colorsOf(
          m,
          ordered,
          colorScale,
          fillScale,
          "colorOrFill",
        );
        const widths = linewidthsOf(m, ordered, linewidthScale);
        const dash = dashOf(layer, m, ordered, linetypeScale);
        return node("Line", {
          positions,
          ...(colors ? { colors } : { color }),
          ...(widths ? { widths } : literalLineProps(layer, 2)),
          ...(dash ? { dash } : {}),
          ...(opacity != null ? { opacity } : {}),
        });
      })
      .filter((n): n is RenderNode => n !== null);
  }

  console.warn(`[gggplot] geom "${layer.geom}" not implemented yet`);
  return [];
}

/**
 * The true y-extent of a stacked/filled bar layer is the summed height per x,
 * not any single row's y — widen [lo,hi] to cover it (uncapped for "stack",
 * fixed to [0,1] for "fill"). Dodge/identity bars don't sum, so are skipped.
 */
function widenForStackedBars(
  [lo, hi]: [number, number],
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
): [number, number] {
  if (layer.geom !== "bar" && layer.geom !== "col") return [lo, hi];
  if (layer.position === "dodge" || layer.position === "identity") {
    return [Math.min(lo, 0), hi];
  }

  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  if (!xs || !ys) return [lo, hi];

  // Filled bars are always normalized to [0,1]; the raw (pre-normalization)
  // y domain doesn't describe the rendered positions at all.
  if (layer.position === "fill") return [0, 1];

  const totals = new Map<number, number>();
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    const xPos = scalePosition(xScale, xs[i]);
    const y = scalePosition(yScale, ys[i]);
    totals.set(xPos, (totals.get(xPos) ?? 0) + y);
  }
  const maxTotal = Math.max(0, ...totals.values());
  return [Math.min(lo, 0), Math.max(hi, maxTotal)];
}

/**
 * geom_tile cells extend half a cell beyond their center point on each axis —
 * widen [lo,hi] so edge cells aren't clipped by the trained (point-based) domain.
 */
function widenForTileAxis(
  [lo, hi]: [number, number],
  centers: number[],
  cellSize: number,
): [number, number] {
  if (centers.length === 0) return [lo, hi];
  const half = cellSize / 2;
  return [
    Math.min(lo, Math.min(...centers) - half),
    Math.max(hi, Math.max(...centers) + half),
  ];
}

/** Numeric view range for a trained scale: level-index span for discrete, domain as-is otherwise. */
function numericRange(
  scale: TrainedScale | undefined,
): [number, number] | undefined {
  if (!scale) return undefined;
  if (scale.kind === "discrete") {
    const levels = scale.domain as string[];
    const span: [number, number] = [0, Math.max(levels.length - 1, 0)];
    return scale.expand ? expandRange(span, scale.expand) : span;
  }
  return scale.domain as [number, number];
}

function isPoint(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length >= 2 && typeof v[0] === "number" &&
    typeof v[1] === "number";
}

function munchLoop(loop: [number, number][], detail = 16): [number, number][] {
  if (loop.length < 2) return loop;
  const out: [number, number][] = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    for (let step = 0; step < detail; step++) {
      const t = step / detail;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function munchPolygonNode(n: RenderNode): RenderNode {
  if (n.component !== "Polygon") return n;
  const positions = n.props.positions;
  if (!Array.isArray(positions) || positions.length === 0) return n;

  const munched = isPoint(positions[0])
    ? munchLoop(positions as [number, number][])
    : (positions as [number, number][][]).map((loop) => munchLoop(loop));

  return node(n.component, { ...n.props, positions: munched }, n.children);
}

function mapPositionValue(
  value: unknown,
  axis: 0 | 1,
  map: (value: number) => number,
): unknown {
  if (!Array.isArray(value)) return value;
  if (
    value.length >= 2 && typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    const point = [...value] as number[];
    point[axis] = map(point[axis]);
    return point;
  }
  return value.map((entry) => mapPositionValue(entry, axis, map));
}

/** Convert the selected theta scale from trained data units into radians. */
function polarizeNode(
  n: RenderNode,
  axis: 0 | 1,
  domain: [number, number],
  start: number,
  end: number,
): RenderNode {
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  const map = (value: number) => start + (value - lo) / span * (end - start);
  const props = "positions" in n.props
    ? { ...n.props, positions: mapPositionValue(n.props.positions, axis, map) }
    : n.props;
  return node(
    n.component,
    props,
    n.children.map((child) => polarizeNode(child, axis, domain, start, end)),
  );
}

function linspace([lo, hi]: [number, number], n: number): number[] {
  if (n <= 1) return [lo];
  return Array.from({ length: n }, (_, i) => lo + (hi - lo) * (i / (n - 1)));
}

function polarGridLines(
  xDomain: [number, number],
  yDomain: [number, number],
  theme: Theme,
): RenderNode {
  const ringYs = linspace(yDomain, 5).slice(1);
  const spokeXs = linspace(xDomain, 12);
  const ringXs = linspace(xDomain, 96);
  const radialYs = linspace(yDomain, 32);
  const positions = [
    ...ringYs.map((y) => ringXs.map((x): [number, number] => [x, y])),
    ...spokeXs.map((x) => radialYs.map((y): [number, number] => [x, y])),
  ];
  return node("Line", {
    positions,
    width: theme.gridWidth ?? 1,
    zBias: -1,
    ...(theme.gridColor ? { color: theme.gridColor } : {}),
  });
}

function labelFor(labels: PlotLabels, key: string, fallback: string): string {
  return labels[key] ?? fallback;
}

function legendTitle(
  scale: TrainedScale,
  labels: PlotLabels,
  fallback: string,
): string {
  return labels[scale.aes] ?? scale.name ?? fallback;
}

function labelNode(
  x: number,
  y: number,
  labels: string[],
  theme: Theme,
  size?: number,
  angle = 0,
): RenderNode {
  return node("Label", {
    positions: labels.map((_, i): [number, number] => [x, y + i * 0.11]),
    labels,
    color: theme.textColor ?? "#0b0b0b",
    size: size ?? theme.fontSize ?? 13,
    zBias: 2,
    ...(angle ? { angle } : {}),
    ...(theme.fontFamily ? { family: theme.fontFamily } : {}),
  });
}

function legendNodes(
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
  sizeScale: TrainedScale | undefined,
  alphaScale: TrainedScale | undefined,
  shapeScale: TrainedScale | undefined,
  linetypeScale: TrainedScale | undefined,
  linewidthScale: TrainedScale | undefined,
  labels: PlotLabels,
  theme: Theme,
  panelBounds: [number, number, number, number],
): RenderNode[] {
  const nodes: RenderNode[] = [];
  let y = -0.76;
  const guideLeft = panelBounds[2];
  const guideWidth = 1 - guideLeft;
  const titleX = guideLeft + guideWidth * 0.16;
  const swatchX = guideLeft + guideWidth * 0.22;
  const labelX = guideLeft + guideWidth * 0.42;

  if (
    colorScale && Array.isArray(colorScale.domain) &&
    typeof colorScale.domain[0] === "string"
  ) {
    const levels = colorScale.domain as string[];
    nodes.push(
      labelNode(
        titleX,
        y,
        [legendTitle(colorScale, labels, "color")],
        theme,
        14,
      ),
    );
    y += 0.14;
    nodes.push(node("Point", {
      positions: levels.map((
        _,
        i,
      ): [number, number] => [swatchX, y + i * 0.11]),
      colors: levels.map((level) => scaleColorValue(colorScale, level)),
      size: 7,
    }));
    nodes.push(labelNode(labelX, y, levels, theme));
    y += levels.length * 0.11 + 0.12;
  }

  if (
    fillScale && Array.isArray(fillScale.domain) &&
    typeof fillScale.domain[0] === "string"
  ) {
    const levels = fillScale.domain as string[];
    nodes.push(
      labelNode(titleX, y, [legendTitle(fillScale, labels, "fill")], theme, 14),
    );
    y += 0.14;
    nodes.push(node("Point", {
      positions: levels.map((
        _,
        i,
      ): [number, number] => [swatchX, y + i * 0.11]),
      colors: levels.map((level) => scaleColorValue(fillScale, level)),
      size: 7,
    }));
    nodes.push(labelNode(labelX, y, levels, theme));
    y += levels.length * 0.11 + 0.12;
  }

  const continuousColorGuide = (
    scale: TrainedScale | undefined,
    fallback: "color" | "fill",
  ) => {
    if (
      !scale || typeof scale.domain[0] !== "number" ||
      scale.guide?.kind === "none"
    ) return;
    const guideKind = scale.guide?.kind ?? "colorbar";
    const count = guideKind === "colorbar"
      ? 24
      : Math.max(2, scale.guide?.bins ?? 6);
    const [lo, hi] = scale.domain as [number, number];
    nodes.push(
      labelNode(
        titleX,
        y,
        [scale.guide?.title ?? legendTitle(scale, labels, fallback)],
        theme,
        14,
      ),
    );
    y += 0.14;
    const height = 0.28 / count;
    const positions = Array.from(
      { length: count },
      (_, i): [number, number][] => {
        const top = y + i * height;
        return [[swatchX - 0.025, top], [swatchX - 0.025, top + height], [
          swatchX + 0.025,
          top + height,
        ], [swatchX + 0.025, top]];
      },
    );
    const values = Array.from(
      { length: count },
      (_, i) => lo + (hi - lo) * (i + 0.5) / count,
    );
    nodes.push(...positions.map((position, i) =>
      node("Polygon", {
        positions: position,
        fill: scaleColorValue(scale, values[i]),
        guideKind,
      })
    ));
    nodes.push(
      labelNode(labelX, y, [
        String(Number(hi.toFixed(2))),
        String(Number(lo.toFixed(2))),
      ], theme),
    );
    y += 0.36;
  };

  continuousColorGuide(colorScale, "color");
  continuousColorGuide(fillScale, "fill");

  if (sizeScale && !Array.isArray(sizeScale.domain[0])) {
    const [lo, hi] = sizeScale.domain as [number, number];
    const values = hi > lo ? [lo, (lo + hi) / 2, hi] : [lo];
    nodes.push(
      labelNode(titleX, y, [legendTitle(sizeScale, labels, "size")], theme, 14),
    );
    y += 0.14;
    nodes.push(node("Point", {
      positions: values.map((
        _,
        i,
      ): [number, number] => [swatchX, y + i * 0.11]),
      sizes: values.map((v) => scaleSizeValue(sizeScale, v)),
      color: "#3b82f6",
    }));
    nodes.push(
      labelNode(
        labelX,
        y,
        values.map((v) =>
          String(Number.isInteger(v) ? v : Number(v.toFixed(2)))
        ),
        theme,
      ),
    );
    y += values.length * 0.11 + 0.12;
  }

  // Alpha is a mapped continuous aesthetic, so it receives the same compact
  // representative-value guide as size/linewidth. Literal layer opacity is
  // intentionally absent because it does not train a scale.
  if (alphaScale && !Array.isArray(alphaScale.domain[0])) {
    const [lo, hi] = alphaScale.domain as [number, number];
    const values = hi > lo ? [lo, (lo + hi) / 2, hi] : [lo];
    nodes.push(
      labelNode(
        titleX,
        y,
        [legendTitle(alphaScale, labels, "alpha")],
        theme,
        14,
      ),
    );
    y += 0.14;
    nodes.push(node("Point", {
      positions: values.map((
        _,
        i,
      ): [number, number] => [swatchX, y + i * 0.11]),
      size: 7,
      colors: values.map((value) => {
        const [rangeLo, rangeHi] = alphaScale.range as [number, number];
        const alpha = hi === lo
          ? rangeHi
          : rangeLo + (rangeHi - rangeLo) * ((value - lo) / (hi - lo));
        return colorWithAlpha("#3b82f6", alpha);
      }),
    }));
    nodes.push(
      labelNode(
        labelX,
        y,
        values.map((v) => String(Number(v.toFixed(2)))),
        theme,
      ),
    );
    y += values.length * 0.11 + 0.12;
  }

  if (
    shapeScale && Array.isArray(shapeScale.domain) &&
    typeof shapeScale.domain[0] === "string"
  ) {
    const levels = shapeScale.domain as string[];
    nodes.push(
      labelNode(
        titleX,
        y,
        [legendTitle(shapeScale, labels, "shape")],
        theme,
        14,
      ),
    );
    y += 0.14;
    levels.forEach((level, i) => {
      nodes.push(node("Point", {
        positions: [[swatchX, y + i * 0.11]],
        shape: scaleShapeValue(shapeScale, level),
        color: "#3b82f6",
        size: 7,
      }));
    });
    nodes.push(labelNode(labelX, y, levels, theme));
    y += levels.length * 0.11 + 0.12;
  }

  if (
    linetypeScale && Array.isArray(linetypeScale.domain) &&
    typeof linetypeScale.domain[0] === "string"
  ) {
    const levels = linetypeScale.domain as string[];
    nodes.push(
      labelNode(
        titleX,
        y,
        [legendTitle(linetypeScale, labels, "linetype")],
        theme,
        14,
      ),
    );
    y += 0.14;
    levels.forEach((level, i) => {
      const dash = scaleLinetypeValue(linetypeScale, level);
      nodes.push(node("Line", {
        positions: [[swatchX - 0.025, y + i * 0.11], [
          swatchX + 0.025,
          y + i * 0.11,
        ]],
        color: "#3b82f6",
        width: 2,
        ...(dash ? { dash } : {}),
      }));
    });
    nodes.push(labelNode(labelX, y, levels, theme));
    y += levels.length * 0.11 + 0.12;
  }

  if (linewidthScale && !Array.isArray(linewidthScale.domain[0])) {
    const [lo, hi] = linewidthScale.domain as [number, number];
    const values = hi > lo ? [lo, (lo + hi) / 2, hi] : [lo];
    nodes.push(
      labelNode(
        titleX,
        y,
        [legendTitle(linewidthScale, labels, "linewidth")],
        theme,
        14,
      ),
    );
    y += 0.14;
    values.forEach((value, i) => {
      nodes.push(node("Line", {
        positions: [[swatchX - 0.025, y + i * 0.11], [
          swatchX + 0.025,
          y + i * 0.11,
        ]],
        color: "#3b82f6",
        width: scaleLinewidthValue(linewidthScale, value),
      }));
    });
    nodes.push(
      labelNode(
        labelX,
        y,
        values.map((v) =>
          String(Number.isInteger(v) ? v : Number(v.toFixed(2)))
        ),
        theme,
      ),
    );
  }

  return nodes;
}

/** Root-overlay title-family text; axis labels stage with their view guides. */
function plotLabelNodes(labels: PlotLabels, theme: Theme): RenderNode[] {
  const nodes: RenderNode[] = [];
  if (labels.title) {
    nodes.push(
      labelNode(-0.92, 0.92, [labels.title], theme, (theme.fontSize ?? 14) + 4),
    );
  }
  if (labels.subtitle) {
    nodes.push(
      labelNode(-0.92, 0.84, [labels.subtitle], theme, theme.fontSize ?? 14),
    );
  }
  if (labels.caption) {
    nodes.push(
      labelNode(
        -0.92,
        -0.92,
        [labels.caption],
        theme,
        Math.max((theme.fontSize ?? 13) - 1, 8),
      ),
    );
  }
  if (labels.tag) {
    nodes.push(
      labelNode(0.92, 0.92, [labels.tag], theme, theme.fontSize ?? 14),
    );
  }
  return nodes;
}

const DEFAULT_PANEL_BOUNDS: [number, number, number, number] = [
  -0.72,
  -0.66,
  0.92,
  0.68,
];

function axisTickValues(
  scale: TrainedScale | undefined,
  count = 5,
): unknown[] {
  if (!scale) return [];
  if (scale.kind === "discrete") return scale.domain as string[];
  const [lo, hi] = scale.domain as [number, number];
  if (lo === hi) return [lo];
  return linspace([lo, hi], count);
}

export interface TextExtent {
  width: number;
  height: number;
}

export type TextMeasurer = (
  text: string,
  size: number,
  family?: string,
) => TextExtent;

function guideLayout(
  width: number | undefined,
  height: number | undefined,
  measure: TextMeasurer | undefined,
  theme: Theme,
  labels: PlotLabels,
  mapping: Aes,
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  legendScales: (TrainedScale | undefined)[],
): { bounds: [number, number, number, number]; tickCount: number } {
  const legendLabels = legendScales.flatMap((scale) => {
    if (!scale || scale.guide?.kind === "none") return [];
    const domain = scale.domain;
    return [scale.name ?? scale.aes, ...domain.map(String)];
  });
  if (!width || !height || !measure) {
    return {
      bounds: legendLabels.length
        ? [
          DEFAULT_PANEL_BOUNDS[0],
          DEFAULT_PANEL_BOUNDS[1],
          0.58,
          DEFAULT_PANEL_BOUNDS[3],
        ]
        : DEFAULT_PANEL_BOUNDS,
      tickCount: 5,
    };
  }
  const tickSize = Math.max((theme.fontSize ?? 13) - 2, 8);
  const titleSize = theme.fontSize ?? 13;
  const tickCount = Math.max(2, Math.min(8, Math.floor(width / 90)));
  const rotated = (extent: TextExtent, angle: number): TextExtent => {
    const radians = angle * Math.PI / 180;
    return {
      width: Math.abs(extent.width * Math.cos(radians)) +
        Math.abs(extent.height * Math.sin(radians)),
      height: Math.abs(extent.width * Math.sin(radians)) +
        Math.abs(extent.height * Math.cos(radians)),
    };
  };
  const yLabels = axisTickValues(yScale, tickCount).map(tickLabel);
  const yTickWidth = Math.max(
    0,
    ...yLabels.map((label) =>
      rotated(
        measure(label, tickSize, theme.fontFamily),
        theme.axisTextYAngle ?? 0,
      ).width
    ),
  );
  const xTickHeight = Math.max(
    tickSize,
    ...axisTickValues(xScale, tickCount).map((value) =>
      rotated(
        measure(tickLabel(value), tickSize, theme.fontFamily),
        theme.axisTextXAngle ?? 0,
      ).height
    ),
  );
  const xTitle = labelFor(labels, "x", mapping.x ?? "x");
  const yTitle = labelFor(labels, "y", mapping.y ?? "y");
  const xTitleHeight = xTitle
    ? measure(xTitle, titleSize, theme.fontFamily).height
    : 0;
  const yTitleBand = yTitle
    ? rotated(
      measure(yTitle, titleSize, theme.fontFamily),
      theme.axisTitleYAngle ?? 0,
    ).width
    : 0;
  const topPx = labels.title || labels.subtitle ? 56 : 16;
  const leftPx = 14 + yTickWidth + yTitleBand;
  const bottomPx = 18 + xTickHeight + xTitleHeight;
  const legendWidth = Math.max(
    0,
    ...legendLabels.map((label) =>
      measure(label, titleSize, theme.fontFamily).width
    ),
  );
  const rightPx = legendLabels.length ? 44 + legendWidth : 16;
  return {
    bounds: [
      -1 + 2 * leftPx / width,
      -1 + 2 * topPx / height,
      1 - 2 * rightPx / width,
      1 - 2 * bottomPx / height,
    ],
    tickCount,
  };
}

function axisTickPosition(
  scale: TrainedScale | undefined,
  value: unknown,
  lo: number,
  hi: number,
): number {
  if (!scale) return (lo + hi) / 2;
  if (scale.kind === "discrete") {
    const levels = scale.domain as string[];
    const index = levels.indexOf(String(value));
    return levels.length <= 1
      ? (lo + hi) / 2
      : lo + index / (levels.length - 1) * (hi - lo);
  }
  const [domainLo, domainHi] = scale.domain as [number, number];
  return domainHi === domainLo
    ? (lo + hi) / 2
    : lo + (Number(value) - domainLo) / (domainHi - domainLo) * (hi - lo);
}

const tickLabel = (value: unknown): string =>
  typeof value === "number"
    ? String(Number(value.toPrecision(4)))
    : String(value);

/** Axis titles and ticks occupy the margins around the inset Cartesian panel. */
function axisGuideOverlay(
  labels: PlotLabels,
  mapping: Aes,
  theme: Theme,
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  project: [PositionAxis, PositionAxis],
  panelBounds: [number, number, number, number],
  tickCount: number,
): RenderNode {
  const [left, bottom, right, top] = panelBounds;
  const horizontal = project[0];
  const vertical = project[1];
  const horizontalScale = horizontal === "x" ? xScale : yScale;
  const verticalScale = vertical === "y" ? yScale : xScale;
  const horizontalValues = axisTickValues(horizontalScale, tickCount);
  const verticalValues = axisTickValues(verticalScale, tickCount);
  const color = theme.textColor ?? "#0b0b0b";
  const family = theme.fontFamily ? { family: theme.fontFamily } : {};
  // The chart already has one outer Embedded/Plot reconciler. Keep the guide
  // labels as a transparent sibling group; nesting Embedded here creates a
  // second virtual-layer/font layout and silently drops its glyph bindings.
  return node("FacetPanel", {}, [
    node("Label", {
      positions: horizontalValues.map((value): [number, number] => [
        axisTickPosition(horizontalScale, value, left, right),
        top + (1 - top) * 0.2,
      ]),
      labels: horizontalValues.map(tickLabel),
      color,
      size: Math.max((theme.fontSize ?? 13) - 2, 8),
      zBias: 2,
      ...(theme.axisTextXAngle ? { angle: theme.axisTextXAngle } : {}),
      ...family,
    }),
    node("Label", {
      positions: verticalValues.map((value): [number, number] => [
        left - (left + 1) * 0.2,
        axisTickPosition(verticalScale, value, top, bottom),
      ]),
      labels: verticalValues.map(tickLabel),
      color,
      size: Math.max((theme.fontSize ?? 13) - 2, 8),
      zBias: 2,
      ...(theme.axisTextYAngle ? { angle: theme.axisTextYAngle } : {}),
      ...family,
    }),
    labelNode(
      (left + right) / 2,
      top + (1 - top) * 0.7,
      [labelFor(labels, horizontal, mapping[horizontal] ?? horizontal)],
      theme,
      undefined,
      theme.axisTitleXAngle ?? 0,
    ),
    labelNode(
      -1 + (left + 1) * 0.3,
      (bottom + top) / 2,
      [labelFor(labels, vertical, mapping[vertical] ?? vertical)],
      theme,
      undefined,
      theme.axisTitleYAngle ?? 0,
    ),
  ]);
}

/** One faceting variable combination (e.g. { cyl: "6" }), row/col-major order. */
interface FacetPanel {
  data: DataFrame;
  label: string;
  row: number;
  col: number;
}

/** Distinct value-combinations for a set of columns, first-seen order deduped, then label-sorted. */
function uniqueCombos(
  data: DataFrame,
  cols: string[],
): Record<string, unknown>[] {
  if (cols.length === 0) return [{}];
  const first = valuesOf(data, cols[0]);
  const n = first?.length ?? 0;
  const seen = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < n; i++) {
    const combo: Record<string, unknown> = {};
    for (const c of cols) combo[c] = valuesOf(data, c)?.[i];
    const key = cols.map((c) => String(combo[c])).join(" ");
    if (!seen.has(key)) seen.set(key, combo);
  }
  return [...seen.values()].sort((a, b) =>
    comboLabel(a).localeCompare(comboLabel(b))
  );
}

/** Row indices matching every column=value pair in `combo`. */
function filterRows(
  data: DataFrame,
  combo: Record<string, unknown>,
): DataFrame {
  const cols = Object.keys(combo);
  const anyCol = Object.keys(data)[0];
  const n = valuesOf(data, anyCol)?.length ?? 0;
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (
      cols.every((c) => String(valuesOf(data, c)?.[i]) === String(combo[c]))
    ) {
      indices.push(i);
    }
  }
  return sliceRows(data, indices);
}

/** Human-readable strip label for a facet panel, e.g. "cyl: 6" or "cyl: 6, gear: 4". */
function comboLabel(
  combo: Record<string, unknown>,
  labels: PlotLabels = {},
): string {
  return Object.entries(combo).map(([k, v]) =>
    `${labelFor(labels, k, k)}: ${v}`
  ).join(", ");
}

/**
 * Partition spec.data into facet panels. facet_wrap tiles its distinct
 * variable combinations into an ncol-wide grid (auto sqrt-ish unless
 * facet.ncol is set); facet_grid crosses rows x cols variables directly, one
 * panel per combination even if some are empty. facet.kind "none" returns a
 * single unfiltered panel with no strip label.
 */
function buildFacetPanels(
  facet: Facet,
  data: DataFrame,
  labels: PlotLabels = {},
): { panels: FacetPanel[]; nrow: number; ncol: number } {
  if (facet.kind === "wrap") {
    const combos = uniqueCombos(data, facet.rows ?? []);
    const n = Math.max(combos.length, 1);
    const ncol = facet.ncol ?? Math.ceil(Math.sqrt(n));
    const nrow = Math.ceil(n / ncol);
    const panels = combos.map((combo, i) => ({
      data: filterRows(data, combo),
      label: comboLabel(combo, labels),
      row: Math.floor(i / ncol),
      col: i % ncol,
    }));
    return { panels, nrow, ncol };
  }

  if (facet.kind === "grid") {
    const rowCombos = uniqueCombos(data, facet.rows ?? []);
    const colCombos = uniqueCombos(data, facet.cols ?? []);
    const panels: FacetPanel[] = [];
    rowCombos.forEach((rc, r) => {
      colCombos.forEach((cc, c) => {
        const combo = { ...rc, ...cc };
        panels.push({
          data: filterRows(data, combo),
          label: comboLabel(combo, labels),
          row: r,
          col: c,
        });
      });
    });
    return { panels, nrow: rowCombos.length || 1, ncol: colCombos.length || 1 };
  }

  return { panels: [{ data, label: "", row: 0, col: 0 }], nrow: 1, ncol: 1 };
}

export interface CompileOptions {
  /** Enable runtime-only GPU products; source emission keeps portable CPU nodes. */
  resident?: boolean;
  /** Concrete host geometry and glyph metrics for guide-aware panel layout. */
  layout?: {
    width: number;
    height: number;
    measureText: TextMeasurer;
  };
}

export function compile(
  spec: GGSpec,
  options: CompileOptions = {},
): RenderNode {
  const labels = spec.labels ?? {};

  // ③ facet → panels, partitioned before stats so stat_count/stat_bin/etc.
  // aggregate within each panel independently (ggplot2's default). A layer
  // with its own data override bypasses faceting — it renders unfiltered
  // into every panel.
  const { panels, nrow, ncol } = buildFacetPanels(
    spec.facet,
    spec.data,
    labels,
  );
  const faceted = spec.facet.kind !== "none";

  // ① stat transform per layer, per panel (resolving each layer's effective mapping/data)
  const panelLayers = panels.map((panel) =>
    spec.layers.map((layer) => {
      const mapping = layer.inheritAes === false
        ? (layer.mapping ?? {})
        : { ...spec.mapping, ...layer.mapping };
      const data = layer.data ?? panel.data;
      const resident = options.resident
        ? residentHistogramProps(
          spec,
          layer,
          mapping,
          data,
          !faceted && spec.layers.length === 1,
        )
        : undefined;
      if (resident) return { layer, data, mapping, resident };
      const res = applyStat(layer, mapping, data);
      return { layer, data: res.data, mapping: res.mapping };
    })
  );

  // ② train scales across all panels combined → shared x/y domains for every
  // panel's view range (ggplot2's default scales="fixed"; free per-panel
  // scales aren't implemented).
  const allPerLayer = panelLayers.flat();
  const scales = trainScales(spec, allPerLayer);
  const xScale = scales.get("x");
  const yScale = scales.get("y");
  const colorScale = scales.get("color");
  const fillScale = scales.get("fill");
  const sizeScale = scales.get("size");
  const alphaScale = scales.get("alpha");
  const shapeScale = scales.get("shape");
  const linetypeScale = scales.get("linetype");
  const linewidthScale = scales.get("linewidth");
  const strokeScale = scales.get("stroke");
  let xDomain = numericRange(xScale) ?? [0, 1];
  let yDomain = numericRange(yScale) ?? [0, 1];
  for (const { layer, data, mapping } of allPerLayer) {
    yDomain = widenForStackedBars(
      yDomain,
      layer,
      mapping,
      data,
      xScale,
      yScale,
    );

    if ((layer.geom === "bar" || layer.geom === "col") && mapping.x) {
      const scaledX = (valuesOf(data, mapping.x) ?? []).map((v) =>
        scalePosition(xScale, v)
      );
      const width = resolutionOf(xScale, scaledX) * 0.9;
      xDomain = widenForTileAxis(xDomain, scaledX, width);
    }

    if (layer.geom === "tile" && mapping.x && mapping.y) {
      const scaledX = (valuesOf(data, mapping.x) ?? []).map((v) =>
        scalePosition(xScale, v)
      );
      const scaledY = (valuesOf(data, mapping.y) ?? []).map((v) =>
        scalePosition(yScale, v)
      );
      const width = (layer.params.width as number) ??
        resolutionOf(xScale, scaledX);
      const height = (layer.params.height as number) ??
        resolutionOf(yScale, scaledY);
      xDomain = widenForTileAxis(xDomain, scaledX, width);
      yDomain = widenForTileAxis(yDomain, scaledY, height);
    }
  }
  const xGuideScale = xScale?.kind === "continuous"
    ? { ...xScale, domain: xDomain }
    : xScale;
  const yGuideScale = yScale?.kind === "continuous"
    ? { ...yScale, domain: yDomain }
    : yScale;

  // ④ coord → view component
  // "axes" is a swizzle string applied to Cartesian/Polar's output after the
  // range-to-clip-space matrix is built — the same trait on both view
  // components, so one projection model covers cartesian x/y swaps
  // (coord_flip) and polar theta/radius reassignment (coord_polar(theta="y"))
  // without touching mark positions or the trained domains.
  const view = spec.coord.kind === "polar" ? "Polar" : "Cartesian";
  const project = spec.coord.project ?? ["x", "y"];
  const axes = project[0] === "y" ? "yx" : "xy";

  const theme = spec.theme;
  const { bounds: panelBounds, tickCount } = guideLayout(
    options.layout?.width,
    options.layout?.height,
    options.layout?.measureText,
    theme,
    labels,
    spec.mapping,
    xGuideScale,
    yGuideScale,
    [
      colorScale,
      fillScale,
      sizeScale,
      alphaScale,
      shapeScale,
      linetypeScale,
      linewidthScale,
    ],
  );

  /** Build one panel's Cartesian/Polar view node (guides + this panel's marks). */
  function buildPanel(perLayer: typeof allPerLayer): RenderNode {
    const free = spec.facet.scales ?? "fixed";
    const panelScales = free === "fixed" ? scales : trainScales(spec, perLayer);
    const panelXScale = free === "free" || free === "free_x"
      ? panelScales.get("x")
      : xScale;
    const panelYScale = free === "free" || free === "free_y"
      ? panelScales.get("y")
      : yScale;
    let panelXDomain = free === "free" || free === "free_x"
      ? numericRange(panelXScale) ?? xDomain
      : xDomain;
    let panelYDomain = free === "free" || free === "free_y"
      ? numericRange(panelYScale) ?? yDomain
      : yDomain;
    for (const { layer, data, mapping } of perLayer) {
      panelYDomain = widenForStackedBars(
        panelYDomain,
        layer,
        mapping,
        data,
        panelXScale,
        panelYScale,
      );
      if ((layer.geom === "bar" || layer.geom === "col") && mapping.x) {
        const values = (valuesOf(data, mapping.x) ?? []).map((value) =>
          scalePosition(panelXScale, value)
        );
        panelXDomain = widenForTileAxis(
          panelXDomain,
          values,
          resolutionOf(panelXScale, values) * 0.9,
        );
      }
    }
    // ⑤ geoms → marks
    const marks = perLayer.flatMap(({ layer, data, mapping, resident }) =>
      resident ? [node("ResidentHistogram", { ...resident })] : lowerLayer(
        layer,
        mapping,
        data,
        panelXScale,
        panelYScale,
        colorScale,
        fillScale,
        sizeScale,
        alphaScale,
        shapeScale,
        linetypeScale,
        linewidthScale,
        strokeScale,
        theme,
        panelXDomain,
        panelYDomain,
      )
    );
    const thetaAxis: 0 | 1 = project[0] === "x" ? 0 : 1;
    const thetaDomain = thetaAxis === 0 ? panelXDomain : panelYDomain;
    const coordParams = spec.coord.params ?? {};
    const requestedStart = typeof coordParams.start === "number"
      ? coordParams.start
      : 0;
    const requestedEnd = typeof coordParams.end === "number"
      ? coordParams.end
      : requestedStart + Math.PI * 2;
    // UseGPU Polar's view matrix treats the angular range like a centered
    // Cartesian axis before bending it. A symmetric radian interval therefore
    // keeps the circle centered; [0, 2π] translates it by half a viewport.
    const thetaSpan = requestedEnd - requestedStart;
    const thetaStart = -thetaSpan / 2;
    const thetaEnd = thetaSpan / 2;
    const polarMarks = view === "Polar"
      ? marks.map((mark) =>
        munchPolygonNode(
          polarizeNode(mark, thetaAxis, thetaDomain, thetaStart, thetaEnd),
        )
      )
      : marks;
    const viewXDomain: [number, number] = view === "Polar" && thetaAxis === 0
      ? [thetaStart, thetaEnd]
      : panelXDomain;
    const viewYDomain: [number, number] = view === "Polar" && thetaAxis === 1
      ? [thetaStart, thetaEnd]
      : panelYDomain;

    // ⑥ guides — background + grid + axes, themed per spec.theme.
    // A background is only drawn when theme.background is set (default: no
    // panel fill, matching ggplot2's theme_minimal); it's a full-range Polygon
    // drawn first so grid/marks layer on top in RenderTree/emitted-source
    // order. theme.grid: false (ggplot2's theme_classic/theme_void) omits the
    // Grid node entirely. gridColor/gridWidth/axisColor/axisWidth pass
    // straight through to Grid/Axis's own `color`/`width` traits, which
    // default to sensible values when unset.
    //
    // @use-gpu/workbench's VirtualLayers aggregator regroups draws by shape
    // type before sorting aggregated layers by zIndex. Keep the full-panel
    // background on a lower layer and lift Grid/Axis with their native zBias
    // trait (these helpers accept zBias directly, not ZIndexTrait) so the live
    // WebGPU backend does not reject guide lines against the panel fill.
    const guides: RenderNode[] = [];
    if (theme.background) {
      guides.push(node("Polygon", {
        positions: [[panelXDomain[0], panelYDomain[0]], [
          panelXDomain[0],
          panelYDomain[1],
        ], [
          panelXDomain[1],
          panelYDomain[1],
        ], [panelXDomain[1], panelYDomain[0]]],
        fill: theme.background,
        depth: 1,
        depthWrite: false,
      }));
    }
    if (theme.grid !== false) {
      guides.push(
        view === "Polar"
          ? polarGridLines(viewXDomain, viewYDomain, theme)
          : node("Grid", {
            axes,
            width: theme.gridWidth ?? 1,
            zBias: -1,
            ...(theme.gridColor ? { color: theme.gridColor } : {}),
          }),
      );
    }
    if (theme.axes !== false) {
      guides.push(
        node("Axis", {
          axis: "x",
          width: theme.axisWidth ?? 2,
          zBias: 0,
          ...(theme.axisColor ? { color: theme.axisColor } : {}),
        }),
        node("Axis", {
          axis: "y",
          width: theme.axisWidth ?? 2,
          zBias: 0,
          ...(theme.axisColor ? { color: theme.axisColor } : {}),
        }),
      );
    }

    return node(
      view,
      {
        range: [viewXDomain, viewYDomain],
        axes,
        ...coordParams,
      },
      [...guides, ...polarMarks],
    );
  }

  // Embedded bridges the host camera's pixel-space layout (from FlatCamera's
  // LayoutContext) into Cartesian's normalized [-1,1] output — without it,
  // Cartesian's tiny normalized units get misread as raw pixel coordinates by
  // the camera's projection, collapsing every mark into the canvas corner.
  // Embedded also establishes the Plot wrapper (font/virtual-layers) itself,
  // so it replaces our own explicit root Plot node rather than nesting inside it.
  if (!faceted) {
    const standaloneResident = panelLayers[0].length === 1
      ? panelLayers[0][0].resident
      : undefined;
    if (standaloneResident?.autoYDomain) {
      return node("Embedded", { normalize: true }, [
        node("PanelViewport", { bounds: panelBounds }, [
          node("ResidentHistogramView", { ...standaloneResident, axes, theme }),
        ]),
        axisGuideOverlay(
          labels,
          spec.mapping,
          theme,
          xGuideScale,
          yGuideScale,
          project,
          panelBounds,
          tickCount,
        ),
        ...plotLabelNodes(labels, theme),
      ]);
    }
    return node("Embedded", { normalize: true }, [
      ...(view === "Polar"
        ? [node("RadialViewport", {}, [buildPanel(panelLayers[0])])]
        : [node("PanelViewport", { bounds: panelBounds }, [
          buildPanel(panelLayers[0]),
        ])]),
      ...(view === "Cartesian"
        ? [
          axisGuideOverlay(
            labels,
            spec.mapping,
            theme,
            xGuideScale,
            yGuideScale,
            project,
            panelBounds,
            tickCount,
          ),
        ]
        : []),
      ...plotLabelNodes(labels, theme),
      ...legendNodes(
        colorScale,
        fillScale,
        sizeScale,
        alphaScale,
        shapeScale,
        linetypeScale,
        linewidthScale,
        labels,
        theme,
        panelBounds,
      ),
    ]);
  }

  // A faceted plot still has one outer Embedded root, matching the non-faceted
  // layout and giving plot-level labels/legends a normalized overlay space.
  // FacetGrid (a custom Live component, not a real @use-gpu/plot export — see
  // rendertree.ts) subdivides that ambient pixel-space layout into an nrow x
  // ncol grid at render time and supplies each panel an explicit viewport.
  // FacetPanel then mounts its normalized Embedded space plus a strip Label
  // at y=0.92, sibling to — not
  // inside — the Cartesian/Polar view, so strip positions are not relative to
  // the trained data domain.
  const embeds = panels.map((panel, i) => {
    // Keep the crossed panel and strip for an empty combination, but do not
    // mount a Cartesian helper subtree whose adapter receives no geometry.
    // The cell remains part of FacetGrid's layout, so subsequent panels keep
    // their row/column positions.
    const hasRows = Object.keys(panel.data).some((column) =>
      columnValues(panel.data, column).length > 0
    );
    return (
      node("FacetPanel", {}, [
        ...(hasRows ? [buildPanel(panelLayers[i])] : []),
        ...(panel.label
          ? [
            node("Label", {
              positions: [[0, 0.92]],
              labels: [panel.label],
              color: theme.textColor ?? "#0b0b0b",
              size: theme.fontSize ?? 13,
              zBias: 2,
            }),
          ]
          : []),
      ])
    );
  });
  return node("Embedded", { normalize: true }, [
    node("FacetGrid", { nrow, ncol, gap: 16 }, embeds),
    // Axis titles are plot-level for fixed-scale facets. Mounting a second
    // normalized Embedded inside every cell can create zero-sized glyph
    // bindings on UseGPU's nested layout path.
    axisGuideOverlay(
      labels,
      spec.mapping,
      theme,
      xGuideScale,
      yGuideScale,
      project,
      panelBounds,
      tickCount,
    ),
    ...plotLabelNodes(labels, theme),
    ...legendNodes(
      colorScale,
      fillScale,
      sizeScale,
      alphaScale,
      shapeScale,
      linetypeScale,
      linewidthScale,
      labels,
      theme,
      panelBounds,
    ),
  ]);
}
