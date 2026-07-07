// The transpiler core — lowers a GGSpec onto a RenderTree of UseGPU/plot nodes.
//
// Stages: stat transform → scale training → facet → coord → geom lowering →
// guides. The compiler keeps all backend-independent layout decisions here:
// panel/facet construction, shared scale domains, guide nodes, coord swizzles,
// and polar polygon munching before the live/codegen backends consume the tree.

import type { Aes, DataFrame, Facet, GGSpec, Layer, PlotLabels, Theme } from "../ir/types.ts";
import { node, type RenderNode } from "./rendertree.ts";
import { applyStat } from "../stat/mod.ts";
import {
  expandRange,
  scaleColorValue,
  scalePosition,
  scaleShapeValue,
  scaleSizeValue,
  trainScales,
  type TrainedScale,
} from "../scale/mod.ts";
import { dodgeBars, jitter, type PositionedBar, stackBars } from "../position/mod.ts";

/** Pull an [x,y] position array for a layer from its mapped columns. */
function positionsOf(
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
): [number, number][] {
  const xs = mapping.x ? data[mapping.x] : undefined;
  const ys = mapping.y ? data[mapping.y] : undefined;
  if (!xs || !ys) return [];
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
  const xs = data[col];
  const order = [...Array(xs.length).keys()].sort((a, b) => Number(xs[a]) - Number(xs[b]));
  return Object.fromEntries(
    Object.entries(data).map(([c, values]) => [c, order.map((i) => values[i])]),
  );
}

/**
 * Split a layer's rows into groups by its `group` aesthetic, preserving each
 * group's first-seen order. Connected geoms (line/path/area/ribbon) render
 * one connected shape per group instead of zigzagging across all of them.
 * Layers without a mapped group column are returned as a single group.
 */
function splitByGroup(
  mapping: Aes,
  data: GGSpec["data"],
): { mapping: Aes; data: GGSpec["data"] }[] {
  const col = mapping.group;
  if (!col || !(col in data)) return [{ mapping, data }];

  const groups = new Map<string, number[]>();
  data[col].forEach((v, i) => {
    const key = String(v);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  });

  return [...groups.values()].map((indices) => ({
    mapping,
    data: Object.fromEntries(
      Object.entries(data).map(([col, values]) => [col, indices.map((i) => values[i])]),
    ),
  }));
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
  return data[col].map((v) => scaleColorValue(scale, v));
}

/** Per-row point radii from a mapped size column, or undefined if unmapped. */
function sizesOf(
  mapping: Aes,
  data: GGSpec["data"],
  sizeScale: TrainedScale | undefined,
): number[] | undefined {
  const col = mapping.size;
  if (!col || !(col in data)) return undefined;
  return data[col].map((v) => scaleSizeValue(sizeScale, v));
}

/** Per-row point shapes from a mapped shape column, or undefined if unmapped. */
function shapesOf(
  mapping: Aes,
  data: GGSpec["data"],
  shapeScale: TrainedScale | undefined,
): string[] | undefined {
  const col = mapping.shape;
  if (!col || !(col in data)) return undefined;
  return data[col].map((v) => scaleShapeValue(shapeScale, v));
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
  const xs = mapping.x ? data[mapping.x] : undefined;
  const ymaxCol = mapping.ymax ?? mapping.y;
  const ymaxs = ymaxCol ? data[ymaxCol] : undefined;
  const ymins = mapping.ymin ? data[mapping.ymin] : undefined;
  if (!xs || !ymaxs) return [];

  const n = Math.min(xs.length, ymaxs.length, ymins ? ymins.length : xs.length);
  const order = [...Array(n).keys()].sort((a, b) => Number(xs[a]) - Number(xs[b]));

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
function resolutionOf(scale: TrainedScale | undefined, values: number[]): number {
  if (scale?.kind === "discrete") return 1;
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  let minGap = Infinity;
  for (let i = 1; i < sorted.length; i++) minGap = Math.min(minGap, sorted[i] - sorted[i - 1]);
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
  const xs = mapping.x ? data[mapping.x] : undefined;
  const ys = mapping.y ? data[mapping.y] : undefined;
  if (!xs || !ys) return [];

  const n = Math.min(xs.length, ys.length);
  const groupCol = mapping.fill ?? mapping.color ?? mapping.group;
  const groupValues = groupCol ? data[groupCol] : undefined;

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
  const placed = layer.position === "dodge"
    ? dodgeBars(bars, width)
    : stackBars(bars, width, layer.position === "fill" ? "fill" : layer.position === "identity" ? "identity" : "stack");

  const isFillMapped = groupCol && (mapping.fill === groupCol || mapping.color === groupCol);
  const fillOf = (groupKey: string) =>
    isFillMapped
      ? scaleColorValue(mapping.fill === groupCol ? fillScale : colorScale, groupKey)
      : (layer.params.fill as string) ?? (layer.params.color as string) ?? "#3b82f6";

  const positions = placed.map((bar): [number, number][] => {
    const x0 = bar.x + bar.xOffset - bar.width / 2;
    const x1 = bar.x + bar.xOffset + bar.width / 2;
    return [[x0, bar.y0], [x0, bar.y1], [x1, bar.y1], [x1, bar.y0]];
  });
  const fills = placed.map((bar) => fillOf(bar.groupKey));
  const uniform = fills.every((f) => f === fills[0]);

  return [node("Polygon", { positions, ...(uniform ? { fill: fills[0] } : { fills }) })];
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
  const xs = mapping.x ? data[mapping.x] : undefined;
  const ys = mapping.y ? data[mapping.y] : undefined;
  if (!xs || !ys) return [];

  const n = Math.min(xs.length, ys.length);
  const scaledX = xs.map((v) => scalePosition(xScale, v));
  const scaledY = ys.map((v) => scalePosition(yScale, v));
  const width = (layer.params.width as number) ?? resolutionOf(xScale, scaledX);
  const height = (layer.params.height as number) ?? resolutionOf(yScale, scaledY);

  const positions: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const x = scaledX[i];
    const y = scaledY[i];
    positions.push([
      [x - width / 2, y - height / 2],
      [x - width / 2, y + height / 2],
      [x + width / 2, y + height / 2],
      [x + width / 2, y - height / 2],
    ]);
  }

  const colors = colorsOf(mapping, data, colorScale, fillScale, "fillOrColor");
  const fill = (layer.params.fill as string) ?? (layer.params.color as string) ?? "#3b82f6";

  return [node("Polygon", { positions, ...(colors ? { fills: colors } : { fill }) })];
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
  const groups = splitByGroup(mapping, data);
  const loops: [number, number][][] = [];
  const fills: string[] = [];

  for (const { mapping: m, data: d } of groups) {
    const positions = positionsOf(m, d, xScale, yScale);
    if (positions.length < 3) continue;
    loops.push(positions);
    const colors = colorsOf(m, d, colorScale, fillScale, "fillOrColor");
    fills.push(colors?.[0] ?? (layer.params.fill as string) ?? (layer.params.color as string) ?? "#3b82f6");
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
  const xs = mapping.x ? data[mapping.x] : undefined;
  const ymins = mapping.ymin ? data[mapping.ymin] : undefined;
  const ymaxs = mapping.ymax ? data[mapping.ymax] : undefined;
  if (!xs || !ymins || !ymaxs) return [];

  const n = Math.min(xs.length, ymins.length, ymaxs.length);
  const scaledX = xs.map((v) => scalePosition(xScale, v));
  const width = (layer.params.width as number) ?? resolutionOf(xScale, scaledX) * 0.9;
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
  return [node("Line", { positions: segments, color, width: (layer.params.strokeWidth as number) ?? 2 })];
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
  const xs = mapping.x ? data[mapping.x] : undefined;
  const lowers = mapping.lower ? data[mapping.lower] : undefined;
  const middles = mapping.middle ? data[mapping.middle] : undefined;
  const uppers = mapping.upper ? data[mapping.upper] : undefined;
  const ymins = mapping.ymin ? data[mapping.ymin] : undefined;
  const ymaxs = mapping.ymax ? data[mapping.ymax] : undefined;
  if (!xs || !lowers || !middles || !uppers || !ymins || !ymaxs) return [];

  const n = Math.min(xs.length, lowers.length, middles.length, uppers.length, ymins.length, ymaxs.length);
  const scaledX = xs.map((v) => scalePosition(xScale, v));
  const width = (layer.params.width as number) ?? resolutionOf(xScale, scaledX) * 0.75;
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

    boxes.push([[x - half, lo], [x - half, up], [x + half, up], [x + half, lo]]);
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
    node("Polygon", { positions: boxes, ...(colors ? { fills: colors } : { fill }) }),
    node("Line", { positions: segments, color: strokeColor, width: strokeWidth }),
  ];
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
  const labels = data[labelCol].map((v) => String(v));

  const colors = colorsOf(mapping, data, colorScale, fillScale, "colorOrFill");
  const color = (layer.params.color as string) ?? theme.textColor ?? "#0b0b0b";
  const size = (layer.params.size as number) ?? theme.fontSize ?? 14;
  const family = (layer.params.family as string) ?? theme.fontFamily;

  return [node("Label", {
    positions,
    labels,
    ...(colors ? { colors } : { color }),
    size,
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
  const xs = mapping.x ? data[mapping.x] : undefined;
  const ys = mapping.y ? data[mapping.y] : undefined;
  const xends = mapping.xend ? data[mapping.xend] : undefined;
  const yends = mapping.yend ? data[mapping.yend] : undefined;
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
  return [node("Line", { positions: segments, color, width: (layer.params.strokeWidth as number) ?? 2 })];
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
  const xmins = mapping.xmin ? data[mapping.xmin] : undefined;
  const xmaxs = mapping.xmax ? data[mapping.xmax] : undefined;
  const ymins = mapping.ymin ? data[mapping.ymin] : undefined;
  const ymaxs = mapping.ymax ? data[mapping.ymax] : undefined;
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
  const fill = (layer.params.fill as string) ?? (layer.params.color as string) ?? "#3b82f6";
  return [node("Polygon", { positions, ...(colors ? { fills: colors } : { fill }) })];
}

/** Lower a geom_hline layer (one or more literal yintercepts) to full-width Line segments spanning the panel's x domain. */
function lowerHlineLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  yScale: TrainedScale | undefined,
  xDomain: [number, number],
): RenderNode[] {
  const ys = mapping.y ? data[mapping.y] : undefined;
  if (!ys) return [];

  const segments = ys.map((v): [number, number][] => {
    const y = scalePosition(yScale, v);
    return [[xDomain[0], y], [xDomain[1], y]];
  });
  const color = (layer.params.color as string) ?? "#000000";
  const width = (layer.params.strokeWidth as number) ?? 1;
  return [node("Line", { positions: segments, color, width })];
}

/** Lower a geom_vline layer (one or more literal xintercepts) to full-height Line segments spanning the panel's y domain. */
function lowerVlineLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yDomain: [number, number],
): RenderNode[] {
  const xs = mapping.x ? data[mapping.x] : undefined;
  if (!xs) return [];

  const segments = xs.map((v): [number, number][] => {
    const x = scalePosition(xScale, v);
    return [[x, yDomain[0]], [x, yDomain[1]]];
  });
  const color = (layer.params.color as string) ?? "#000000";
  const width = (layer.params.strokeWidth as number) ?? 1;
  return [node("Line", { positions: segments, color, width })];
}

/** Lower a geom_abline layer (literal slope/intercept, default 1/0) to a single Line spanning the panel's x domain. */
function lowerAblineLayer(layer: Layer, xDomain: [number, number]): RenderNode[] {
  const slope = (layer.params.slope as number) ?? 1;
  const intercept = (layer.params.intercept as number) ?? 0;
  const [x0, x1] = xDomain;
  const positions: [number, number][] = [[x0, slope * x0 + intercept], [x1, slope * x1 + intercept]];
  const color = (layer.params.color as string) ?? "#000000";
  const width = (layer.params.strokeWidth as number) ?? 1;
  return [node("Line", { positions, color, width })];
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
  shapeScale: TrainedScale | undefined,
  theme: Theme,
  xDomain: [number, number],
  yDomain: [number, number],
): RenderNode[] {
  const opacity = layer.params.alpha as number | undefined;

  if (layer.geom === "segment") {
    return lowerSegmentLayer(layer, mapping, data, xScale, yScale);
  }

  if (layer.geom === "rect") {
    return lowerRectLayer(layer, mapping, data, xScale, yScale, colorScale, fillScale);
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
    const fill = (layer.params.fill as string) ?? (layer.params.color as string) ?? "#3b82f6";
    return splitByGroup(mapping, data)
      .map(({ mapping: m, data: d }) => {
        const positions = bandPositions(m, d, xScale, yScale);
        return positions.length ? node("Polygon", { positions, fill }) : null;
      })
      .filter((n): n is RenderNode => n !== null);
  }

  if (layer.geom === "bar" || layer.geom === "col") {
    return lowerBarLayer(layer, mapping, data, xScale, yScale, colorScale, fillScale);
  }

  if (layer.geom === "tile") {
    return lowerTileLayer(layer, mapping, data, xScale, yScale, colorScale, fillScale);
  }

  if (layer.geom === "polygon") {
    return lowerPolygonLayer(layer, mapping, data, xScale, yScale, colorScale, fillScale);
  }

  if (layer.geom === "errorbar") {
    return lowerErrorbarLayer(layer, mapping, data, xScale, yScale);
  }

  if (layer.geom === "boxplot") {
    return lowerBoxplotLayer(layer, mapping, data, xScale, yScale, colorScale, fillScale);
  }

  if (layer.geom === "text") {
    return lowerTextLayer(layer, mapping, data, xScale, yScale, colorScale, fillScale, theme);
  }

  if (layer.geom === "point") {
    let positions = positionsOf(mapping, data, xScale, yScale);
    if (positions.length === 0) return [];
    if (layer.position === "jitter") {
      const xAmount = (layer.params.width as number) ?? resolutionOf(xScale, positions.map((p) => p[0])) * 0.4;
      const yAmount = (layer.params.height as number) ?? 0.4;
      positions = positions.map(([x, y]) => [jitter(x, xAmount), jitter(y, yAmount)]);
    }
    const colors = colorsOf(mapping, data, colorScale, fillScale, "colorOrFill");
    const color = (layer.params.color as string) ?? "#3b82f6";
    const sizes = sizesOf(mapping, data, sizeScale);
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
          ...(colors ? { colors: indices.map((i) => colors[i]) } : { color }),
          ...(sizes ? { sizes: indices.map((i) => sizes[i]) } : { size: (layer.params.size as number) ?? 5 }),
          shape,
          ...(opacity != null ? { opacity } : {}),
        })
      );
    }

    return [node("Point", {
      positions,
      ...(colors ? { colors } : { color }),
      ...(sizes ? { sizes } : { size: (layer.params.size as number) ?? 5 }),
      ...(opacity != null ? { opacity } : {}),
    })];
  }

  if (layer.geom === "smooth") {
    const nodes: RenderNode[] = [];
    if (mapping.ymin && mapping.ymax) {
      const bandPos = bandPositions(mapping, data, xScale, yScale);
      if (bandPos.length) {
        const ribbonFill = (layer.params.fill as string) ?? "#c7d2fe";
        nodes.push(node("Polygon", { positions: bandPos, fill: ribbonFill }));
      }
    }
    const positions = positionsOf(mapping, data, xScale, yScale);
    if (positions.length) {
      const color = (layer.params.color as string) ?? "#3b82f6";
      nodes.push(node("Line", { positions, color, width: (layer.params.width as number) ?? 2 }));
    }
    return nodes;
  }

  if (layer.geom === "line" || layer.geom === "path") {
    const color = (layer.params.color as string) ?? "#3b82f6";
    return splitByGroup(mapping, data)
      .map(({ mapping: m, data: d }) => {
        const ordered = layer.geom === "line" ? sortByX(m, d) : d;
        const positions = positionsOf(m, ordered, xScale, yScale);
        if (positions.length === 0) return null;
        const colors = colorsOf(m, ordered, colorScale, fillScale, "colorOrFill");
        return node("Line", {
          positions,
          ...(colors ? { colors } : { color }),
          width: (layer.params.width as number) ?? 2,
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
  if (layer.position === "dodge" || layer.position === "identity") return [lo, hi];

  const xs = mapping.x ? data[mapping.x] : undefined;
  const ys = mapping.y ? data[mapping.y] : undefined;
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
  return [Math.min(lo, Math.min(...centers) - half), Math.max(hi, Math.max(...centers) + half)];
}

/** Numeric view range for a trained scale: level-index span for discrete, domain as-is otherwise. */
function numericRange(scale: TrainedScale | undefined): [number, number] | undefined {
  if (!scale) return undefined;
  if (scale.kind === "discrete") {
    const levels = scale.domain as string[];
    const span: [number, number] = [0, Math.max(levels.length - 1, 0)];
    return scale.expand ? expandRange(span, scale.expand) : span;
  }
  return scale.domain as [number, number];
}

function isPoint(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length >= 2 && typeof v[0] === "number" && typeof v[1] === "number";
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
    zBias: 1,
    ...(theme.gridColor ? { color: theme.gridColor } : {}),
  });
}

function labelFor(labels: PlotLabels, key: string, fallback: string): string {
  return labels[key] ?? fallback;
}

function legendTitle(scale: TrainedScale, labels: PlotLabels, fallback: string): string {
  return labels[scale.aes] ?? scale.name ?? fallback;
}

function labelNode(x: number, y: number, labels: string[], theme: Theme, size?: number): RenderNode {
  return node("Label", {
    positions: labels.map((_, i): [number, number] => [x, y - i * 0.07]),
    labels,
    color: theme.textColor ?? "#0b0b0b",
    size: size ?? theme.fontSize ?? 13,
    ...(theme.fontFamily ? { family: theme.fontFamily } : {}),
  });
}

function legendNodes(
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
  sizeScale: TrainedScale | undefined,
  shapeScale: TrainedScale | undefined,
  labels: PlotLabels,
  theme: Theme,
): RenderNode[] {
  const nodes: RenderNode[] = [];
  let y = 0.82;
  const titleX = 0.72;
  const swatchX = 0.74;
  const labelX = 0.80;

  if (colorScale && Array.isArray(colorScale.domain) && typeof colorScale.domain[0] === "string") {
    const levels = colorScale.domain as string[];
    nodes.push(labelNode(titleX, y, [legendTitle(colorScale, labels, "color")], theme, 14));
    y -= 0.08;
    nodes.push(node("Point", {
      positions: levels.map((_, i): [number, number] => [swatchX, y - i * 0.07]),
      colors: levels.map((level) => scaleColorValue(colorScale, level)),
      size: 7,
    }));
    nodes.push(labelNode(labelX, y, levels, theme));
    y -= levels.length * 0.07 + 0.08;
  }

  if (fillScale && Array.isArray(fillScale.domain) && typeof fillScale.domain[0] === "string") {
    const levels = fillScale.domain as string[];
    nodes.push(labelNode(titleX, y, [legendTitle(fillScale, labels, "fill")], theme, 14));
    y -= 0.08;
    nodes.push(node("Point", {
      positions: levels.map((_, i): [number, number] => [swatchX, y - i * 0.07]),
      colors: levels.map((level) => scaleColorValue(fillScale, level)),
      size: 7,
    }));
    nodes.push(labelNode(labelX, y, levels, theme));
    y -= levels.length * 0.07 + 0.08;
  }

  if (sizeScale && !Array.isArray(sizeScale.domain[0])) {
    const [lo, hi] = sizeScale.domain as [number, number];
    const values = hi > lo ? [lo, (lo + hi) / 2, hi] : [lo];
    nodes.push(labelNode(titleX, y, [legendTitle(sizeScale, labels, "size")], theme, 14));
    y -= 0.08;
    nodes.push(node("Point", {
      positions: values.map((_, i): [number, number] => [swatchX, y - i * 0.07]),
      sizes: values.map((v) => scaleSizeValue(sizeScale, v)),
      color: "#3b82f6",
    }));
    nodes.push(labelNode(labelX, y, values.map((v) => String(Number.isInteger(v) ? v : Number(v.toFixed(2)))), theme));
    y -= values.length * 0.07 + 0.08;
  }

  if (shapeScale && Array.isArray(shapeScale.domain) && typeof shapeScale.domain[0] === "string") {
    const levels = shapeScale.domain as string[];
    nodes.push(labelNode(titleX, y, [legendTitle(shapeScale, labels, "shape")], theme, 14));
    y -= 0.08;
    levels.forEach((level, i) => {
      nodes.push(node("Point", {
        positions: [[swatchX, y - i * 0.07]],
        shape: scaleShapeValue(shapeScale, level),
        color: "#3b82f6",
        size: 7,
      }));
    });
    nodes.push(labelNode(labelX, y, levels, theme));
  }

  return nodes;
}

function plotLabelNodes(labels: PlotLabels, theme: Theme): RenderNode[] {
  const nodes: RenderNode[] = [];
  if (labels.title) nodes.push(labelNode(-0.92, 0.92, [labels.title], theme, (theme.fontSize ?? 14) + 4));
  if (labels.subtitle) nodes.push(labelNode(-0.92, 0.84, [labels.subtitle], theme, theme.fontSize ?? 14));
  if (labels.caption) nodes.push(labelNode(-0.92, -0.92, [labels.caption], theme, Math.max((theme.fontSize ?? 13) - 1, 8)));
  return nodes;
}

/** One faceting variable combination (e.g. { cyl: "6" }), row/col-major order. */
interface FacetPanel {
  data: DataFrame;
  label: string;
  row: number;
  col: number;
}

/** Distinct value-combinations for a set of columns, first-seen order deduped, then label-sorted. */
function uniqueCombos(data: DataFrame, cols: string[]): Record<string, unknown>[] {
  if (cols.length === 0) return [{}];
  const n = data[cols[0]]?.length ?? 0;
  const seen = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < n; i++) {
    const combo: Record<string, unknown> = {};
    for (const c of cols) combo[c] = data[c]?.[i];
    const key = cols.map((c) => String(combo[c])).join(" ");
    if (!seen.has(key)) seen.set(key, combo);
  }
  return [...seen.values()].sort((a, b) => comboLabel(a).localeCompare(comboLabel(b)));
}

/** Row indices matching every column=value pair in `combo`. */
function filterRows(data: DataFrame, combo: Record<string, unknown>): DataFrame {
  const cols = Object.keys(combo);
  const anyCol = Object.keys(data)[0];
  const n = anyCol ? data[anyCol].length : 0;
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (cols.every((c) => String(data[c]?.[i]) === String(combo[c]))) indices.push(i);
  }
  return Object.fromEntries(Object.entries(data).map(([c, vs]) => [c, indices.map((i) => vs[i])]));
}

/** Human-readable strip label for a facet panel, e.g. "cyl: 6" or "cyl: 6, gear: 4". */
function comboLabel(combo: Record<string, unknown>, labels: PlotLabels = {}): string {
  return Object.entries(combo).map(([k, v]) => `${labelFor(labels, k, k)}: ${v}`).join(", ");
}

/**
 * Partition spec.data into facet panels. facet_wrap tiles its distinct
 * variable combinations into an ncol-wide grid (auto sqrt-ish unless
 * facet.ncol is set); facet_grid crosses rows x cols variables directly, one
 * panel per combination even if some are empty. facet.kind "none" returns a
 * single unfiltered panel with no strip label.
 */
function buildFacetPanels(facet: Facet, data: DataFrame, labels: PlotLabels = {}): { panels: FacetPanel[]; nrow: number; ncol: number } {
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
        panels.push({ data: filterRows(data, combo), label: comboLabel(combo, labels), row: r, col: c });
      });
    });
    return { panels, nrow: rowCombos.length || 1, ncol: colCombos.length || 1 };
  }

  return { panels: [{ data, label: "", row: 0, col: 0 }], nrow: 1, ncol: 1 };
}

export function compile(spec: GGSpec): RenderNode {
  const labels = spec.labels ?? {};

  // ③ facet → panels, partitioned before stats so stat_count/stat_bin/etc.
  // aggregate within each panel independently (ggplot2's default). A layer
  // with its own data override bypasses faceting — it renders unfiltered
  // into every panel.
  const { panels, nrow, ncol } = buildFacetPanels(spec.facet, spec.data, labels);
  const faceted = spec.facet.kind !== "none";

  // ① stat transform per layer, per panel (resolving each layer's effective mapping/data)
  const panelLayers = panels.map((panel) =>
    spec.layers.map((layer) => {
      const mapping = layer.inheritAes === false ? (layer.mapping ?? {}) : { ...spec.mapping, ...layer.mapping };
      const data = layer.data ?? panel.data;
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
  const shapeScale = scales.get("shape");
  let xDomain = numericRange(xScale) ?? [0, 1];
  let yDomain = numericRange(yScale) ?? [0, 1];
  for (const { layer, data, mapping } of allPerLayer) {
    yDomain = widenForStackedBars(yDomain, layer, mapping, data, xScale, yScale);

    if ((layer.geom === "bar" || layer.geom === "col") && mapping.x) {
      const scaledX = data[mapping.x].map((v) => scalePosition(xScale, v));
      const width = resolutionOf(xScale, scaledX) * 0.9;
      xDomain = widenForTileAxis(xDomain, scaledX, width);
    }

    if (layer.geom === "tile" && mapping.x && mapping.y) {
      const scaledX = data[mapping.x].map((v) => scalePosition(xScale, v));
      const scaledY = data[mapping.y].map((v) => scalePosition(yScale, v));
      const width = (layer.params.width as number) ?? resolutionOf(xScale, scaledX);
      const height = (layer.params.height as number) ?? resolutionOf(yScale, scaledY);
      xDomain = widenForTileAxis(xDomain, scaledX, width);
      yDomain = widenForTileAxis(yDomain, scaledY, height);
    }
  }

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

  /** Build one panel's Cartesian/Polar view node (guides + this panel's marks). */
  function buildPanel(perLayer: typeof allPerLayer): RenderNode {
    // ⑤ geoms → marks
    const marks = perLayer.flatMap(({ layer, data, mapping }) =>
      lowerLayer(layer, mapping, data, xScale, yScale, colorScale, fillScale, sizeScale, shapeScale, theme, xDomain, yDomain)
    );
    const viewMarks = view === "Polar" ? marks.map(munchPolygonNode) : marks;

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
        positions: [[xDomain[0], yDomain[0]], [xDomain[0], yDomain[1]], [xDomain[1], yDomain[1]], [xDomain[1], yDomain[0]]],
        fill: theme.background,
        depth: 1,
        depthWrite: false,
      }));
    }
    if (theme.grid !== false) {
      guides.push(view === "Polar"
        ? polarGridLines(xDomain, yDomain, theme)
        : node("Grid", {
          axes,
          width: theme.gridWidth ?? 1,
          zBias: 1,
          ...(theme.gridColor ? { color: theme.gridColor } : {}),
        }));
    }
    guides.push(
      node("Axis", { axis: "x", width: theme.axisWidth ?? 2, zBias: 1, ...(theme.axisColor ? { color: theme.axisColor } : {}) }),
      node("Axis", { axis: "y", width: theme.axisWidth ?? 2, zBias: 1, ...(theme.axisColor ? { color: theme.axisColor } : {}) }),
    );

    return node(
      view,
      {
        range: [xDomain, yDomain],
        axes,
        ...(view === "Polar" ? spec.coord.params : {}),
      },
      [...guides, ...viewMarks],
    );
  }

  // Embedded bridges the host camera's pixel-space layout (from FlatCamera's
  // LayoutContext) into Cartesian's normalized [-1,1] output — without it,
  // Cartesian's tiny normalized units get misread as raw pixel coordinates by
  // the camera's projection, collapsing every mark into the canvas corner.
  // Embedded also establishes the Plot wrapper (font/virtual-layers) itself,
  // so it replaces our own explicit root Plot node rather than nesting inside it.
  if (!faceted) {
    return node("Embedded", { normalize: true }, [
      buildPanel(panelLayers[0]),
      ...plotLabelNodes(labels, theme),
      ...legendNodes(colorScale, fillScale, sizeScale, shapeScale, labels, theme),
    ]);
  }

  // A faceted plot still has one outer Embedded root, matching the non-faceted
  // layout and giving plot-level labels/legends a normalized overlay space.
  // FacetGrid (a custom Live component, not a real @use-gpu/plot export — see
  // rendertree.ts) subdivides that ambient pixel-space layout into an nrow x
  // ncol grid at render time and provides each cell as the LayoutContext for
  // one panel Embedded child. Each panel Embedded gets its own normalized
  // [-1,1] coordinate space plus a strip Label at y=0.92, sibling to — not
  // inside — the Cartesian/Polar view, so strip positions are not relative to
  // the trained data domain.
  const embeds = panels.map((panel, i) =>
    node("Embedded", { normalize: true }, [
      buildPanel(panelLayers[i]),
      ...(panel.label
        ? [node("Label", { positions: [[0, 0.92]], labels: [panel.label], color: theme.textColor ?? "#0b0b0b", size: theme.fontSize ?? 13 })]
        : []),
    ])
  );
  return node("Embedded", { normalize: true }, [
    node("FacetGrid", { nrow, ncol, gap: 16 }, embeds),
    ...plotLabelNodes(labels, theme),
    ...legendNodes(colorScale, fillScale, sizeScale, shapeScale, labels, theme),
  ]);
}
