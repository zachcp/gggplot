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
// DISPATCH AND READBACK MOVE TOGETHER. The kernel's commands are now recorded,
// not submitted, and handed to a sibling <Compute> as a `pre` call, so they join
// the frame's single submit. That alone would break every summary-reading view:
// useAwait fires during reconciliation, so readSummary's copyBufferToBuffer
// would be submitted BEFORE the compute that fills the buffer, and the view
// would read zeros (gggplot-vs7.1 attempt 2 — stackedMaximum 0 instead of 5000,
// y-range collapsing from 5000 to 1, bars overflowing the plot). So the product
// handed downward has its readSummary GATED: it waits until this version's
// commands have actually been submitted. Queue order does the rest, since the
// readback copy is then enqueued behind the compute on the same queue.

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
  Compute,
  createElement,
  Fragment,
  makeContext,
  provide,
  useContext,
  useOne,
  yeet,
} from "./usegpu_compat.ts";

/**
 * A one-shot barrier per kernel version.
 *
 * `wait()` resolves once `open()` has been called for that version, which the
 * compute leaf does immediately after submitting. A version that has already
 * been submitted resolves immediately, so a re-render does not stall.
 */
interface DispatchGate {
  wait(version: number): Promise<void>;
  open(version: number): void;
}

function createDispatchGate(): DispatchGate {
  let submitted = -1;
  let pending: {
    version: number;
    resolve: () => void;
    promise: Promise<void>;
  } = { version: -1, resolve: () => {}, promise: Promise.resolve() };
  const pendingFor = (version: number) => {
    if (pending.version !== version) {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      pending = { version, resolve, promise };
    }
    return pending;
  };
  return {
    wait(version) {
      if (submitted >= version) return Promise.resolve();
      return pendingFor(version).promise;
    },
    open(version) {
      submitted = version;
      pendingFor(version).resolve();
    },
  };
}

/** Records one kernel's work into the frame's compute pass. */
const ResidentCompute = (
  { encode, version, gate }: {
    encode: () => GPUCommandBuffer | null;
    version: number;
    gate: DispatchGate;
  },
): LiveElement => {
  // `pre` runs every frame the pass runs, so the version guard is what keeps a
  // steady-state plot from re-encoding.
  const state = useOne(() => ({ encoded: -1 }), encode);
  return yeet({
    pre: () => {
      if (state.encoded === version) return null;
      state.encoded = version;
      const command = encode();
      // Opened after the command buffer is handed back: ComputePass pushes it
      // into the same submit it is building, so anything awaiting this gate
      // enqueues its copy behind the compute.
      gate.open(version);
      return command;
    },
  });
};

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
    children: (
      built: { product: ResidentCountProduct; gate: DispatchGate },
    ) => LiveElement;
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
  const gate = useOne(() => createDispatchGate());
  return createElement(GPUDataProvider, {
    data: props.data,
    fields,
    children: (sources: Record<string, GPUStorageSource>) =>
      createElement(ResidentCountProvider, {
        x: sources[x],
        group: group ? sources[group] : undefined,
        options,
        // The frame owns submission now; see the module doc.
        defer: true,
        children: (product: ResidentCountProduct) =>
          children({ product, gate }),
      }),
  }) as LiveElement;
};

/**
 * Wraps a product so its readback waits for this version's dispatch.
 *
 * Everything else about the product is passed through untouched, so the mark
 * below cannot tell a hoisted product from an in-place one.
 */
function gateProduct(
  product: ResidentCountProduct,
  gate: DispatchGate,
): ResidentCountProduct {
  return {
    ...product,
    readSummary: async () => {
      await gate.wait(product.version);
      return product.readSummary();
    },
  };
}

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
  interface Built {
    id: number;
    product: ResidentCountProduct;
    gate: DispatchGate;
  }
  const bind = (index: number, built: Built[]): LiveElement => {
    if (index === nodes.length) {
      const products: ResidentProducts = new Map(
        built.map((
          entry,
        ) => [entry.id, gateProduct(entry.product, entry.gate)]),
      );
      return createElement(
        Fragment,
        {},
        // <Compute> gathers the recorded commands and runs them in the frame's
        // compute pass. It is a SIBLING of the plot, never an ancestor: its
        // Resume returns pass elements, which must not land in the layer tree.
        createElement(
          Compute,
          {},
          ...built.map((entry) =>
            createElement(ResidentCompute, {
              encode: entry.product.encode,
              version: entry.product.version,
              gate: entry.gate,
            })
          ),
        ),
        // Live contexts are supplied with provide(), not a .Provider element.
        provide(ResidentProductsContext, products, children),
      ) as LiveElement;
    }
    const node = nodes[index];
    return createElement(HoistedCount, {
      props: node.props,
      children: (
        { product, gate }: {
          product: ResidentCountProduct;
          gate: DispatchGate;
        },
      ) => bind(index + 1, [...built, { id: node.id, product, gate }]),
    }) as LiveElement;
  };
  return bind(0, []);
};
