// gggplot-269d: facets on the component path. The root partitions the rows
// per panel on the CPU (buildFacetPanels), prepares each layer per panel,
// trains free scales per panel, and lays the grid and strips out with the
// same facet layout as compile(): the trees match but for the component
// path's mark keys and owners.
import { assert, assertEquals } from "@std/assert";
import {
  createRootCaches,
  layoutRoot,
  plotSpec,
  prepareRoot,
} from "../src/components/root_assembly.ts";
import { layerFromProps } from "../src/components/geom_layer.ts";
import {
  GeomHistogram,
  GeomLine,
  GeomPoint,
  type NamedGeom,
} from "../src/components/geoms.ts";
import { FacetGrid, FacetWrap } from "../src/components/plot_parts.ts";
import {
  buildFacetPanels,
  compile,
  type RenderNode,
} from "../src/compile/mod.ts";
import type { SpecPart } from "../src/dsl/base.ts";
import { ingest } from "../src/data/mod.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";
import { componentProbe } from "../src/components/probe.ts";

const LAYOUT = {
  width: 720,
  height: 480,
  measureText: approximateTextMeasurer,
};

const n = 36;
const data = ingest({
  x: Array.from({ length: n }, (_, i) => (i % 6) * (1 + Math.floor(i / 12))),
  y: Array.from({ length: n }, (_, i) => Math.cos(i / 4) * (i % 3 + 1)),
  row: Array.from({ length: n }, (_, i) => ["r1", "r2"][i % 2]),
  col: Array.from({ length: n }, (_, i) => ["c1", "c2", "c3"][i % 3]),
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

function both(layers: Array<[Geom, Record<string, unknown>]>, facet: SpecPart) {
  const built = layers.map(([geom, props]) =>
    layerFromProps(geom.layerProps(props))
  );
  const base = plotSpec(data, { x: "x", y: "y" }, undefined, undefined, [
    facet,
  ]);
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

const LAYERS: Array<[Geom, Record<string, unknown>]> = [
  [GeomPoint, {}],
  [GeomLine, {}],
];

const FACETS: Array<[string, SpecPart]> = [
  ["facet_wrap", FacetWrap.part({ vars: ["col"] })],
  ["facet_wrap, two columns", FacetWrap.part({ vars: ["col"], ncol: 2 })],
  ["facet_grid", FacetGrid.part({ rows: ["row"], cols: ["col"] })],
  ...(["free", "free_x", "free_y"] as const).map((
    scales,
  ): [string, SpecPart] => [
    `facet_grid, scales = ${scales}`,
    FacetGrid.part({ rows: ["row"], cols: ["col"], scales }),
  ]),
  [
    "facet_wrap, scales = free",
    FacetWrap.part({ vars: ["col"], scales: "free" }),
  ],
];

for (const [name, facet] of FACETS) {
  Deno.test(`facets on the component path match compile(): ${name}`, () => {
    const { component, compiled } = both(LAYERS, facet);
    assertEquals(plain(component), plain(compiled));
  });
}

Deno.test("a per-panel stat runs once per panel and matches compile()", () => {
  componentProbe.reset();
  const { component, compiled } = both(
    [[GeomHistogram, { bins: 4 }]],
    FacetWrap.part({ vars: ["col"] }),
  );
  // One CPU partition per panel, each binned on its own rows.
  assertEquals(componentProbe.statCalls, 3);
  assertEquals(plain(component), plain(compiled));
});

Deno.test("free scales train per panel", () => {
  const { root } = both(
    LAYERS,
    FacetWrap.part({ vars: ["col"], scales: "free_x" }),
  );
  const domains = root.trained.panelTrains.map((t) => t.xDomain.join(","));
  assert(new Set(domains).size > 1, `per-panel x domains: ${domains}`);
});

Deno.test("a resize re-lays out the facet grid only", () => {
  const { root, caches } = both(
    LAYERS,
    FacetGrid.part({
      rows: ["row"],
      cols: ["col"],
    }),
  );
  componentProbe.reset();
  layoutRoot(root, { ...LAYOUT, width: 1000 }, caches);
  assertEquals(componentProbe.statCalls, 0);
  assertEquals(componentProbe.trainCalls, 0);
  assertEquals(componentProbe.lowerCalls, 0);
});
