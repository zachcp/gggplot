// A spec's layers assembled the way the component root assembles its parts
// (components/root_assembly.ts), for tests and the fixture drift gate
// (gggplot-vnh.12). compile() is retired; this is the path that ships.
import {
  assembleRoot,
  createRootCaches,
  prepareLayers,
  type ResidentReadbacks,
  type RootCaches,
} from "../../src/components/root_assembly.ts";
import {
  buildFacetPanels,
  type RenderNode,
  type RowRemoval,
  type TextMeasurer,
} from "../../src/compile/mod.ts";
import type { GGSpec } from "../../src/ir/types.ts";
import type { ProductPlan } from "../../src/runtime/product_host.tsx";
import { approximateTextMeasurer } from "../../src/render/font_resources.ts";

export const LAYOUT = {
  width: 640,
  height: 400,
  measureText: approximateTextMeasurer as TextMeasurer,
};

export interface AssembleOptions {
  layout?: { width: number; height: number; measureText: TextMeasurer };
  /**
   * Let eligible layers become GPU-resident products (ProductMark), as the
   * root does in a browser. Off by default: the CPU stat path, as compile()
   * had it.
   */
  resident?: boolean;
  /** Each summary-reporting product's read-back maximum, when resident. */
  stackedMaximum?: number;
  /** Caches shared across calls, to test what a re-assembly reuses. */
  caches?: RootCaches;
  /** Sees each layer's CPU lowering (RootCaches.observeLowering). */
  observeLowering?: RootCaches["observeLowering"];
  /**
   * Bind eligible point aesthetics on the GPU (BoundPoint), as the root does
   * in a browser. Off by default: the CPU-packed tensors, as compile() had.
   */
  bindScales?: boolean;
}

const layerParts = (spec: GGSpec) =>
  spec.layers.map((layer, index) => ({
    kind: "layer" as const,
    id: index + 1,
    layer,
  }));

const panelsOf = (spec: GGSpec) =>
  buildFacetPanels(spec.facet, spec.data, spec.labels);

const forPath = (spec: GGSpec, resident: boolean): GGSpec =>
  resident || spec.execution?.resident === false
    ? spec
    : { ...spec, execution: { ...spec.execution, resident: false } };

/** The options' caches (or fresh ones), with the options' switches applied. */
function cachesFor(options: AssembleOptions): RootCaches {
  const caches = options.caches ?? createRootCaches();
  caches.bindScales ??= options.bindScales ?? false;
  caches.observeLowering ??= options.observeLowering;
  return caches;
}

/** The products the root would host for `spec`, one per distinct key. */
export function residentPlansOf(spec: GGSpec): ProductPlan[] {
  return prepareLayers(
    spec,
    layerParts(spec),
    panelsOf(spec),
    createRootCaches(),
  )!.plans;
}

/** The root's laid-out tree for `spec`. */
export function assembleTree(
  spec: GGSpec,
  options: AssembleOptions = {},
): RenderNode {
  return assemble(spec, options).tree;
}

/** The root's laid-out tree for `spec`, and the rows its layers dropped. */
export function assemble(
  spec: GGSpec,
  options: AssembleOptions = {},
): { tree: RenderNode; diagnostics: readonly RowRemoval[] } {
  const resident = options.resident ?? false;
  const input = forPath(spec, resident);
  const readbacks: ResidentReadbacks = new Map(
    resident
      ? residentPlansOf(input).filter((plan) => plan.summary).map((
        plan,
      ) => [plan.key, {
        version: 1,
        value: {
          groupTotals: new Uint32Array(0),
          stackedMaximum: options.stackedMaximum ?? 4,
          byteLength: 0,
        },
      }])
      : [],
  );
  const assembled = assembleRoot(
    input,
    layerParts(input),
    panelsOf(input),
    options.layout ?? LAYOUT,
    cachesFor(options),
    readbacks,
  );
  if (!assembled) throw new Error("assemble: a layer is still pending");
  return { tree: assembled.tree, diagnostics: assembled.diagnostics };
}

/**
 * The root's tree for `spec` with its GPU-resident layers as products, each
 * summary answering `stackedMaximum` at version 1.
 */
export function residentTreeOf(
  spec: GGSpec,
  stackedMaximum = 4,
): RenderNode {
  return assembleTree(spec, { resident: true, stackedMaximum });
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

/** One layer's lowered mark, as the root keys it (layer-<id>-<panel>-<n>). */
export interface LayerMark {
  key: string;
  component: string;
  props: Record<string, unknown>;
}

/** Every lowered mark in the tree, in tree order. */
export function layerMarks(tree: RenderNode): LayerMark[] {
  const marks: LayerMark[] = [];
  const walk = (node: RenderNode) => {
    if (typeof node.key === "string" && /^layer-\d+-/.test(node.key)) {
      marks.push({
        key: node.key,
        component: node.component,
        props: node.props,
      });
    }
    node.children.forEach(walk);
  };
  walk(tree);
  return marks;
}
