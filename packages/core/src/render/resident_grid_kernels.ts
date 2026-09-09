// <Kernel>-linkable forms of the passes SHARED by the resident count and
// histogram grids (gggplot-vs7.7 / vs7.8).
//
// Same dual-surface rule as render/resident_domain_kernel.ts: @gggplot/reductions
// owns the pass bodies and the hand-numbered preamble its standalone executor
// needs, and this module adds the `@link` preamble over the same body text.
//
// DECLARATION ORDER IS THE BINDING ORDER. <Kernel> builds its value list as
//   [dataSize, ...args, ...sources, source, ...targets, ...history]
// and pairs it positionally against the bundle's attributes, so every bundle
// declares getSize first, then its args, then its source, and its storage
// TARGET LAST. Getting this wrong does not fail loudly — it binds a buffer to a
// size lambda, or one accessor to another's value.
import { CLEAR_U32_BODY, GRID_SUMMARY_BODY } from "@gggplot/reductions";
import { wgsl } from "@use-gpu/shader/wgsl";

/**
 * Zeroes a u32 grid. Dispatched four times across the resident kernels — the
 * count grid and its summary, the histogram grid and its summary.
 *
 * No args and no source: the value list is [dataSize, target].
 */
export const CLEAR_U32_KERNEL = wgsl`
@link fn getSize() -> vec2<u32>;
@link var<storage, read_write> values: array<u32>;

${CLEAR_U32_BODY}
`;

/**
 * Per-group totals plus the position's stacked maximum.
 *
 * Two args, one source and one target, so the value list is
 * [dataSize, groups, position, counts, summary] — hence this declaration order.
 * The scalars that the standalone form reads out of its HistogramParams uniform
 * are `args` here, which means changing a position or group count updates a
 * uniform ref instead of rebuilding the pipeline.
 */
export const GRID_SUMMARY_KERNEL = wgsl`
@link fn getSize() -> vec2<u32>;
@link fn getGroups() -> u32;
@link fn getPosition() -> u32;
@link fn getCount(i: u32) -> u32;
@link var<storage, read_write> summary: array<atomic<u32>>;

${GRID_SUMMARY_BODY}
`;
