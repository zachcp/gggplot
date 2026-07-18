// geom_polygon — one closed loop per effective group.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { splitByEffectiveGroup } from "../group/mod.ts";
import type { LayerContext } from "./types.ts";
import { colorsOf, positionsOf } from "./shared.ts";

export function lowerPolygon(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;
  const colorScale = ctx.scales.color;
  const fillScale = ctx.scales.fill;

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
