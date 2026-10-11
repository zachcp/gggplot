// stat_count as a ProductSpec product (gggplot-034): the count grid allocated
// and dispatched through the named-port adapter (runtime/product_kernels.ts)
// instead of the hand-wired CountKernels and the reductions kernel object.
//
// Yields the same ResidentGridProduct shape the count view and the inline
// bar mark already consume, plus the compute elements (passes and summary
// readback) for the frame's <Compute>.
import type { LiveElement } from "@use-gpu/live";
import {
  COUNT_GRID_PALETTE_PRODUCT,
  COUNT_GRID_PRODUCT,
  type CountPosition,
  gridPositionCode,
  type ResidentCountSummary,
} from "@gggplot/reductions";
import { ProductKernels, useProductAllocation } from "./product_kernels.ts";
import type { ResidentGridProduct } from "./resident_products.ts";
import type { GridSummary } from "./resident_grid_pending.ts";
import type { ReadbackChannel } from "./resident_readback.tsx";
import type { GPUStorageSource } from "./types.ts";
import {
  createElement,
  useMemo,
  useNoRawSource,
  useRawSource,
} from "./usegpu_compat.ts";

export interface CountProductOptions {
  valuesCount: number;
  groupsCount: number;
  position?: CountPosition;
  /** Per-group RGBA (length groupsCount * 4). Adds the bar-color pass. */
  palette?: Float32Array;
}

/**
 * Builds the count grid product for `x` (and optionally `group`) and returns
 * it with the elements to mount in the frame's <Compute>.
 */
export function useCountProduct(
  { x, group, options, summary }: {
    x: GPUStorageSource;
    group?: GPUStorageSource;
    options: CountProductOptions;
    summary: {
      channel: ReadbackChannel<GridSummary>;
      read: (version: number) => Promise<GridSummary>;
    };
  },
): { product: ResidentGridProduct; computes: LiveElement[] } {
  const spec = options.palette
    ? COUNT_GRID_PALETTE_PRODUCT
    : COUNT_GRID_PRODUCT;
  const symbols = useMemo(() => ({
    rows: x.length,
    bins: options.valuesCount,
    groups: options.groupsCount,
    hasGroups: group ? 1 : 0,
    position: gridPositionCode(options.position),
  }), [
    x.length,
    options.valuesCount,
    options.groupsCount,
    group ? 1 : 0,
    options.position,
  ]);
  const allocation = useProductAllocation<ResidentCountSummary>(spec, symbols);
  // The palette is an input port: uploaded once per palette identity.
  const palette = options.palette
    ? useRawSource(options.palette, "vec4<f32>")
    : (useNoRawSource(), undefined);
  const version = Math.max(x.version, group?.version ?? 0);
  const inputs = useMemo(() => ({
    valueIds: x,
    // With no group column the value column binds twice and hasGroups is 0,
    // as the standalone executor always did.
    groupIds: group ?? x,
    ...(palette ? { palette } : {}),
  }), [x, group, palette]);
  const product = useMemo((): ResidentGridProduct => {
    const { buffers } = allocation;
    return {
      counts: buffers.counts,
      barVertices: buffers.barVertices,
      tileVertices: buffers.barVertices,
      ...(buffers.barColors ? { barColors: buffers.barColors } : {}),
      ...(palette ? { palette } : {}),
      summary: buffers.summary,
      bins: symbols.bins,
      groupsCount: symbols.groups,
      rows: symbols.rows,
      alive: () => allocation.generation.alive(),
      readSummary: () => summary.read(version),
      version,
    };
  }, [allocation, palette, symbols, version, summary]);
  const computes = [
    createElement(ProductKernels, {
      allocation,
      inputs,
      symbols,
      version,
      summary: summary.channel as ReadbackChannel<unknown>,
      label: "resident count summary",
    }) as LiveElement,
  ];
  return { product, computes };
}
