import { mat4 } from "gl-matrix";
import type { Camera3D, Vec3 } from "./types.ts";

export function resolveCamera3d(camera: Camera3D): Required<Camera3D> {
  const near = camera.near ?? 0.1;
  const far = camera.far ?? 1000;
  if (!(near > 0 && far > near)) {
    throw new Error("[gggplot/geom_3d] camera requires 0 < near < far");
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

/**
 * Build the view·projection matrix (column-major, 16 numbers). The GPU applies
 * it to data-space positions — the CPU never projects individual points, which
 * is the whole point of moving 3D into the flat-native pipeline. The camera
 * basis comes from a standard lookAt; the frustum from perspective/ortho.
 */
export function cameraViewProjection(input: Camera3D): number[] {
  const camera = resolveCamera3d(input);
  const view = mat4.create();
  mat4.lookAt(
    view,
    camera.position as Vec3,
    camera.target as Vec3,
    camera.up as Vec3,
  );
  const projection = mat4.create();
  if (camera.projection === "perspective") {
    mat4.perspective(
      projection,
      camera.fovY,
      camera.aspect,
      camera.near,
      camera.far,
    );
  } else {
    const height = camera.orthographicHeight;
    const width = height * camera.aspect;
    mat4.ortho(
      projection,
      -width / 2,
      width / 2,
      -height / 2,
      height / 2,
      camera.near,
      camera.far,
    );
  }
  const viewProjection = mat4.create();
  mat4.multiply(viewProjection, projection, view);
  return Array.from(viewProjection);
}

export interface OrbitCameraProps {
  bearing: number;
  pitch: number;
  radius: number;
  target: Vec3;
  fov: number;
  near: number;
  far: number;
}

/**
 * Convert the lookAt-style Camera3D into use.gpu OrbitCamera props (the live
 * 3D camera host). bearing is the yaw around the up axis, pitch the elevation;
 * both in radians. The GPU still owns the projection — this only reparametrizes
 * the same eye position.
 */
export function orbitCameraProps(input: Camera3D): OrbitCameraProps {
  const camera = resolveCamera3d(input);
  const dx = camera.position[0] - camera.target[0];
  const dy = camera.position[1] - camera.target[1];
  const dz = camera.position[2] - camera.target[2];
  const radius = Math.hypot(dx, dy, dz) || 1;
  const pitch = Math.asin(Math.max(-1, Math.min(1, dy / radius)));
  const bearing = Math.atan2(dx, dz);
  return {
    bearing,
    pitch,
    radius,
    target: camera.target,
    fov: camera.fovY,
    near: camera.near,
    far: camera.far,
  };
}
