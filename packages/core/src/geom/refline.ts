// geom_hline / geom_vline / geom_abline — panel-spanning reference lines.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import { literalLineProps, packUniformChunks, valuesOf } from "./shared.ts";

/**
 * Lower a geom_hline layer (one or more literal yintercepts) to full-width
 * Line segments spanning the panel's x domain. gggplot-tzc.3: positions pack
 * into one FlatTensor + MarkTopology (packUniformChunks); component stays
 * 'Line' — reference lines are never geom_line's per-group ChunkedLine (the
 * MANDATORY test: a grouped geom_line + an hline in the same spec lowers to
 * 'ChunkedLine' + 'Line' respectively — see the bd note on gggplot-tzc.3).
 */
export function lowerHline(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const yScale = ctx.scales.y;
  const xDomain = ctx.xDomain;
  const ys = valuesOf(data, mapping.y);
  if (!ys) return [];

  const segments = ys.map((v): [number, number][] => {
    const y = scalePosition(yScale, v);
    return [[xDomain[0], y], [xDomain[1], y]];
  });
  const color = (layer.params.color as string) ?? "#000000";
  const packed = packUniformChunks(segments);
  return [
    node("Line", {
      positions: packed.positions,
      topology: packed.topology,
      color,
      ...literalLineProps(layer, 1),
    }),
  ];
}

/** Lower a geom_vline layer (one or more literal xintercepts) to full-height Line segments spanning the panel's y domain. gggplot-tzc.3: see lowerHline. */
export function lowerVline(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yDomain = ctx.yDomain;
  const xs = valuesOf(data, mapping.x);
  if (!xs) return [];

  const segments = xs.map((v): [number, number][] => {
    const x = scalePosition(xScale, v);
    return [[x, yDomain[0]], [x, yDomain[1]]];
  });
  const color = (layer.params.color as string) ?? "#000000";
  const packed = packUniformChunks(segments);
  return [
    node("Line", {
      positions: packed.positions,
      topology: packed.topology,
      color,
      ...literalLineProps(layer, 1),
    }),
  ];
}

/** Lower a geom_abline layer (literal slope/intercept, default 1/0) to a single Line spanning the panel's x domain. gggplot-tzc.3: see lowerHline. */
export function lowerAbline(
  layer: Layer,
  _mapping: Aes,
  _data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const [x0, x1] = ctx.xDomain;
  const slope = (layer.params.slope as number) ?? 1;
  const intercept = (layer.params.intercept as number) ?? 0;
  const positions: [number, number][] = [[x0, slope * x0 + intercept], [
    x1,
    slope * x1 + intercept,
  ]];
  const color = (layer.params.color as string) ?? "#000000";
  const packed = packUniformChunks([positions]);
  return [node("Line", {
    positions: packed.positions,
    topology: packed.topology,
    color,
    ...literalLineProps(layer, 1),
  })];
}
