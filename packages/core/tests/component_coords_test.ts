// gggplot-nmok: polar, flip and zoom on the component path. coord_polar
// munches marks through the root's per-mark memo (gggplot-mqj) and draws the
// polar grid; coord_flip and theta = "y" swizzle the view's axes; a
// coord_cartesian zoom narrows the view range and clips marks with a
// ScissorBox while keeping every row. Each matches compile()'s tree but for
// the component path's mark keys and owners.
import { assert, assertEquals } from "@std/assert";
import {
  createRootCaches,
  layoutRoot,
  plotSpec,
  prepareRoot,
} from "../src/components/root_assembly.ts";
import { layerFromProps } from "../src/components/geom_layer.ts";
import {
  GeomBar,
  GeomBoxplot,
  GeomLine,
  GeomPoint,
  type NamedGeom,
} from "../src/components/geoms.ts";
import {
  CoordCartesian,
  CoordFlip,
  CoordPolar,
  CoordRadial,
} from "../src/components/plot_parts.ts";
import {
  buildFacetPanels,
  compile,
  type RenderNode,
} from "../src/compile/mod.ts";
import type { SpecPart } from "../src/dsl/base.ts";
import { ingest } from "../src/data/mod.ts";
import type { Aes } from "../src/ir/types.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";
import { componentProbe } from "../src/components/probe.ts";

const LAYOUT = {
  width: 640,
  height: 480,
  measureText: approximateTextMeasurer,
};

const data = ingest({
  x: [1, 2, 3, 4, 5, 6, 7, 8],
  y: [3, 7, 2, 9, 4, 8, 1, 6],
  g: ["a", "b", "a", "b", "a", "b", "a", "b"],
});

function plain(node: RenderNode): unknown {
  return {
    component: node.component,
    props: node.props,
    children: node.children.map(plain),
  };
}

// deno-lint-ignore no-explicit-any
type Geom = NamedGeom<any>;

function both(
  layers: Array<[Geom, Record<string, unknown>]>,
  parts: SpecPart[],
  mapping: Aes = { x: "x", y: "y" },
) {
  const built = layers.map(([geom, props]) =>
    layerFromProps(geom.layerProps(props))
  );
  const base = plotSpec(data, mapping, undefined, undefined, parts);
  const caches = createRootCaches();
  const root = prepareRoot(
    base,
    built.map((layer, i) => ({ kind: "layer" as const, id: i + 1, layer })),
    buildFacetPanels(base.facet, base.data, base.labels),
    caches,
  )!;
  return {
    root,
    caches,
    component: layoutRoot(root, LAYOUT, caches).tree,
    compiled: compile({ ...base, layers: built }, { layout: LAYOUT }),
  };
}

function find(tree: RenderNode, component: string): RenderNode[] {
  const out: RenderNode[] = [];
  const walk = (node: RenderNode) => {
    if (node.component === component) out.push(node);
    node.children.forEach(walk);
  };
  walk(tree);
  return out;
}

const POINTS_LINES: Array<[Geom, Record<string, unknown>]> = [
  [GeomPoint, {}],
  [GeomLine, {}],
];

const COORDS: Array<
  [string, Array<[Geom, Record<string, unknown>]>, SpecPart[]]
> = [
  ["coord_polar", POINTS_LINES, [CoordPolar.part({})]],
  ["coord_polar(theta = y)", POINTS_LINES, [CoordPolar.part({ theta: "y" })]],
  ["coord_radial (donut)", POINTS_LINES, [
    CoordRadial.part({ donut: 0.3, end: Math.PI }),
  ]],
  ["coord_flip", [[GeomBar, { stat: "identity" }]], [CoordFlip.part({})]],
  ["coord_cartesian zoom", POINTS_LINES, [
    CoordCartesian.part({ xlim: [2, 6], ylim: [2, 8] }),
  ]],
];

for (const [name, layers, parts] of COORDS) {
  Deno.test(`coords on the component path match compile(): ${name}`, () => {
    const { component, compiled } = both(layers, parts);
    assertEquals(plain(component), plain(compiled));
  });
}

Deno.test("a polar resize re-munches nothing", () => {
  const { root, caches } = both(POINTS_LINES, [CoordPolar.part({})]);
  componentProbe.reset();
  layoutRoot(root, { ...LAYOUT, width: 900 }, caches);
  assertEquals(componentProbe.polarCalls, 0);
  assertEquals(componentProbe.lowerCalls, 0);
});

Deno.test("flip and theta = y are axis swizzles on the view", () => {
  const flipped = both([[GeomBar, { stat: "identity" }]], [CoordFlip.part({})]);
  assertEquals(find(flipped.component, "Cartesian")[0].props.axes, "yx");
  const theta = both(POINTS_LINES, [CoordPolar.part({ theta: "y" })]);
  assertEquals(find(theta.component, "Polar")[0].props.axes, "yx");
});

Deno.test("a zoom clips marks and keeps every row", () => {
  const { component } = both(POINTS_LINES, [
    CoordCartesian.part({ xlim: [2, 6] }),
  ]);
  const [scissor] = find(component, "ScissorBox");
  assert(scissor, "zoomed marks sit inside a ScissorBox");
  // Every row is still lowered: the zoom narrows the view, not the data.
  const [points] = find(scissor, "Point");
  const positions = points.props.positions as { array: Float32Array };
  assertEquals(positions.array.length / 2, 8);
  // Guides stay outside the scissor box.
  assertEquals(find(scissor, "Axis").length, 0);
});

Deno.test("zooming does not change a stat's output", () => {
  const stat = (parts: SpecPart[]) =>
    both([[GeomBoxplot, {}]], parts, { x: "g", y: "y" }).root.prepared
      .panelLayers[0][0].data;
  assertEquals(stat([CoordCartesian.part({ ylim: [3, 7] })]), stat([]));
});

Deno.test("no scissor box when nothing is zoomed", () => {
  assertEquals(find(both(POINTS_LINES, []).component, "ScissorBox"), []);
});
