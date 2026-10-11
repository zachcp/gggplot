// gggplot-7j9: <GGPanel> content is drawn in each panel's data coordinates,
// after the marks: inside every 2D panel view (faceted too) and inside the 3D
// scene's Cartesian.
import { assert, assertEquals } from "@std/assert";
import {
  createRootCaches,
  layoutRoot,
  plotSpec,
  prepareRoot,
} from "../src/components/root_assembly.ts";
import { layerFromProps } from "../src/components/geom_layer.ts";
import { GeomPoint } from "../src/components/geoms.ts";
import { FacetWrap } from "../src/components/plot_parts.ts";
import { buildFacetPanels, type RenderNode } from "../src/compile/mod.ts";
import type { SpecPart } from "../src/dsl/base.ts";
import { ingest } from "../src/data/mod.ts";
import type { Aes } from "../src/ir/types.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";

const CONTENT = { marker: "custom primitive" };

function laidOut(mapping: Aes, parts: SpecPart[] = []) {
  const data = ingest({
    x: [1, 2, 3, 4],
    y: [2, 4, 1, 3],
    z: [1, 2, 3, 4],
    g: ["a", "a", "b", "b"],
  });
  const base = plotSpec(data, mapping, undefined, undefined, parts);
  const layers = [{
    kind: "layer" as const,
    id: 1,
    layer: layerFromProps(GeomPoint.layerProps({})),
  }];
  const caches = createRootCaches();
  const root = prepareRoot(
    base,
    layers,
    buildFacetPanels(base.facet, base.data, base.labels),
    caches,
  )!;
  return layoutRoot(
    root,
    {
      width: 640,
      height: 400,
      measureText: approximateTextMeasurer,
    },
    caches,
    [CONTENT],
  ).tree;
}

/** Every view node (Cartesian/Polar) and its children's component names. */
function views(tree: RenderNode): string[][] {
  const out: string[][] = [];
  const walk = (node: RenderNode) => {
    if (node.component === "Cartesian" || node.component === "Polar") {
      out.push(node.children.map((child) => child.component));
    }
    node.children.forEach(walk);
  };
  walk(tree);
  return out;
}

function content(tree: RenderNode): unknown[] {
  const out: unknown[] = [];
  const walk = (node: RenderNode) => {
    if (node.component === "PanelContent") out.push(node.props.content);
    node.children.forEach(walk);
  };
  walk(tree);
  return out;
}

Deno.test("panel content draws in the panel view, after the marks", () => {
  const tree = laidOut({ x: "x", y: "y" });
  const [view] = views(tree);
  assertEquals(view.at(-1), "PanelContent");
  assert(view.indexOf("Point") < view.indexOf("PanelContent"));
  assertEquals(content(tree), [[CONTENT]]);
});

Deno.test("a faceted plot draws the content in every panel", () => {
  const tree = laidOut({ x: "x", y: "y" }, [FacetWrap.part({ vars: ["g"] })]);
  const panels = views(tree);
  assertEquals(panels.length, 2);
  for (const view of panels) assertEquals(view.at(-1), "PanelContent");
});

Deno.test("a 3D plot draws the content in the scene's data space", () => {
  const tree = laidOut({ x: "x", y: "y", z: "z" });
  assertEquals(tree.component, "Scene3D");
  assertEquals(content(tree), [[CONTENT]]);
  assertEquals(views(tree)[0].at(-1), "PanelContent");
});

Deno.test("without content the tree has no PanelContent", () => {
  const data = ingest({ x: [1, 2], y: [1, 2] });
  const base = plotSpec(data, { x: "x", y: "y" }, undefined, undefined, []);
  const layers = [{
    kind: "layer" as const,
    id: 1,
    layer: layerFromProps(GeomPoint.layerProps({})),
  }];
  const caches = createRootCaches();
  const root = prepareRoot(
    base,
    layers,
    buildFacetPanels(base.facet, base.data, base.labels),
    caches,
  )!;
  const { tree } = layoutRoot(root, {
    width: 640,
    height: 400,
    measureText: approximateTextMeasurer,
  }, caches);
  assertEquals(content(tree), []);
});
