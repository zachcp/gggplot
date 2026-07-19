// geom_segment / annotate("segment") — one disjoint Line segment per row.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import { packUniformChunks, valuesOf } from "./shared.ts";

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
