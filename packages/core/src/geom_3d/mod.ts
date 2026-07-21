// 3D geoms in core (parallel to geom/). Self-contained lowering + emission for
// the flat-native, GPU-projected 3D pipeline. See docs/DESIGN_3D_IN_CORE.md.
// Kept out of the top-level core barrel until the render wiring lands; import
// from "@gggplot/core/geom_3d" or this module directly.
export * from "./types.ts";
export * from "./camera.ts";
export * from "./packing.ts";
export * from "./point.ts";
export * from "./emit.ts";

import type { Geom3DKind, Point3DSpec, Render3DNode } from "./types.ts";
import { lowerPoint3d } from "./point.ts";

/** Parallel 3D geom registry: kind -> lowering. One entry today (point_3d). */
export const GEOM3D_REGISTRY: Record<
  Geom3DKind,
  (spec: Point3DSpec) => Render3DNode
> = {
  point_3d: lowerPoint3d,
};

/** Lower any registered 3D spec to a Render3DNode. */
export function compile3d(spec: Point3DSpec): Render3DNode {
  return GEOM3D_REGISTRY[spec.geom](spec);
}
