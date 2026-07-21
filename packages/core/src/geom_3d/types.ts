// 3D geoms in core (parallel to the 2D geom/ registry; see
// docs/DESIGN_3D_IN_CORE.md). Data stays flat-native and DATA-space; the
// camera lowers to a view·projection matrix the GPU applies — nothing is
// CPU-projected per row (unlike the retired packages/3d PointCloud path).
import type { FlatTensor } from "../compile/rendertree.ts";

/** Parallel 3D geom registry key. Grows as line_3d/path_3d/surface land. */
export type Geom3DKind = "point_3d";

export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

/** Camera params — attach to a cartesian coord (decision B, DESIGN §6). */
export interface Camera3D {
  projection: "perspective" | "orthographic";
  position: Vec3;
  target: Vec3;
  up?: Vec3;
  near?: number;
  far?: number;
  /** Perspective vertical field of view, radians. */
  fovY?: number;
  /** Orthographic frustum height in world units. */
  orthographicHeight?: number;
  aspect?: number;
}

/** Plain-JSON 3D layer spec; executable values never enter the spec. */
export interface Point3DSpec {
  geom: "point_3d";
  data: Record<string, Array<number | string | null>>;
  mapping: { x: string; y: string; z: string; color?: string; size?: string };
  camera: Camera3D;
  params?: {
    color?: string;
    size?: number;
    alpha?: number;
    depthTest?: boolean;
  };
}

/** Trained data-space domains, one [lo, hi] per axis. Feeds Cartesian range. */
export type Range3D = [[number, number], [number, number], [number, number]];

/**
 * Lowered 3D mark. `positions` are DATA-space vec4 `[x, y, z, 1]` (NOT
 * projected); `cameraMatrix` (view·projection, 16 col-major) and `range` drive
 * the use.gpu Cartesian view so projection happens on the GPU.
 */
export interface Render3DNode {
  kind: Geom3DKind;
  positions: FlatTensor;
  colors?: FlatTensor;
  sizes?: FlatTensor;
  color: string;
  size: number;
  opacity: number;
  depthTest: boolean;
  range: Range3D;
  cameraMatrix: number[];
}
