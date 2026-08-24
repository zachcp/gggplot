// Planar 3D surfaces shared by geom_polygon, geom_rect, geom_area, and
// geom_ribbon.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import type { DepthPolicy } from "./types.ts";
import { colorsOf, depthProps, valuesOf } from "./shared.ts";
import { splitByEffectiveGroup } from "../group/mod.ts";
import { type FaceLoop3D, packFaceLoops3d } from "./packing.ts";

/**
 * Planar surfaces are the first translucent 3D content.
 *
 * A filled surface seen edge-on hides whatever is behind it, so honouring a
 * mapped alpha matters more here than it does for points or thin lines. The
 * matrix's original "translucent" spelling predates the policy vocabulary from
 * gggplot-lcy.10; alphaAware is the same thing expressed as a capability
 * rather than an outcome.
 */
export const SURFACE_3D_DEPTH: DepthPolicy = "alphaAware";

/**
 * Build one ring per group from per-vertex x/y/z.
 *
 * A ring with any non-finite or missing vertex is dropped whole. Closing the
 * ring across the gap would fabricate area, and dropping just the bad vertex
 * would silently reshape the surface — both are worse than drawing nothing.
 */
function ringsFrom(
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
  vertices: (
    m: Aes,
    d: DataFrame,
  ) => { x: number; y: number; z: number }[] | undefined,
  fallbackFill: string,
): FaceLoop3D[] {
  const loops: FaceLoop3D[] = [];
  for (const { mapping: m, data: d } of splitByEffectiveGroup(mapping, data)) {
    const points = vertices(m, d);
    if (!points || points.length < 3) continue;
    if (
      points.some((p) =>
        !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)
      )
    ) continue;
    const colors = colorsOf(m, d, ctx.scales.color, ctx.scales.fill, "fillOrColor");
    loops.push({
      positions: points.map((p): [number, number, number] => [p.x, p.y, p.z]),
      fill: colors?.[0] ?? fallbackFill,
    });
  }
  return loops;
}

function surfaceNode(
  layer: Layer,
  loops: FaceLoop3D[],
): RenderNode[] {
  if (loops.length === 0) return [];
  const opacity = (layer.params.alpha as number) ?? 1;
  const packed = packFaceLoops3d(
    loops.map((loop) => ({ ...loop, alpha: opacity })),
  );
  return [node("ChunkedFace", {
    positions: packed.positions,
    topology: packed.topology,
    colors: packed.colors,
    ...(opacity !== 1 ? { opacity } : {}),
    ...depthProps(SURFACE_3D_DEPTH, opacity < 1),
  })];
}

/** Read a row's scaled position triple, or undefined when any part is absent. */
function triple(
  ctx: LayerContext,
  xRaw: unknown,
  yRaw: unknown,
  zRaw: unknown,
): { x: number; y: number; z: number } | undefined {
  // Raw-value check first: ingest turns NaN into null and scalePosition maps
  // null onto a finite coordinate, so testing only the scaled result would
  // place a vertex the data never had (see gggplot-ybv).
  if (xRaw == null || yRaw == null || zRaw == null) return undefined;
  return {
    x: scalePosition(ctx.scales.x, xRaw),
    y: scalePosition(ctx.scales.y, yRaw),
    z: scalePosition(ctx.scales.z, zRaw),
  };
}

/** geom_polygon: a closed ring per group, positioned per vertex. */
export function lowerPolygon3d(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const fill = (layer.params.fill as string) ??
    (layer.params.color as string) ?? "#3b82f6";
  return surfaceNode(
    layer,
    ringsFrom(mapping, data, ctx, (m, d) => {
      const xs = valuesOf(d, m.x);
      const ys = valuesOf(d, m.y);
      const zs = valuesOf(d, m.z);
      if (!xs || !ys || !zs) return undefined;
      const n = Math.min(xs.length, ys.length, zs.length);
      const points = [];
      for (let i = 0; i < n; i++) {
        const point = triple(ctx, xs[i], ys[i], zs[i]);
        if (!point) return undefined;
        points.push(point);
      }
      return points;
    }, fill),
  );
}

/** geom_rect: an axis-aligned quad lying in the plane at its row's z. */
export function lowerRect3d(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xmins = valuesOf(data, mapping.xmin);
  const xmaxs = valuesOf(data, mapping.xmax);
  const ymins = valuesOf(data, mapping.ymin);
  const ymaxs = valuesOf(data, mapping.ymax);
  const zs = valuesOf(data, mapping.z);
  if (!xmins || !xmaxs || !ymins || !ymaxs || !zs) return [];
  const fill = (layer.params.fill as string) ??
    (layer.params.color as string) ?? "#3b82f6";
  const colors = colorsOf(
    mapping,
    data,
    ctx.scales.color,
    ctx.scales.fill,
    "fillOrColor",
  );

  const n = Math.min(
    xmins.length,
    xmaxs.length,
    ymins.length,
    ymaxs.length,
    zs.length,
  );
  const loops: FaceLoop3D[] = [];
  for (let i = 0; i < n; i++) {
    if (
      xmins[i] == null || xmaxs[i] == null || ymins[i] == null ||
      ymaxs[i] == null || zs[i] == null
    ) continue;
    const x0 = scalePosition(ctx.scales.x, xmins[i]);
    const x1 = scalePosition(ctx.scales.x, xmaxs[i]);
    const y0 = scalePosition(ctx.scales.y, ymins[i]);
    const y1 = scalePosition(ctx.scales.y, ymaxs[i]);
    const z = scalePosition(ctx.scales.z, zs[i]);
    if (![x0, x1, y0, y1, z].every(Number.isFinite)) continue;
    loops.push({
      positions: [[x0, y0, z], [x0, y1, z], [x1, y1, z], [x1, y0, z]],
      fill: colors?.[i] ?? fill,
    });
  }
  return surfaceNode(layer, loops);
}

/**
 * geom_area and geom_ribbon: a band between two y edges, in the plane at z.
 *
 * The band is closed by walking the upper edge in ascending x and the lower
 * edge back, exactly as the 2D path does. It does **not** fill down to a z
 * floor — there is no floor, because the grammar has not chosen one — so a
 * 3D area is a surface standing in its plane, not a solid.
 */
export function lowerArea3d(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const fill = (layer.params.fill as string) ??
    (layer.params.color as string) ?? "#3b82f6";
  return surfaceNode(
    layer,
    ringsFrom(mapping, data, ctx, (m, d) => {
      const xs = valuesOf(d, m.x);
      const zs = valuesOf(d, m.z);
      const upperCol = m.ymax ?? m.y;
      const uppers = valuesOf(d, upperCol);
      const lowers = m.ymin ? valuesOf(d, m.ymin) : undefined;
      if (!xs || !uppers || !zs) return undefined;
      const n = Math.min(
        xs.length,
        uppers.length,
        zs.length,
        lowers ? lowers.length : xs.length,
      );
      const order = [...Array(n).keys()].sort((a, b) =>
        scalePosition(ctx.scales.x, xs[a]) - scalePosition(ctx.scales.x, xs[b])
      );
      const top = [];
      const bottom = [];
      for (const i of order) {
        const upper = triple(ctx, xs[i], uppers[i], zs[i]);
        // A ribbon's lower edge defaults to the 2D baseline of zero, which is
        // a real y value rather than a missing one.
        const lower = triple(ctx, xs[i], lowers ? lowers[i] : 0, zs[i]);
        if (!upper || !lower) return undefined;
        top.push(upper);
        bottom.push(lower);
      }
      return [...top, ...bottom.reverse()];
    }, fill),
  );
}
