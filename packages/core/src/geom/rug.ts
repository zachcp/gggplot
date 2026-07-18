// geom_rug — short observation ticks along the panel edges.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import { literalLineProps, valuesOf } from "./shared.ts";

export function lowerRug(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;
  const xDomain = ctx.xDomain;
  const yDomain = ctx.yDomain;
  const panelPixels = ctx.panelPixels;

  const sides = String(layer.params.sides ?? "bl");
  if (!/^[btlr]+$/.test(sides) || new Set(sides).size !== sides.length) {
    throw new TypeError(
      'geomRug sides must contain unique letters from "btlr"',
    );
  }
  const length = Number(layer.params.length ?? 5);
  if (!Number.isFinite(length) || length < 0) {
    throw new TypeError(
      "geomRug length must be a non-negative CSS-pixel value",
    );
  }
  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  if (!xs && !ys) {
    throw new TypeError("geomRug requires a mapped x or y aesthetic");
  }
  const dx = (xDomain[1] - xDomain[0]) * length / panelPixels.width;
  const dy = (yDomain[1] - yDomain[0]) * length / panelPixels.height;
  const positions: [number, number][][] = [];
  for (const value of xs ?? []) {
    const x = scalePosition(xScale, value);
    if (!Number.isFinite(x)) continue;
    if (sides.includes("b")) {
      positions.push([[x, yDomain[0]], [x, yDomain[0] + dy]]);
    }
    if (sides.includes("t")) {
      positions.push([[x, yDomain[1]], [x, yDomain[1] - dy]]);
    }
  }
  for (const value of ys ?? []) {
    const y = scalePosition(yScale, value);
    if (!Number.isFinite(y)) continue;
    if (sides.includes("l")) {
      positions.push([[xDomain[0], y], [xDomain[0] + dx, y]]);
    }
    if (sides.includes("r")) {
      positions.push([[xDomain[1], y], [xDomain[1] - dx, y]]);
    }
  }
  if (!positions.length) return [];
  return [node("Line", {
    positions,
    color: (layer.params.color as string) ?? "#111827",
    ...literalLineProps(layer, 1),
  })];
}
