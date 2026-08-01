/** Plain-JSON vector used by the serialized 3D camera declaration. */
export type CameraVec3 = [number, number, number];

/**
 * Canonical, serialized initial view for a 3D plot.
 *
 * V1 deliberately supports one representation: a perspective orbit camera.
 * Runtime controls may mutate a live copy, and the compiler may derive a
 * matrix, but neither runtime state nor matrices enter GGSpec.
 */
export interface Camera3D {
  kind: "orbit";
  projection: "perspective";
  /** Yaw around the positive y/up axis, radians. */
  bearing: number;
  /** Elevation above the x/z plane, radians. */
  pitch: number;
  /** Positive distance from target. */
  radius: number;
  target: CameraVec3;
  /** Perspective vertical field of view, radians. */
  fov: number;
  near: number;
  far: number;
}

/** Options accepted by camera3d(); all omitted values use the standard view. */
export type Camera3DOptions = Partial<Camera3D>;

/** Explicit look-at convenience input; it immediately lowers to Camera3D. */
export interface LookAtCamera3D {
  position: CameraVec3;
  target?: CameraVec3;
  fovY?: number;
  near?: number;
  far?: number;
}

/** Standard three-quarter view of the normalized plot cube. */
export const DEFAULT_CAMERA_3D: Camera3D = Object.freeze({
  kind: "orbit",
  projection: "perspective",
  bearing: Math.PI / 4,
  pitch: 0.45,
  radius: 3.6,
  target: Object.freeze([0, 0, 0]) as unknown as CameraVec3,
  fov: Math.PI / 4,
  near: 0.1,
  far: 100,
});

const CAMERA_KEYS = new Set<keyof Camera3D>([
  "kind",
  "projection",
  "bearing",
  "pitch",
  "radius",
  "target",
  "fov",
  "near",
  "far",
]);

const LOOK_AT_KEYS = new Set<keyof LookAtCamera3D>([
  "position",
  "target",
  "fovY",
  "near",
  "far",
]);

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw new TypeError(
      `[gggplot] ${label} does not support camera field(s): ${
        unknown.join(", ")
      }`,
    );
  }
}

function finite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`[gggplot] camera ${field} must be finite`);
  }
}

function cameraTarget(value: CameraVec3): CameraVec3 {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new TypeError("[gggplot] camera target must be a 3-element vector");
  }
  value.forEach((component) => finite(component, "target"));
  return [value[0], value[1], value[2]];
}

/** Resolve partial DSL input to the sole canonical serialized camera shape. */
export function resolveCamera3D(options: Camera3DOptions = {}): Camera3D {
  rejectUnknownKeys(
    options as Record<string, unknown>,
    CAMERA_KEYS,
    "camera3d()",
  );
  if (options.kind != null && options.kind !== "orbit") {
    throw new TypeError('[gggplot] camera3d() kind must be "orbit"');
  }
  if (
    options.projection != null && options.projection !== "perspective"
  ) {
    throw new TypeError(
      '[gggplot] camera3d() projection must be "perspective"; orthographic cameras are not implemented',
    );
  }

  const camera: Camera3D = {
    kind: "orbit",
    projection: "perspective",
    bearing: options.bearing ?? DEFAULT_CAMERA_3D.bearing,
    pitch: options.pitch ?? DEFAULT_CAMERA_3D.pitch,
    radius: options.radius ?? DEFAULT_CAMERA_3D.radius,
    target: cameraTarget(options.target ?? DEFAULT_CAMERA_3D.target),
    fov: options.fov ?? DEFAULT_CAMERA_3D.fov,
    near: options.near ?? DEFAULT_CAMERA_3D.near,
    far: options.far ?? DEFAULT_CAMERA_3D.far,
  };
  finite(camera.bearing, "bearing");
  finite(camera.pitch, "pitch");
  finite(camera.radius, "radius");
  finite(camera.fov, "fov");
  finite(camera.near, "near");
  finite(camera.far, "far");
  if (!(camera.radius > 0)) {
    throw new RangeError("[gggplot] camera radius must be greater than 0");
  }
  if (!(camera.fov > 0 && camera.fov < Math.PI)) {
    throw new RangeError("[gggplot] camera requires 0 < fov < pi");
  }
  if (!(camera.near > 0 && camera.far > camera.near)) {
    throw new RangeError("[gggplot] camera requires 0 < near < far");
  }
  return camera;
}

/** Convert a look-at declaration immediately into canonical orbit JSON. */
export function camera3DFromLookAt(input: LookAtCamera3D): Camera3D {
  rejectUnknownKeys(
    input as unknown as Record<string, unknown>,
    LOOK_AT_KEYS,
    "camera3dFromLookAt()",
  );
  const position = cameraTarget(input.position);
  const target = cameraTarget(input.target ?? DEFAULT_CAMERA_3D.target);
  const dx = position[0] - target[0];
  const dy = position[1] - target[1];
  const dz = position[2] - target[2];
  const radius = Math.hypot(dx, dy, dz);
  if (!(radius > 0)) {
    throw new RangeError(
      "[gggplot] look-at camera position must differ from target",
    );
  }
  return resolveCamera3D({
    bearing: Math.atan2(dx, dz),
    pitch: Math.asin(Math.max(-1, Math.min(1, dy / radius))),
    radius,
    target,
    fov: input.fovY,
    near: input.near,
    far: input.far,
  });
}
