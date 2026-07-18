import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { ExtensionRegistry } from "@gggplot/core/plan";
import { compilePointCloud, pointCloudRows } from "../src/compile.ts";
import { emitPointCloudSource } from "../src/emit.ts";
import { projectPoint } from "../src/camera.ts";
import { POINT_CLOUD_EXTENSION_ID, type PointCloudSpec } from "../src/types.ts";
import { pointCloudDefinition, registerPointCloud } from "../src/registry.ts";

const pointCloudRegistry = () => registerPointCloud(Symbol("PointCloud"));

const spec: PointCloudSpec = {
  extension: POINT_CLOUD_EXTENSION_ID,
  data: {
    x: [-1, 0, 1],
    y: [0, 1, 0],
    z: [0, 0, 0],
    radius: [3, 5, 7],
  },
  mapping: { x: "x", y: "y", z: "z", size: "radius" },
  camera: {
    projection: "perspective" as const,
    position: [0, 0, 5] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
    near: 0.1,
    far: 100,
  },
};

Deno.test("point-cloud package registers a portable, versioned extension", () => {
  const registry = pointCloudRegistry();
  assertEquals(
    registry.resolve(POINT_CLOUD_EXTENSION_ID).definition,
    pointCloudDefinition,
  );
  assertEquals(JSON.parse(JSON.stringify(registry.manifest())), [
    pointCloudDefinition,
  ]);
});

Deno.test("camera projection preserves depth and supports perspective/orthographic modes", () => {
  const perspective = projectPoint([0, 0, 0], spec.camera);
  assertEquals(perspective[0], 0);
  assertEquals(perspective[1], 0);
  assertEquals(perspective[2] > 0 && perspective[2] < 1, true);
  const orthographic = projectPoint([1, 1, 0], {
    ...spec.camera,
    projection: "orthographic",
    orthographicHeight: 4,
  });
  assertEquals(orthographic.slice(0, 2), [0.5, 0.5]);
});

Deno.test("point-cloud compiler lowers x/y/z and styling into depth-tested vec4 points", () => {
  const node = compilePointCloud(spec, pointCloudRegistry());
  assertEquals(node.component, POINT_CLOUD_EXTENSION_ID);
  assertEquals(node.props.positions.length, 12);
  assertEquals(node.props.sizes, new Float32Array([3, 5, 7]));
  assertEquals(node.props.depthTest, true);
  assertEquals(node.props.depthWrite, true);
  assertEquals(node.props.formats, { positions: "vec4<f32>" });
  assertEquals(
    pointCloudRows(node).every((row) => row[2] > 0 && row[2] < 1),
    true,
  );
});

Deno.test("point-cloud compiler aligns mapped colors and sizes when rows are dropped", () => {
  const mapped: PointCloudSpec = {
    ...spec,
    data: {
      x: [0, 0],
      y: [0, 0],
      z: [0, 10],
      color: ["#ff000080", "#00ff00"],
      size: [4, 9],
    },
    mapping: {
      x: "x",
      y: "y",
      z: "z",
      color: "color",
      size: "size",
    },
  };
  const node = compilePointCloud(mapped, pointCloudRegistry());
  assertEquals(node.props.positions.length, 4);
  assertEquals(node.props.sizes, new Float32Array([4]));
  assertEquals(
    node.props.colors,
    new Float32Array([1, 0, 0, 128 / 255]),
  );
});

Deno.test("point-cloud compiler rejects missing registry and malformed columns", () => {
  assertThrows(
    () => compilePointCloud(spec, new ExtensionRegistry()),
    Error,
    "Missing extension",
  );
  assertThrows(
    () =>
      compilePointCloud(
        { ...spec, data: { ...spec.data, z: [0] } },
        pointCloudRegistry(),
      ),
    Error,
    "equal lengths",
  );
});

Deno.test("emitted point-cloud source resolves the same package adapter", () => {
  const registry = pointCloudRegistry();
  const source = emitPointCloudSource(
    compilePointCloud(spec, registry),
    registry,
    "CloudDemo",
  );
  assertStringIncludes(source, 'import { PointCloud } from "@gggplot/3d"');
  assertStringIncludes(source, "export const CloudDemo");
  assertStringIncludes(source, '"depthTest":true');
  assertEquals(source.includes("Symbol("), false);
});
