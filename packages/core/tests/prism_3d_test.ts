import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { geomBar, geomCol, ggplot } from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";

function findNodes(node: RenderNode, component: string): RenderNode[] {
  return [
    ...(node.component === component ? [node] : []),
    ...(node.children ?? []).flatMap((child) => findNodes(child, component)),
  ];
}

const prisms = (spec: Parameters<typeof compile>[0]) =>
  findNodes(compile(spec), "ChunkedFace").filter((node) =>
    (node.props.positions as { format?: string })?.format === "vec4<f32>"
  );

const mapping = { x: "x", y: "y", z: "z" };

/** Read every vertex as [x, y, z] triples. */
const verts = (node: RenderNode): [number, number, number][] => {
  const array = (node.props.positions as { array: Float32Array }).array;
  const out: [number, number, number][] = [];
  for (let i = 0; i < array.length; i += 4) {
    out.push([array[i], array[i + 1], array[i + 2]]);
  }
  return out;
};

Deno.test("a 3D column is a closed box of six faces", () => {
  const one = { x: [0], y: [2], z: [0] };
  const node = prisms(
    ggplot(one, mapping).add(geomCol({ position: "identity" })).build(),
  )[0];
  const topology = node.props.topology as { chunks: Uint32Array };
  // Six quads, four vertices each — a box, not a flat quad.
  assertEquals(Array.from(topology.chunks), [4, 4, 4, 4, 4, 4]);
  assertEquals((node.props.positions as { length: number }).length, 24);
});

Deno.test("the footprint has thickness on both x and z", () => {
  const one = { x: [0], y: [2], z: [0] };
  const node = prisms(
    ggplot(one, mapping).add(
      geomCol({ position: "identity", width: 0.5, zwidth: 0.25 }),
    ).build(),
  )[0];
  const points = verts(node);
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[2]);
  // A prism occupies a real extent on both footprint axes; a flat quad would
  // collapse one of them to a single value.
  assertEquals(Math.max(...xs) - Math.min(...xs), 0.5);
  assertEquals(Math.max(...zs) - Math.min(...zs), 0.25);
});

Deno.test("zwidth defaults from the z scale like width does from x", () => {
  const spread = { x: [0, 1], y: [1, 1], z: [0, 1] };
  const node = prisms(
    ggplot(spread, mapping).add(geomCol({ position: "identity" })).build(),
  )[0];
  // Measure ONE prism (its first face) rather than the span across both,
  // which would include the gap between them.
  const firstFace = verts(node).slice(0, 4);
  const zs = firstFace.map((p) => p[2]);
  const xs = firstFace.map((p) => p[0]);
  // Unit spacing on both axes resolves to a 0.9 slab, matching 2D width.
  assertEquals(Number((Math.max(...xs) - Math.min(...xs)).toFixed(4)), 0.9);
  assertEquals(Number((Math.max(...zs) - Math.min(...zs)).toFixed(4)), 0);
  // The face is one of the two z-facing quads, so depth shows across faces.
  const allZs = verts(node).slice(0, 24).map((p) => p[2]);
  assertEquals(
    Number((Math.max(...allZs) - Math.min(...allZs)).toFixed(4)),
    0.9,
  );
});

Deno.test("stacking accumulates within a footprint cell, not along x alone", () => {
  // Two rows share x but sit at different z: they are separate footprints and
  // must both start at the floor. The 2D stacker keys on x only and would
  // pile the second on top of the first.
  const data = { x: [0, 0], y: [1, 1], z: [0, 5], g: ["a", "b"] };
  const node = prisms(
    ggplot(data, { ...mapping, group: "g" }).add(geomCol()).build(),
  )[0];
  const ys = verts(node).map((p) => p[1]);
  assertEquals(Math.min(...ys), 0);
  assertEquals(Math.max(...ys), 1);
});

Deno.test("stacking does accumulate when the footprint cell matches", () => {
  const data = { x: [0, 0], y: [1, 1], z: [0, 0], g: ["a", "b"] };
  const node = prisms(
    ggplot(data, { ...mapping, group: "g" }).add(geomCol()).build(),
  )[0];
  const ys = verts(node).map((p) => p[1]);
  // Same cell, so the second prism sits on the first: total height two.
  assertEquals(Math.max(...ys), 2);
});

Deno.test("geom_bar has no 3D mode because its count has no (x, z) meaning", () => {
  assertThrows(
    () => compile(ggplot({ x: [0], y: [1], z: [0] }, mapping).add(geomBar()).build()),
    Error,
    "geom_bar has no 3D mode; z is not supported",
  );
});

Deno.test("3D columns reject dodge, which competes with the z footprint", () => {
  assertThrows(
    () =>
      compile(
        ggplot({ x: [0], y: [1], z: [0] }, mapping).add(
          geomCol({ position: "dodge" }),
        ).build(),
      ),
    Error,
    'does not support position "dodge"',
  );
});
