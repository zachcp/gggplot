import { assert, assertAlmostEquals, assertThrows } from "@std/assert";
import {
  type CameraBounds3D,
  DEFAULT_CAMERA_3D,
  fitCamera3D,
} from "../src/ir/camera.ts";

/**
 * gggplot-o2x: the 3D model scene rendered off-centre and cropped because
 * DEFAULT_CAMERA_3D targets the origin at radius 3.6 -- correct for the
 * normalized plot cube, wrong for a scene laid out in real units. The mnist
 * scene spans 50 x 26 x 5.2 and is centred at [24, 12, 0.4].
 *
 * These project the fitted result rather than asserting on its numbers: the
 * claim is "the bounds fit the viewport", so the test checks exactly that, at
 * many camera orientations.
 */

type Vec3 = [number, number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => {
  const length = Math.hypot(...a);
  return [a[0] / length, a[1] / length, a[2] / length];
};

function corners(bounds: CameraBounds3D): Vec3[] {
  const out: Vec3[] = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) out.push([x, y, z]);
    }
  }
  return out;
}

/**
 * Project a world point to NDC through an orbit camera placed `radius` away
 * from `target` along (bearing, pitch), looking at the target.
 *
 * Returns null when the point is behind the camera.
 */
function project(
  point: Vec3,
  target: Vec3,
  radius: number,
  bearing: number,
  pitch: number,
  fov: number,
  aspect: number,
): { x: number; y: number; depth: number } | null {
  const position: Vec3 = [
    target[0] + radius * Math.cos(pitch) * Math.sin(bearing),
    target[1] + radius * Math.sin(pitch),
    target[2] + radius * Math.cos(pitch) * Math.cos(bearing),
  ];
  const forward = norm(sub(target, position));
  const worldUp: Vec3 = Math.abs(forward[1]) > 0.999 ? [0, 0, 1] : [0, 1, 0];
  const right = norm(cross(forward, worldUp));
  const up = cross(right, forward);

  const relative = sub(point, position);
  const depth = dot(relative, forward);
  if (depth <= 0) return null;
  const halfHeight = Math.tan(fov / 2);
  return {
    x: dot(relative, right) / (halfHeight * aspect * depth),
    y: dot(relative, up) / (halfHeight * depth),
    depth,
  };
}

/** Every corner inside the frustum, at the given orientation. */
function fits(
  bounds: CameraBounds3D,
  camera: ReturnType<typeof fitCamera3D>,
  bearing: number,
  pitch: number,
  aspect: number,
): boolean {
  return corners(bounds).every((corner) => {
    const p = project(
      corner,
      camera.target as unknown as Vec3,
      camera.radius,
      bearing,
      pitch,
      camera.fov,
      aspect,
    );
    return p !== null && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 &&
      p.depth >= camera.near && p.depth <= camera.far;
  });
}

/** The real mnist-12 model scene extent, measured from buildModelScene3D. */
const MNIST: CameraBounds3D = {
  min: [-1, -1, -2.2],
  max: [49, 25, 3],
};

Deno.test("the fitted camera targets the centre of the bounds", () => {
  const camera = fitCamera3D(MNIST);
  assertAlmostEquals(camera.target[0], 24, 1e-9);
  assertAlmostEquals(camera.target[1], 12, 1e-9);
  assertAlmostEquals(camera.target[2], 0.4, 1e-9);
});

Deno.test("the default camera does NOT frame this scene", () => {
  // The bug, pinned: origin-targeted at radius 3.6 puts the camera inside a
  // scene that spans 50 units and is centred 27 units away.
  assert(
    !fits(MNIST, DEFAULT_CAMERA_3D, Math.PI / 4, 0.45, 912 / 300),
    "DEFAULT_CAMERA_3D unexpectedly frames the mnist scene",
  );
});

Deno.test("the fitted camera frames the scene at every orientation", () => {
  // The whole reason for fitting the bounding sphere instead of the projected
  // box: orbiting is the primary 3D interaction, so a fit that only holds at
  // the declared angle is not a fit.
  const camera = fitCamera3D(MNIST);
  for (let bearing = 0; bearing < Math.PI * 2; bearing += Math.PI / 8) {
    for (const pitch of [-1.2, -0.6, 0, 0.45, 1.2]) {
      assert(
        fits(MNIST, camera, bearing, pitch, 1),
        `cropped at bearing ${bearing.toFixed(2)}, pitch ${pitch}`,
      );
    }
  }
});

Deno.test("the default fit covers every viewport at least as wide as it is tall", () => {
  // The canvas that exposed this is 912x300, an unusually wide 3:1. Horizontal
  // FOV only grows with aspect, so fitting at aspect 1 leaves slack above it.
  const camera = fitCamera3D(MNIST);
  for (const aspect of [3.04, 2, 1]) {
    assert(
      fits(MNIST, camera, Math.PI / 4, 0.45, aspect),
      `cropped at aspect ${aspect}`,
    );
  }
});

Deno.test("a taller-than-wide viewport needs its aspect, and honours it", () => {
  // The other half of the contract, and the reason the default is documented
  // rather than described as universally safe: below 1, horizontal FOV is the
  // narrower one, so the default fit crops and the real aspect must be passed.
  const narrow = 0.5;
  assert(
    !fits(MNIST, fitCamera3D(MNIST), Math.PI / 4, 0.45, narrow),
    "default fit unexpectedly covered a taller-than-wide viewport",
  );
  assert(
    fits(
      MNIST,
      fitCamera3D(MNIST, { aspect: narrow }),
      Math.PI / 4,
      0.45,
      narrow,
    ),
    "fit did not honour an explicit narrow aspect",
  );
});

Deno.test("near and far bracket the scene rather than clipping it", () => {
  // tiny-encoder-stack needs far ~440; DEFAULT_CAMERA_3D's far is 100, so
  // deriving these from the fit is load-bearing, not decoration.
  const big: CameraBounds3D = { min: [-1, -1, -2.2], max: [85, 73, 3] };
  const camera = fitCamera3D(big);
  assert(camera.far > camera.radius, "far plane is in front of the camera");
  assert(camera.near > 0 && camera.near < camera.radius, "near is usable");
  assert(fits(big, camera, Math.PI / 4, 0.45, 1), "large scene is clipped");
});

Deno.test("explicit overrides win over the fit", () => {
  const camera = fitCamera3D(MNIST, {
    radius: 5,
    bearing: 1,
    target: [0, 0, 0],
  });
  assertAlmostEquals(camera.radius, 5, 1e-9);
  assertAlmostEquals(camera.bearing, 1, 1e-9);
  assertAlmostEquals(camera.target[0], 0, 1e-9);
});

Deno.test("padding widens the fit", () => {
  const tight = fitCamera3D(MNIST, { padding: 1 });
  const loose = fitCamera3D(MNIST, { padding: 1.5 });
  assert(loose.radius > tight.radius);
});

Deno.test("a degenerate single-point scene still yields a usable camera", () => {
  const point: CameraBounds3D = { min: [3, 3, 3], max: [3, 3, 3] };
  const camera = fitCamera3D(point);
  assertAlmostEquals(camera.radius, DEFAULT_CAMERA_3D.radius, 1e-9);
  assertAlmostEquals(camera.target[0], 3, 1e-9);
});

Deno.test("invalid fit inputs are rejected", () => {
  assertThrows(() => fitCamera3D(MNIST, { aspect: 0 }), RangeError);
  assertThrows(() => fitCamera3D(MNIST, { padding: -1 }), RangeError);
  assertThrows(
    () => fitCamera3D({ min: [1, 0, 0], max: [0, 0, 0] }),
    RangeError,
  );
});
