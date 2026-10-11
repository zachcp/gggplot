// gggplot-d14: a resize re-lays out guides only. The root prepares and trains
// layout-free (prepareRoot) and lays out per size (layoutRoot), so a resize
// runs no stat, no training and no lowering, and keeps every mark tensor.
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import {
  createRootCaches,
  layoutRoot,
  plotSpec,
  prepareRoot,
} from "../src/components/root_assembly.ts";
import { layerFromProps } from "../src/components/geom_layer.ts";
import { GeomLine, GeomPoint, GeomText } from "../src/components/geoms.ts";
import { Labs } from "../src/components/plot_parts.ts";
import { componentProbe } from "../src/components/probe.ts";
import { buildFacetPanels, type RenderNode } from "../src/compile/mod.ts";
import { ingest, touchColumn } from "../src/data/mod.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";

const data = ingest({
  x: [1, 2, 3, 4],
  y: [3, 1, 4, 2],
  v: [0.2, 0.4, 0.6, 0.8],
  label: ["a", "b", "c", "d"],
});

function marks(tree: RenderNode): Map<string, unknown> {
  const out = new Map<string, unknown>();
  const walk = (node: RenderNode) => {
    const positions = node.props.positions as { array?: unknown } | undefined;
    if (node.key?.startsWith("layer-") && positions?.array) {
      out.set(node.key, positions.array);
    }
    node.children.forEach(walk);
  };
  walk(tree);
  return out;
}

Deno.test("a resize trains nothing, lowers nothing and keeps every tensor", () => {
  const base = plotSpec(data, { x: "x", y: "y" }, undefined, undefined, [
    Labs.part({ title: "Resize" }),
  ]);
  const layers = [
    layerFromProps(GeomPoint.layerProps({ mapping: { fill: "v" } })),
    layerFromProps(GeomLine.layerProps({})),
  ].map((layer, i) => ({ kind: "layer" as const, id: i + 1, layer }));
  const caches = createRootCaches();
  const root = prepareRoot(
    base,
    layers,
    buildFacetPanels(base.facet, base.data, base.labels),
    caches,
  )!;
  const small = layoutRoot(root, {
    width: 400,
    height: 300,
    measureText: approximateTextMeasurer,
  }, caches);
  componentProbe.reset();
  const large = layoutRoot(root, {
    width: 1200,
    height: 800,
    measureText: approximateTextMeasurer,
  }, caches);
  assertEquals(
    {
      train: componentProbe.trainCalls,
      stat: componentProbe.statCalls,
      lower: componentProbe.lowerCalls,
      layout: componentProbe.assembleCalls,
    },
    { train: 0, stat: 0, lower: 0, layout: 1 },
  );
  const before = marks(small.tree);
  const after = marks(large.tree);
  assert(before.size > 0);
  for (const [key, array] of after) {
    assert(before.get(key) === array, `${key} kept its tensor`);
  }
  // The guides did re-lay out: the panel moved within the larger canvas.
  assertNotEquals(small.info!.panelBounds, large.info!.panelBounds);
});

Deno.test("layout-bound geoms re-lower on a resize; the rest do not", () => {
  const base = plotSpec(data, { x: "x", y: "y" }, undefined, undefined, []);
  const layers = [
    layerFromProps(GeomPoint.layerProps({})),
    layerFromProps(GeomText.layerProps({ mapping: { label: "label" } })),
  ].map((layer, i) => ({ kind: "layer" as const, id: i + 1, layer }));
  const caches = createRootCaches();
  const root = prepareRoot(
    base,
    layers,
    buildFacetPanels(base.facet, base.data, base.labels),
    caches,
  )!;
  const layout = (width: number) =>
    layoutRoot(root, {
      width,
      height: 400,
      measureText: approximateTextMeasurer,
    }, caches);
  layout(500);
  componentProbe.reset();
  layout(900);
  // Text places glyphs in panel pixels, so it alone lowers again.
  assertEquals(componentProbe.lowerCalls, 1);
  assertEquals(componentProbe.trainCalls, 0);
});

Deno.test("a column touched in place re-prepares and re-packs what read it", () => {
  const frame = ingest({ x: [1, 2, 3], y: [3, 1, 2], z: [5, 6, 7] });
  const base = plotSpec(frame, { x: "x", y: "y" }, undefined, undefined, []);
  const layers = [{
    kind: "layer" as const,
    id: 1,
    layer: layerFromProps(GeomPoint.layerProps({})),
  }];
  const caches = createRootCaches();
  const panels = () => buildFacetPanels(base.facet, base.data, base.labels);
  const layout = {
    width: 500,
    height: 400,
    measureText: approximateTextMeasurer,
  };
  const first = layoutRoot(
    prepareRoot(base, layers, panels(), caches)!,
    layout,
    caches,
  );
  // Same frame, same column objects: only y's version moves.
  frame.y.values[0] = 9;
  touchColumn(frame.y);
  componentProbe.reset();
  const second = layoutRoot(
    prepareRoot(base, layers, panels(), caches)!,
    layout,
    caches,
  );
  assertEquals(componentProbe.statCalls, 1, "the layer re-prepared");
  assertEquals(componentProbe.lowerCalls, 1, "and re-lowered");
  const ys = (tree: RenderNode) => {
    const [array] = marks(tree).values() as IterableIterator<Float32Array>;
    return Array.from(array).filter((_, i) => i % 2 === 1);
  };
  assertEquals(ys(first.tree)[0], 3);
  assertEquals(ys(second.tree)[0], 9);
});
