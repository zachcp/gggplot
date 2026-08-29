import { lowerPolygon3d } from "./surface_3d.ts";
// geom_polygon — one closed loop per effective group, packed into a single
// ChunkedFace node per layer (gggplot-tzc.4). Arbitrary user-supplied
// outlines are not guaranteed convex, so this uses the concave-capable
// triangulation path (concave: true) — see render/chunked_face.tsx's spike
// writeup.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { splitByEffectiveGroup } from "../group/mod.ts";
import type { LayerContext } from "./types.ts";
import {
  colorsOf,
  type FaceLoop,
  packFaceLoops,
  positionsOf,
} from "./shared.ts";

export function lowerPolygon(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  if (mapping.z != null) return lowerPolygon3d(layer, mapping, data, ctx);
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;
  const colorScale = ctx.scales.color;
  const fillScale = ctx.scales.fill;

  const groups = splitByEffectiveGroup(mapping, data);
  const loops: FaceLoop[] = [];

  for (const { mapping: m, data: d } of groups) {
    const positions = positionsOf(m, d, xScale, yScale);
    if (positions.length < 3) continue;
    const colors = colorsOf(m, d, colorScale, fillScale, "fillOrColor");
    loops.push({
      positions,
      fill: colors?.[0] ?? (layer.params.fill as string) ??
        (layer.params.color as string) ?? "#3b82f6",
    });
  }

  if (loops.length === 0) return [];
  const packed = packFaceLoops(loops);
  return [node("ChunkedFace", {
    positions: packed.positions,
    topology: packed.topology,
    colors: packed.colors,
    concave: true,
  })];
}
