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
// DISPATCH AND READBACK MOVE TOGETHER. No hoisted node submits its own work any
// more: every resident pass dispatches as a real <Kernel> inside the sibling
// <Compute>, and every resident read comes back through a <Readback> mounted in
// that same <Compute> (gggplot-vs7.4). That pairing is the point. A readback
// driven from a view's useAwait fires during RECONCILIATION, so its
// copyBufferToBuffer was submitted BEFORE the compute that fills the buffer and
// the view read zeros (gggplot-vs7.1 attempt 2 — stackedMaximum 0 instead of
// 5000, y-range collapsing from 5000 to 1, bars overflowing the plot). That was
// patched here with a per-version dispatch gate; the gate is gone, because
// <Compute> mounts ReadbackPass AFTER ComputePass and the ordering is now
// structural rather than arranged. What each node still owns is the CHANNEL the
// readback publishes into — see runtime/resident_readback.tsx — because a
// <Readback>'s result is mounted in the queue tree, not in the plot subtree
// where the views that need it live.

import type { LiveElement } from "@use-gpu/live";
import type {
  CountPosition,
  ResidentDomain1DResult,
} from "@gggplot/reductions";
import type { RenderNode } from "../compile/rendertree.ts";
import {
  RESIDENT_STAT_BIN_PRODUCT,
  RESIDENT_STAT_BIN_TILES_PRODUCT,
  RESIDENT_STAT_COUNT_PRODUCT,
} from "../compile/resident.ts";
import { GPUDataProvider } from "./live.tsx";
import { type CountProductOptions, useCountProduct } from "./count_product.ts";
import type { GridSummary } from "./resident_grid_pending.ts";
import {
  createReadbackChannel,
  type ReadbackChannel,
} from "./resident_readback.tsx";
import {
  RESIDENT_ID_PROP,
  type ResidentProducts,
  ResidentProductsContext,
} from "./resident_products.ts";
import {
  HistogramProductNode,
  type HistogramProductOptions,
} from "./histogram_product.ts";
import { paletteToRgbaF32 } from "./resident_bar.tsx";
import type { GPUStorageSource } from "./types.ts";
import {
  Compute,
  createElement,
  Fragment,
  provide,
  useMemo,
  useOne,
} from "./usegpu_compat.ts";

/**
 * One node's summary channel, created once per hoisted node.
 *
 * `read` is held alongside it because it is a useResource dependency of the
 * product the provider builds: a fresh closure per render would rebuild the
 * product, and through it every memo keyed on the product, on every frame.
 */
interface SummaryChannel {
  channel: ReadbackChannel<GridSummary>;
  read: (version: number) => Promise<GridSummary>;
}

const makeSummaryChannel = (): SummaryChannel => {
  const channel = createReadbackChannel<GridSummary>();
  return { channel, read: (version: number) => channel.read(version) };
};

/**
 * What a hoisted node yields.
 *
 * `product` is null while the node is still resolving something it needs — the
 * stat_bin view has to read its x bounds off the GPU before it can size its bin
 * grid, so on the first frame it contributes only its domain kernel. Its marks
 * render nothing until the product arrives, which is the same behavior the
 * in-place path already had.
 */
export interface HoistedResult {
  product: unknown | null;
  /** Elements mounted inside the frame's <Compute>; already built by the node. */
  computes: LiveElement[];
}

export interface HoistedNode {
  id: number;
  props: Record<string, unknown>;
}

/**
 * Product ids whose construction is lifted above the plot.
 *
 * Deliberately a small allowlist rather than "everything resident": a product
 * is added here only once BOTH of its consumers — the standalone view and the
 * inline mark — can take a hoisted product, so the two halves of the migration
 * never disagree. Anything absent keeps building its own kernel in place.
 */
const HOISTED_PRODUCTS = new Set<string>([
  RESIDENT_STAT_COUNT_PRODUCT,
  RESIDENT_STAT_BIN_PRODUCT,
  // The dense tile strip runs the SAME stat_bin kernel and the same auto-domain
  // stage, differing only in which of its buffers the mark draws, so it hoists
  // through HoistedHistogram unchanged (gggplot-vs7.12).
  RESIDENT_STAT_BIN_TILES_PRODUCT,
]);

/** Identity tokens for the data frames products read, held weakly. */
const frameTokens = new WeakMap<object, number>();
let nextFrameToken = 1;

/**
 * What makes two hoisted nodes the same product: the kernel family (both
 * stat_bin forms run one kernel and differ only in the buffers their marks
 * draw), the data frame by identity, the columns, the kernel options and the
 * palette input. Everything else on a node (its mark color, `view`, axes,
 * theme) belongs to the consumer.
 */
function productKey(props: Record<string, unknown>): string {
  const data = props.data;
  let token = 0;
  if (data && typeof data === "object") {
    token = frameTokens.get(data) ?? 0;
    if (!token) frameTokens.set(data, token = nextFrameToken++);
  }
  const family = props.product === RESIDENT_STAT_COUNT_PRODUCT
    ? "count"
    : "bin";
  return JSON.stringify([
    family,
    token,
    props.x,
    props.group ?? null,
    props.options ?? null,
    props.paletteColors ?? null,
    props.opacity ?? null,
  ]);
}

/**
 * Stamps a `residentId` on every hoistable ResidentProduct node and returns
 * one hoisted node per distinct product alongside the rewritten tree.
 *
 * Fan-out (gggplot-280): consumers of the same product (productKey) share
 * one id, so the product is built and dispatched once however many marks
 * read it. The tree is copied, never mutated: the compiled tree is cached and
 * shared across re-renders.
 */
export function collectResidentNodes(
  tree: RenderNode,
): { tree: RenderNode; nodes: HoistedNode[] } {
  const nodes: HoistedNode[] = [];
  const ids = new Map<string, number>();
  const visit = (node: RenderNode): RenderNode => {
    // Both forms hoist. The `view` flag used to gate this, back when only the
    // view components could consume a hoisted product; now that grid.Mark can
    // too (gggplot-vs7.1), an inline mark is hoistable on the same terms and
    // the flag only selects which component renders the result.
    const hoistable = node.component === "ResidentProduct" &&
      HOISTED_PRODUCTS.has(node.props.product as string);
    const children = node.children.map(visit);
    if (!hoistable) {
      return children === node.children ? node : { ...node, children };
    }
    const key = productKey(node.props);
    let id = ids.get(key);
    if (id === undefined) {
      id = nodes.length;
      ids.set(key, id);
      nodes.push({ id, props: node.props });
    }
    return {
      ...node,
      props: { ...node.props, [RESIDENT_ID_PROP]: id },
      children,
    };
  };
  return { tree: visit(tree), nodes };
}

/**
 * Builds one stat_count node's product through the ProductSpec adapter
 * (gggplot-034) and yields it with the elements for the frame's <Compute>.
 */
const CountProductNode = (
  { x, group, options, summary, children }: {
    x: GPUStorageSource;
    group?: GPUStorageSource;
    options: CountProductOptions;
    summary: SummaryChannel;
    children: (result: HoistedResult) => LiveElement;
  },
): LiveElement => {
  const { product, computes } = useCountProduct({ x, group, options, summary });
  return children({ product, computes });
};

/** Builds one node's product and yields it. */
const HoistedCount = (
  { props, children }: {
    props: Record<string, unknown>;
    children: (result: HoistedResult) => LiveElement;
  },
): LiveElement => {
  const x = props.x as string;
  const group = props.group as string | undefined;
  const paletteColors = props.paletteColors as string[] | undefined;
  const opacity = props.opacity as number | undefined;
  const base = props.options as Record<string, unknown>;
  // Matches ResidentCountView's own palette handling. Memoized on the colors:
  // the palette is an input port uploaded per identity, so a fresh array each
  // render would re-upload it every frame.
  const palette = useMemo(
    () =>
      paletteColors ? paletteToRgbaF32(paletteColors, opacity ?? 1) : undefined,
    [paletteColors?.join(","), opacity],
  );
  const options = useMemo((): CountProductOptions => ({
    valuesCount: base.valuesCount as number,
    groupsCount: base.groupsCount as number,
    position: base.position as CountPosition | undefined,
    ...(palette ? { palette } : {}),
  }), [base.valuesCount, base.groupsCount, base.position, palette]);
  const fields = [
    { name: x, dtype: "u32", shape: "row", dimensions: ["row"] },
    ...(group
      ? [{ name: group, dtype: "u32", shape: "row", dimensions: ["row"] }]
      : []),
  ];
  const summary = useOne(makeSummaryChannel);
  return createElement(GPUDataProvider, {
    data: props.data,
    fields,
    children: (sources: Record<string, GPUStorageSource>) =>
      createElement(CountProductNode, {
        x: sources[x],
        group: group ? sources[group] : undefined,
        options,
        summary,
        children,
      }),
  }) as LiveElement;
};

/**
 * Builds one stat_bin node's products and yields them (gggplot-0rv): the
 * auto-domain stage first, then the bin grid sized to its bounds. See
 * runtime/histogram_product.ts for why it takes two stages and the readiness
 * rule between them.
 */
const HoistedHistogram = (
  { props, children }: {
    props: Record<string, unknown>;
    children: (result: HoistedResult) => LiveElement;
  },
): LiveElement => {
  const x = props.x as string;
  const group = props.group as string | undefined;
  const paletteColors = props.paletteColors as string[] | undefined;
  const opacity = props.opacity as number | undefined;
  const base = props.options as Record<string, unknown>;
  // Memoized on the colors: the palette is an input port uploaded per identity.
  const palette = useMemo(
    () =>
      paletteColors ? paletteToRgbaF32(paletteColors, opacity ?? 1) : undefined,
    [paletteColors?.join(","), opacity],
  );
  const options = useMemo((): HistogramProductOptions => ({
    bins: base.bins as number | undefined,
    binwidth: base.binwidth as number | undefined,
    position: base.position as HistogramProductOptions["position"],
    groupsCount: base.groupsCount as number | undefined,
    ...(palette ? { palette } : {}),
  }), [base.bins, base.binwidth, base.position, base.groupsCount, palette]);
  const fields = [
    { name: x, dtype: "f32", shape: "row", dimensions: ["row"] },
    ...(group
      ? [{ name: group, dtype: "u32", shape: "row", dimensions: ["row"] }]
      : []),
  ];
  const channels = useOne(() => ({
    domain: createReadbackChannel<ResidentDomain1DResult>(),
    summary: makeSummaryChannel(),
  }));
  return createElement(GPUDataProvider, {
    data: props.data,
    fields,
    children: (sources: Record<string, GPUStorageSource>) =>
      createElement(HistogramProductNode, {
        x: sources[x],
        group: group ? sources[group] : undefined,
        options,
        channels,
        children,
      }),
  }) as LiveElement;
};

/**
 * Mounts every hoisted node's kernel above `children` and provides the
 * resulting products by id.
 *
 * The nesting is a fold rather than a flat list because each provider hands its
 * product to a callback; the same shape GPUDataProvider already uses for its
 * per-field raw-source hooks.
 */
export const ResidentHost = (
  { nodes, children }: { nodes: HoistedNode[]; children: LiveElement },
): LiveElement => {
  if (!nodes.length) return children;
  interface Built {
    id: number;
    result: HoistedResult;
  }
  const bind = (index: number, built: Built[]): LiveElement => {
    if (index === nodes.length) {
      const products: ResidentProducts = new Map(
        built
          .filter((entry) => entry.result.product != null)
          .map((entry) => [entry.id, entry.result.product]),
      );
      const computes = built.flatMap((entry) => entry.result.computes);
      return createElement(
        Fragment,
        {},
        // <Compute> gathers the recorded commands and runs them in the frame's
        // compute pass. It is a SIBLING of the plot, never an ancestor: its
        // Resume returns pass elements, which must not land in the layer tree.
        createElement(
          Compute,
          {},
          ...computes,
        ),
        // Live contexts are supplied with provide(), not a .Provider element.
        provide(ResidentProductsContext, products, children),
      ) as LiveElement;
    }
    const node = nodes[index];
    // Both stat_bin products share HoistedHistogram: same kernel, same
    // auto-domain stage. Only stat_count has its own node.
    const Hoisted = node.props.product === RESIDENT_STAT_COUNT_PRODUCT
      ? HoistedCount
      : HoistedHistogram;
    return createElement(Hoisted, {
      props: node.props,
      children: (result: HoistedResult) =>
        bind(index + 1, [...built, { id: node.id, result }]),
    }) as LiveElement;
  };
  return bind(0, []);
};
