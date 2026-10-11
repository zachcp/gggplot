// gggplot-mqj: on the component path each layer memoizes its packed (and, in
// polar, munched) tensors on its inputs, with no whole-plot pack cache: a
// re-assembly over unchanged inputs hands back the very same typed arrays, so
// nothing re-uploads.
import { assert, assertEquals, assertNotStrictEquals } from "@std/assert";
import {
  assembleRoot,
  createRootCaches,
  plotSpec,
  type RootCaches,
} from "../src/components/root_assembly.ts";
import { layerFromProps } from "../src/components/geom_layer.ts";
import { GeomLine, GeomPoint } from "../src/components/geoms.ts";
import {
  CoordPolar,
  ThemeMinimal,
  ThemeOverrides,
} from "../src/components/plot_parts.ts";
import { componentProbe } from "../src/components/probe.ts";
import { buildFacetPanels, type RenderNode } from "../src/compile/mod.ts";
import type { SpecPart } from "../src/dsl/base.ts";
import { ingest } from "../src/data/mod.ts";
import type { Layer } from "../src/ir/types.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";

const data = ingest({
  x: [0, 1, 2, 3, 4, 5],
  y: [2, 4, 3, 5, 1, 6],
});
const other = ingest({ x: [0, 2, 4], y: [1, 1, 2] });

const point = layerFromProps(GeomPoint.layerProps({ size: 4 }));
const line = layerFromProps(GeomLine.layerProps({}));

/** One root assembly over the parts, as the root's view memo runs it. */
function assemble(
  caches: RootCaches,
  layers: Layer[],
  parts: SpecPart[],
  width = 640,
) {
  const base = plotSpec(data, { x: "x", y: "y" }, undefined, undefined, parts);
  return assembleRoot(
    base,
    layers.map((layer, i) => ({ kind: "layer" as const, id: i + 1, layer })),
    buildFacetPanels(base.facet, base.data, base.labels),
    { width, height: 400, measureText: approximateTextMeasurer },
    caches,
  );
}

/** Every mark's position array, in tree order. */
function markArrays(tree: RenderNode): unknown[] {
  const out: unknown[] = [];
  const walk = (node: RenderNode) => {
    if (node.key?.startsWith("layer-")) {
      const positions = node.props.positions as { array?: unknown } | undefined;
      if (positions?.array) out.push(positions.array);
    }
    node.children.forEach(walk);
  };
  walk(tree);
  return out;
}

const assertSameArrays = (a: unknown[], b: unknown[], why: string) => {
  assert(a.length > 0, "the plot has marks");
  assertEquals(a.length, b.length);
  a.forEach((array, i) => assert(array === b[i], `${why}: mark ${i}`));
};

for (
  const [name, parts] of [
    ["cartesian", []],
    ["polar", [CoordPolar.part({})]],
  ] as Array<[string, SpecPart[]]>
) {
  Deno.test(`${name}: a resize keeps every tensor`, () => {
    const caches = createRootCaches();
    const first = markArrays(assemble(caches, [point, line], parts).tree);
    componentProbe.reset();
    const resized = markArrays(
      assemble(caches, [point, line], parts, 900).tree,
    );
    assertSameArrays(first, resized, "after resize");
    assertEquals(componentProbe.lowerCalls, 0, "nothing re-lowered");
    assertEquals(componentProbe.polarCalls, 0, "nothing re-munched");
  });

  Deno.test(`${name}: a plot-level change keeps unchanged tensors`, () => {
    const caches = createRootCaches();
    const first = markArrays(
      assemble(caches, [point, line], [...parts, ThemeMinimal.part({})]).tree,
    );
    // A theme change re-prepares every layer (the base spec changed), but the
    // repacked bytes are equal, so the arrays come back by identity.
    const themed = markArrays(
      assemble(caches, [point, line], [
        ...parts,
        ThemeMinimal.part({}),
        ThemeOverrides.part({ gridColor: "#eeeeee" }),
      ]).tree,
    );
    assertSameArrays(first, themed, "after a theme change");
  });

  Deno.test(`${name}: changed data re-packs only its own layer`, () => {
    const caches = createRootCaches();
    const lineWithData = layerFromProps(GeomLine.layerProps({ data: other }));
    const before = markArrays(assemble(caches, [point, line], parts).tree);
    const after = markArrays(
      assemble(caches, [point, lineWithData], parts).tree,
    );
    // The domains did not move (the new rows sit inside them), so the point
    // layer's tensors survive while the line's are new.
    assert(before[0] === after[0], "point tensors kept");
    assertNotStrictEquals(before[1], after[1]);
  });
}

Deno.test("polar marks keep their keys, and points their owners", () => {
  const { tree } = assemble(createRootCaches(), [point, line], [
    CoordPolar.part({}),
  ]);
  const marks: RenderNode[] = [];
  const walk = (node: RenderNode) => {
    if (node.key?.startsWith("layer-")) marks.push(node);
    node.children.forEach(walk);
  };
  walk(tree);
  assertEquals(marks.map((m) => m.key), ["layer-1-0-0", "layer-2-0-0"]);
  // Points are not munched: one owner row per vertex still holds.
  assertEquals(Array.from(marks[0].owners ?? []), [0, 1, 2, 3, 4, 5]);
  // The line is munched into more vertices than rows, so its owners go.
  assertEquals(marks[1].owners, undefined);
});
