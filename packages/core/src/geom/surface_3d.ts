// Planar 3D surfaces shared by geom_polygon, geom_rect, geom_area, and
// geom_ribbon.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import type { DepthPolicy } from "./types.ts";
import { colorsOf, depthProps, resolutionOf, valuesOf } from "./shared.ts";
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
    const colors = colorsOf(
      m,
      d,
      ctx.scales.color,
      ctx.scales.fill,
      "fillOrColor",
    );
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

/**
 * The six faces of an axis-aligned box, as closed rings.
 *
 * A prism is drawn as planar surfaces rather than through the instanced
 * PrismInstances3D primitive because that primitive is reached only through
 * the runtime SceneExtras host hook — it is not something compile() can emit.
 * Six rings per box reuses the surface path this module already provides and
 * keeps prisms inside the serializable RenderTree; instancing is a
 * performance question for dense lattices, filed separately.
 */
export function boxLoops(
  center: [number, number, number],
  size: [number, number, number],
  fill: string,
): FaceLoop3D[] {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size;
  const x0 = cx - sx / 2, x1 = cx + sx / 2;
  const y0 = cy - sy / 2, y1 = cy + sy / 2;
  const z0 = cz - sz / 2, z1 = cz + sz / 2;
  const ring = (
    positions: [number, number, number][],
  ): FaceLoop3D => ({ positions, fill });
  return [
    ring([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]),
    ring([[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]]),
    ring([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]]),
    ring([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]]),
    ring([[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]]),
    ring([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]),
  ];
}

/** Emit a set of boxes as one packed surface node. */
export function boxNode(
  layer: Layer,
  boxes: {
    center: [number, number, number];
    size: [number, number, number];
    fill: string;
  }[],
): RenderNode[] {
  return surfaceNode(
    layer,
    boxes.flatMap((box) => boxLoops(box.center, box.size, box.fill)),
  );
}

/**
 * geom_col in 3D: one rectangular prism per row.
 *
 * This is a distinct 3D primitive, not a z extension. A 2D bar has one
 * categorical axis and one measured extent; a prism has two footprint axes,
 * and the second one is an ordinary mapped position (`z`) whose thickness
 * comes from a `zwidth` param defaulting to the scale resolution — exactly how
 * `width` already works on x. There is no depthMode enum: "constant depth" is
 * the param's default, and mapping the thickness later is an additive change
 * that needs no new mode.
 *
 * Stacking groups by the (x, z) FOOTPRINT CELL rather than by x alone. The 2D
 * stackBars helper keys on x only, which in 3D would pile up prisms that share
 * an x but sit at different depths.
 */
export function lowerPrism3d(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  const zs = valuesOf(data, mapping.z);
  if (!xs || !ys || !zs) return [];

  const rows: { x: number; y: number; z: number; row: number }[] = [];
  const n = Math.min(xs.length, ys.length, zs.length);
  for (let row = 0; row < n; row++) {
    if (xs[row] == null || ys[row] == null || zs[row] == null) continue;
    const point = {
      x: scalePosition(ctx.scales.x, xs[row]),
      y: scalePosition(ctx.scales.y, ys[row]),
      z: scalePosition(ctx.scales.z, zs[row]),
      row,
    };
    if (![point.x, point.y, point.z].every(Number.isFinite)) continue;
    rows.push(point);
  }
  if (!rows.length) return [];

  const width = typeof layer.params.width === "number"
    ? layer.params.width
    : resolutionOf(ctx.scales.x, rows.map((r) => r.x)) * 0.9;
  const zwidth = typeof layer.params.zwidth === "number"
    ? layer.params.zwidth
    : resolutionOf(ctx.scales.z, rows.map((r) => r.z)) * 0.9;

  // Stack within a footprint cell; identity leaves every prism on the floor.
  const stacking = layer.position === "stack";
  const cursor = new Map<string, number>();
  const colors = colorsOf(
    mapping,
    data,
    ctx.scales.color,
    ctx.scales.fill,
    "fillOrColor",
  );
  const fallback = (layer.params.fill as string) ??
    (layer.params.color as string) ?? "#3b82f6";

  const boxes = rows.map((r) => {
    const key = `${r.x}|${r.z}`;
    const base = stacking ? cursor.get(key) ?? 0 : 0;
    const top = base + r.y;
    if (stacking) cursor.set(key, top);
    return {
      center: [r.x, (base + top) / 2, r.z] as [number, number, number],
      size: [width, Math.abs(top - base), zwidth] as [number, number, number],
      fill: colors?.[r.row] ?? fallback,
    };
  });
  return boxNode(layer, boxes);
}

/**
 * geom_voxel: one occupancy cell per non-empty lattice bin.
 *
 * Cell size comes from the binWidth columns stat_bin_3d emits, so voxels tile
 * exactly. A `padding` param shrinks each box toward its center, which makes
 * individual cells legible in a dense lattice; it is a rendering affordance
 * and does not change the bin the cell represents.
 */
export function lowerVoxel(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  const zs = valuesOf(data, mapping.z);
  const wx = valuesOf(data, "binWidthX");
  const wy = valuesOf(data, "binWidthY");
  const wz = valuesOf(data, "binWidthZ");
  if (!xs || !ys || !zs) return [];

  const colors = colorsOf(
    mapping,
    data,
    ctx.scales.color,
    ctx.scales.fill,
    "fillOrColor",
  );
  const fallback = (layer.params.fill as string) ??
    (layer.params.color as string) ?? "#3b82f6";
  const padding = typeof layer.params.padding === "number"
    ? Math.min(Math.max(layer.params.padding, 0), 1)
    : 0;

  const boxes = [];
  const n = Math.min(xs.length, ys.length, zs.length);
  for (let row = 0; row < n; row++) {
    if (xs[row] == null || ys[row] == null || zs[row] == null) continue;
    const cx = scalePosition(ctx.scales.x, xs[row]);
    const cy = scalePosition(ctx.scales.y, ys[row]);
    const cz = scalePosition(ctx.scales.z, zs[row]);
    if (![cx, cy, cz].every(Number.isFinite)) continue;
    // Widths are in data units; scale the cell's far corner rather than the
    // width itself, so a non-linear position scale still tiles correctly.
    const half = (
      raw: number[] | undefined,
      centerRaw: unknown,
      center: number,
      scale: Parameters<typeof scalePosition>[0],
    ): number => {
      const width = raw?.[row];
      if (typeof width !== "number" || !Number.isFinite(width)) return 0;
      const edge = scalePosition(scale, Number(centerRaw) + width / 2);
      return Number.isFinite(edge) ? Math.abs(edge - center) : 0;
    };
    const sx = half(wx as number[], xs[row], cx, ctx.scales.x) * 2;
    const sy = half(wy as number[], ys[row], cy, ctx.scales.y) * 2;
    const sz = half(wz as number[], zs[row], cz, ctx.scales.z) * 2;
    const shrink = 1 - padding;
    boxes.push({
      center: [cx, cy, cz] as [number, number, number],
      size: [sx * shrink, sy * shrink, sz * shrink] as [number, number, number],
      fill: colors?.[row] ?? fallback,
    });
  }
  return boxNode(layer, boxes);
}

export class SurfaceGridError extends TypeError {
  override name = "SurfaceGridError";
}

/**
 * geom_surface: a grid-connected height field, z = f(x, y).
 *
 * Named for what it draws. "mesh" would promise arbitrary topology, which is
 * an explicit non-goal — this triangulates by grid adjacency and nothing else.
 *
 * The grid contract is declared rather than inferred. Every combination of the
 * distinct x and y values must appear exactly once, because inferring
 * adjacency from scattered points is a triangulation problem this geom does
 * not solve; scattered input fails with that message instead of being turned
 * into a sparse lattice of mostly-holes.
 *
 * A missing z leaves a hole: the up-to-four quads touching that corner are
 * dropped rather than interpolated across, which would fabricate terrain.
 */
export function lowerSurface3d(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  const zs = valuesOf(data, mapping.z);
  if (!xs || !ys || !zs) return [];

  const n = Math.min(xs.length, ys.length, zs.length);
  const xKeys = [...new Set(xs.slice(0, n).map(Number))].sort((a, b) => a - b);
  const yKeys = [...new Set(ys.slice(0, n).map(Number))].sort((a, b) => a - b);
  if (xKeys.length < 2 || yKeys.length < 2) {
    throw new SurfaceGridError(
      "[gggplot] geom_surface requires a grid with at least two distinct x " +
        "and two distinct y values",
    );
  }
  if (n !== xKeys.length * yKeys.length) {
    throw new SurfaceGridError(
      `[gggplot] geom_surface requires a complete grid: ${xKeys.length} x ` +
        `values by ${yKeys.length} y values needs ${
          xKeys.length * yKeys.length
        } rows, got ${n}. Scattered points are not a height field; ` +
        "triangulating them is not something this geom does.",
    );
  }

  const xIndex = new Map(xKeys.map((value, index) => [value, index]));
  const yIndex = new Map(yKeys.map((value, index) => [value, index]));
  // A cell holds its scaled vertex, or undefined where z is missing.
  const cells = new Array<
    { x: number; y: number; z: number } | undefined
  >(xKeys.length * yKeys.length).fill(undefined);
  const seen = new Uint8Array(cells.length);
  for (let row = 0; row < n; row++) {
    const xi = xIndex.get(Number(xs[row]));
    const yi = yIndex.get(Number(ys[row]));
    if (xi === undefined || yi === undefined) continue;
    const slot = yi * xKeys.length + xi;
    if (seen[slot]) {
      throw new SurfaceGridError(
        `[gggplot] geom_surface found a duplicate grid position at x=${
          xs[row]
        }, y=${ys[row]}; each cell must appear exactly once`,
      );
    }
    seen[slot] = 1;
    // Raw check before scaling: ingest turns NaN into null and scalePosition
    // maps null onto a finite coordinate (gggplot-ybv), so a hole would
    // otherwise become a vertex at an invented height.
    if (zs[row] == null) continue;
    const point = {
      x: scalePosition(ctx.scales.x, xs[row]),
      y: scalePosition(ctx.scales.y, ys[row]),
      z: scalePosition(ctx.scales.z, zs[row]),
    };
    if (![point.x, point.y, point.z].every(Number.isFinite)) continue;
    cells[slot] = point;
  }

  const colors = colorsOf(
    mapping,
    data,
    ctx.scales.color,
    ctx.scales.fill,
    "fillOrColor",
  );
  const fallback = (layer.params.fill as string) ??
    (layer.params.color as string) ?? "#3b82f6";

  const loops: FaceLoop3D[] = [];
  for (let yi = 0; yi < yKeys.length - 1; yi++) {
    for (let xi = 0; xi < xKeys.length - 1; xi++) {
      const corners = [
        cells[yi * xKeys.length + xi],
        cells[yi * xKeys.length + xi + 1],
        cells[(yi + 1) * xKeys.length + xi + 1],
        cells[(yi + 1) * xKeys.length + xi],
      ];
      // One missing corner drops the quad. The hole is the honest rendering
      // of absent data; bridging it would invent terrain.
      if (corners.some((corner) => corner === undefined)) continue;
      loops.push({
        positions: corners.map((
          corner,
        ): [number, number, number] => [corner!.x, corner!.y, corner!.z]),
        fill: colors?.[yi * xKeys.length + xi] ?? fallback,
      });
    }
  }
  return surfaceNode(layer, loops);
}
