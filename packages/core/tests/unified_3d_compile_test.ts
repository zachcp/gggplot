import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  camera3d,
  coordCartesian,
  geomPoint,
  ggplot,
  labels,
  scaleZContinuous,
  theme,
} from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import { emitSource } from "../src/emit/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";
import { cameraNearOrigin3d } from "../src/compile/guides_3d.ts";

function children(node: RenderNode, component: RenderNode["component"]) {
  return node.children.filter((child) => child.component === component);
}

Deno.test("camera-aware 3D guides select the near cube corner", () => {
  const domains: [[number, number], [number, number], [number, number]] = [
    [0, 1],
    [10, 20],
    [100, 200],
  ];
  assertEquals(cameraNearOrigin3d(domains, 0, -0.5), [1, 10, 200]);
  assertEquals(cameraNearOrigin3d(domains, -2, 0.5), [0, 20, 100]);
});

Deno.test("ordinary geomPoint plus z compiles to one two-branch 3D RenderTree", () => {
  const spec = ggplot(
    {
      x: [0, 1, 2],
      y: [10, 20, 30],
      z: [100, 200, 300],
      group: ["a", "b", "a"],
      magnitude: [1, 2, 3],
    },
    { x: "x", y: "y", z: "z", color: "group", size: "magnitude" },
  ).add(
    geomPoint({ sizeMode: "perspective" }),
    scaleZContinuous({ breaks: [100, 300], name: "Depth scale" }),
    labels({ title: "Unified", z: "Depth" }),
    camera3d({ bearing: 1.25 }),
    coordCartesian({ axes: "xzy", fixed: true }),
  ).build();

  const tree = compile(spec);
  assertEquals(tree.component, "Scene3D");
  assertEquals(tree.children.map((node) => node.component), [
    "Plot",
    "Embedded",
  ]);
  assertEquals((tree.props.camera as { bearing: number }).bearing, 1.25);

  const cartesian = tree.children[0].children[0];
  assertEquals(cartesian.component, "Cartesian");
  assertEquals(cartesian.props.axes, "xzyw");
  assertEquals(cartesian.props.range, [[0, 2], [10, 30], [100, 300], [1, 1]]);
  assertEquals(children(cartesian, "Grid").length, 6);
  const cameraAxes = children(cartesian, "CameraAxis3D");
  assertEquals(cameraAxes.length, 3);
  assertEquals(cameraAxes.map((node) => node.props.axis), ["x", "y", "z"]);
  assertEquals(cameraAxes[2].props.values, [100, 300]);
  assertEquals(cameraAxes[2].props.title, "Depth");

  const point = children(cartesian, "Point")[0];
  const positions = point.props.positions as {
    array: Float32Array;
    dims: number;
    length: number;
  };
  assertEquals(positions.dims, 4);
  assertEquals(positions.length, 3);
  assertEquals(Array.from(positions.array), [
    0,
    10,
    100,
    1,
    1,
    20,
    200,
    1,
    2,
    30,
    300,
    1,
  ]);
  assertEquals(point.props.depth, 1);
  assertEquals(point.props.depthWrite, true);
  assertEquals((point.props.colors as { dims: number }).dims, 4);
  assertEquals((point.props.sizes as { dims: number }).dims, 1);
  assertEquals(
    tree.children[1].children.some((node) => node.component === "Label"),
    true,
  );
});

Deno.test("3D theme guide switches apply without a parallel guide spec", () => {
  const tree = compile(
    ggplot({ x: [1], y: [2], z: [3] }, { x: "x", y: "y", z: "z" })
      .add(geomPoint(), theme({ grid: false, axes: false })).build(),
  );
  const cartesian = tree.children[0].children[0];
  assertEquals(children(cartesian, "Grid"), []);
  assertEquals(children(cartesian, "Axis"), []);
  assertEquals(children(cartesian, "Tick"), []);
  assertEquals(children(cartesian, "CameraAxis3D"), []);
  assertEquals(children(cartesian, "Point").length, 1);
  assertEquals(cartesian.props.range, [
    [0.5, 1.5],
    [1.5, 2.5],
    [2.5, 3.5],
    [1, 1],
  ]);
});

Deno.test("the shared emitter serializes Scene3D, camera, vec4 points, and overlay", async () => {
  const spec = ggplot(
    { x: [1, 2], y: [3, 4], z: [5, 6] },
    { x: "x", y: "y", z: "z" },
  ).add(
    geomPoint({ alpha: 0.5 }),
    camera3d({ bearing: 1, pitch: 0.4, radius: 5, near: 0.2, far: 50 }),
    labels({ title: "Emitted 3D" }),
  ).build();
  const source = emitSource(compile(spec), "Unified3D");
  assertStringIncludes(source, "const Scene3D =");
  assertStringIncludes(
    source,
    'import { OrbitControls } from "@use-gpu/interact"',
  );
  assertStringIncludes(source, "const Point3D =");
  assertStringIncludes(source, 'format: "vec4<f32>"');
  assertStringIncludes(source, '"bearing":1');
  assertStringIncludes(source, '"near":0.2');
  assertStringIncludes(source, '"far":50');
  assertStringIncludes(source, "<CameraAxis3D");
  assertStringIncludes(source, "const CameraOrbitContext = makeContext");
  assertStringIncludes(
    source,
    "provide(CameraOrbitContext, { bearing, pitch }, scene)",
  );
  assertStringIncludes(source, "<Embedded normalize={true}>");

  const packageDir = new URL("../", import.meta.url).pathname;
  const output = await Deno.makeTempFile({
    dir: packageDir,
    prefix: "gen_3d_",
    suffix: ".tsx",
  });
  try {
    await Deno.writeTextFile(output, source);
    const result = await new Deno.Command("deno", {
      args: ["check", output],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(
      result.code,
      0,
      new TextDecoder().decode(result.stderr),
    );
  } finally {
    await Deno.remove(output);
  }
});
