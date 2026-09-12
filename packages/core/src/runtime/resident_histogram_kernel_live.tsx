/** @jsxRuntime classic */
/** @jsx createElement */
// The stat_bin grid as real Use.GPU <Kernel>s (gggplot-vs7.8).
//
// The largest of the three ports, and structurally the count port plus a tile
// pass: see resident_count_kernel_live.tsx for the pattern and
// render/resident_grid_kernels.ts for the two binding preambles each body
// compiles under. Three of these eight passes (the u32 clear, the summary and
// the palette expansion) are the SAME bundles the count grid drives.
//
// As there, no <ComputeBuffer> is needed — every buffer already belongs to the
// reductions kernel, so each <Stage> gets a StorageTarget built over one and
// only the pipelines and the dispatch are replaced.
//
// The Dawn auto-layout workaround the raw tile pass used to need is gone with
// this port, and could only ever have been needed there: the linker emits
// bindings from actual links, so a declared-but-unused one cannot exist in the
// linked form. The tile bundle declares no count accessor at all.

import type { LiveElement } from "@use-gpu/live";
import { gridPositionCode } from "@gggplot/reductions";
import {
  CLEAR_U32_KERNEL,
  GRID_BAR_VERTEX_COLORS_KERNEL,
  GRID_HEATMAP_COLORS_KERNEL,
  GRID_SUMMARY_KERNEL,
  GROUPED_HISTOGRAM_1D_KERNEL,
  HISTOGRAM_BAR_VERTICES_KERNEL,
  HISTOGRAM_TILE_VERTICES_KERNEL,
} from "../render/resident_grid_kernels.ts";
import {
  storageSource,
  type StorageTarget,
  storageTarget,
} from "./resident_grid_bindings.ts";
import { armGridSummary } from "./resident_grid_pending.ts";
import type { ResidentHistogramProduct } from "./resident_live.tsx";
import type { GPUStorageSource } from "./types.ts";
import {
  createElement,
  Fragment,
  Kernel,
  Stage,
  useDeviceContext,
  useMemo,
} from "./usegpu_compat.ts";

/** A histogram position, as the shader args spell it. */
export type HistogramPosition = "identity" | "stack" | "dodge" | "fill";

/**
 * Everything the eight passes bind, built once per buffer set.
 *
 * Identity-stable on purpose: <Kernel> memoizes its linked shader on
 * `[shader, targets, source, sources, size, ...]` BY IDENTITY, so a freshly
 * allocated sources array or size tuple per render would relink the bundle and
 * recompile the pipeline every frame. Keyed on the BUFFERS and the grid shape,
 * never on the data version — a version bump must re-dispatch, not rebuild.
 * Scalars are exempt: they go in `args`, which reach the shader as uniform refs
 * that <Kernel> re-reads on every dispatch.
 */
interface HistogramKernelBindings {
  rows: number;
  cells: number;
  bins: number;
  groupsCount: number;
  summaryLength: number;
  hasGroups: number;
  /** The bin grid as a plain u32 target (the clear writes non-atomically). */
  countsClear: StorageTarget;
  /** The same grid as the accumulation's atomic target. */
  countsAtomic: StorageTarget;
  /** The same grid read-only, for the summary pass. */
  countsSource: readonly GPUStorageSource[];
  summaryClear: StorageTarget;
  summaryAtomic: StorageTarget;
  barVertices: StorageTarget;
  tileVertices: StorageTarget;
  barColors?: StorageTarget;
  /** Per-cell heatmap colors; unconditional, unlike `barColors`. */
  heatmapColors: StorageTarget;
  /** [counts, summary] for the bar-vertex and heatmap-color passes. */
  gridSources: readonly GPUStorageSource[];
  /** The x column, then the group column (which falls back to x when absent). */
  binSources: readonly GPUStorageSource[];
  paletteSource?: readonly GPUStorageSource[];
  clearGridSize: readonly number[];
  clearSummarySize: readonly number[];
  rowsSize: readonly number[];
  binsSize: readonly number[];
  cellsSize: readonly number[];
}

export interface HistogramKernelsProps {
  /** The product whose buffers these passes fill. */
  product: ResidentHistogramProduct;
  /** The mounted f32 x column. */
  values: GPUStorageSource;
  /** The mounted group column; absent collapses the grid to one group. */
  groups?: GPUStorageSource;
  position: HistogramPosition;
}

/**
 * Mounts the bin grid's eight passes against the kernel's own buffers.
 *
 * ORDER IS THE SCHEDULE. ComputePass gathers every `compute` call below it and
 * runs them in TREE ORDER into one pass encoder, so declaration order here is
 * the dispatch order: clear the grid, accumulate it, clear the summary,
 * summarize, lay out the bars, lay out the tiles, shade the heatmap, expand
 * the per-group palette colours. `summarize` must stay strictly before the
 * bar-vertex pass — dodge layout reads each group's total through getSummary
 * to decide which groups are present, and reading a half-cleared summary
 * would slot the bars into the wrong sub-bands — and strictly before the
 * heatmap pass too, which reads the same summary's stacked-maximum slot as
 * its normalizer. Intra-pass read-after-write visibility is what makes one
 * encoder sufficient, and it is pinned by
 * packages/core/tests/usegpu_kernel_link_test.ts.
 *
 * `initial` + `version` is what makes each kernel dispatch ONCE PER VERSION
 * rather than on every frame the pass runs: <Kernel> routes them through
 * useInitialDispatch, whose guard re-arms only when `version` changes.
 */
export const HistogramKernels = (
  { product, values, groups, position }: HistogramKernelsProps,
): LiveElement => {
  const version = product.version;
  const device = useDeviceContext();
  const bindings = useMemo<HistogramKernelBindings>(() => {
    const bins = product.bins;
    const groupsCount = product.groupsCount;
    const cells = bins * groupsCount;
    const summaryLength = groupsCount + 1;
    const rows = values.length;
    const target = (
      source: GPUStorageSource,
      format: string,
      length: number,
    ): StorageTarget => storageTarget(source.buffer, format, length);
    const readOnly = (
      source: GPUStorageSource,
      format: string,
      length: number,
    ): GPUStorageSource => storageSource(source.buffer, format, length);
    const counts = readOnly(product.counts, "u32", cells);
    const summary = readOnly(product.summary, "u32", summaryLength);
    return {
      rows,
      cells,
      bins,
      groupsCount,
      summaryLength,
      hasGroups: groups ? 1 : 0,
      countsClear: target(product.counts, "u32", cells),
      countsAtomic: target(product.counts, "atomic<u32>", cells),
      countsSource: [counts],
      summaryClear: target(product.summary, "u32", summaryLength),
      summaryAtomic: target(product.summary, "atomic<u32>", summaryLength),
      barVertices: target(product.barVertices, "vec2<f32>", cells * 4),
      tileVertices: target(product.tileVertices, "vec2<f32>", cells * 4),
      barColors: product.barColors
        ? target(product.barColors, "vec4<f32>", cells * 4)
        : undefined,
      // Unconditional — the histogram grid always produces one, unlike
      // barColors which needs a palette.
      heatmapColors: target(product.heatmapColors!, "vec4<f32>", cells * 4),
      gridSources: [counts, summary],
      // The accumulation always binds two columns. With no group column the raw
      // executor binds x twice and zeroes hasGroups, so the shader reads the
      // second accessor and discards it; mirror that rather than branching the
      // bundle.
      binSources: [
        readOnly(values, "f32", rows),
        readOnly(groups ?? values, "u32", rows),
      ],
      paletteSource: product.palette
        ? [readOnly(product.palette, "vec4<f32>", groupsCount)]
        : undefined,
      clearGridSize: [cells, 1],
      clearSummarySize: [summaryLength, 1],
      rowsSize: [rows, 1],
      binsSize: [bins, 1],
      cellsSize: [cells, 1],
    };
  }, [
    product.counts.buffer,
    product.summary.buffer,
    product.barVertices.buffer,
    product.tileVertices.buffer,
    product.barColors?.buffer,
    product.heatmapColors?.buffer,
    product.palette?.buffer,
    values.buffer,
    values.length,
    groups?.buffer,
    product.bins,
    product.groupsCount,
  ]);

  // Re-armed per version, and inside a memo purely to run once per version
  // rather than on every render. It must precede this version's passes, which
  // it does: reconciliation runs before the frame's submit.
  useMemo(() => {
    if (bindings.cells === 0) return;
    armGridSummary(device, product.summary.buffer, bindings.groupsCount);
  }, [device, bindings, version]);

  const code = gridPositionCode(position);
  // `binGeometry` is always present for a stat_bin product; the fallback only
  // keeps a degenerate grid from producing NaN vertices.
  const lo = product.binGeometry?.lo ?? 0;
  const binwidth = product.binGeometry?.binwidth ?? 1;
  // An empty grid has nothing to clear, accumulate or lay out, and the raw
  // executor's own passes would all no-op on it (each body guards on
  // getSize().x). Skipping them keeps the two surfaces recording the same work.
  // The summary readback still resolves: an empty grid can only summarize to
  // zero, and decideGridSummary accepts zero immediately when no nonzero answer
  // is possible.
  const passes = bindings.cells === 0 ? [] : [
    createElement(
      Stage,
      { target: bindings.countsClear },
      createElement(Kernel, {
        shader: CLEAR_U32_KERNEL,
        size: bindings.clearGridSize,
        initial: true,
        version,
      }),
    ),
    createElement(
      Stage,
      { target: bindings.countsAtomic },
      createElement(Kernel, {
        shader: GROUPED_HISTOGRAM_1D_KERNEL,
        args: [
          bindings.bins,
          bindings.groupsCount,
          bindings.hasGroups,
          lo,
          binwidth,
        ],
        sources: bindings.binSources,
        size: bindings.rowsSize,
        initial: true,
        version,
      }),
    ),
    createElement(
      Stage,
      { target: bindings.summaryClear },
      createElement(Kernel, {
        shader: CLEAR_U32_KERNEL,
        size: bindings.clearSummarySize,
        initial: true,
        version,
      }),
    ),
    createElement(
      Stage,
      { target: bindings.summaryAtomic },
      createElement(Kernel, {
        shader: GRID_SUMMARY_KERNEL,
        args: [bindings.groupsCount, code],
        sources: bindings.countsSource,
        size: bindings.binsSize,
        initial: true,
        version,
      }),
    ),
    createElement(
      Stage,
      { target: bindings.barVertices },
      createElement(Kernel, {
        shader: HISTOGRAM_BAR_VERTICES_KERNEL,
        args: [bindings.bins, bindings.groupsCount, code, lo, binwidth],
        sources: bindings.gridSources,
        size: bindings.cellsSize,
        initial: true,
        version,
      }),
    ),
    createElement(
      Stage,
      { target: bindings.tileVertices },
      createElement(Kernel, {
        shader: HISTOGRAM_TILE_VERTICES_KERNEL,
        args: [bindings.bins, lo, binwidth],
        size: bindings.cellsSize,
        initial: true,
        version,
      }),
    ),
    createElement(
      Stage,
      { target: bindings.heatmapColors },
      createElement(Kernel, {
        shader: GRID_HEATMAP_COLORS_KERNEL,
        args: [bindings.groupsCount],
        sources: bindings.gridSources,
        size: bindings.cellsSize,
        initial: true,
        version,
      }),
    ),
    ...(bindings.barColors && bindings.paletteSource
      ? [createElement(
        Stage,
        { target: bindings.barColors },
        createElement(Kernel, {
          shader: GRID_BAR_VERTEX_COLORS_KERNEL,
          args: [bindings.bins],
          sources: bindings.paletteSource,
          size: bindings.cellsSize,
          initial: true,
          version,
        }),
      )]
      : []),
  ];

  return createElement(
    Fragment,
    {},
    ...passes,
  ) as LiveElement;
};
