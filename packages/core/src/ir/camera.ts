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

/** An axis-aligned world-space box, as scene builders report their extent. */
export interface CameraBounds3D {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

/** Extra options for fitCamera3D, on top of the ordinary camera overrides. */
export interface CameraFit3DOptions extends Camera3DOptions {
  /** Viewport aspect (width / height). Defaults to 1, the safe assumption. */
  aspect?: number;
  /** Multiplier on the fitted distance, for breathing room. Defaults to 1.1. */
  padding?: number;
}

/**
 * Frame a camera so `bounds` fits the viewport (gggplot-o2x).
 *
 * DEFAULT_CAMERA_3D targets the origin at radius 3.6, which suits the
 * normalized plot cube and nothing else. A scene built from real geometry --
 * the model-inspection scene lays modules out with a per-layer gap, so it spans
 * tens of units and is nowhere near the origin -- is then both off-centre and
 * far too close, and gets cropped.
 *
 * Fits the bounding SPHERE rather than the projected box. The sphere is
 * orientation-independent, so the framing holds at every bearing and pitch;
 * fitting the box at the declared angle would look right until the user
 * orbited, which is the one thing a 3D scene exists for.
 *
 * The limiting field of view is the smaller of vertical and horizontal, so a
 * viewport fits on its tight axis instead of spilling over it.
 *
 * `aspect` defaults to 1, which fits any viewport at least as wide as it is
 * tall -- horizontal FOV only grows with aspect, so a wider viewport has slack
 * to spare. It does NOT cover a viewport taller than it is wide: there the
 * horizontal FOV is the narrower one and the fit must know it, so pass the real
 * aspect. camera_fit_test.ts pins both halves of that contract.
 *
 * near/far are derived from the fitted distance unless given, so a large scene
 * is not clipped by DEFAULT_CAMERA_3D's far plane of 100.
 */
export function fitCamera3D(
  bounds: CameraBounds3D,
  options: CameraFit3DOptions = {},
): Camera3D {
  const { aspect = 1, padding = 1.1, ...camera } = options;
  finite(aspect, "aspect");
  finite(padding, "padding");
  if (aspect <= 0) {
    throw new RangeError("[gggplot] fitCamera3D aspect must be positive");
  }
  if (padding <= 0) {
    throw new RangeError("[gggplot] fitCamera3D padding must be positive");
  }
  for (const axis of [0, 1, 2]) {
    finite(bounds.min[axis], "bounds.min");
    finite(bounds.max[axis], "bounds.max");
    if (bounds.max[axis] < bounds.min[axis]) {
      throw new RangeError("[gggplot] fitCamera3D bounds are inverted");
    }
  }

  const target: CameraVec3 = [0, 1, 2].map((axis) =>
    (bounds.min[axis] + bounds.max[axis]) / 2
  ) as unknown as CameraVec3;
  const half = Math.hypot(
    ...[0, 1, 2].map((axis) => (bounds.max[axis] - bounds.min[axis]) / 2),
  );

  const fov = camera.fov ?? DEFAULT_CAMERA_3D.fov;
  const horizontal = 2 * Math.atan(Math.tan(fov / 2) * aspect);
  const limiting = Math.min(fov, horizontal);
  // A degenerate scene (one point) still needs a usable distance to look from.
  const radius = half > 0
    ? half / Math.sin(limiting / 2) * padding
    : DEFAULT_CAMERA_3D.radius;

  return resolveCamera3D({
    ...camera,
    target: camera.target ?? target,
    radius: camera.radius ?? radius,
    near: camera.near ?? Math.max(0.01, (radius - half) / 2),
    far: camera.far ?? (radius + half) * 2,
  });
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
