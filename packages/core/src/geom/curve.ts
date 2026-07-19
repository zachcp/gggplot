// geom_curve — quadratic-tessellated curved connector per row.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import {
  literalLineProps,
  packUniformChunks,
  requiredValues,
} from "./shared.ts";

export function lowerCurve(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;

  for (const unsupported of ["arrow", "angle", "ncp"]) {
    if (layer.params[unsupported] !== undefined) {
      throw new TypeError(`geomCurve does not support ${unsupported} in V1`);
    }
  }
  const xs = requiredValues("geomCurve", mapping, data, "x");
  const ys = requiredValues("geomCurve", mapping, data, "y");
  const xends = requiredValues("geomCurve", mapping, data, "xend");
  const yends = requiredValues("geomCurve", mapping, data, "yend");
  const curvature = Number(layer.params.curvature ?? 0.5);
  const segments = Number(layer.params.segments ?? 32);
  if (!Number.isFinite(curvature)) {
    throw new TypeError("geomCurve curvature must be a finite number");
  }
  if (!Number.isInteger(segments) || segments < 2) {
    throw new TypeError("geomCurve segments must be an integer of at least 2");
  }
  const n = Math.min(xs.length, ys.length, xends.length, yends.length);
  const positions: [number, number][][] = [];
  for (let row = 0; row < n; row++) {
    const x0 = scalePosition(xScale, xs[row]);
    const y0 = scalePosition(yScale, ys[row]);
    const x1 = scalePosition(xScale, xends[row]);
    const y1 = scalePosition(yScale, yends[row]);
    if (![x0, y0, x1, y1].every(Number.isFinite)) continue;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const controlX = (x0 + x1) / 2 - dy * curvature;
    const controlY = (y0 + y1) / 2 + dx * curvature;
    const curve: [number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const u = 1 - t;
      curve.push([
        u * u * x0 + 2 * u * t * controlX + t * t * x1,
        u * u * y0 + 2 * u * t * controlY + t * t * y1,
      ]);
    }
    positions.push(curve);
  }
  if (!positions.length) return [];
  const packed = packUniformChunks(positions);
  return [node("Line", {
    positions: packed.positions,
    topology: packed.topology,
    color: (layer.params.color as string) ?? "#3b82f6",
    ...literalLineProps(layer, 2),
  })];
}
