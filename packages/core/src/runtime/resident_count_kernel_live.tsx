/** @jsxRuntime classic */
/** @jsx createElement */
// The stat_count grid as real Use.GPU <Kernel>s (gggplot-vs7.7).
//
// Same shape as resident_domain_kernel_live.tsx, and the same dual-surface
// rule: @gggplot/reductions owns the five pass bodies and keeps the raw
// pipelines its standalone executor needs for the headless CPU/GPU parity
// harness, while this module drives the identical bodies through Use.GPU's
// linker. See render/resident_grid_kernels.ts for the two preambles.
//
// LIGHTER THAN THE DOMAIN PORT. That one needed a <ComputeBuffer> because it
// had no buffer of its own; this kernel already allocates every buffer it
// writes, so the allocation stays in reductions and each <Stage> gets a
// StorageTarget hand-built from an existing GPUBuffer. Only the pipelines and
// the dispatch are replaced.

import type { LiveElement } from "@use-gpu/live";
import { type CountPosition, gridPositionCode } from "@gggplot/reductions";
import {
  storageSource,
  type StorageTarget,
  storageTarget,
} from "./resident_grid_bindings.ts";
import { armGridSummary } from "./resident_grid_pending.ts";
import {
  CLEAR_U32_KERNEL,
  COUNT_BAR_VERTICES_KERNEL,
  GRID_BAR_VERTEX_COLORS_KERNEL,
  GRID_SUMMARY_KERNEL,
  GROUPED_COUNT_1D_KERNEL,
} from "../render/resident_grid_kernels.ts";
import type { ResidentCountProduct } from "./resident_count_live.tsx";
import type { GPUStorageSource } from "./types.ts";
import {
  createElement,
  Fragment,
  Kernel,
  Stage,
  useDeviceContext,
  useMemo,
} from "./usegpu_compat.ts";

/**
 * Everything the six passes bind, built once per buffer set.
 *
 * Stability is not cosmetic here. <Kernel> memoizes its linked shader on
 * `[shader, targets, source, sources, size, ...]` BY IDENTITY, so a freshly
 * built sources array or size tuple on each render would relink the bundle and
 * recompile the pipeline every frame. The buffers only change when the provider
 * recreates the whole kernel, so this is keyed on them and the grid shape, and
 * deliberately NOT on the data version — a version bump must re-dispatch, not
 * rebuild. Scalars are exempt: they go in `args`, whose values reach the shader
 * as uniform refs that <Kernel> re-reads on every dispatch.
 */
interface CountKernelBindings {
  rows: number;
  cells: number;
  perGroup: number;
  groupsCount: number;
  summaryLength: number;
  hasGroups: number;
  /** The count grid, as a plain u32 target (the clear writes non-atomically). */
  countsClear: StorageTarget;
  /** The same grid as the accumulation's atomic target. */
  countsAtomic: StorageTarget;
  /** The same grid read-only, for the summary and bar-vertex passes. */
  countsSource: readonly GPUStorageSource[];
  summaryClear: StorageTarget;
  summaryAtomic: StorageTarget;
  barVertices: StorageTarget;
  barColors?: StorageTarget;
  /** [counts, summary] for the bar-vertex pass, in its declared order. */
  gridSources: readonly GPUStorageSource[];
  /** The x column, then the group column (which falls back to x when absent). */
  countSources: readonly GPUStorageSource[];
  paletteSource?: readonly GPUStorageSource[];
  clearGridSize: readonly number[];
  clearSummarySize: readonly number[];
  rowsSize: readonly number[];
  perGroupSize: readonly number[];
  cellsSize: readonly number[];
}

export interface CountKernelsProps {
  /** The product whose buffers these passes fill. */
  product: ResidentCountProduct;
  /** The mounted, integer-indexed x column. */
  values: GPUStorageSource;
  /** The mounted group column; absent collapses the grid to one group. */
  groups?: GPUStorageSource;
  position: CountPosition;
}

/**
 * Mounts the count grid's five passes against the kernel's own buffers.
 *
 * ORDER IS THE SCHEDULE. ComputePass gathers every `compute` call below it and
 * runs them in TREE ORDER into one pass encoder, so declaration order here is
 * the dispatch order: clear the grid, accumulate it, clear the summary,
 * summarize, then lay out the bars. `summarize` must stay strictly before the
 * bar-vertex pass — dodge layout reads each group's total through getSummary to
 * decide which groups are present, and reading a half-cleared summary would
 * slot the bars into the wrong sub-bands. Intra-pass read-after-write
 * visibility is what makes one encoder sufficient, and it is pinned by
 * packages/core/tests/usegpu_kernel_link_test.ts.
 *
 * `initial` + `version` is what makes each kernel dispatch ONCE PER VERSION
 * rather than on every frame the pass runs: <Kernel> routes them through
 * useInitialDispatch, whose guard re-arms only when `version` changes.
 */
export const CountKernels = (
  { product, values, groups, position }: CountKernelsProps,
): LiveElement => {
  const version = product.version;
  const device = useDeviceContext();
  const bindings = useMemo<CountKernelBindings>(() => {
    const perGroup = product.bins;
    const groupsCount = product.groupsCount;
    const cells = perGroup * groupsCount;
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
      perGroup,
      groupsCount,
      summaryLength,
      hasGroups: groups ? 1 : 0,
      countsClear: target(product.counts, "u32", cells),
      countsAtomic: target(product.counts, "atomic<u32>", cells),
      countsSource: [counts],
      summaryClear: target(product.summary, "u32", summaryLength),
      summaryAtomic: target(product.summary, "atomic<u32>", summaryLength),
      barVertices: target(product.barVertices, "vec2<f32>", cells * 4),
      barColors: product.barColors
        ? target(product.barColors, "vec4<f32>", cells * 4)
        : undefined,
      gridSources: [counts, summary],
      // The accumulation always binds two columns. With no group column the raw
      // executor binds x twice and zeroes hasGroups, so the shader reads the
      // second accessor and discards it; mirror that rather than branching the
      // bundle.
      countSources: [
        readOnly(values, "u32", rows),
        readOnly(groups ?? values, "u32", rows),
      ],
      paletteSource: product.palette
        ? [readOnly(product.palette, "vec4<f32>", groupsCount)]
        : undefined,
      clearGridSize: [cells, 1],
      clearSummarySize: [summaryLength, 1],
      rowsSize: [rows, 1],
      perGroupSize: [perGroup, 1],
      cellsSize: [cells, 1],
    };
  }, [
    product.counts.buffer,
    product.summary.buffer,
    product.barVertices.buffer,
    product.barColors?.buffer,
    product.palette?.buffer,
    values.buffer,
    values.length,
    groups?.buffer,
    product.bins,
    product.groupsCount,
  ]);

  // Re-armed per version, and inside a memo purely to run once per version
  // rather than on every render — the same shape resident_grid.tsx's provider
  // uses for its own dispatch. It must precede this version's passes, which it
  // does: reconciliation runs before the frame's submit.
  useMemo(() => {
    if (bindings.cells === 0) return;
    armGridSummary(device, product.summary.buffer, bindings.groupsCount);
  }, [device, bindings, version]);

  const code = gridPositionCode(position);
  // An empty grid has nothing to clear, accumulate or lay out, and the raw
  // executor records no commands at all for it. Every pass below would be a
  // no-op anyway (each body guards on getSize().x), but skipping them keeps the
  // two surfaces recording the same work. The summary readback still resolves:
  // an empty grid can only summarize to zero, and decideGridSummary accepts
  // zero immediately when no nonzero answer is possible.
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
        shader: GROUPED_COUNT_1D_KERNEL,
        args: [bindings.perGroup, bindings.groupsCount, bindings.hasGroups],
        sources: bindings.countSources,
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
        size: bindings.perGroupSize,
        initial: true,
        version,
      }),
    ),
    createElement(
      Stage,
      { target: bindings.barVertices },
      createElement(Kernel, {
        shader: COUNT_BAR_VERTICES_KERNEL,
        args: [bindings.perGroup, bindings.groupsCount, code],
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
          args: [bindings.perGroup],
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
