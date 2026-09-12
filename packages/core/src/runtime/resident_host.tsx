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
import {
  type ResidentCountProduct,
  ResidentCountProvider,
} from "./resident_count_live.tsx";
import { CountKernels } from "./resident_count_kernel_live.tsx";
import {
  decideGridSummary,
  type GridSummary,
} from "./resident_grid_pending.ts";
import {
  createReadbackChannel,
  type ReadbackChannel,
  ResidentReadback,
} from "./resident_readback.tsx";
import {
  RESIDENT_ID_PROP,
  type ResidentProducts,
  ResidentProductsContext,
} from "./resident_products.ts";
import {
  HistogramKernels,
  type HistogramPosition,
} from "./resident_histogram_kernel_live.tsx";
import {
  DOMAIN_ACCUMULATOR_LENGTH,
  DomainKernels,
  DomainReadback,
} from "./resident_domain_kernel_live.tsx";
import {
  type ResidentHistogramProduct,
  ResidentHistogramProvider,
} from "./resident_live.tsx";
import { paletteToRgbaF32 } from "./resident_bar.tsx";
import type { GPUStorageSource } from "./types.ts";
import {
  Compute,
  ComputeBuffer,
  createElement,
  Fragment,
  provide,
  useAwait,
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

/** What {@link GridSummaryReadback} needs of a product to read its summary. */
interface SummarizedProduct {
  readonly summary: GPUStorageSource;
  readonly bins: number;
  readonly groupsCount: number;
  readonly rows: number;
  readonly version: number;
  alive(): boolean;
}

/**
 * Mounts the <Readback> that fills one grid product's summary channel.
 *
 * Nothing here waits on the compute having run — <Compute> sequences the copy
 * behind it. What it does wait on is the compute having FINISHED PRODUCING,
 * which is a different claim: a <Kernel> contributes no dispatch until its
 * pipeline compiles, and each of a chain's kernels compiles on its own promise,
 * so a pass can run with some of the chain absent and leave the summary buffer
 * untouched. Opening a view on that hands it an untouched summary, whose
 * stackedMaximum of 0 collapses the y-range to 1 and overflows the bars out of
 * the plot — the exact gggplot-vs7.1 attempt-2 failure, and one a pixel floor
 * cannot see because coverage goes UP. decideGridSummary is that predicate.
 */
const GridSummaryReadback = (
  { product, channel }: {
    product: SummarizedProduct;
    channel: ReadbackChannel<GridSummary>;
  },
): LiveElement => {
  const { groupsCount, bins, rows } = product;
  // A grid with no cells mounts no passes at all, so nothing ever arms its
  // pending marker and nothing can make its summary nonzero; a grid with no
  // rows can only ever summarize to zero. Either way zero is the answer rather
  // than something to wait for.
  const expectNonEmpty = rows > 0 && bins * groupsCount > 0;
  const decide = useMemo(
    () => (data: Uint32Array, exhausted: boolean) =>
      decideGridSummary(data, { groupsCount, expectNonEmpty }, exhausted),
    [groupsCount, expectNonEmpty],
  );
  const alive = useMemo(() => () => product.alive(), [product]);
  return createElement(ResidentReadback, {
    source: product.summary,
    version: product.version,
    channel,
    decide,
    alive,
    label: "resident grid summary",
  }) as LiveElement;
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

interface HoistedNode {
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
    children: (result: HoistedResult) => LiveElement;
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
  const summary = useOne(makeSummaryChannel);
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
        readSummary: summary.read,
        children: (product: ResidentCountProduct) =>
          children({
            product,
            // Real <Kernel>s rather than a recorded command buffer: this node's
            // five passes are dispatched from the frame's compute pass by
            // Use.GPU's own linker and dispatch gating (gggplot-vs7.7). The
            // kernel object built by the provider above contributes only its
            // buffers now — with `defer` set nothing ever calls its encode(),
            // so its raw pipelines are never built. The readback rides in the
            // same pass; it is declared after the kernels only for reading, as
            // ReadbackPass sequences it regardless of tree order.
            computes: [
              createElement(CountKernels, {
                product,
                values: sources[x],
                groups: group ? sources[group] : undefined,
                position: (options as { position?: CountPosition }).position ??
                  "stack",
              }),
              createElement(GridSummaryReadback, {
                product,
                channel: summary.channel,
              }),
            ],
          }),
      }),
  }) as LiveElement;
};

/**
 * Builds one stat_bin node's kernels and yields its product.
 *
 * Two kernels, not one, and the second depends on a readback from the first:
 * an auto-domain histogram must know its x bounds before it can size the bin
 * grid. So this contributes its domain kernels immediately and its bin kernel
 * only once bounds have resolved — which is why HoistedResult allows a null
 * product. The in-place path had exactly the same two stages; hoisting does not
 * add a round trip.
 *
 * The domain reduction runs as real <Kernel>s. Its accumulator is created here,
 * OUTSIDE <Compute>, because <ComputeBuffer> is a buffer rather than a pass and
 * the handle has to reach both the <Stage> inside the compute and the readback
 * out here.
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
  const options = paletteColors
    ? { ...base, palette: paletteToRgbaF32(paletteColors, opacity ?? 1) }
    : base;
  const fields = [
    { name: x, dtype: "f32", shape: "row", dimensions: ["row"] },
    ...(group
      ? [{ name: group, dtype: "u32", shape: "row", dimensions: ["row"] }]
      : []),
  ];
  const domain = useOne(() => createReadbackChannel<ResidentDomain1DResult>());
  const summary = useOne(makeSummaryChannel);
  return createElement(GPUDataProvider, {
    data: props.data,
    fields,
    children: (sources: Record<string, GPUStorageSource>) =>
      createElement(ComputeBuffer, {
        width: DOMAIN_ACCUMULATOR_LENGTH,
        height: 1,
        depth: 1,
        format: "atomic<u32>",
        label: "gggplot-domain",
        children: (target: unknown) =>
          createElement(AwaitHoistedBounds, {
            target,
            xSource: sources[x],
            groupSource: group ? sources[group] : undefined,
            options,
            domain,
            summary,
            children,
          }),
      }),
  }) as LiveElement;
};

/** Resolves x bounds off the GPU, then mounts the bin grid sized to them. */
const AwaitHoistedBounds = (
  {
    target,
    xSource,
    groupSource,
    options,
    domain,
    summary,
    children,
  }: {
    target: unknown;
    xSource: GPUStorageSource;
    groupSource?: GPUStorageSource;
    options: Record<string, unknown>;
    domain: ReadbackChannel<ResidentDomain1DResult>;
    summary: SummaryChannel;
    children: (result: HoistedResult) => LiveElement;
  },
): LiveElement => {
  const version = xSource.version;
  // The accumulator's own `version` counts <ComputeBuffer> history swaps and
  // never moves, so the readback is keyed on the COLUMN version instead — the
  // version of the data whose bounds are in there.
  const domainComputes = [
    createElement(DomainKernels, {
      target,
      source: xSource,
      rows: xSource.length,
      version,
    }),
    createElement(DomainReadback, {
      source: target as GPUStorageSource,
      version,
      rows: xSource.length,
      channel: domain,
      // Nothing to check: this leaf is mounted INSIDE the <ComputeBuffer> whose
      // accumulator it copies (the host's fold nests every node's <Compute>
      // within the nodes above it), so the buffer cannot outlive it and a
      // dispatch cannot outlive the buffer. The grid summaries are the ones
      // with a real answer here — their kernel object is disposed on an option
      // change, not only on unmount.
      alive: () => true,
    }),
  ];
  const [bounds, error] = useAwait(() => domain.read(version), [version]);
  if (error) throw error;
  // Contribute the domain kernels even while their bounds are still in flight —
  // they are what produce them, so withholding them would deadlock.
  if (!bounds || bounds.empty) {
    return children({ product: null, computes: domainComputes });
  }
  const resolved = {
    ...options,
    lo: bounds.min,
    hi: bounds.max,
    autoDomain: undefined,
  };
  return createElement(ResidentHistogramProvider, {
    x: xSource,
    group: groupSource,
    options: resolved,
    defer: true,
    readSummary: summary.read,
    children: (product: ResidentHistogramProduct) =>
      children({
        product: {
          ...product,
          // The view needs the bounds it was sized against to set its x range.
          hoistedBounds: bounds,
        },
        // Real <Kernel>s rather than a recorded command buffer: this node's
        // seven passes are dispatched from the frame's compute pass by
        // Use.GPU's own linker and dispatch gating (gggplot-vs7.8). The kernel
        // object built by the provider above contributes only its buffers now
        // — with `defer` set nothing ever calls its encode(), so its raw
        // pipelines are never built.
        computes: [
          ...domainComputes,
          createElement(HistogramKernels, {
            product,
            values: xSource,
            groups: groupSource,
            position: (options as { position?: HistogramPosition }).position ??
              "stack",
          }),
          createElement(GridSummaryReadback, {
            product,
            channel: summary.channel,
          }),
        ],
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
