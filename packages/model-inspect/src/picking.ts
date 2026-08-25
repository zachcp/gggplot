/**
 * Ray picking for the 3D model scene (gggplot-i5m.23).
 *
 * The bead assumed a picking path "from the useGPU scene back to stable entity
 * ids" had to be built. Half of it already exists: use.gpu's ViewContext
 * exposes `pick(event) -> [origin, direction]`, a world-space ray straight from
 * a pointer event (workbench/hooks/useFrustumPicker.mjs). And buildModelScene3D
 * already assigns every module, slab, and connector a stable id. What was
 * missing is only the middle: turning that ray into one of those ids.
 *
 * This does it on the CPU against the scene's axis-aligned boxes rather than
 * through GPU picking, because the alternative is worse here.
 * render/prism_instances_3d.tsx expands every tensor cell into a flat triangle
 * batch — one Mesh, 36 vertices per cell, no instancing — so a GPU pick would
 * report a triangle in one undifferentiated draw, not a cell. Per-vertex
 * picking ids would have to be threaded through that geometry first. A slab
 * IS an axis-aligned box with a known centre and size, so the exact answer is
 * a slab test costing nothing.
 */
import type { ModelScene3D } from "./scene3d.ts";

export type PickedEntityKind = "module" | "slab";

export interface PickedEntity {
  /** Stable scene entity id, the same one buildModelScene3D assigned. */
  id: string;
  kind: PickedEntityKind;
  /** Present on slabs that correspond to a declared tensor. */
  tensorId?: string;
  /** Present on modules; the graph node the module was built from. */
  nodeId?: string;
  /** Ray parameter at the entry point, in units of the direction vector. */
  distance: number;
}

type Vec3 = readonly [number, number, number];

/**
 * Slab method for ray vs axis-aligned box.
 *
 * Returns the ray parameter at ENTRY, or null when the ray misses. A ray that
 * starts inside the box returns 0 rather than the negative back-face value, so
 * a camera placed inside a module still picks it.
 *
 * Division by a zero direction component is deliberate and correct here: it
 * yields ±Infinity, which compares the way the slab method needs for a ray
 * exactly parallel to that axis. NaN only arises when the origin sits exactly
 * on the slab plane AND the direction is zero, which the final ordering test
 * rejects along with every other miss.
 */
function intersectBox(
  origin: Vec3,
  direction: Vec3,
  center: Vec3,
  size: Vec3,
): number | null {
  // A zero direction is not a ray. Left unguarded the slab method below turns
  // every component into +/-Infinity and reports a "hit" at infinite distance,
  // which then wins comparisons against real hits.
  if (direction[0] === 0 && direction[1] === 0 && direction[2] === 0) return null;

  let near = -Infinity;
  let far = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const half = Math.abs(size[axis]) / 2;
    const min = center[axis] - half;
    const max = center[axis] + half;
    const inverse = 1 / direction[axis];
    let t0 = (min - origin[axis]) * inverse;
    let t1 = (max - origin[axis]) * inverse;
    if (t0 > t1) [t0, t1] = [t1, t0];
    if (t0 > near) near = t0;
    if (t1 < far) far = t1;
    if (near > far) return null;
  }
  // Entirely behind the camera.
  if (far < 0) return null;
  // Backstop for a non-finite direction component: a real ray always resolves
  // to a finite entry distance on at least one axis.
  if (!Number.isFinite(near) && near > 0) return null;
  return near < 0 ? 0 : near;
}

/**
 * The nearest module or slab the ray enters, or null.
 *
 * Ranking is by entry distance, with ONE containment exception: when the
 * nearest module is the module that encloses the nearest slab, the slab wins.
 *
 * That exception is load-bearing. Every slab sits inside a module box, so a ray
 * reaching a slab always pierces its module first and the module's entry
 * distance is always smaller — ranking by distance alone would make slabs
 * unpickable. But the exception has to be scoped to containment rather than
 * applied as a blanket "slabs beat modules": otherwise a slab far down the ray,
 * in a completely different module, outranks a module the pointer is directly
 * over. Both failure modes are covered by tests.
 *
 * Connectors are excluded: they are polylines, not boxes, and hovering one is
 * not part of this feature.
 */
export function pickSceneEntity(
  scene: ModelScene3D,
  origin: Vec3,
  direction: Vec3,
): PickedEntity | null {
  let nearestSlab: (PickedEntity & { moduleId?: string }) | null = null;
  let nearestModule: PickedEntity | null = null;

  for (const slab of scene.slabs) {
    const distance = intersectBox(origin, direction, slab.center, slab.size);
    if (distance == null) continue;
    if (nearestSlab && nearestSlab.distance <= distance) continue;
    nearestSlab = {
      id: slab.id,
      kind: "slab",
      ...(slab.tensorId != null ? { tensorId: slab.tensorId } : {}),
      ...(slab.moduleId != null ? { moduleId: slab.moduleId } : {}),
      distance,
    };
  }
  for (const module of scene.modules) {
    const distance = intersectBox(origin, direction, module.center, module.size);
    if (distance == null) continue;
    if (nearestModule && nearestModule.distance <= distance) continue;
    nearestModule = {
      id: module.id,
      kind: "module",
      nodeId: module.nodeId,
      distance,
    };
  }

  if (!nearestSlab) return nearestModule;
  if (!nearestModule) return strip(nearestSlab);
  if (nearestSlab.moduleId === nearestModule.id) return strip(nearestSlab);
  return nearestSlab.distance <= nearestModule.distance
    ? strip(nearestSlab)
    : nearestModule;
}

/** Drop the internal moduleId used only for the containment comparison. */
function strip(hit: PickedEntity & { moduleId?: string }): PickedEntity {
  const { moduleId: _moduleId, ...rest } = hit;
  return rest;
}
