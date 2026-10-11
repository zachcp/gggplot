// A spec's layers assembled the way the component root assembles its parts
// (gggplot-vnh.5.1): the GPU products it would host, and the tree it lays
// out once their summaries are in. Resident layers exist only on this path;
// compile() takes every stat on the CPU.
import {
  assembleRoot,
  createRootCaches,
  prepareLayers,
  type ResidentReadbacks,
} from "../../src/components/root_assembly.ts";
import { buildFacetPanels, type RenderNode } from "../../src/compile/mod.ts";
import type { GGSpec } from "../../src/ir/types.ts";
import type { ProductPlan } from "../../src/runtime/product_host.tsx";
import { approximateTextMeasurer } from "../../src/render/font_resources.ts";

const LAYOUT = {
  width: 640,
  height: 400,
  measureText: approximateTextMeasurer,
};

const layerParts = (spec: GGSpec) =>
  spec.layers.map((layer, index) => ({
    kind: "layer" as const,
    id: index + 1,
    layer,
  }));

const panelsOf = (spec: GGSpec) =>
  buildFacetPanels(spec.facet, spec.data, spec.labels);

/** The products the root would host for `spec`, one per distinct key. */
export function residentPlansOf(spec: GGSpec): ProductPlan[] {
  return prepareLayers(
    spec,
    layerParts(spec),
    panelsOf(spec),
    createRootCaches(),
  )!.plans;
}

/**
 * The root's tree for `spec`, with every product that reports a summary
 * answering `stackedMaximum` at version 1.
 */
export function residentTreeOf(
  spec: GGSpec,
  stackedMaximum = 4,
): RenderNode {
  const plans = residentPlansOf(spec);
  const readbacks: ResidentReadbacks = new Map(
    plans.filter((plan) => plan.summary).map((plan) => [plan.key, {
      version: 1,
      value: {
        groupTotals: new Uint32Array(0),
        stackedMaximum,
        byteLength: 0,
      },
    }]),
  );
  return assembleRoot(
    spec,
    layerParts(spec),
    panelsOf(spec),
    LAYOUT,
    createRootCaches(),
    readbacks,
  )!.tree;
}

export function findNodes(
  tree: RenderNode,
  component: string,
): RenderNode[] {
  return [
    ...(tree.component === component ? [tree] : []),
    ...tree.children.flatMap((child) => findNodes(child, component)),
  ];
}
