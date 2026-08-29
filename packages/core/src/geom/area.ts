import { lowerArea3d } from "./surface_3d.ts";
// geom_area / geom_ribbon — filled bands, plus the stacked-silhouette variant.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { splitByEffectiveGroup } from "../group/mod.ts";
import { scalePosition, type TrainedScale } from "../scale/mod.ts";
import type { DomainContributionCtx, LayerContext } from "./types.ts";
import {
  bandPositions,
  colorsOf,
  type FaceLoop,
  packFaceLoops,
  valuesOf,
} from "./shared.ts";

/** Wrap a layer's collected per-group band loops into the single ChunkedFace node the layer emits (gggplot-tzc.4: one Face node per layer). Bands can wiggle/self-cross, so this uses the concave-capable triangulation path (concave: true). */
function faceNodesFor(loops: FaceLoop[]): RenderNode[] {
  if (loops.length === 0) return [];
  const packed = packFaceLoops(loops);
  return [
    node("ChunkedFace", {
      positions: packed.positions,
      topology: packed.topology,
      colors: packed.colors,
      concave: true,
    }),
  ];
}

function lowerStackedAreaLayer(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
): RenderNode[] {
  const positive = new Map<number, number>();
  const negative = new Map<number, number>();
  const loops: FaceLoop[] = [];
  for (const group of splitByEffectiveGroup(mapping, data)) {
    const xs = valuesOf(group.data, group.mapping.x) ?? [];
    const ys = valuesOf(group.data, group.mapping.y) ?? [];
    const rows: Array<{ x: number; y0: number; y1: number }> = [];
    for (let row = 0; row < Math.min(xs.length, ys.length); row++) {
      const x = scalePosition(xScale, xs[row]);
      const y = Number(ys[row]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const cumulative = y >= 0 ? positive : negative;
      const y0 = cumulative.get(x) ?? 0;
      const y1 = y0 + y;
      cumulative.set(x, y1);
      rows.push({ x, y0, y1 });
    }
    rows.sort((a, b) => a.x - b.x);
    if (!rows.length) continue;
    const positions: [number, number][] = [
      ...rows.map((
        { x, y1 },
      ): [number, number] => [x, scalePosition(yScale, y1)]),
      ...rows.toReversed().map((
        { x, y0 },
      ): [number, number] => [x, scalePosition(yScale, y0)]),
    ];
    const colors = colorsOf(
      group.mapping,
      group.data,
      colorScale,
      fillScale,
      "fillOrColor",
    );
    loops.push({
      positions,
      fill: colors?.[0] ?? (layer.params.fill as string) ??
        (layer.params.color as string) ?? "#3b82f6",
    });
  }
  return faceNodesFor(loops);
}

function lowerSilhouetteAreaLayer(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
): RenderNode[] {
  const groups = splitByEffectiveGroup(mapping, data);
  const totals = new Map<number, number>();
  for (const group of groups) {
    const xs = valuesOf(group.data, group.mapping.x) ?? [];
    const ys = valuesOf(group.data, group.mapping.y) ?? [];
    for (let row = 0; row < Math.min(xs.length, ys.length); row++) {
      const x = scalePosition(xScale, xs[row]);
      const y = Number(ys[row]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      totals.set(x, (totals.get(x) ?? 0) + y);
    }
  }
  const cumulative = new Map<number, number>();
  for (const [x, total] of totals) cumulative.set(x, -total / 2);
  const loops: FaceLoop[] = [];
  for (const group of groups) {
    const xs = valuesOf(group.data, group.mapping.x) ?? [];
    const ys = valuesOf(group.data, group.mapping.y) ?? [];
    const rows: Array<{ x: number; y0: number; y1: number }> = [];
    for (let row = 0; row < Math.min(xs.length, ys.length); row++) {
      const x = scalePosition(xScale, xs[row]);
      const y = Number(ys[row]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const y0 = cumulative.get(x) ?? 0;
      const y1 = y0 + y;
      cumulative.set(x, y1);
      rows.push({ x, y0, y1 });
    }
    rows.sort((a, b) => a.x - b.x);
    if (!rows.length) continue;
    const positions: [number, number][] = [
      ...rows.map((
        { x, y1 },
      ): [number, number] => [x, scalePosition(yScale, y1)]),
      ...rows.toReversed().map((
        { x, y0 },
      ): [number, number] => [x, scalePosition(yScale, y0)]),
    ];
    const colors = colorsOf(
      group.mapping,
      group.data,
      colorScale,
      fillScale,
      "fillOrColor",
    );
    loops.push({
      positions,
      fill: colors?.[0] ?? (layer.params.fill as string) ??
        (layer.params.color as string) ?? "#3b82f6",
    });
  }
  return faceNodesFor(loops);
}

/**
 * geom_area domain contribution: a stacked silhouette (position "stack",
 * params.offset "silhouette") symmetrizes each group's cumulative total
 * around 0 rather than baselining at 0, so the trained y domain — built from
 * individual rows — undershoots the rendered extent. Silhouette widens to a
 * symmetric half-total; ordinary stacking widens to separate positive and
 * negative cumulative totals, matching position_stack semantics.
 */
export function areaDomainContribution(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: DomainContributionCtx,
): { x?: [number, number]; y?: [number, number] } | undefined {
  if (
    !(layer.geom === "area" && layer.position === "stack" && mapping.x &&
      mapping.y)
  ) {
    return undefined;
  }
  const xs = valuesOf(data, mapping.x) ?? [];
  const ys = valuesOf(data, mapping.y) ?? [];
  const positive = new Map<string, number>();
  const negative = new Map<string, number>();
  for (let row = 0; row < Math.min(xs.length, ys.length); row++) {
    const y = Number(ys[row]);
    if (!Number.isFinite(y)) continue;
    const key = String(xs[row]);
    const totals = y >= 0 ? positive : negative;
    totals.set(key, (totals.get(key) ?? 0) + y);
  }
  if (layer.params.offset !== "silhouette") {
    return {
      y: [
        Math.min(ctx.yDomain[0], 0, ...negative.values()),
        Math.max(ctx.yDomain[1], 0, ...positive.values()),
      ],
    };
  }
  const combined = new Map<string, number>();
  for (const [key, value] of positive) combined.set(key, value);
  for (const [key, value] of negative) {
    combined.set(key, (combined.get(key) ?? 0) + value);
  }
  const half = Math.max(0, ...combined.values()) / 2;
  return {
    y: [Math.min(ctx.yDomain[0], -half), Math.max(ctx.yDomain[1], half)],
  };
}

/** Lower a geom_area/geom_ribbon layer to a single ChunkedFace node (gggplot-tzc.4) of filled band loops, one per group. */
export function lowerArea(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  if (mapping.z != null) return lowerArea3d(layer, mapping, data, ctx);
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;
  const colorScale = ctx.scales.color;
  const fillScale = ctx.scales.fill;

  if (
    layer.geom === "area" && layer.position === "stack" &&
    layer.params.offset === "silhouette"
  ) {
    return lowerSilhouetteAreaLayer(
      layer,
      mapping,
      data,
      xScale,
      yScale,
      colorScale,
      fillScale,
    );
  }
  if (layer.geom === "area" && layer.position === "stack") {
    return lowerStackedAreaLayer(
      layer,
      mapping,
      data,
      xScale,
      yScale,
      colorScale,
      fillScale,
    );
  }
  const fill = (layer.params.fill as string) ??
    (layer.params.color as string) ?? "#3b82f6";
  const loops: FaceLoop[] = splitByEffectiveGroup(mapping, data)
    .map(({ mapping: m, data: d }) => {
      const positions = bandPositions(m, d, xScale, yScale);
      const colors = colorsOf(m, d, colorScale, fillScale, "fillOrColor");
      return positions.length ? { positions, fill: colors?.[0] ?? fill } : null;
    })
    .filter((l): l is FaceLoop => l !== null);
  return faceNodesFor(loops);
}
