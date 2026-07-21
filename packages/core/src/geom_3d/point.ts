import type { Point3DSpec, Range3D, Render3DNode } from "./types.ts";
import { cameraViewProjection } from "./camera.ts";
import { packPoints3d } from "./packing.ts";

function numericColumn(spec: Point3DSpec, name: string): number[] {
  const column = spec.data[name];
  if (!column) {
    throw new Error(`[gggplot/geom_3d] missing mapped column: ${name}`);
  }
  return column.map((value) => Number(value));
}

/** [lo, hi] over finite values; a degenerate domain is padded by 0.5 (as 2D scale training does). */
function domainOf(values: number[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < lo) lo = value;
    if (value > hi) hi = value;
  }
  if (!Number.isFinite(lo)) return [0, 1];
  return lo === hi ? [lo - 0.5, hi + 0.5] : [lo, hi];
}

/**
 * Lower a geom_point_3d spec to a Render3DNode: flat vec4 DATA-space
 * positions, trained x/y/z domains, and a GPU camera matrix. No CPU
 * projection — position z is the raw data z.
 */
export function lowerPoint3d(spec: Point3DSpec): Render3DNode {
  if (spec.geom !== "point_3d") {
    throw new Error(
      `[gggplot/geom_3d] expected geom "point_3d", got "${spec.geom}"`,
    );
  }
  const xs = numericColumn(spec, spec.mapping.x);
  const ys = numericColumn(spec, spec.mapping.y);
  const zs = numericColumn(spec, spec.mapping.z);
  if (xs.length !== ys.length || xs.length !== zs.length) {
    throw new Error(
      "[gggplot/geom_3d] x, y, and z columns must have equal length",
    );
  }
  const sizes = spec.mapping.size
    ? numericColumn(spec, spec.mapping.size)
    : undefined;
  const colorColumn = spec.mapping.color
    ? spec.data[spec.mapping.color]
    : undefined;
  if (spec.mapping.color && !colorColumn) {
    throw new Error(
      `[gggplot/geom_3d] missing mapped column: ${spec.mapping.color}`,
    );
  }
  const colors = colorColumn?.map((value) => String(value));

  const packed = packPoints3d({ xs, ys, zs, colors, sizes });
  const range: Range3D = [domainOf(xs), domainOf(ys), domainOf(zs)];

  return {
    kind: "point_3d",
    positions: packed.positions,
    ...(packed.colors ? { colors: packed.colors } : {}),
    ...(packed.sizes ? { sizes: packed.sizes } : {}),
    color: spec.params?.color ?? "#3b82f6",
    size: spec.params?.size ?? 6,
    opacity: spec.params?.alpha ?? 1,
    depthTest: spec.params?.depthTest ?? true,
    range,
    cameraMatrix: cameraViewProjection(spec.camera),
  };
}
