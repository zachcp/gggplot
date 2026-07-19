// geom_tile / geom_raster — full-resolution cell rectangles.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import { widenForTileAxis } from "../compile/coordinates.ts";
import type { DomainContributionCtx, LayerContext } from "./types.ts";
import { colorsOf, type FaceLoop, packFaceLoops, resolutionOf, valuesOf } from "./shared.ts";

/**
 * geom_tile domain contribution: cells extend half a cell beyond their center
 * point on each axis, so widen x/y to cover the edge cells that the trained
 * (point-based) domain would otherwise clip. Honors params.width/height
 * overrides the same way lowerTile does; unlike lowerTile it does not read
 * the resident binwidthX/binwidthY columns (matches pre-existing behavior).
 */
export function tileDomainContribution(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: DomainContributionCtx,
): { x?: [number, number]; y?: [number, number] } | undefined {
  if (!mapping.x || !mapping.y) return undefined;
  const scaledX = (valuesOf(data, mapping.x) ?? []).map((v) =>
    scalePosition(ctx.xScale, v)
  );
  const scaledY = (valuesOf(data, mapping.y) ?? []).map((v) =>
    scalePosition(ctx.yScale, v)
  );
  const width = (layer.params.width as number) ??
    resolutionOf(ctx.xScale, scaledX);
  const height = (layer.params.height as number) ??
    resolutionOf(ctx.yScale, scaledY);
  return {
    x: widenForTileAxis(ctx.xDomain, scaledX, width),
    y: widenForTileAxis(ctx.yDomain, scaledY, height),
  };
}

/**
 * Lower a geom_tile/geom_raster layer to a single ChunkedFace node
 * (gggplot-tzc.4) of full-resolution cell rectangles, one loop per row,
 * centered on (x,y) and colored by the mapped fill/color. Cell size defaults
 * to each axis's resolution (the smallest gap between distinct values, or 1
 * level-index unit for a discrete axis) so adjacent cells tile edge-to-edge
 * with no gaps, matching ggplot2's default; `params.width`/`params.height`
 * override it. Cells are always axis-aligned rectangles (guaranteed convex),
 * so triangulation uses the fan path (concave: false).
 */
export function lowerTile(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;

  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  if (!xs || !ys) return [];

  const n = Math.min(xs.length, ys.length);
  const scaledX = xs.map((v) => scalePosition(xScale, v));
  const scaledY = ys.map((v) => scalePosition(yScale, v));
  const width = (layer.params.width as number) ?? resolutionOf(xScale, scaledX);
  const height = (layer.params.height as number) ??
    resolutionOf(yScale, scaledY);
  const productWidth = valuesOf(data, "binwidthX")?.[0];
  const productHeight = valuesOf(data, "binwidthY")?.[0];
  const cellWidth = typeof productWidth === "number" ? productWidth : width;
  const cellHeight = typeof productHeight === "number" ? productHeight : height;

  const positions: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const x = scaledX[i];
    const y = scaledY[i];
    positions.push([
      [x - cellWidth / 2, y - cellHeight / 2],
      [x - cellWidth / 2, y + cellHeight / 2],
      [x + cellWidth / 2, y + cellHeight / 2],
      [x + cellWidth / 2, y - cellHeight / 2],
    ]);
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
  const metadata = typeof layer.params.fun === "function"
    ? { execution: "cpu-custom-summary", nonSerializable: true }
    : {};

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
      ...metadata,
    }),
  ];
}
