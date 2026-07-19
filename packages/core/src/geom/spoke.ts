// geom_spoke — rays from x/y using angle (radians) and radius aesthetics.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import {
  literalLineProps,
  packUniformChunks,
  requiredValues,
} from "./shared.ts";

export function lowerSpoke(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;

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
  const packed = packUniformChunks(positions);
  return [node("Line", {
    positions: packed.positions,
    topology: packed.topology,
    color: (layer.params.color as string) ?? "#3b82f6",
    ...literalLineProps(layer, 1),
  })];
}
