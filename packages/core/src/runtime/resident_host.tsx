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
// more: stat_count dispatches as real <Kernel>s inside the sibling <Compute>
// (resident_count_kernel_live.tsx), and stat_bin's grid still hands that
// <Compute> a recorded command buffer as a `pre` call. Either way the work joins
// the frame's single submit. That alone would break every summary-reading view:
// useAwait fires during reconciliation, so readSummary's copyBufferToBuffer
// would be submitted BEFORE the compute that fills the buffer, and the view
// would read zeros (gggplot-vs7.1 attempt 2 — stackedMaximum 0 instead of 5000,
// y-range collapsing from 5000 to 1, bars overflowing the plot). So the product
// handed downward has its readSummary GATED: it waits until this version's
// commands have actually been encoded. Queue order does the rest, since the
// readback copy is then enqueued behind the compute on the same queue.

import type { LiveElement } from "@use-gpu/live";
import type { CountPosition } from "@gggplot/reductions";
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
import { awaitGridSummary } from "./resident_grid_pending.ts";
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
  awaitDomain,
  DOMAIN_ACCUMULATOR_LENGTH,
  DomainKernels,
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
  useDeviceContext,
  useOne,
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
          children({
            product: gateGridSummary(product, gate),
            // Real <Kernel>s rather than a recorded command buffer: this node's
            // five passes are dispatched from the frame's compute pass by
            // Use.GPU's own linker and dispatch gating (gggplot-vs7.7). The
            // kernel object built by the provider above contributes only its
            // buffers now — with `defer` set nothing ever calls its encode(),
            // so its raw pipelines are never built.
            computes: [
              createElement(CountKernels, {
                product,
                values: sources[x],
                groups: group ? sources[group] : undefined,
                position: (options as { position?: CountPosition }).position ??
                  "stack",
                onEncoded: (encoded: number) => gate.open(encoded),
              }),
            ],
          }),
      }),
  }) as LiveElement;
};

/**
 * A grid product's readback wait, which needs more than the dispatch gate.
 *
 * The gate only says the frame's compute pass reached this node's leaf, and for
 * a <Kernel> that is not the same as the kernels having dispatched: their
 * pipelines compile asynchronously and contribute nothing until they finish, so
 * the pass can run with all five absent. Opening the gate then would hand the
 * view an untouched summary, whose stackedMaximum of 0 collapses the y-range to
 * 1 and overflows the bars out of the plot — the exact gggplot-vs7.1 attempt-2
 * failure, and one a pixel floor cannot see because coverage goes UP. So the
 * gate is only the first half; the second waits on the summary buffer's own
 * pending marker.
 */
function gateGridSummary<
  T extends {
    version: number;
    bins: number;
    groupsCount: number;
    rows: number;
    alive(): boolean;
    readSummary(): Promise<{ stackedMaximum: number }>;
  },
>(product: T, gate: DispatchGate): T {
  return {
    ...product,
    readSummary: async () => {
      await gate.wait(product.version);
      if (product.bins * product.groupsCount === 0) {
        // No passes are mounted for an empty grid, so no marker was ever armed
        // and there is nothing to wait for.
        return product.readSummary();
      }
      return awaitGridSummary(() => product.readSummary(), {
        expectNonEmpty: product.rows > 0,
        alive: () => product.alive(),
      });
    },
  };
}

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
  const device = useDeviceContext();
  const domainGate = useOne(() => createDispatchGate());
  const gridGate = useOne(() => createDispatchGate());
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
            device,
            target,
            xSource: sources[x],
            groupSource: group ? sources[group] : undefined,
            options,
            domainGate,
            gridGate,
            children,
          }),
      }),
  }) as LiveElement;
};

/** Resolves x bounds off the GPU, then mounts the bin grid sized to them. */
const AwaitHoistedBounds = (
  {
    device,
    target,
    xSource,
    groupSource,
    options,
    domainGate,
    gridGate,
    children,
  }: {
    device: GPUDevice;
    target: unknown;
    xSource: GPUStorageSource;
    groupSource?: GPUStorageSource;
    options: Record<string, unknown>;
    domainGate: DispatchGate;
    gridGate: DispatchGate;
    children: (result: HoistedResult) => LiveElement;
  },
): LiveElement => {
  const version = xSource.version;
  const domainCompute = createElement(DomainKernels, {
    target,
    source: xSource,
    rows: xSource.length,
    version,
    onEncoded: (encoded: number) => domainGate.open(encoded),
  });
  // Waits for this version's passes to be encoded before copying the
  // accumulator, so the copy is enqueued behind the compute on the same queue.
  const [bounds, error] = useAwait(async (cancelled: () => boolean) => {
    await domainGate.wait(version);
    // `cancelled` is Live's own liveness signal for this await: it flips on
    // unmount or a dependency change, which is exactly when the <ComputeBuffer>
    // above is destroyed out from under the poll. See awaitDomain.
    return awaitDomain(
      device,
      (target as { buffer: GPUBuffer }).buffer,
      () => !cancelled(),
    );
  }, [version]);
  if (error) throw error;
  // Contribute the domain kernels even while their bounds are still in flight —
  // they are what produce them, so withholding them would deadlock.
  if (!bounds || bounds.empty) {
    return children({ product: null, computes: [domainCompute] });
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
    children: (product: ResidentHistogramProduct) =>
      children({
        product: {
          ...gateGridSummary(product, gridGate),
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
          domainCompute,
          createElement(HistogramKernels, {
            product,
            values: xSource,
            groups: groupSource,
            position: (options as { position?: HistogramPosition }).position ??
              "stack",
            onEncoded: (encoded: number) => gridGate.open(encoded),
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
