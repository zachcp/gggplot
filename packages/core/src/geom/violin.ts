// geom_violin — one mirrored density loop per group, packed into a single
// ChunkedFace node per layer (gggplot-tzc.4). A mirrored density outline is
// not guaranteed convex, so this uses the concave-capable triangulation path
// (concave: true) — see render/chunked_face.tsx's spike writeup.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { splitByEffectiveGroup } from "../group/mod.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import { colorsOf, type FaceLoop, packFaceLoops, valuesOf } from "./shared.ts";

/** Lower a dense y-density product to one mirrored density loop per group, packed into a single ChunkedFace node. */
export function lowerViolin(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;
  const colorScale = ctx.scales.color;
  const fillScale = ctx.scales.fill;

  const loops: FaceLoop[] = [];
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
    loops.push({
      positions: [...right, ...left],
      fill: colors?.[0] ?? (layer.params.fill as string) ?? "#3b82f6",
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
