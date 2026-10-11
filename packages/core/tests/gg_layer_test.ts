// gggplot-4ot: a <GGLayer> trains the plot like a geom (its rows widen the
// position domains and its aesthetics add legend scales) and draws its
// children in the panel.
import { assert, assertEquals } from "@std/assert";
import { GGLayer, type GGLayerProps } from "../src/components/gg_layer.ts";
import { GeomLayer, layerFromProps } from "../src/components/geom_layer.ts";
import { GGPanel } from "../src/components/parts.ts";
import { GeomPoint } from "../src/components/geoms.ts";
import {
  createRootCaches,
  layoutRoot,
  plotSpec,
  prepareRoot,
} from "../src/components/root_assembly.ts";
import { buildFacetPanels, type RenderNode } from "../src/compile/mod.ts";
import { ingest } from "../src/data/mod.ts";
import type { Layer } from "../src/ir/types.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";

interface Element {
  f: unknown;
  args: [Record<string, unknown>];
}

/** The layer and panel content a <GGLayer> reports, as the root sees them. */
function parts(props: GGLayerProps): { layer: Layer; content: unknown } {
  const fragment = GGLayer(props) as unknown as { args: Element[] };
  const [layerEl, panelEl] = fragment.args;
  assertEquals(layerEl.f, GeomLayer);
  assertEquals(panelEl.f, GGPanel);
  return {
    layer: layerFromProps(layerEl.args[0] as never),
    content: panelEl.args[0].children,
  };
}

const PRIMITIVE = { marker: "custom" };

function assemble(custom: GGLayerProps) {
  const data = ingest({ x: [1, 2, 3], y: [1, 4, 2] });
  const base = plotSpec(data, { x: "x", y: "y" }, undefined, undefined, []);
  const { layer, content } = parts(custom);
  const layers = [
    layerFromProps(GeomPoint.layerProps({})),
    layer,
  ].map((l, i) => ({ kind: "layer" as const, id: i + 1, layer: l }));
  const caches = createRootCaches();
  const root = prepareRoot(
    base,
    layers,
    buildFacetPanels(base.facet, base.data, base.labels),
    caches,
  )!;
  const { tree } = layoutRoot(
    root,
    {
      width: 640,
      height: 400,
      measureText: approximateTextMeasurer,
    },
    caches,
    [content],
  );
  return { root, tree };
}

function texts(tree: RenderNode): string[] {
  const out: string[] = [];
  const walk = (node: RenderNode) => {
    const labels = node.props.labels ?? node.props.text;
    if (Array.isArray(labels)) out.push(...labels.map(String));
    else if (typeof labels === "string") out.push(labels);
    node.children.forEach(walk);
  };
  walk(tree);
  return out;
}

Deno.test("a custom layer's rows widen the trained position domains", () => {
  const { root } = assemble({
    data: { x: [0, 10], y: [-5, 20] },
    children: PRIMITIVE,
  });
  const [xLo, xHi] = root.trained.xDomain;
  const [yLo, yHi] = root.trained.yDomain;
  assert(xLo <= 0 && xHi >= 10, `x domain ${root.trained.xDomain}`);
  assert(yLo <= -5 && yHi >= 20, `y domain ${root.trained.yDomain}`);
});

Deno.test("a custom layer's aesthetic appears in the legend", () => {
  const { root, tree } = assemble({
    data: { x: [1, 3], y: [1, 2], temp: [12, 30] },
    mapping: { color: "temp" },
    children: PRIMITIVE,
  });
  assertEquals(root.trained.guideScales.color?.domain, [12, 30]);
  // A layer-level mapping's legend is titled by its aesthetic (as on the
  // compile path), keyed by the scale's range.
  const shown = texts(tree);
  for (const text of ["color", "12", "30"]) {
    assert(shown.includes(text), `the legend shows ${text}`);
  }
});

Deno.test("a custom layer draws its children in the panel", () => {
  const { tree } = assemble({ children: PRIMITIVE });
  const found: unknown[] = [];
  const walk = (node: RenderNode) => {
    if (node.component === "PanelContent") found.push(node.props.content);
    node.children.forEach(walk);
  };
  walk(tree);
  assertEquals(found, [[PRIMITIVE]]);
});

Deno.test("a custom layer with no children reports only its layer", () => {
  const fragment = GGLayer({ mapping: { x: "x" } }) as unknown as {
    args: (Element | null)[];
  };
  assertEquals(fragment.args[1], null);
});
