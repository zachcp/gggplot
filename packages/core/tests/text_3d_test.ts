import { assert, assertEquals, assertThrows } from "@std/assert";
import { geomLabel, geomText, ggplot } from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import { emitSource } from "../src/emit/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";

const data = {
  x: [0, 1, 2],
  y: [0, 1, 2],
  z: [0, 1, 2],
  label: ["a", "b", "c"],
  face: ["plain", "bold", "plain"],
};
const mapping = { x: "x", y: "y", z: "z", label: "label" };

function findNodes(node: RenderNode, component: string): RenderNode[] {
  return [
    ...(node.component === component ? [node] : []),
    ...(node.children ?? []).flatMap((child) => findNodes(child, component)),
  ];
}

/** In-scene glyph nodes carry vec4 anchors; flat overlay guides do not. */
const glyphNodes = (spec: Parameters<typeof compile>[0]) =>
  findNodes(compile(spec), "Label").filter((node) =>
    Array.isArray(node.props.positions) &&
    (node.props.positions as unknown[][])[0]?.length === 4
  );

Deno.test("3D text anchors glyphs at vec4 world positions", () => {
  const nodes = glyphNodes(ggplot(data, mapping).add(geomText()).build());
  assertEquals(nodes.length, 1);
  const positions = nodes[0].props.positions as [
    number,
    number,
    number,
    number,
  ][];
  assertEquals(positions.length, 3);
  assertEquals(nodes[0].props.labels, ["a", "b", "c"]);
  // Homogeneous w stays 1 on every anchor.
  for (const position of positions) assertEquals(position[3], 1);
});

Deno.test("glyphs are pixel-constant unless perspective is asked for", () => {
  // `depth` here is the perspective size factor, not a buffer setting.
  assertEquals(
    glyphNodes(ggplot(data, mapping).add(geomText()).build())[0].props.depth,
    0,
  );
  assertEquals(
    glyphNodes(
      ggplot(data, mapping).add(geomText({ sizeMode: "perspective" })).build(),
    )[0].props.depth,
    1,
  );
});

Deno.test("a row without a label or a finite anchor is dropped", () => {
  const holed = {
    x: [0, 1, 2],
    y: [0, 1, 2],
    z: [0, Number.NaN, 2],
    label: ["a", "b", null],
  };
  const node = glyphNodes(ggplot(holed, mapping).add(geomText()).build())[0];
  // Row 1 has a non-finite z, row 2 has no label; only "a" survives.
  assertEquals(node.props.labels, ["a"]);
  assertEquals((node.props.positions as unknown[]).length, 1);
});

Deno.test("glyphs batch by resolved font identity", () => {
  const nodes = glyphNodes(
    ggplot(data, { ...mapping, fontface: "face" }).add(geomText()).build(),
  );
  // plain and bold cannot share an atlas batch.
  assertEquals(nodes.length, 2);
  assertEquals(
    nodes.flatMap((node) => node.props.labels as string[]).sort(),
    ["a", "b", "c"],
  );
});

Deno.test("3D text carries depth props and survives emitSource", () => {
  const opaque = glyphNodes(ggplot(data, mapping).add(geomText()).build())[0];
  assertEquals(opaque.props.depthTest, true);
  assertEquals(opaque.props.depthWrite, true);

  const faded =
    glyphNodes(ggplot(data, mapping).add(geomText({ alpha: 0.3 })).build())[0];
  assertEquals(faded.props.depthWrite, false);
  assertEquals(faded.props.mode, "transparent");

  const source = emitSource(
    compile(ggplot(data, mapping).add(geomText()).build()),
    "Text3D",
  );
  assert(source.includes("depthWrite"), "emitted node keeps depth props");
  assert(source.includes("positions"), "emitted node keeps its anchors");
});

Deno.test("geom_label has no 3D mode and says so", () => {
  // Its background box is measured in CSS pixels through the panel's
  // data-per-pixel ratio, which has no meaning under a perspective camera.
  assertThrows(
    () => compile(ggplot(data, mapping).add(geomLabel()).build()),
    Error,
    "geom_label has no 3D mode; z is not supported",
  );
});

Deno.test("3D text rejects non-identity stats and unknown size modes", () => {
  assertThrows(
    () =>
      compile(
        ggplot(data, mapping).add(geomText({ position: "jitter" })).build(),
      ),
    Error,
    'does not support position "jitter"',
  );
  assertThrows(
    () =>
      compile(
        ggplot(data, mapping).add(geomText({ sizeMode: "wobble" })).build(),
      ),
    Error,
    "must be one of: constant, perspective",
  );
});
