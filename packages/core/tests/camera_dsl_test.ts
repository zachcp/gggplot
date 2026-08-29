import {
  assertAlmostEquals,
  assertEquals,
  assertNotStrictEquals,
  assertThrows,
} from "@std/assert";
import { camera3d, camera3dFromLookAt, ggplot } from "../src/dsl/mod.ts";
import { DEFAULT_CAMERA_3D, resolveCamera3D } from "../src/ir/types.ts";

Deno.test("camera3d serializes one fully resolved canonical default", () => {
  const spec = ggplot({ x: [1], y: [2], z: [3] }, {
    x: "x",
    y: "y",
    z: "z",
  }).add(camera3d()).build();

  assertEquals(spec.camera, DEFAULT_CAMERA_3D);
  assertNotStrictEquals(spec.camera, DEFAULT_CAMERA_3D);
  assertNotStrictEquals(spec.camera?.target, DEFAULT_CAMERA_3D.target);
  assertEquals(JSON.parse(JSON.stringify(spec.camera)), DEFAULT_CAMERA_3D);
});

Deno.test("camera3d resolves partial overrides and later additions replace", () => {
  const spec = ggplot({ x: [1] })
    .add(
      camera3d({ bearing: 0.1, radius: 4 }),
      camera3d({ pitch: 0.7, target: [1, 2, 3] }),
    )
    .build();

  assertEquals(spec.camera, {
    ...DEFAULT_CAMERA_3D,
    pitch: 0.7,
    target: [1, 2, 3],
  });
});

Deno.test("camera3d validates the canonical projection and frustum", () => {
  assertThrows(
    () => camera3d({ projection: "orthographic" } as never),
    TypeError,
    'projection must be "perspective"',
  );
  assertThrows(
    () => camera3d({ radius: 0 }),
    RangeError,
    "radius must be greater than 0",
  );
  assertThrows(
    () => camera3d({ near: 1, far: 1 }),
    RangeError,
    "0 < near < far",
  );
  assertThrows(
    () => camera3d({ up: [0, 1, 0] } as never),
    TypeError,
    "does not support camera field(s): up",
  );
});

Deno.test("camera3dFromLookAt immediately serializes canonical orbit JSON", () => {
  const spec = ggplot({ x: [1] }).add(camera3dFromLookAt({
    position: [3, 3, 3],
    target: [0, 0, 0],
    fovY: 0.6,
  })).build();

  assertEquals(spec.camera?.kind, "orbit");
  assertEquals(spec.camera?.projection, "perspective");
  assertAlmostEquals(spec.camera!.radius, Math.sqrt(27), 1e-12);
  assertAlmostEquals(spec.camera!.bearing, Math.PI / 4, 1e-12);
  assertEquals(spec.camera?.fov, 0.6);
  assertEquals(Object.hasOwn(spec.camera!, "position"), false);
});

Deno.test("canonical default camera resolves identically", () => {
  assertEquals(resolveCamera3D(), DEFAULT_CAMERA_3D);
});
