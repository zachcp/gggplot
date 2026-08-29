import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { geomContour, geomHline, geomSegment, ggplot } from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import { emitSource } from "../src/emit/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";

const data = {
  x: [0, 1],
  y: [0, 1],
  z: [0, 1],
  xend: [1, 2],
  yend: [2, 3],
  zend: [3, 4],
};

const mapping = {
  x: "x",
  y: "y",
  z: "z",
  xend: "xend",
  yend: "yend",
  zend: "zend",
};

function findNodes(node: RenderNode, component: string): RenderNode[] {
  return [
    ...(node.component === component ? [node] : []),
    ...(node.children ?? []).flatMap((child) => findNodes(child, component)),
  ];
}

const segmentNode = (spec: Parameters<typeof compile>[0]) =>
  findNodes(compile(spec), "ChunkedLine").find((node) =>
    (node.props.positions as { format?: string }).format === "vec4<f32>"
  )!;

Deno.test("3D segments pack disjoint vec4 endpoint pairs", () => {
  const node = segmentNode(
    ggplot(data, mapping).add(geomSegment()).build(),
  );
  const positions = node.props.positions as {
    format: string;
    array: Float32Array;
    length: number;
  };
  assertEquals(positions.format, "vec4<f32>");
  // Two segments, two endpoints each.
  assertEquals(positions.length, 4);
  const topology = node.props.topology as { chunks: Uint32Array };
  assertEquals(Array.from(topology.chunks), [2, 2]);
  // Homogeneous w stays 1 on every vertex.
  for (let i = 3; i < positions.array.length; i += 4) {
    assertEquals(positions.array[i], 1);
  }
});

Deno.test("zend widens the z domain like xend widens x", () => {
  // zend reaches 4 while z stops at 1. 3D marks keep data-space positions and
  // let the scene carry the domain, so the proof is in the trained range: if
  // zend did not train the z scale this would stop at 1 and the far endpoint
  // would fall outside the cube.
  const cartesian = findNodes(
    compile(ggplot(data, mapping).add(geomSegment()).build()),
    "Cartesian",
  )[0];
  const range = cartesian.props.range as [number, number][];
  assertEquals(range[2], [0, 4]);
  // x and y are trained from their own end aesthetics the same way.
  assertEquals(range[0], [0, 2]);
  assertEquals(range[1], [0, 3]);
});

Deno.test("a partially mapped 3D segment names the missing aesthetics", () => {
  assertThrows(
    () =>
      compile(
        ggplot(data, { x: "x", y: "y", z: "z", xend: "xend", yend: "yend" })
          .add(geomSegment()).build(),
      ),
    Error,
    "requires mapped position aesthetic(s): zend",
  );
});

Deno.test("contour still reads z as a value channel through the same geom", () => {
  // geom_contour lowers through lowerSegment and maps z as a height field, so
  // it must not be captured by the 3D mode that shares that lowering.
  const grid = { x: [0, 1, 0, 1], y: [0, 0, 1, 1], z: [0, 1, 1, 2] };
  const tree = compile(
    ggplot(grid, { x: "x", y: "y", z: "z" }).add(
      geomContour({ breaks: [0.5] }),
    ).build(),
  );
  assertEquals(findNodes(tree, "Scene3D").length, 0);
  assert(findNodes(tree, "Line").length > 0);
});

Deno.test("reference lines cannot become planes because they do not inherit", () => {
  // A 3D reference plane is a separate primitive with its own parameters. The
  // hline family is structurally immune to being mistaken for one: it supplies
  // its own literal data with inheritAes false, so it never sees a plot-level
  // z at all. What a user actually hits is the mixed-dimension guard.
  assertThrows(
    () =>
      compile(
        ggplot(data, mapping).add(geomSegment(), geomHline({ yintercept: 1 }))
          .build(),
      ),
    Error,
    "mixed 2D/3D layers",
  );
});

Deno.test("3D segments carry depth props and survive emitSource", () => {
  const opaque = segmentNode(ggplot(data, mapping).add(geomSegment()).build());
  assertEquals(opaque.props.depthTest, true);
  assertEquals(opaque.props.depthWrite, true);

  const faded = segmentNode(
    ggplot(data, mapping).add(geomSegment({ alpha: 0.4 })).build(),
  );
  assertEquals(faded.props.depthWrite, false);
  assertEquals(faded.props.mode, "transparent");

  const source = emitSource(
    compile(ggplot(data, mapping).add(geomSegment()).build()),
    "Segment3D",
  );
  assert(source.includes("vec4<f32>"), "emitted positions stay vec4");
  assert(source.includes("depthWrite"), "emitted node keeps depth props");
});

Deno.test("3D segment rejects non-identity stats and positions", () => {
  assertThrows(
    () =>
      compile(
        ggplot(data, mapping).add(geomSegment({ position: "jitter" })).build(),
      ),
    Error,
    'does not support position "jitter"',
  );
});

Deno.test("a scalar mark colour is parsed before it reaches a raw layer", () => {
  // gggplot-frg: geom_segment's 3D mode is the only ChunkedLine caller that
  // relies on the scalar `color` prop — every other one packs a per-vertex
  // `colors` tensor. That made this path the one place where handing a CSS
  // string to workbench's raw LineLayer went unnoticed: the string reaches
  // useShaderRef, which wants a numeric vec4, and all 75 segments drew pure
  // black on a near-black scene. Draws happened, so no existing gate caught it.
  const node = segmentNode(
    ggplot(data, mapping).add(geomSegment({ color: "#38bdf8" })).build(),
  );
  assertEquals(node.props.color, "#38bdf8");
  assertEquals(
    node.props.colors,
    undefined,
    "3D segments carry no color tensor",
  );

  // The emitted standalone module must parse it too, or the two backends
  // disagree about what the same RenderTree looks like.
  const source = emitSource(
    compile(
      ggplot(data, mapping).add(geomSegment({ color: "#38bdf8" })).build(),
    ),
    "Segment3D",
  );
  assertStringIncludes(source, "const parseColorRGBA");
  assertStringIncludes(
    source,
    'color: parseColorRGBA(color ?? "#3b82f6", opacity ?? 1)',
  );
});
