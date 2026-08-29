import { assert, assertEquals, assertThrows } from "@std/assert";
import {
  geomArea,
  geomPolygon,
  geomRect,
  geomRibbon,
  geomTile,
  ggplot,
  statSummary2d,
} from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import { emitSource } from "../src/emit/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";

function findNodes(node: RenderNode, component: string): RenderNode[] {
  return [
    ...(node.component === component ? [node] : []),
    ...(node.children ?? []).flatMap((child) => findNodes(child, component)),
  ];
}

/** In-scene surfaces carry vec4 rings; flat guide faces do not. */
const surfaces = (spec: Parameters<typeof compile>[0]) =>
  findNodes(compile(spec), "ChunkedFace").filter((node) =>
    (node.props.positions as { format?: string })?.format === "vec4<f32>"
  );

const ring = {
  x: [0, 1, 1, 0],
  y: [0, 0, 1, 1],
  z: [2, 2, 2, 2],
};

Deno.test("a 3D polygon packs one vec4 ring per group", () => {
  const nodes = surfaces(
    ggplot(ring, { x: "x", y: "y", z: "z" }).add(geomPolygon()).build(),
  );
  assertEquals(nodes.length, 1);
  const positions = nodes[0].props.positions as {
    format: string;
    length: number;
    array: Float32Array;
  };
  assertEquals(positions.format, "vec4<f32>");
  assertEquals(positions.length, 4);
  for (let i = 3; i < positions.array.length; i += 4) {
    assertEquals(positions.array[i], 1);
  }
});

Deno.test("groups become separate rings in one packed face", () => {
  const two = {
    x: [0, 1, 1, 0, 2, 3, 3, 2],
    y: [0, 0, 1, 1, 0, 0, 1, 1],
    z: [2, 2, 2, 2, 5, 5, 5, 5],
    g: ["a", "a", "a", "a", "b", "b", "b", "b"],
  };
  const nodes = surfaces(
    ggplot(two, { x: "x", y: "y", z: "z", group: "g" }).add(geomPolygon())
      .build(),
  );
  // One node, two rings — the packer concatenates groups rather than
  // emitting a draw call each.
  assertEquals(nodes.length, 1);
  assertEquals((nodes[0].props.positions as { length: number }).length, 8);
  const topology = nodes[0].props.topology as { chunks?: Uint32Array };
  assertEquals(Array.from(topology.chunks ?? []), [4, 4]);
});

Deno.test("a ring with a missing vertex is dropped, not closed across the gap", () => {
  // Closing the gap would invent area the data never had.
  const holed = { x: [0, 1, 1, 0], y: [0, 0, 1, 1], z: [2, null, 2, 2] };
  assertEquals(
    surfaces(
      ggplot(holed, { x: "x", y: "y", z: "z" }).add(geomPolygon()).build(),
    ).length,
    0,
  );
});

Deno.test("3D rect lies flat in the plane at its row's z", () => {
  const data = {
    xmin: [0],
    xmax: [1],
    ymin: [0],
    ymax: [2],
    z: [5],
  };
  const node = surfaces(
    ggplot(data, {
      xmin: "xmin",
      xmax: "xmax",
      ymin: "ymin",
      ymax: "ymax",
      z: "z",
    }).add(geomRect()).build(),
  )[0];
  const array = (node.props.positions as { array: Float32Array }).array;
  const zs: number[] = [];
  for (let i = 2; i < array.length; i += 4) zs.push(array[i]);
  // Four corners, all at one depth: a plane, never an extrusion.
  assertEquals(zs.length, 4);
  assertEquals(new Set(zs).size, 1);
});

Deno.test("a 3D ribbon is one surface, not a solid", () => {
  const band = {
    x: [0, 1, 2],
    ymin: [0, 0, 0],
    ymax: [1, 2, 1],
    z: [3, 3, 3],
  };
  const nodes = surfaces(
    ggplot(band, { x: "x", ymin: "ymin", ymax: "ymax", z: "z" })
      .add(geomRibbon()).build(),
  );
  // One ring walking the upper edge and back along the lower one — six
  // vertices for three x values, and a single face rather than two.
  assertEquals(nodes.length, 1);
  assertEquals((nodes[0].props.positions as { length: number }).length, 6);
});

Deno.test("3D area does not fill to a z floor", () => {
  const series = { x: [0, 1, 2], y: [1, 2, 1], z: [4, 4, 4] };
  const node = surfaces(
    ggplot(series, { x: "x", y: "y", z: "z" }).add(geomArea()).build(),
  )[0];
  const array = (node.props.positions as { array: Float32Array }).array;
  const zs: number[] = [];
  for (let i = 2; i < array.length; i += 4) zs.push(array[i]);
  // Every vertex shares the layer's z: the band stands in its plane rather
  // than dropping to a floor the grammar never chose.
  assertEquals(new Set(zs).size, 1);
});

Deno.test("surfaces carry depth props and survive emitSource", () => {
  const opaque = surfaces(
    ggplot(ring, { x: "x", y: "y", z: "z" }).add(geomPolygon()).build(),
  )[0];
  assertEquals(opaque.props.depthTest, true);
  assertEquals(opaque.props.depthWrite, true);

  const faded = surfaces(
    ggplot(ring, { x: "x", y: "y", z: "z" }).add(geomPolygon({ alpha: 0.4 }))
      .build(),
  )[0];
  assertEquals(faded.props.depthWrite, false);
  assertEquals(faded.props.mode, "transparent");

  const source = emitSource(
    compile(
      ggplot(ring, { x: "x", y: "y", z: "z" }).add(geomPolygon()).build(),
    ),
    "Surface3D",
  );
  assert(source.includes("vec4<f32>"));
  assert(source.includes("depthWrite"));
});

Deno.test("geom_tile keeps z as a value channel and gains no 3D mode", () => {
  // z is already spoken for on tile — statSummary2d reduces it per cell — so
  // a second positional meaning would make a mapped z ambiguous.
  assertEquals(
    findNodes(
      compile(
        ggplot(ring, { x: "x", y: "y", z: "z" }).add(geomTile()).build(),
      ),
      "Scene3D",
    ).length,
    0,
  );
  assertEquals(
    findNodes(
      compile(
        ggplot({ x: [0, 1], y: [0, 1], z: [1, 2] }, {
          x: "x",
          y: "y",
          z: "z",
        }).add(statSummary2d({ bins: 2 })).build(),
      ),
      "Scene3D",
    ).length,
    0,
  );
});

Deno.test("3D surfaces reject non-identity stats and positions", () => {
  assertThrows(
    () =>
      compile(
        ggplot(ring, { x: "x", y: "y", z: "z" })
          .add(geomArea({ position: "stack" })).build(),
      ),
    Error,
    'does not support position "stack"',
  );
});
