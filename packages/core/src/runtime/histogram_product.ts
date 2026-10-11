// stat_bin as ProductSpec products (gggplot-0rv): the auto-domain stage
// (DOMAIN_1D_PRODUCT) and, once its bounds have been read back, the histogram
// grid (HISTOGRAM_GRID_PRODUCT) sized to them. Both allocate and dispatch
// through the named-port adapter, replacing the hand-wired DomainKernels and
// HistogramKernels and the reductions kernel objects' buffers.
//
// Two stages because an auto-domain histogram must know its x bounds before
// it can size its bin grid. The domain kernels are contributed immediately
// (they produce the bounds; withholding them would deadlock) and the grid
// mounts only once decideDomain accepts a non-empty domain, which it withholds
// while the cleared seed could still be hiding a real one (vs7 trap 2).
import type { LiveElement } from "@use-gpu/live";
import {
  DOMAIN_1D_PRODUCT,
  gridPositionCode,
  HISTOGRAM_GRID_PALETTE_PRODUCT,
  HISTOGRAM_GRID_PRODUCT,
  type ResidentDomain1DResult,
  type ResidentHistogramSummary,
  resolveHistogram1dBins,
} from "@gggplot/reductions";
import { ProductKernels, useProductAllocation } from "./product_kernels.ts";
import { DOMAIN_FRAME_BUDGET } from "./resident_domain_kernel_live.tsx";
import type { GridSummary } from "./resident_grid_pending.ts";
import type { ResidentHistogramProduct } from "./resident_live.tsx";
import type { ReadbackChannel } from "./resident_readback.tsx";
import type { GPUStorageSource } from "./types.ts";
import { dispatchVersion, stamped } from "./generation_gate.ts";
import {
  createElement,
  useAwait,
  useMemo,
  useNoRawSource,
  useOne,
  useRawSource,
} from "./usegpu_compat.ts";

export interface HistogramProductOptions {
  bins?: number;
  binwidth?: number;
  position?: "identity" | "stack" | "dodge" | "fill";
  groupsCount?: number;
  /** Per-group RGBA (length groupsCount * 4). Adds the bar-color pass. */
  palette?: Float32Array;
}

/** What the node yields: a null product while the bounds are in flight. */
export interface HistogramProductResult {
  product: (ResidentHistogramProduct & { hoistedBounds: unknown }) | null;
  computes: LiveElement[];
}

interface Channels {
  domain: ReadbackChannel<ResidentDomain1DResult>;
  summary: {
    channel: ReadbackChannel<GridSummary>;
    read: (version: number) => Promise<GridSummary>;
  };
}

/** The domain stage; mounts the grid once its bounds resolve. */
export const HistogramProductNode = (
  { x, group, options, channels, children }: {
    x: GPUStorageSource;
    group?: GPUStorageSource;
    options: HistogramProductOptions;
    channels: Channels;
    children: (result: HistogramProductResult) => LiveElement;
  },
): LiveElement => {
  const version = x.version;
  const symbols = useMemo(() => ({ rows: x.length }), [x.length]);
  const domain = useProductAllocation<ResidentDomain1DResult>(
    DOMAIN_1D_PRODUCT,
    symbols,
  );
  const inputs = useMemo(() => ({ values: x }), [x]);
  const domainComputes = [
    createElement(ProductKernels, {
      allocation: domain,
      inputs,
      symbols,
      // Keyed on the COLUMN version: the answer in the accumulator belongs
      // to the version of the data reduced into it.
      version,
      summary: channels.domain as ReadbackChannel<unknown>,
      label: "resident domain",
      frames: DOMAIN_FRAME_BUDGET,
    }) as LiveElement,
  ];
  // Stamped with the version they describe: useAwait keeps the previous
  // bounds while the next are read back (gggplot-wkc).
  const [awaited, error] = useAwait(
    stamped(version, (v) => channels.domain.read(v)),
    [version],
  );
  if (error) throw error;
  const bounds = awaited?.value;
  if (!bounds || bounds.empty) {
    return children({ product: null, computes: domainComputes });
  }
  return createElement(HistogramGrid, {
    x,
    group,
    options,
    bounds,
    boundsCurrent: awaited.version === version,
    summary: channels.summary,
    domainComputes,
    children,
  }) as LiveElement;
};

/** The bin grid, sized to resolved bounds. */
const HistogramGrid = (
  {
    x,
    group,
    options,
    bounds,
    boundsCurrent,
    summary,
    domainComputes,
    children,
  }: {
    x: GPUStorageSource;
    group?: GPUStorageSource;
    options: HistogramProductOptions;
    bounds: ResidentDomain1DResult;
    /** Whether `bounds` describe the column's current version. */
    boundsCurrent: boolean;
    summary: Channels["summary"];
    domainComputes: LiveElement[];
    children: (result: HistogramProductResult) => LiveElement;
  },
): LiveElement => {
  const lo = bounds.min, hi = bounds.max;
  // Exactly the geometry the standalone executor packs, so both surfaces
  // size the grid identically; the view needs `binwidth` as derived here.
  const { bins, binwidth } = resolveHistogram1dBins({
    lo,
    hi,
    bins: options.bins,
    binwidth: options.binwidth,
  });
  const groups = Math.max(1, options.groupsCount ?? 1);
  const symbols = useMemo(() => ({
    rows: x.length,
    bins,
    groups,
    hasGroups: group ? 1 : 0,
    position: gridPositionCode(options.position),
    lo,
    binwidth,
  }), [x.length, bins, groups, group ? 1 : 0, options.position, lo, binwidth]);
  const spec = options.palette
    ? HISTOGRAM_GRID_PALETTE_PRODUCT
    : HISTOGRAM_GRID_PRODUCT;
  const allocation = useProductAllocation<ResidentHistogramSummary>(
    spec,
    symbols,
  );
  const palette = options.palette
    ? useRawSource(options.palette, "vec4<f32>")
    : (useNoRawSource(), undefined);
  // The grid dispatches a new data version only once that version's bounds
  // are in: until then it holds the version it last dispatched, so its
  // buffers keep a whole generation (data and sizing together) rather than
  // binning new rows into the previous bounds (gggplot-wkc).
  const held = useOne(() => ({ version: null as number | null }));
  const version = held.version = dispatchVersion(
    held.version,
    Math.max(x.version, group?.version ?? 0),
    boundsCurrent,
  );
  const inputs = useMemo(() => ({
    values: x,
    groupIds: group ?? x,
    ...(palette ? { palette } : {}),
  }), [x, group, palette]);
  const product = useMemo(() => {
    const { buffers } = allocation;
    return {
      counts: buffers.counts,
      barVertices: buffers.barVertices,
      tileVertices: buffers.tileVertices,
      heatmapColors: buffers.heatmapColors,
      ...(buffers.barColors ? { barColors: buffers.barColors } : {}),
      ...(palette ? { palette } : {}),
      summary: buffers.summary,
      bins,
      groupsCount: groups,
      rows: x.length,
      binGeometry: { lo, binwidth },
      alive: () => allocation.generation.alive(),
      readSummary: () => summary.read(version),
      version,
      // The view needs the bounds it was sized against to set its x range.
      hoistedBounds: bounds,
    };
  }, [allocation, palette, bins, groups, lo, binwidth, version, bounds]);
  return children({
    product,
    computes: [
      ...domainComputes,
      createElement(ProductKernels, {
        allocation,
        inputs,
        symbols,
        version,
        summary: summary.channel as ReadbackChannel<unknown>,
        label: "resident histogram summary",
      }) as LiveElement,
    ],
  });
};
