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
import {
  CLEAR_U32_BODY,
  COUNT_BAR_VERTICES_BODY,
  GRID_BAR_VERTEX_COLORS_BODY,
  GRID_SUMMARY_BODY,
  GROUPED_COUNT_1D_BODY,
  GROUPED_HISTOGRAM_1D_BODY,
  HISTOGRAM_BAR_VERTICES_BODY,
  HISTOGRAM_TILE_VERTICES_BODY,
} from "@gggplot/reductions";
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

/**
 * Expands a per-group palette into per-vertex bar colors (four vertices per
 * cell). Optional in both kernels — absent when a layer takes a scalar fill.
 *
 * One arg, one source and one target: [dataSize, perGroup, palette, colors].
 */
export const GRID_BAR_VERTEX_COLORS_KERNEL = wgsl`
@link fn getSize() -> vec2<u32>;
@link fn getPerGroup() -> u32;
@link fn getPaletteColor(i: u32) -> vec4<f32>;
@link var<storage, read_write> colors: array<vec4<f32>>;

${GRID_BAR_VERTEX_COLORS_BODY}
`;

/**
 * Accumulates a grouped categorical count grid.
 *
 * The first pass here with TWO inputs, which go in <Kernel>'s plural `sources`
 * slot: [dataSize, values, groups, hasGroups, valueIds, groupIds, counts].
 * `sources` are linked before a singular `source` and before targets, so the
 * two accessors are declared together, ahead of the atomic grid.
 */
export const GROUPED_COUNT_1D_KERNEL = wgsl`
@link fn getSize() -> vec2<u32>;
@link fn getValues() -> u32;
@link fn getGroups() -> u32;
@link fn getHasGroups() -> u32;
@link fn getValueId(i: u32) -> u32;
@link fn getGroupId(i: u32) -> u32;
@link var<storage, read_write> counts: array<atomic<u32>>;

${GROUPED_COUNT_1D_BODY}
`;

/**
 * Expands a count grid into bar quad vertices.
 *
 * Two sources and one target:
 * [dataSize, values, groups, position, counts, summary, vertices]. The summary
 * is an input here, not an output — the dodge layout needs each group's total
 * to know which groups are actually present, so the summary pass must be
 * dispatched before this one.
 */
export const COUNT_BAR_VERTICES_KERNEL = wgsl`
@link fn getSize() -> vec2<u32>;
@link fn getValues() -> u32;
@link fn getGroups() -> u32;
@link fn getPosition() -> u32;
@link fn getCount(i: u32) -> u32;
@link fn getSummary(i: u32) -> u32;
@link var<storage, read_write> vertices: array<vec2<f32>>;

${COUNT_BAR_VERTICES_BODY}
`;

/**
 * Accumulates the grouped 1-D bin grid.
 *
 * Five args, two sources, one target:
 * [dataSize, bins, groups, hasGroups, lo, binwidth, values, groupIds, counts].
 */
export const GROUPED_HISTOGRAM_1D_KERNEL = wgsl`
@link fn getSize() -> vec2<u32>;
@link fn getBins() -> u32;
@link fn getGroups() -> u32;
@link fn getHasGroups() -> u32;
@link fn getLo() -> f32;
@link fn getBinwidth() -> f32;
@link fn getValue(i: u32) -> f32;
@link fn getGroupId(i: u32) -> u32;
@link var<storage, read_write> counts: array<atomic<u32>>;

${GROUPED_HISTOGRAM_1D_BODY}
`;

/**
 * Expands the bin grid into bar quad vertices.
 *
 * [dataSize, bins, groups, position, lo, binwidth, counts, summary, vertices].
 * The summary is an input, so the summary pass must be dispatched first.
 */
export const HISTOGRAM_BAR_VERTICES_KERNEL = wgsl`
@link fn getSize() -> vec2<u32>;
@link fn getBins() -> u32;
@link fn getGroups() -> u32;
@link fn getPosition() -> u32;
@link fn getLo() -> f32;
@link fn getBinwidth() -> f32;
@link fn getCount(i: u32) -> u32;
@link fn getSummary(i: u32) -> u32;
@link var<storage, read_write> vertices: array<vec2<f32>>;

${HISTOGRAM_BAR_VERTICES_BODY}
`;

/**
 * The dense [group, bin] tile grid.
 *
 * Purely geometric, so it has no source at all: [dataSize, bins, lo, binwidth,
 * vertices]. Declaring no count accessor is what removes the need for the
 * Dawn auto-layout workaround the raw form carries — the linker emits bindings
 * only for actual links, so an unused one cannot exist here.
 */
export const HISTOGRAM_TILE_VERTICES_KERNEL = wgsl`
@link fn getSize() -> vec2<u32>;
@link fn getBins() -> u32;
@link fn getLo() -> f32;
@link fn getBinwidth() -> f32;
@link var<storage, read_write> vertices: array<vec2<f32>>;

${HISTOGRAM_TILE_VERTICES_BODY}
`;
