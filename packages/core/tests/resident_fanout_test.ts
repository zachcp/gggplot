// gggplot-280: products are addressable, so consumers of the same product
// share one hoisted node: one build, one dispatch per version.
import { assertEquals } from "@std/assert";
import { node, type RenderNode } from "../src/compile/rendertree.ts";
import {
  RESIDENT_STAT_BIN_PRODUCT,
  RESIDENT_STAT_BIN_TILES_PRODUCT,
  RESIDENT_STAT_COUNT_PRODUCT,
} from "../src/compile/resident.ts";
import { collectResidentNodes } from "../src/runtime/resident_host.tsx";
import { RESIDENT_ID_PROP } from "../src/runtime/resident_products.ts";
import {
  assembleRoot as assembleRootOrNull,
  createRootCaches,
  plotSpec,
} from "../src/components/root_assembly.ts";
import { layerFromProps } from "../src/components/geom_layer.ts";
import { GeomBar, GeomHistogram } from "../src/components/geoms.ts";
import { ScaleYContinuous } from "../src/components/plot_parts.ts";
import { buildFacetPanels } from "../src/compile/mod.ts";
import { ingest } from "../src/data/mod.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";

/** assembleRoot for plots with no pending layer: never null. */
const assembleRoot = (
  ...args: Parameters<typeof assembleRootOrNull>
) => assembleRootOrNull(...args)!;

const frame = ingest({ x: [0.5, 1.5, 2.5, 3.5], g: ["a", "b", "a", "b"] });

const product = (props: Record<string, unknown>) =>
  node("ResidentProduct", {
    product: RESIDENT_STAT_BIN_PRODUCT,
    data: frame,
    x: "x",
    options: { bins: 4, autoDomain: true, position: "stack" },
    ...props,
  });

/** Every hoisted mark's resident id, in tree order. */
function ids(tree: RenderNode): number[] {
  const out: number[] = [];
  const walk = (n: RenderNode) => {
    if (n.component === "ResidentProduct") {
      out.push(n.props[RESIDENT_ID_PROP] as number);
    }
    n.children.forEach(walk);
  };
  walk(tree);
  return out;
}

Deno.test("consumers of one product share one hoisted node", () => {
  // Two marks over the same grid: their mark colors are consumer props.
  const { tree, nodes } = collectResidentNodes(
    node("Plot", {}, [
      product({ color: "#ff0000" }),
      product({ color: "#0000ff", view: false }),
    ]),
  );
  assertEquals(nodes.length, 1);
  assertEquals(ids(tree), [0, 0]);
});

Deno.test("both stat_bin forms run one kernel", () => {
  const { tree, nodes } = collectResidentNodes(
    node("Plot", {}, [
      product({}),
      product({ product: RESIDENT_STAT_BIN_TILES_PRODUCT }),
    ]),
  );
  assertEquals(nodes.length, 1);
  assertEquals(ids(tree), [0, 0]);
});

Deno.test("different inputs are different products", () => {
  const other = ingest({ x: [0.5, 1.5, 2.5, 3.5], g: ["a", "b", "a", "b"] });
  const { tree, nodes } = collectResidentNodes(
    node("Plot", {}, [
      product({}),
      // Another frame, even with equal values: a different source.
      product({ data: other }),
      product({ options: { bins: 8, autoDomain: true, position: "stack" } }),
      product({ group: "g" }),
      product({ paletteColors: ["#000000", "#ffffff"] }),
      product({ product: RESIDENT_STAT_COUNT_PRODUCT }),
    ]),
  );
  assertEquals(nodes.length, 6);
  assertEquals(ids(tree), [0, 1, 2, 3, 4, 5]);
});

Deno.test("two histogram layers on the component path dispatch once", () => {
  // Inline resident marks (more than one layer) need an explicit y domain.
  const data = ingest({ x: Array.from({ length: 64 }, (_, i) => i / 8) });
  const base = plotSpec(data, { x: "x" }, undefined, undefined, [
    ScaleYContinuous.part({ domain: [0, 20] }),
  ]);
  const layers = [
    layerFromProps(GeomHistogram.layerProps({ bins: 8, fill: "#2563eb" })),
    layerFromProps(GeomHistogram.layerProps({ bins: 8, fill: "#f97316" })),
  ].map((layer, i) => ({ kind: "layer" as const, id: i + 1, layer }));
  const { tree, residentNodes } = assembleRoot(
    base,
    layers,
    buildFacetPanels(base.facet, base.data, base.labels),
    { width: 640, height: 400, measureText: approximateTextMeasurer },
    createRootCaches(),
  );
  assertEquals(residentNodes.length, 1);
  assertEquals(ids(tree), [0, 0]);
});

Deno.test("a cached plan does not outlive the layer count it assumed", () => {
  // Without an explicit y domain only a LONE count layer is resident (its
  // standalone view reads the y range off the GPU); beside a second layer it
  // falls back to the CPU. Adding a layer over the same caches must not keep
  // the first assembly's standalone plan.
  const data = ingest({ c: ["a", "b", "a", "c"] });
  const base = plotSpec(data, { x: "c" }, undefined, undefined, []);
  const panels = buildFacetPanels(base.facet, base.data, base.labels);
  const layout = {
    width: 640,
    height: 400,
    measureText: approximateTextMeasurer,
  };
  const caches = createRootCaches();
  const bar = {
    kind: "layer" as const,
    id: 1,
    layer: layerFromProps(GeomBar.layerProps({})),
  };
  const one = assembleRoot(base, [bar], panels, layout, caches);
  assertEquals(one.residentNodes.length, 1);
  assertEquals(ids(one.tree), [0]);
  const two = assembleRoot(
    base,
    [bar, { ...bar, id: 2 }],
    panels,
    layout,
    caches,
  );
  assertEquals(two.residentNodes.length, 0);
  assertEquals(ids(two.tree), []);
});
