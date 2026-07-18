// geom_violin — one mirrored density polygon per group.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { splitByEffectiveGroup } from "../group/mod.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import { colorsOf, valuesOf } from "./shared.ts";

/** Lower a dense y-density product to one mirrored polygon per group. */
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
