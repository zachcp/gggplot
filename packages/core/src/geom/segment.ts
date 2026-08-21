// geom_segment / annotate("segment") — one disjoint Line segment per row.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import { depthProps, packUniformChunks, valuesOf } from "./shared.ts";
import { packUniformChunks3d } from "./packing.ts";
import type { DepthPolicy } from "./types.ts";

/**
 * Segments are lines and fade with alpha exactly as geom_line does.
 *
 * DESIGN_3D_GEOM_MATRIX proposed "opaque" for this row, but that predates the
 * policy vocabulary settled in gggplot-lcy.10; alphaAware matches line and
 * path, and resolves to the same flags while a layer is opaque.
 */
export const SEGMENT_3D_DEPTH: DepthPolicy = "alphaAware";

/**
 * Lower an annotate("segment", ...)/geom_segment layer (x, y, xend, yend) to a
 * single Line of disjoint segments, one per row. gggplot-tzc.3: positions
 * pack into one FlatTensor + MarkTopology (packUniformChunks); component
 * stays 'Line' (a row-disjoint annotation, not geom_line's per-group
 * ChunkedLine — see the bd note on gggplot-tzc.3).
 */
export function lowerSegment(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  // Dispatch on zend, not z. geom_contour also lowers through here and maps z
  // as a stat value channel (the height field), never as a position — so a
  // mapped z alone does not mean 3D. The 3D mode requires zend, which contour
  // never supplies, making it the exact discriminator.
  if (mapping.zend != null) return lowerSegment3d(layer, mapping, data, ctx);
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;

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
  const packed = packUniformChunks(segments);
  return [
    node("Line", {
      positions: packed.positions,
      topology: packed.topology,
      color,
      width: (layer.params.strokeWidth as number) ?? 2,
    }),
  ];
}

/**
 * The 3D realization: one disjoint vec4 segment per row.
 *
 * A row survives only if all six position components are finite. Dropping the
 * whole segment is the specified missing-value rule — packing one endpoint
 * would draw a line to the origin, which is worse than drawing nothing.
 */
function lowerSegment3d(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  const zs = valuesOf(data, mapping.z);
  const xends = valuesOf(data, mapping.xend);
  const yends = valuesOf(data, mapping.yend);
  const zends = valuesOf(data, mapping.zend);
  if (!xs || !ys || !zs || !xends || !yends || !zends) return [];

  const n = Math.min(
    xs.length,
    ys.length,
    zs.length,
    xends.length,
    yends.length,
    zends.length,
  );
  const segments: [number, number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const start: [number, number, number] = [
      scalePosition(ctx.scales.x, xs[i]),
      scalePosition(ctx.scales.y, ys[i]),
      scalePosition(ctx.scales.z, zs[i]),
    ];
    const end: [number, number, number] = [
      scalePosition(ctx.scales.x, xends[i]),
      scalePosition(ctx.scales.y, yends[i]),
      scalePosition(ctx.scales.z, zends[i]),
    ];
    if (![...start, ...end].every((value) => Number.isFinite(value))) continue;
    segments.push([start, end]);
  }
  if (segments.length === 0) return [];

  const opacity = (layer.params.alpha as number) ?? 1;
  const packed = packUniformChunks3d(segments);
  return [
    node("Line", {
      positions: packed.positions,
      topology: packed.topology,
      color: (layer.params.color as string) ?? "#3b82f6",
      width: (layer.params.strokeWidth as number) ?? 2,
      ...(opacity !== 1 ? { opacity } : {}),
      ...depthProps(SEGMENT_3D_DEPTH, opacity < 1),
    }),
  ];
}
