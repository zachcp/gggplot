import type { Aes, DataFrame, GGSpec, Layer, Theme } from "../ir/types.ts";
import { node, type RenderNode } from "./rendertree.ts";
import { sliceRows, splitByEffectiveGroup } from "../group/mod.ts";
import { columnValues, numericColumnValues } from "../data/mod.ts";
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
import {
  dodge2Bars,
  dodgeBars,
  jitter,
  nudge,
  type PositionedBar,
  stackBars,
} from "../position/mod.ts";
import type { TextMeasurer } from "./guides.ts";

export function valuesOf(
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

function lowerSilhouetteAreaLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
): RenderNode[] {
  const groups = splitByEffectiveGroup(mapping, data);
  const totals = new Map<number, number>();
  for (const group of groups) {
    const xs = valuesOf(group.data, group.mapping.x) ?? [];
    const ys = valuesOf(group.data, group.mapping.y) ?? [];
    for (let row = 0; row < Math.min(xs.length, ys.length); row++) {
      const x = scalePosition(xScale, xs[row]);
      const y = Number(ys[row]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      totals.set(x, (totals.get(x) ?? 0) + y);
    }
  }
  const cumulative = new Map<number, number>();
  for (const [x, total] of totals) cumulative.set(x, -total / 2);
  const nodes: RenderNode[] = [];
  for (const group of groups) {
    const xs = valuesOf(group.data, group.mapping.x) ?? [];
    const ys = valuesOf(group.data, group.mapping.y) ?? [];
    const rows: Array<{ x: number; y0: number; y1: number }> = [];
    for (let row = 0; row < Math.min(xs.length, ys.length); row++) {
      const x = scalePosition(xScale, xs[row]);
      const y = Number(ys[row]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const y0 = cumulative.get(x) ?? 0;
      const y1 = y0 + y;
      cumulative.set(x, y1);
      rows.push({ x, y0, y1 });
    }
    rows.sort((a, b) => a.x - b.x);
    if (!rows.length) continue;
    const positions: [number, number][] = [
      ...rows.map((
        { x, y1 },
      ): [number, number] => [x, scalePosition(yScale, y1)]),
      ...rows.toReversed().map((
        { x, y0 },
      ): [number, number] => [x, scalePosition(yScale, y0)]),
    ];
    const colors = colorsOf(
      group.mapping,
      group.data,
      colorScale,
      fillScale,
      "fillOrColor",
    );
    nodes.push(node("Polygon", {
      positions,
      fill: colors?.[0] ?? (layer.params.fill as string) ??
        (layer.params.color as string) ?? "#3b82f6",
    }));
  }
  return nodes;
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
      bars.map((bar) => ({
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
  const metadata = typeof layer.params.fun === "function"
    ? { execution: "cpu-custom-summary", nonSerializable: true }
    : {};

  return colors
    ? positions.map((position, i) =>
      node("Polygon", { positions: position, fill: colors[i], ...metadata })
    )
    : [node("Polygon", { positions, fill, ...metadata })];
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
  const metadata = typeof layer.params.fun === "function"
    ? { execution: "cpu-custom-summary", nonSerializable: true }
    : {};
  return colors
    ? positions.map((position, i) =>
      node("Polygon", { positions: position, fill: colors[i], ...metadata })
    )
    : [node("Polygon", {
      positions,
      fill: (layer.params.fill as string) ?? "#3b82f6",
      ...metadata,
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
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
  sizeScale: TrainedScale | undefined,
  alphaScale: TrainedScale | undefined,
  linetypeScale: TrainedScale | undefined,
  linewidthScale: TrainedScale | undefined,
  centerOffset = 0,
): RenderNode[] {
  const vertical = Boolean(mapping.x && mapping.ymin && mapping.ymax);
  const horizontal = Boolean(mapping.y && mapping.xmin && mapping.xmax);
  const requested = layer.params.orientation;
  if (requested !== undefined && requested !== "x" && requested !== "y") {
    throw new TypeError('interval orientation must be "x" or "y"');
  }
  const orientation = requested ??
    (vertical !== horizontal ? (vertical ? "x" : "y") : undefined);
  if (
    !orientation || (orientation === "x" && !vertical) ||
    (orientation === "y" && !horizontal)
  ) {
    throw new TypeError("interval geom mappings are incomplete or ambiguous");
  }
  const centers = valuesOf(data, orientation === "x" ? mapping.x : mapping.y)!;
  const mins = valuesOf(
    data,
    orientation === "x" ? mapping.ymin : mapping.xmin,
  )!;
  const maxs = valuesOf(
    data,
    orientation === "x" ? mapping.ymax : mapping.xmax,
  )!;
  const middles = valuesOf(data, orientation === "x" ? mapping.y : mapping.x);
  if ((layer.geom === "pointrange" || layer.geom === "crossbar") && !middles) {
    throw new TypeError(
      `${layer.geom} requires a mapped middle ${
        orientation === "x" ? "y" : "x"
      } aesthetic`,
    );
  }
  const n = Math.min(
    centers.length,
    mins.length,
    maxs.length,
    middles?.length ?? centers.length,
  );
  const scaledCenters = centers.map((value) =>
    scalePosition(orientation === "x" ? xScale : yScale, value)
  );
  const width = (layer.params.width as number) ??
    resolutionOf(orientation === "x" ? xScale : yScale, scaledCenters) * 0.5;
  const half = width / 2;
  const segments: [number, number][][] = [];
  const boxes: [number, number][][] = [];
  const points: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    if (centers[i] == null || mins[i] == null || maxs[i] == null) continue;
    const center = scaledCenters[i] + centerOffset;
    const min = scalePosition(orientation === "x" ? yScale : xScale, mins[i]);
    const max = scalePosition(orientation === "x" ? yScale : xScale, maxs[i]);
    if (![center, min, max].every(Number.isFinite)) continue;
    const middle = middles
      ? scalePosition(orientation === "x" ? yScale : xScale, middles[i])
      : undefined;
    if (middles && (middles[i] == null || !Number.isFinite(middle))) continue;
    const point = (a: number, b: number): [number, number] =>
      orientation === "x" ? [a, b] : [b, a];
    if (layer.geom === "errorbar") {
      segments.push([point(center - half, max), point(center + half, max)]);
      segments.push([point(center, max), point(center, min)]);
      segments.push([point(center - half, min), point(center + half, min)]);
    } else if (layer.geom === "pointrange" && middle !== undefined) {
      segments.push([point(center, min), point(center, max)]);
      points.push(point(center, middle));
    } else if (layer.geom === "crossbar" && middle !== undefined) {
      boxes.push([
        point(center - half, min),
        point(center - half, max),
        point(center + half, max),
        point(center + half, min),
      ]);
      segments.push([
        point(center - half, middle),
        point(center + half, middle),
      ]);
    } else {
      segments.push([point(center, min), point(center, max)]);
    }
  }
  if (!segments.length && !boxes.length && !points.length) return [];
  const mappedColor = colorsOf(mapping, data, colorScale, fillScale, "color")
    ?.[0];
  const mappedAlpha = alphasOf(mapping, data, alphaScale)?.[0];
  const baseColor = (layer.params.color as string) ?? mappedColor ?? "#3b82f6";
  const color = mappedAlpha == null
    ? baseColor
    : colorWithAlpha(baseColor, mappedAlpha);
  const dash = dashOf(layer, mapping, data, linetypeScale);
  const mappedWidth = linewidthsOf(mapping, data, linewidthScale)?.[0];
  const nodes = [
    node("Line", {
      positions: segments,
      color,
      width: (layer.params.linewidth as number) ?? mappedWidth ?? 2,
      ...(dash ? { dash } : {}),
    }),
  ];
  if (boxes.length) {
    nodes.unshift(
      node("Polygon", {
        positions: boxes,
        fill: (layer.params.fill as string) ??
          colorsOf(mapping, data, colorScale, fillScale, "fill")?.[0] ??
          "#00000000",
      }),
    );
  }
  if (points.length) {
    nodes.push(
      node("Point", {
        positions: points,
        color,
        size: (layer.params.size as number) ??
          sizesOf(mapping, data, sizeScale)?.[0] ?? 5,
      }),
    );
  }
  return nodes;
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
 * Lower geom_text to labels and geom_label to measured background, border,
 * and label nodes. Box dimensions are CSS-pixel stable and use the same
 * compiler-provided glyph measurer as guide layout when one is available.
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
  xDomain: [number, number] = [0, 1],
  yDomain: [number, number] = [0, 1],
  panelPixels: { width: number; height: number } = { width: 800, height: 600 },
  measureText: TextMeasurer = (text, size) => ({
    width: text.length * size * 0.6,
    height: size,
  }),
): RenderNode[] {
  const labelCol = mapping.label;
  if (!labelCol || !(labelCol in data)) return [];
  const rawLabels = columnValues(data, labelCol);
  const rawX = valuesOf(data, mapping.x);
  const rawY = valuesOf(data, mapping.y);
  if (!rawX || !rawY) return [];
  const retained: number[] = [];
  const positions: [number, number][] = [];
  const labels: string[] = [];
  for (
    let row = 0;
    row < Math.min(rawX.length, rawY.length, rawLabels.length);
    row++
  ) {
    if (rawLabels[row] == null) continue;
    const position: [number, number] = [
      scalePosition(xScale, rawX[row]),
      scalePosition(yScale, rawY[row]),
    ];
    if (!position.every(Number.isFinite)) continue;
    retained.push(row);
    positions.push(position);
    labels.push(String(rawLabels[row]));
  }
  if (!positions.length) return [];

  const mappedColors = colorsOf(mapping, data, colorScale, fillScale, "color");
  const colors = mappedColors?.filter((_, row) => retained.includes(row));
  const mappedFills = colorsOf(mapping, data, colorScale, fillScale, "fill");
  const fills = mappedFills?.filter((_, row) => retained.includes(row));
  const color = (layer.params.color as string) ?? theme.textColor ?? "#0b0b0b";
  const size = (layer.params.size as number) ?? theme.fontSize ?? 14;
  const defaultFamily = (layer.params.family as string) ?? theme.fontFamily;
  const defaultFace = normalizeFontface(
    layer.params.fontface,
    layer.params.weight ?? theme.fontWeight,
    layer.params.style ?? theme.fontStyle,
  );
  const lineHeight = (layer.params.lineheight as number) ??
    (layer.params.lineHeight as number) ?? theme.lineHeight;
  const angle = (layer.params.angle as number) ?? 0;
  const sourceFamilies = valuesOf(data, mapping.family);
  const sourceFaces = valuesOf(data, mapping.fontface);
  const mappedFamilies = retained.map((row) => sourceFamilies?.[row]);
  const mappedFaces = retained.map((row) => sourceFaces?.[row]);
  const batches = new Map<string, {
    family?: string;
    weight: number | string;
    style: string;
    indices: number[];
  }>();

  positions.forEach((_, index) => {
    const family = mappedFamilies?.[index] != null
      ? String(mappedFamilies[index])
      : defaultFamily;
    const face = mappedFaces?.[index] != null
      ? normalizeFontface(mappedFaces[index])
      : defaultFace;
    const key = JSON.stringify([family, face.weight, face.style]);
    const batch = batches.get(key) ?? { family, ...face, indices: [] };
    batch.indices.push(index);
    batches.set(key, batch);
  });

  const labelNodes = [...batches.values()].map((batch) =>
    node("Label", {
      positions: batch.indices.map((index) => positions[index]),
      labels: batch.indices.map((index) => labels[index]),
      ...(colors
        ? { colors: batch.indices.map((index) => colors[index]) }
        : { color }),
      size,
      weight: batch.weight,
      style: batch.style,
      ...(lineHeight != null ? { lineHeight } : {}),
      ...(angle ? { angle } : {}),
      zBias: 2,
      ...(batch.family ? { family: batch.family } : {}),
    })
  );
  if (layer.geom !== "label") return labelNodes;

  const padding = Number(layer.params.labelPadding ?? 3);
  const radius = Number(layer.params.labelR ?? 2);
  const borderWidth = Number(layer.params.borderWidth ?? 1);
  if (
    ![padding, radius, borderWidth].every((value) =>
      Number.isFinite(value) && value >= 0
    )
  ) {
    throw new TypeError(
      "geomLabel padding, radius, and border width must be non-negative CSS-pixel values",
    );
  }
  const xPerPixel = (xDomain[1] - xDomain[0]) / panelPixels.width;
  const yPerPixel = (yDomain[1] - yDomain[0]) / panelPixels.height;
  const radians = angle * Math.PI / 180;
  const rotate = (
    [x, y]: [number, number],
    [cx, cy]: [number, number],
  ): [number, number] => {
    const dx = x - cx, dy = y - cy;
    return [
      cx + dx * Math.cos(radians) - dy * Math.sin(radians),
      cy + dx * Math.sin(radians) + dy * Math.cos(radians),
    ];
  };
  const boxes: [number, number][][] = [];
  for (let index = 0; index < positions.length; index++) {
    const family = mappedFamilies[index] != null
      ? String(mappedFamilies[index])
      : defaultFamily;
    const face = mappedFaces[index] != null
      ? normalizeFontface(mappedFaces[index])
      : defaultFace;
    const lines = labels[index].split("\n");
    const metrics = lines.map((line) =>
      measureText(line, size, family, face.weight, face.style)
    );
    const widthPx = Math.max(0, ...metrics.map((metric) => metric.width)) +
      2 * padding;
    const naturalHeight = metrics.reduce(
      (sum, metric) => sum + metric.height,
      0,
    );
    const heightPx =
      (lineHeight != null ? Number(lineHeight) * lines.length : naturalHeight) +
      2 * padding;
    const halfWidth = widthPx * xPerPixel / 2,
      halfHeight = heightPx * yPerPixel / 2;
    const cornerRadiusX = Math.min(radius, widthPx / 2) * xPerPixel;
    const cornerRadiusY = Math.min(radius, heightPx / 2) * yPerPixel;
    const [cx, cy] = positions[index];
    const loop: [number, number][] = [];
    for (
      const [cornerX, cornerY, start] of [
        [cx + halfWidth - cornerRadiusX, cy + halfHeight - cornerRadiusY, 0],
        [
          cx - halfWidth + cornerRadiusX,
          cy + halfHeight - cornerRadiusY,
          Math.PI / 2,
        ],
        [
          cx - halfWidth + cornerRadiusX,
          cy - halfHeight + cornerRadiusY,
          Math.PI,
        ],
        [
          cx + halfWidth - cornerRadiusX,
          cy - halfHeight + cornerRadiusY,
          3 * Math.PI / 2,
        ],
      ] as const
    ) {
      for (let step = 0; step <= 3; step++) {
        const theta = start + step * Math.PI / 6;
        loop.push(rotate([
          cornerX + cornerRadiusX * Math.cos(theta),
          cornerY + cornerRadiusY * Math.sin(theta),
        ], positions[index]));
      }
    }
    boxes.push(loop);
  }
  const opacity = layer.params.alpha as number | undefined;
  const fill = (layer.params.fill as string) ?? "#ffffff";
  const borderColor = (layer.params.borderColor as string) ?? color;
  return [
    node("Polygon", {
      positions: boxes,
      ...(fills ? { fills } : { fill }),
      zBias: 0,
      ...(opacity != null ? { opacity } : {}),
      radius,
    }),
    node("Line", {
      positions: boxes.map((box) => [...box, box[0]]),
      ...(colors ? { colors } : { color: borderColor }),
      width: borderWidth,
      zBias: 1,
      ...(opacity != null ? { opacity } : {}),
    }),
    ...labelNodes.map((label) => ({
      ...label,
      props: {
        ...label.props,
        zBias: 2,
        ...(opacity != null ? { opacity } : {}),
      },
    })),
  ];
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

function requiredValues(
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

function stepPositions(
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

function lowerCurveLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
): RenderNode[] {
  for (const unsupported of ["arrow", "angle", "ncp"]) {
    if (layer.params[unsupported] !== undefined) {
      throw new TypeError(`geomCurve does not support ${unsupported} in V1`);
    }
  }
  const xs = requiredValues("geomCurve", mapping, data, "x");
  const ys = requiredValues("geomCurve", mapping, data, "y");
  const xends = requiredValues("geomCurve", mapping, data, "xend");
  const yends = requiredValues("geomCurve", mapping, data, "yend");
  const curvature = Number(layer.params.curvature ?? 0.5);
  const segments = Number(layer.params.segments ?? 32);
  if (!Number.isFinite(curvature)) {
    throw new TypeError("geomCurve curvature must be a finite number");
  }
  if (!Number.isInteger(segments) || segments < 2) {
    throw new TypeError("geomCurve segments must be an integer of at least 2");
  }
  const n = Math.min(xs.length, ys.length, xends.length, yends.length);
  const positions: [number, number][][] = [];
  for (let row = 0; row < n; row++) {
    const x0 = scalePosition(xScale, xs[row]);
    const y0 = scalePosition(yScale, ys[row]);
    const x1 = scalePosition(xScale, xends[row]);
    const y1 = scalePosition(yScale, yends[row]);
    if (![x0, y0, x1, y1].every(Number.isFinite)) continue;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const controlX = (x0 + x1) / 2 - dy * curvature;
    const controlY = (y0 + y1) / 2 + dx * curvature;
    const curve: [number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const u = 1 - t;
      curve.push([
        u * u * x0 + 2 * u * t * controlX + t * t * x1,
        u * u * y0 + 2 * u * t * controlY + t * t * y1,
      ]);
    }
    positions.push(curve);
  }
  if (!positions.length) return [];
  return [node("Line", {
    positions,
    color: (layer.params.color as string) ?? "#3b82f6",
    ...literalLineProps(layer, 2),
  })];
}

function lowerSpokeLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
): RenderNode[] {
  const xs = requiredValues("geomSpoke", mapping, data, "x");
  const ys = requiredValues("geomSpoke", mapping, data, "y");
  const angles = requiredValues("geomSpoke", mapping, data, "angle");
  const radii = requiredValues("geomSpoke", mapping, data, "radius");
  const n = Math.min(xs.length, ys.length, angles.length, radii.length);
  const positions: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const x = Number(xs[i]);
    const y = Number(ys[i]);
    const angle = Number(angles[i]);
    const radius = Number(radii[i]);
    if (![x, y, angle, radius].every(Number.isFinite)) continue;
    positions.push([
      [scalePosition(xScale, x), scalePosition(yScale, y)],
      [
        scalePosition(xScale, x + Math.cos(angle) * radius),
        scalePosition(yScale, y + Math.sin(angle) * radius),
      ],
    ]);
  }
  if (!positions.length) return [];
  return [node("Line", {
    positions,
    color: (layer.params.color as string) ?? "#3b82f6",
    ...literalLineProps(layer, 1),
  })];
}

function lowerRugLayer(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  xDomain: [number, number],
  yDomain: [number, number],
  panelPixels: { width: number; height: number },
): RenderNode[] {
  const sides = String(layer.params.sides ?? "bl");
  if (!/^[btlr]+$/.test(sides) || new Set(sides).size !== sides.length) {
    throw new TypeError(
      'geomRug sides must contain unique letters from "btlr"',
    );
  }
  const length = Number(layer.params.length ?? 5);
  if (!Number.isFinite(length) || length < 0) {
    throw new TypeError(
      "geomRug length must be a non-negative CSS-pixel value",
    );
  }
  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  if (!xs && !ys) {
    throw new TypeError("geomRug requires a mapped x or y aesthetic");
  }
  const dx = (xDomain[1] - xDomain[0]) * length / panelPixels.width;
  const dy = (yDomain[1] - yDomain[0]) * length / panelPixels.height;
  const positions: [number, number][][] = [];
  for (const value of xs ?? []) {
    const x = scalePosition(xScale, value);
    if (!Number.isFinite(x)) continue;
    if (sides.includes("b")) {
      positions.push([[x, yDomain[0]], [x, yDomain[0] + dy]]);
    }
    if (sides.includes("t")) {
      positions.push([[x, yDomain[1]], [x, yDomain[1] - dy]]);
    }
  }
  for (const value of ys ?? []) {
    const y = scalePosition(yScale, value);
    if (!Number.isFinite(y)) continue;
    if (sides.includes("l")) {
      positions.push([[xDomain[0], y], [xDomain[0] + dx, y]]);
    }
    if (sides.includes("r")) {
      positions.push([[xDomain[1], y], [xDomain[1] - dx, y]]);
    }
  }
  if (!positions.length) return [];
  return [node("Line", {
    positions,
    color: (layer.params.color as string) ?? "#111827",
    ...literalLineProps(layer, 1),
  })];
}

/** Map one geom layer to its RenderNode(s) — one per group for connected geoms. */
export function lowerLayer(
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
  panelPixels: { width: number; height: number } = { width: 800, height: 600 },
  measureText?: TextMeasurer,
): RenderNode[] {
  const opacity = layer.params.alpha as number | undefined;

  if (layer.geom === "blank") return [];

  if (layer.geom === "curve") {
    return lowerCurveLayer(layer, mapping, data, xScale, yScale);
  }

  if (layer.geom === "spoke") {
    return lowerSpokeLayer(layer, mapping, data, xScale, yScale);
  }

  if (layer.geom === "rug") {
    return lowerRugLayer(
      layer,
      mapping,
      data,
      xScale,
      yScale,
      xDomain,
      yDomain,
      panelPixels,
    );
  }

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
    if (
      layer.geom === "area" && layer.position === "stack" &&
      layer.params.offset === "silhouette"
    ) {
      return lowerSilhouetteAreaLayer(
        layer,
        mapping,
        data,
        xScale,
        yScale,
        colorScale,
        fillScale,
      );
    }
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

  if (
    ["errorbar", "linerange", "pointrange", "crossbar"].includes(layer.geom)
  ) {
    const groups = splitByEffectiveGroup(mapping, data);
    const dodge = layer.position === "dodge" || layer.position === "dodge2";
    const dodgeWidth = (layer.params.dodgeWidth as number) ?? 0.9;
    return groups.flatMap(
      ({ mapping: groupMapping, data: groupData }, index) => {
        const offset = dodge && groups.length > 1
          ? (index - (groups.length - 1) / 2) * dodgeWidth / groups.length
          : 0;
        return lowerErrorbarLayer(
          layer,
          groupMapping,
          groupData,
          xScale,
          yScale,
          colorScale,
          fillScale,
          sizeScale,
          alphaScale,
          linetypeScale,
          linewidthScale,
          offset,
        );
      },
    );
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

  if (layer.geom === "text" || layer.geom === "label") {
    return lowerTextLayer(
      layer,
      mapping,
      data,
      xScale,
      yScale,
      colorScale,
      fillScale,
      theme,
      xDomain,
      yDomain,
      panelPixels,
      measureText,
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

  if (layer.geom === "line" || layer.geom === "path" || layer.geom === "step") {
    const color = (layer.params.color as string) ?? "#3b82f6";
    return splitByEffectiveGroup(mapping, data)
      .map(({ mapping: m, data: d }) => {
        const ordered = layer.geom === "path" ? d : sortByX(m, d);
        let positions = layer.stat === "ecdf"
          ? (() => {
            const xs = valuesOf(ordered, m.x) ?? [];
            const ys = valuesOf(ordered, m.y) ?? [];
            return xs.slice(0, Math.min(xs.length, ys.length)).map((
              value,
              index,
            ): [number, number] => [
              value === Number.NEGATIVE_INFINITY
                ? xDomain[0]
                : value === Number.POSITIVE_INFINITY
                ? xDomain[1]
                : scalePosition(xScale, value),
              scalePosition(yScale, ys[index]),
            ]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
          })()
          : positionsOf(m, ordered, xScale, yScale);
        if (layer.geom === "step") {
          positions = stepPositions(positions, layer.params.direction ?? "hv");
        }
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
