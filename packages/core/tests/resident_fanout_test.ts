// gggplot-280: products are addressable, so consumers of the same product
// share one plan: one build, one dispatch per version (vnh.5.1: the root
// plans them; each mark finds its product by key).
import { assertEquals } from "@std/assert";
import type { RenderNode } from "../src/compile/rendertree.ts";
import {
  RESIDENT_STAT_BIN_PRODUCT,
  RESIDENT_STAT_BIN_TILES_PRODUCT,
  RESIDENT_STAT_COUNT_PRODUCT,
} from "../src/geom/resident_plans.ts";
import { productKey } from "../src/runtime/product_host.tsx";
import {
  assembleRoot as assembleRootOrNull,
  createRootCaches,
  plotSpec,
  prepareLayers,
  residentPlans,
} from "../src/components/root_assembly.ts";
import { layerFromProps } from "../src/components/geom_layer.ts";
import { GeomBar, GeomHistogram } from "../src/components/geoms.ts";
import { ScaleYContinuous } from "../src/components/plot_parts.ts";
import { buildFacetPanels, type PreparedPlot } from "../src/compile/mod.ts";
import { ingest } from "../src/data/mod.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";

/** assembleRoot for plots with no pending layer: never null. */
const assembleRoot = (
  ...args: Parameters<typeof assembleRootOrNull>
) => assembleRootOrNull(...args)!;

const frame = ingest({ x: [0.5, 1.5, 2.5, 3.5], g: ["a", "b", "a", "b"] });

const props = (extra: Record<string, unknown>) => ({
  data: frame,
  x: "x",
  options: { bins: 4, autoDomain: true, position: "stack" },
  ...extra,
});

/** A prepared plot whose single panel holds these resident layers. */
const preparedOf = (
  residents: { product: string; props: Record<string, unknown> }[],
): PreparedPlot => ({
  panels: [],
  nrow: 1,
  ncol: 1,
  removals: new Map(),
  panelLayers: [
    residents.map((resident) => ({ resident }) as never),
  ],
});

/** Every ProductMark's product key, in tree order. */
function markKeys(tree: RenderNode): string[] {
  const out: string[] = [];
  const walk = (n: RenderNode) => {
    if (n.component === "ProductMark") out.push(n.props.productKey as string);
    n.children.forEach(walk);
  };
  walk(tree);
  return out;
}

Deno.test("consumers of one product share one plan", () => {
  // Two marks over the same grid: their mark colors are consumer props.
  const plans = residentPlans(preparedOf([
    { product: RESIDENT_STAT_BIN_PRODUCT, props: props({ color: "#ff0000" }) },
    { product: RESIDENT_STAT_BIN_PRODUCT, props: props({ color: "#0000ff" }) },
  ]));
  assertEquals(plans.length, 1);
});

Deno.test("both stat_bin forms run one kernel", () => {
  const plans = residentPlans(preparedOf([
    { product: RESIDENT_STAT_BIN_PRODUCT, props: props({}) },
    { product: RESIDENT_STAT_BIN_TILES_PRODUCT, props: props({}) },
  ]));
  assertEquals(plans.length, 1);
  assertEquals(
    productKey(RESIDENT_STAT_BIN_PRODUCT, props({})),
    productKey(RESIDENT_STAT_BIN_TILES_PRODUCT, props({})),
  );
});

Deno.test("different inputs are different products", () => {
  const other = ingest({ x: [0.5, 1.5, 2.5, 3.5], g: ["a", "b", "a", "b"] });
  const plans = residentPlans(preparedOf([
    { product: RESIDENT_STAT_BIN_PRODUCT, props: props({}) },
    // Another frame, even with equal values: a different source.
    { product: RESIDENT_STAT_BIN_PRODUCT, props: props({ data: other }) },
    {
      product: RESIDENT_STAT_BIN_PRODUCT,
      props: props({
        options: { bins: 8, autoDomain: true, position: "stack" },
      }),
    },
    { product: RESIDENT_STAT_BIN_PRODUCT, props: props({ group: "g" }) },
    {
      product: RESIDENT_STAT_BIN_PRODUCT,
      props: props({ paletteColors: ["#000000", "#ffffff"] }),
    },
    { product: RESIDENT_STAT_COUNT_PRODUCT, props: props({}) },
  ]));
  assertEquals(plans.length, 6);
});

Deno.test("a plan reports its summary when any consumer owns the y range", () => {
  const plans = residentPlans(preparedOf([
    { product: RESIDENT_STAT_BIN_PRODUCT, props: props({ color: "#ff0000" }) },
    {
      product: RESIDENT_STAT_BIN_PRODUCT,
      props: props({ color: "#0000ff", autoYDomain: true }),
    },
  ]));
  assertEquals(plans.map((plan) => plan.summary), [true]);
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
  const panels = buildFacetPanels(base.facet, base.data, base.labels);
  const caches = createRootCaches();
  const { plans } = prepareLayers(base, layers, panels, caches)!;
  const { tree } = assembleRoot(
    base,
    layers,
    panels,
    { width: 640, height: 400, measureText: approximateTextMeasurer },
    caches,
  );
  assertEquals(plans.length, 1);
  assertEquals(markKeys(tree), [plans[0].key, plans[0].key]);
});

Deno.test("a cached plan does not outlive the layer count it assumed", () => {
  // Without an explicit y domain only a LONE count layer is resident (the
  // root reads its y range off the GPU); beside a second layer it falls back
  // to the CPU. Adding a layer over the same caches must not keep
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
  const one = prepareLayers(base, [bar], panels, caches)!;
  assertEquals(one.plans.length, 1);
  assertEquals(one.plans[0].summary, true);
  // Nothing trains until the product's summary is read back.
  assertEquals(assembleRootOrNull(base, [bar], panels, layout, caches), null);
  const readbacks = new Map([[one.plans[0].key, {
    version: 1,
    value: {
      groupTotals: new Uint32Array(0),
      stackedMaximum: 2,
      byteLength: 0,
    },
  }]]);
  const first = assembleRoot(base, [bar], panels, layout, caches, readbacks);
  assertEquals(markKeys(first.tree), [one.plans[0].key]);
  const two = assembleRoot(
    base,
    [bar, { ...bar, id: 2 }],
    panels,
    layout,
    caches,
  );
  assertEquals(
    prepareLayers(base, [bar, { ...bar, id: 2 }], panels, caches)!.plans
      .length,
    0,
  );
  assertEquals(markKeys(two.tree), []);
});
