/** @jsxRuntime classic */
/** @jsx createElement */
// Lifts GPU-resident kernel construction OUT of the plot subtree.
//
// WHY THIS EXISTS. A resident mark used to build its kernel where it renders,
// deep inside <Plot>. That is the one place a kernel cannot usefully live:
// <Plot> wraps its children in Workbench's VirtualLayers, whose multiGather (on
// the LayerReconciler) intercepts any yeet from below it, so a kernel down there
// can never hand work to a compute pass. Mounting <Compute> inside that subtree
// is not a workaround either — its Resume returns pass elements, which land in
// the layer tree and corrupt rendering. Both were tried; see gggplot-vs7.1.
//
// So construction moves ABOVE the compiled tree. The kernel and its buffers are
// built here, the resulting product is handed down by context, and the mark
// below only consumes it. That puts the kernel somewhere a sibling <Compute>
// can reach, which is the prerequisite for the <Kernel> port (gggplot-vs7.5).
//
// WHAT THIS STEP DELIBERATELY DOES NOT CHANGE: the kernel still dispatches from
// the provider, not from a compute pass. Moving the dispatch requires moving the
// summary readback in the same change — they are coupled, and splitting them
// yields a plot that renders and is silently wrong (gggplot-vs7.1 attempt 2:
// stackedMaximum reads 0 instead of 5000 and the y-range collapses). Because
// construction now happens above the tree, the provider still renders before
// the marks below it, so the existing dispatch-then-readback ordering is
// preserved exactly.

import type { LiveElement } from "@use-gpu/live";
import type { RenderNode } from "../compile/rendertree.ts";
import { RESIDENT_STAT_COUNT_PRODUCT } from "../compile/resident.ts";
import { GPUDataProvider } from "./live.tsx";
import {
  type ResidentCountProduct,
  ResidentCountProvider,
} from "./resident_count_live.tsx";
import { paletteToRgbaF32 } from "./resident_bar.tsx";
import type { GPUStorageSource } from "./types.ts";
import {
  createElement,
  makeContext,
  provide,
  useContext,
} from "./usegpu_compat.ts";

/** Products built above the plot, keyed by the id stamped on their node. */
export type ResidentProducts = ReadonlyMap<number, unknown>;

const EMPTY: ResidentProducts = new Map();

export const ResidentProductsContext = makeContext<ResidentProducts>(
  EMPTY,
  "ResidentProductsContext",
);

/** Reads the product built for this node, or null when it was not hoisted. */
export function useHoistedProduct<T>(residentId: unknown): T | null {
  const products = useContext<ResidentProducts>(ResidentProductsContext);
  if (typeof residentId !== "number") return null;
  return (products.get(residentId) as T) ?? null;
}

/** The prop name stamped onto a hoisted node so the mark can find its product. */
export const RESIDENT_ID_PROP = "residentId";

interface HoistedNode {
  id: number;
  props: Record<string, unknown>;
}

/**
 * Product ids whose construction is lifted above the plot.
 *
 * Deliberately a small allowlist rather than "everything resident": a product
 * is added here only once its mark can consume a hoisted product, so the two
 * halves of the migration never disagree. Anything absent keeps building its
 * own kernel in place, exactly as before.
 */
const HOISTED_PRODUCTS = new Set<string>([RESIDENT_STAT_COUNT_PRODUCT]);

/**
 * Stamps a `residentId` on every hoistable ResidentProduct node and returns
 * them alongside the rewritten tree. The tree is copied, never mutated: the
 * compiled tree is cached by the pack cache and shared across re-renders.
 */
export function collectResidentNodes(
  tree: RenderNode,
): { tree: RenderNode; nodes: HoistedNode[] } {
  const nodes: HoistedNode[] = [];
  const visit = (node: RenderNode): RenderNode => {
    const hoistable = node.component === "ResidentProduct" &&
      node.props.view === true &&
      HOISTED_PRODUCTS.has(node.props.product as string);
    const children = node.children.map(visit);
    if (!hoistable) {
      return children === node.children ? node : { ...node, children };
    }
    const id = nodes.length;
    nodes.push({ id, props: node.props });
    return {
      ...node,
      props: { ...node.props, [RESIDENT_ID_PROP]: id },
      children,
    };
  };
  return { tree: visit(tree), nodes };
}

/** Builds one node's kernel and yields its product. */
const HoistedCount = (
  { props, children }: {
    props: Record<string, unknown>;
    children: (product: unknown) => LiveElement;
  },
): LiveElement => {
  const x = props.x as string;
  const group = props.group as string | undefined;
  const paletteColors = props.paletteColors as string[] | undefined;
  const opacity = props.opacity as number | undefined;
  const base = props.options as Record<string, unknown>;
  // Matches ResidentCountView's own palette handling so the hoisted kernel is
  // built from identical options; a palette change re-keys the provider.
  const options = paletteColors
    ? { ...base, palette: paletteToRgbaF32(paletteColors, opacity ?? 1) }
    : base;
  const fields = [
    { name: x, dtype: "u32", shape: "row", dimensions: ["row"] },
    ...(group
      ? [{ name: group, dtype: "u32", shape: "row", dimensions: ["row"] }]
      : []),
  ];
  return createElement(GPUDataProvider, {
    data: props.data,
    fields,
    children: (sources: Record<string, GPUStorageSource>) =>
      createElement(ResidentCountProvider, {
        x: sources[x],
        group: group ? sources[group] : undefined,
        options,
        children: (product: ResidentCountProduct) => children(product),
      }),
  }) as LiveElement;
};

/**
 * Mounts every hoisted node's kernel above `children` and provides the
 * resulting products by id.
 *
 * The nesting is a fold rather than a flat list because each provider hands its
 * product to a callback; the same shape GPUDataProvider already uses for its
 * per-field RawData nodes.
 */
export const ResidentHost = (
  { nodes, children }: { nodes: HoistedNode[]; children: LiveElement },
): LiveElement => {
  if (!nodes.length) return children;
  const bind = (
    index: number,
    products: Map<number, unknown>,
  ): LiveElement => {
    if (index === nodes.length) {
      // Live contexts are supplied with provide(), not a .Provider element.
      return provide(
        ResidentProductsContext,
        products as ResidentProducts,
        children,
      );
    }
    const node = nodes[index];
    return createElement(HoistedCount, {
      props: node.props,
      children: (product: unknown) =>
        bind(index + 1, new Map(products).set(node.id, product)),
    }) as LiveElement;
  };
  return bind(0, new Map());
};
