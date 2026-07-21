import {
  assertAlmostEquals,
  assertEquals,
  assertThrows,
} from "jsr:@std/assert@1";
import {
  cameraViewProjection,
  compile3d,
  emitPoint3dSource,
  lowerPoint3d,
  packPoints3d,
} from "../src/geom_3d/mod.ts";
import type { Camera3D, Point3DSpec } from "../src/geom_3d/mod.ts";

const camera: Camera3D = {
  projection: "perspective",
  position: [3, 3, 3],
  target: [0, 0, 0],
};

const spec: Point3DSpec = {
  geom: "point_3d",
  data: {
    x: [0, 1, 2, 3],
    y: [0, 2, 4, 6],
    z: [0, 1, Number.NaN, 3],
    grp: ["a", "b", "a", "b"],
    mag: [5, 6, 7, 8],
  },
  mapping: { x: "x", y: "y", z: "z", color: "grp", size: "mag" },
  camera,
};

Deno.test("packPoints3d packs interleaved vec4 with REAL z and drops non-finite rows", () => {
  const packed = packPoints3d({
    xs: [0, 1, 2, 3],
    ys: [0, 2, 4, 6],
    zs: [0, 1, Number.NaN, 3],
    colors: ["a", "b", "a", "b"],
    sizes: [5, 6, 7, 8],
  });
  // Row index 2 has NaN z -> dropped; 3 of 4 rows retained.
  assertEquals(packed.positions.format, "vec4");
  assertEquals(packed.positions.dims, 4);
  assertEquals(packed.positions.length, 3);
  assertEquals([...packed.mask], [1, 1, 0, 1]);
  // Third retained vertex is source row 3: [3, 6, 3, 1] — z is the raw data z.
  assertEquals([...packed.positions.array.slice(8, 12)], [3, 6, 3, 1]);
  // Companions packed through the SAME mask (row 2 dropped everywhere).
  assertEquals(packed.sizes?.length, 3);
  assertEquals(packed.colors?.length, 3);
});

Deno.test("cameraViewProjection returns a well-formed 16-element view*projection matrix", () => {
  const matrix = cameraViewProjection(camera);
  assertEquals(matrix.length, 16);
  assertEquals(matrix.every((value) => Number.isFinite(value)), true);
  // Orthographic path is exercised too and stays finite.
  const ortho = cameraViewProjection({ ...camera, projection: "orthographic" });
  assertEquals(ortho.length, 16);
  assertEquals(ortho.every((value) => Number.isFinite(value)), true);
});

Deno.test("cameraViewProjection rejects a degenerate frustum", () => {
  assertThrows(
    () => cameraViewProjection({ ...camera, near: 0, far: 10 }),
    Error,
    "0 < near < far",
  );
});

Deno.test("lowerPoint3d keeps positions in DATA space (no CPU projection) and trains 3 domains", () => {
  const node = compile3d(spec);
  assertEquals(node.kind, "point_3d");
  assertEquals(node.positions.length, 3);
  // Retained rows are 0,1,3; their z values are the raw data z (0,1,3),
  // proving positions are NOT projected to NDC on the CPU.
  assertEquals([...node.positions.array].filter((_, i) => i % 4 === 2), [
    0,
    1,
    3,
  ]);
  // Trained data-space ranges, one [lo,hi] per axis.
  assertEquals(node.range[0], [0, 3]);
  assertEquals(node.range[1], [0, 6]);
  assertEquals(node.range[2], [0, 3]);
  // Camera lowered to a matrix carried alongside the data-space positions.
  assertEquals(node.cameraMatrix.length, 16);
  // Mapped color/size produced companion tensors.
  assertEquals(node.colors?.length, 3);
  assertEquals(node.sizes?.length, 3);
});

Deno.test("lowerPoint3d pads a degenerate (single-value) axis domain", () => {
  const flat = lowerPoint3d({
    geom: "point_3d",
    data: { x: [1, 1, 1], y: [0, 1, 2], z: [5, 5, 5] },
    mapping: { x: "x", y: "y", z: "z" },
    camera,
  });
  assertEquals(flat.range[0], [0.5, 1.5]);
  assertEquals(flat.range[2], [4.5, 5.5]);
});

Deno.test("lowerPoint3d rejects mismatched column lengths and missing columns", () => {
  assertThrows(
    () =>
      lowerPoint3d({
        geom: "point_3d",
        data: { x: [1, 2], y: [1], z: [1, 2] },
        mapping: { x: "x", y: "y", z: "z" },
        camera,
      }),
    Error,
    "equal length",
  );
  assertThrows(
    () =>
      lowerPoint3d({
        geom: "point_3d",
        data: { x: [1], y: [1] },
        mapping: { x: "x", y: "y", z: "z" },
        camera,
      }),
    Error,
    "missing mapped column: z",
  );
});

Deno.test("emitPoint3dSource emits standalone Plot source with data-space positions + camera matrix", () => {
  const node = compile3d(spec);
  const source = emitPoint3dSource(node, "MyCloud");
  assertEquals(
    source.includes('import { Cartesian, Point } from "@use-gpu/plot"'),
    true,
  );
  assertEquals(source.includes("export const MyCloud"), true);
  // Camera matrix and a 4-component range (data axes + homogeneous w) present.
  assertEquals(source.includes(JSON.stringify(node.cameraMatrix)), true);
  assertEquals(source.includes('formats={{ positions: "vec4<f32>" }}'), true);
  // The serialized z values are the raw data z, not projected NDC.
  assertEquals(source.includes("[0,0,0,1,1,2,1,1,3,6,3,1]"), true);
});
