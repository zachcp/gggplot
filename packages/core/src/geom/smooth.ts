// geom_smooth — per-group trend Line with an optional SE ribbon Polygon.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { splitByEffectiveGroup } from "../group/mod.ts";
import type { LayerContext } from "./types.ts";
import {
  bandPositions,
  colorsOf,
  literalLineProps,
  positionsOf,
} from "./shared.ts";

export function lowerSmooth(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;
  const colorScale = ctx.scales.color;
  const fillScale = ctx.scales.fill;

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
