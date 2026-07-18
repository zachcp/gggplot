// geom_boxplot — box Polygon plus median/whisker Line segments.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import { colorsOf, resolutionOf, valuesOf } from "./shared.ts";

/**
 * Lower a geom_boxplot layer (x, lower, middle, upper, ymin, ymax) to a box
 * Polygon (lower..upper) plus a Line of disjoint segments for the median and
 * the two whiskers (each with a half-width cap). `params.width` sets the box
 * width (default: 0.75 * x resolution, ggplot2's default).
 */
export function lowerBoxplot(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;

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

  const colors = colorsOf(
    mapping,
    data,
    ctx.scales.color,
    ctx.scales.fill,
    "fillOrColor",
  );
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
