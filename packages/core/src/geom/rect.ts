import { lowerRect3d } from "./surface_3d.ts";
// geom_rect / annotate("rect") — one rectangle loop per row.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import { colorsOf, type FaceLoop, packFaceLoops, valuesOf } from "./shared.ts";

/**
 * Lower an annotate("rect", ...)/geom_rect layer (xmin, xmax, ymin, ymax) to a
 * single ChunkedFace node (gggplot-tzc.4) of rectangle loops, one per row.
 * Rectangles are always axis-aligned (guaranteed convex), so this uses fan
 * triangulation (concave: false).
 */
export function lowerRect(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  if (mapping.z != null) return lowerRect3d(layer, mapping, data, ctx);
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;

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

  const colors = colorsOf(
    mapping,
    data,
    ctx.scales.color,
    ctx.scales.fill,
    "fillOrColor",
  );
  const fill = (layer.params.fill as string) ??
    (layer.params.color as string) ?? "#3b82f6";
  if (positions.length === 0) return [];
  const loops: FaceLoop[] = colors
    ? positions.map((position, i) => ({ positions: position, fill: colors[i] }))
    : positions.map((position) => ({ positions: position, fill }));
  const packed = packFaceLoops(loops);
  return [
    node("ChunkedFace", {
      positions: packed.positions,
      topology: packed.topology,
      colors: packed.colors,
      concave: false,
    }),
  ];
}
