import { assert, assertEquals, assertThrows } from "@std/assert";
import { geomSurface, ggplot } from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";

function findNodes(node: RenderNode, component: string): RenderNode[] {
  return [
    ...(node.component === component ? [node] : []),
    ...(node.children ?? []).flatMap((child) => findNodes(child, component)),
  ];
}

const mapping = { x: "x", y: "y", z: "z" };
const face = (spec: Parameters<typeof compile>[0]) =>
  findNodes(compile(spec), "ChunkedFace").find((node) =>
    (node.props.positions as { format?: string })?.format === "vec4<f32>"
  );

/** A complete 3x3 grid; z rises toward one corner. */
const grid = {
  x: [0, 1, 2, 0, 1, 2, 0, 1, 2],
  y: [0, 0, 0, 1, 1, 1, 2, 2, 2],
  z: [0, 1, 2, 1, 2, 3, 2, 3, 4],
};

Deno.test("a complete grid triangulates by adjacency", () => {
  const node = face(ggplot(grid, mapping).add(geomSurface()).build())!;
  const topology = node.props.topology as { chunks: Uint32Array };
  // A 3x3 grid has 2x2 = 4 cells, each a quad.
  assertEquals(Array.from(topology.chunks), [4, 4, 4, 4]);
});

Deno.test("a missing z leaves a hole rather than being interpolated", () => {
  const holed = { ...grid, z: [0, 1, 2, 1, null, 3, 2, 3, 4] };
  // The center vertex touches all four cells of a 3x3 grid, so every cell
  // drops and nothing is drawn at all. Bridging the gap would fabricate
  // terrain the data never had.
  assertEquals(
    face(ggplot(holed, mapping).add(geomSurface()).build()),
    undefined,
  );
});

Deno.test("a corner hole drops only the cells that touch it", () => {
  const holed = { ...grid, z: [null, 1, 2, 1, 2, 3, 2, 3, 4] };
  const node = face(ggplot(holed, mapping).add(geomSurface()).build())!;
  const topology = node.props.topology as { chunks: Uint32Array };
  assertEquals(topology.chunks.length, 3);
});

Deno.test("scattered points are refused, not silently triangulated", () => {
  // Four distinct x and four distinct y would need sixteen rows; four points
  // are a point cloud, and inferring adjacency from them is a different
  // problem this geom does not solve.
  const scattered = { x: [0, 1, 2, 3], y: [0, 2, 1, 3], z: [1, 2, 3, 4] };
  assertThrows(
    () => compile(ggplot(scattered, mapping).add(geomSurface()).build()),
    TypeError,
    "requires a complete grid",
  );
});

Deno.test("a duplicated grid position is refused", () => {
  const duplicated = {
    x: [0, 1, 0, 1],
    y: [0, 0, 0, 1],
    z: [1, 2, 3, 4],
  };
  assertThrows(
    () => compile(ggplot(duplicated, mapping).add(geomSurface()).build()),
    TypeError,
    "duplicate grid position",
  );
});

Deno.test("a degenerate grid is refused before triangulating", () => {
  const line = { x: [0, 1, 2], y: [0, 0, 0], z: [1, 2, 3] };
  assertThrows(
    () => compile(ggplot(line, mapping).add(geomSurface()).build()),
    TypeError,
    "at least two distinct x",
  );
});

Deno.test("surfaces carry depth props", () => {
  const opaque = face(ggplot(grid, mapping).add(geomSurface()).build())!;
  assertEquals(opaque.props.depthTest, true);
  assertEquals(opaque.props.depthWrite, true);

  const faded = face(
    ggplot(grid, mapping).add(geomSurface({ alpha: 0.5 })).build(),
  )!;
  assertEquals(faded.props.depthWrite, false);
  assertEquals(faded.props.mode, "transparent");
});

Deno.test("vertices keep their height field values", () => {
  const node = face(ggplot(grid, mapping).add(geomSurface()).build())!;
  const array = (node.props.positions as { array: Float32Array }).array;
  const zs: number[] = [];
  for (let i = 2; i < array.length; i += 4) zs.push(array[i]);
  // z is a mapped height, not a constant plane.
  assert(new Set(zs).size > 1, "surface should vary in z");
});
