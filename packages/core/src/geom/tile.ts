// geom_tile / geom_raster — full-resolution cell rectangles.
import type { Aes, DataFrame, GGSpec, Layer } from "../ir/types.ts";
import type { TypedDataFrame } from "../data/mod.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import { widenForTileAxis } from "../compile/coordinates.ts";
import {
  RESIDENT_STAT_BIN_TILES_PRODUCT,
  type ResidentTileNodeProps,
} from "../compile/resident.ts";
import type {
  DomainContributionCtx,
  LayerContext,
  ResidentProductProps,
} from "./types.ts";
import { explicitDomain, residentBarPalette } from "./bar.ts";
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
 * geom_tile's GPU-resident capability: the dense [group, bin] tile strip
 * (heatmap rows) over the resident stat_bin grid — x is the binned continuous
 * axis, each factor group is one y row, and the kernels' tileVertices output
 * draws every cell with no CPU count readback.
 *
 * DSL surface: `geomTile({ stat: "bin" })` with a numeric x, NO y mapping, and
 * rows driven by the same fill/color/group factor derivation the resident bar
 * path uses. This combination is an explicit opt-in — no DSL helper defaults a
 * tile layer to stat "bin" — and it is only offered as the STANDALONE view
 * form: the strip's y range is the statically-known group-row count
 * ([0, groups]), which the standalone view owns; an inline panel mark would
 * fight the panel's trained y domain, so multi-layer/faceted specs fall back.
 *
 * CPU-fallback caveat (for the residency matrix): with `resident` off, the
 * same spec routes through statBin → lowerTile, which renders the stat rows as
 * (bin center, count) cells rather than a per-group heatmap strip — the CPU
 * grammar has no tile-grid product yet. The resident path is therefore the
 * authoritative renderer for this opt-in combination.
 */
export function tileResidentPlan(
  spec: GGSpec,
  layer: Layer,
  mapping: Aes,
  data: TypedDataFrame,
  opts: { standalone: boolean },
): ResidentProductProps | undefined {
  if (
    !opts.standalone ||
    spec.execution?.resident === false ||
    spec.coord.kind !== "cartesian" || spec.facet.kind !== "none" ||
    layer.geom !== "tile" || layer.stat !== "bin" ||
    mapping.y || "weight" in layer.params
  ) return undefined;

  // Same fill/color eligibility as barResidentPlan: a factor column with a
  // default scale that itself drives grouping; anything else stays on CPU.
  const colorAes: "fill" | "color" | undefined = mapping.fill
    ? "fill"
    : mapping.color
    ? "color"
    : undefined;
  const colorCol = colorAes ? mapping[colorAes] : undefined;
  if (colorCol) {
    const colorColumn = data[colorCol];
    const declaredScale = spec.scales.find((scale) => scale.aes === colorAes);
    if (colorColumn?.type !== "factor" || declaredScale) return undefined;
    if (mapping.group && mapping.group !== colorCol) return undefined;
  }

  const x = mapping.x;
  const xColumn = x ? data[x] : undefined;
  if (!x || xColumn?.type !== "numeric") return undefined;

  // A heatmap strip needs factor rows; a group-less tile strip is just a
  // histogram and should use the bar product.
  const group = mapping.fill ?? mapping.color ?? mapping.group;
  const groupColumn = group ? data[group] : undefined;
  if (!group || groupColumn?.type !== "factor") return undefined;
  const groupsCount = groupColumn.levels.length;
  const paletteColors = colorCol
    ? residentBarPalette(data, colorCol, groupColumn.levels)
    : undefined;

  const requestedBinwidth = layer.params.binwidth;
  const requestedBins = layer.params.bins;
  if (
    requestedBinwidth != null &&
      (typeof requestedBinwidth !== "number" || requestedBinwidth <= 0) ||
    requestedBins != null &&
      (typeof requestedBins !== "number" || requestedBins <= 0)
  ) return undefined;
  const bins = (requestedBins as number | undefined) ?? 30;
  const xDomain = explicitDomain(spec, "x");
  const shared = {
    binwidth: requestedBinwidth as number | undefined,
    bins: requestedBinwidth == null ? bins : undefined,
    groupsCount,
    // Tiles are a dense grid; bar-position layout does not apply.
    position: "identity" as const,
  };
  const nodeProps: ResidentTileNodeProps = {
    data,
    x,
    group,
    options: xDomain
      ? { lo: xDomain[0], hi: xDomain[1], ...shared }
      : { autoDomain: true, ...shared },
    color: (layer.params.fill as string) ?? (layer.params.color as string) ??
      "#3b82f6",
    opacity: layer.params.alpha as number | undefined,
    paletteColors,
  };
  return {
    product: RESIDENT_STAT_BIN_TILES_PRODUCT,
    props: nodeProps as unknown as Record<string, unknown>,
    standaloneView: true,
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
