import type { PointCloudCamera, Vec3, Vec4 } from "./types.ts";

const subtract = (
  a: Vec3,
  b: Vec3,
): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (value: Vec3): Vec3 => {
  const length = Math.hypot(...value);
  if (!length) {
    throw new Error("[gggplot/3d] Camera basis vectors must be non-zero");
  }
  return [value[0] / length, value[1] / length, value[2] / length];
};

export function resolveCamera(
  camera: PointCloudCamera,
): Required<PointCloudCamera> {
  const near = camera.near ?? 0.1;
  const far = camera.far ?? 1000;
  if (!(near > 0 && far > near)) {
    throw new Error("[gggplot/3d] Camera requires 0 < near < far");
  }
  return {
    ...camera,
    up: camera.up ?? [0, 1, 0],
    near,
    far,
    fovY: camera.fovY ?? Math.PI / 4,
    orthographicHeight: camera.orthographicHeight ?? 2,
    aspect: camera.aspect ?? 1,
  };
}

/** Project one world-space point into WebGPU normalized device coordinates. */
export function projectPoint(point: Vec3, input: PointCloudCamera): Vec4 {
  const camera = resolveCamera(input);
  const forward = normalize(subtract(camera.target, camera.position));
  const right = normalize(cross(forward, camera.up));
  const up = cross(right, forward);
  const relative = subtract(point, camera.position);
  const viewX = dot(relative, right);
  const viewY = dot(relative, up);
  const viewZ = dot(relative, forward);
  if (viewZ <= 0) return [Number.NaN, Number.NaN, Number.NaN, 1];

  let x: number;
  let y: number;
  if (camera.projection === "perspective") {
    const focal = 1 / Math.tan(camera.fovY / 2);
    x = viewX * focal / (viewZ * camera.aspect);
    y = viewY * focal / viewZ;
  } else {
    x = viewX / (camera.orthographicHeight * camera.aspect / 2);
    y = viewY / (camera.orthographicHeight / 2);
  }
  // WebGPU depth range is [0, 1]; nearer points produce smaller values.
  const z = (viewZ - camera.near) / (camera.far - camera.near);
  return [x, y, z, 1];
}
