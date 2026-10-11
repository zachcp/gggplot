// The shared pass bodies as KernelSpecs, and the products built from them
// (gggplot-euh). A spec names exactly the accessors and storage its body
// already reads and writes; the preambles are generated (product_spec.ts).
import type { KernelSpec, ProductSpec } from "./product_spec.ts";
import {
  CLEAR_U32_BODY,
  COUNT_BAR_VERTICES_BODY,
  DOMAIN_CLEAR_BODY,
  FINITE_DOMAIN_1D_BODY,
  GRID_BAR_VERTEX_COLORS_BODY,
  GRID_HEATMAP_COLORS_BODY,
  GRID_SUMMARY_BODY,
  GROUPED_COUNT_1D_BODY,
  GROUPED_HISTOGRAM_1D_BODY,
  HISTOGRAM_BAR_VERTICES_BODY,
  HISTOGRAM_TILE_VERTICES_BODY,
} from "./wgsl.ts";

/** Zeroes a u32 buffer. */
export const CLEAR_U32: KernelSpec = {
  id: "@gggplot/reductions:clear_u32@1",
  body: CLEAR_U32_BODY,
  args: [],
  reads: [],
  write: { name: "values", format: "u32" },
};

/** Accumulates a grouped categorical count grid. */
export const GROUPED_COUNT_1D: KernelSpec = {
  id: "@gggplot/reductions:grouped_count_1d@1",
  body: GROUPED_COUNT_1D_BODY,
  args: [
    { name: "values", format: "u32" },
    { name: "groups", format: "u32" },
    { name: "hasGroups", format: "u32" },
  ],
  reads: [
    { name: "valueId", format: "u32" },
    { name: "groupId", format: "u32" },
  ],
  write: { name: "counts", format: "u32", atomic: true },
};

/** Per-group totals plus the position's stacked maximum. */
export const GRID_SUMMARY: KernelSpec = {
  id: "@gggplot/reductions:grid_summary@1",
  body: GRID_SUMMARY_BODY,
  args: [
    { name: "groups", format: "u32" },
    { name: "position", format: "u32" },
  ],
  reads: [{ name: "count", format: "u32" }],
  write: { name: "summary", format: "u32", atomic: true },
};

/** Expands a count grid into four bar vertices per cell. */
export const COUNT_BAR_VERTICES: KernelSpec = {
  id: "@gggplot/reductions:count_bar_vertices@1",
  body: COUNT_BAR_VERTICES_BODY,
  args: [
    { name: "values", format: "u32" },
    { name: "groups", format: "u32" },
    { name: "position", format: "u32" },
  ],
  reads: [
    { name: "count", format: "u32" },
    { name: "summary", format: "u32" },
  ],
  write: { name: "vertices", format: "vec2<f32>" },
};

/** Expands a per-group palette into per-vertex bar colors. */
export const GRID_BAR_VERTEX_COLORS: KernelSpec = {
  id: "@gggplot/reductions:grid_bar_vertex_colors@1",
  body: GRID_BAR_VERTEX_COLORS_BODY,
  args: [{ name: "perGroup", format: "u32" }],
  reads: [{ name: "paletteColor", format: "vec4<f32>" }],
  write: { name: "colors", format: "vec4<f32>" },
};

const CELLS = { mul: ["bins", "groups"] } as const;

/**
 * stat_count as a product: a [group, category] count grid, its summary, and
 * bar vertices. Symbols: rows, bins (categories), groups, hasGroups (0/1),
 * position (gridPositionCode). With no group column, bind the value column to
 * `groupIds` too and set hasGroups 0, as the standalone executor always has.
 */
export const COUNT_GRID_PRODUCT: ProductSpec = {
  id: "@gggplot/reductions:count_grid@1",
  inputs: [
    { name: "valueIds", format: "u32", length: "rows" },
    { name: "groupIds", format: "u32", length: "rows" },
  ],
  buffers: [
    { name: "counts", format: "u32", length: CELLS },
    { name: "summary", format: "u32", length: { add: ["groups", 1] } },
    { name: "barVertices", format: "vec2<f32>", length: { mul: [CELLS, 4] } },
  ],
  passes: [
    { kernel: CLEAR_U32, write: "counts", size: CELLS },
    {
      kernel: GROUPED_COUNT_1D,
      reads: { valueId: "valueIds", groupId: "groupIds" },
      write: "counts",
      args: { values: "bins", groups: "groups", hasGroups: "hasGroups" },
      size: "rows",
    },
    {
      kernel: CLEAR_U32,
      write: "summary",
      size: { add: ["groups", 1] },
    },
    // The summary must precede the bar layout: dodge reads each group's total.
    {
      kernel: GRID_SUMMARY,
      reads: { count: "counts" },
      write: "summary",
      args: { groups: "groups", position: "position" },
      size: "bins",
    },
    {
      kernel: COUNT_BAR_VERTICES,
      reads: { count: "counts", summary: "summary" },
      write: "barVertices",
      args: { values: "bins", groups: "groups", position: "position" },
      size: CELLS,
    },
  ],
  summary: { port: "summary", decide: "gridSummary" },
};

/**
 * stat_count with per-group fill colors: the count grid plus a pass that
 * expands an RGBA palette input (one color per group) into per-vertex bar
 * colors.
 */
export const COUNT_GRID_PALETTE_PRODUCT: ProductSpec = {
  ...COUNT_GRID_PRODUCT,
  id: "@gggplot/reductions:count_grid_palette@1",
  inputs: [
    ...COUNT_GRID_PRODUCT.inputs,
    { name: "palette", format: "vec4<f32>", length: "groups" },
  ],
  buffers: [
    ...COUNT_GRID_PRODUCT.buffers,
    { name: "barColors", format: "vec4<f32>", length: { mul: [CELLS, 4] } },
  ],
  passes: [
    ...COUNT_GRID_PRODUCT.passes,
    {
      kernel: GRID_BAR_VERTEX_COLORS,
      reads: { paletteColor: "palette" },
      write: "barColors",
      args: { perGroup: "bins" },
      size: CELLS,
    },
  ],
};

/** Seeds the ordered-float [min, max] accumulator ([0xffffffff, 0]). */
export const DOMAIN_CLEAR: KernelSpec = {
  id: "@gggplot/reductions:domain_clear@1",
  body: DOMAIN_CLEAR_BODY,
  args: [],
  reads: [],
  write: { name: "domain", format: "u32", atomic: true },
};

/** Folds every finite value into the ordered-float [min, max] accumulator. */
export const FINITE_DOMAIN_1D: KernelSpec = {
  id: "@gggplot/reductions:finite_domain_1d@1",
  body: FINITE_DOMAIN_1D_BODY,
  args: [],
  reads: [{ name: "value", format: "f32" }],
  write: { name: "domain", format: "u32", atomic: true },
};

/** Accumulates a grouped 1D histogram grid. */
export const GROUPED_HISTOGRAM_1D: KernelSpec = {
  id: "@gggplot/reductions:grouped_histogram_1d@1",
  body: GROUPED_HISTOGRAM_1D_BODY,
  args: [
    { name: "bins", format: "u32" },
    { name: "groups", format: "u32" },
    { name: "hasGroups", format: "u32" },
    { name: "lo", format: "f32" },
    { name: "binwidth", format: "f32" },
  ],
  reads: [
    { name: "value", format: "f32" },
    { name: "groupId", format: "u32" },
  ],
  write: { name: "counts", format: "u32", atomic: true },
};

/** Expands a histogram grid into four bar vertices per cell. */
export const HISTOGRAM_BAR_VERTICES: KernelSpec = {
  id: "@gggplot/reductions:histogram_bar_vertices@1",
  body: HISTOGRAM_BAR_VERTICES_BODY,
  args: [
    { name: "bins", format: "u32" },
    { name: "groups", format: "u32" },
    { name: "position", format: "u32" },
    { name: "lo", format: "f32" },
    { name: "binwidth", format: "f32" },
  ],
  reads: [
    { name: "count", format: "u32" },
    { name: "summary", format: "u32" },
  ],
  write: { name: "vertices", format: "vec2<f32>" },
};

/** Lays out the dense [group, bin] tile grid. */
export const HISTOGRAM_TILE_VERTICES: KernelSpec = {
  id: "@gggplot/reductions:histogram_tile_vertices@1",
  body: HISTOGRAM_TILE_VERTICES_BODY,
  args: [
    { name: "bins", format: "u32" },
    { name: "lo", format: "f32" },
    { name: "binwidth", format: "f32" },
  ],
  reads: [],
  write: { name: "vertices", format: "vec2<f32>" },
};

/** Shades each cell by its own count. */
export const GRID_HEATMAP_COLORS: KernelSpec = {
  id: "@gggplot/reductions:grid_heatmap_colors@1",
  body: GRID_HEATMAP_COLORS_BODY,
  args: [{ name: "groups", format: "u32" }],
  reads: [
    { name: "count", format: "u32" },
    { name: "summary", format: "u32" },
  ],
  write: { name: "colors", format: "vec4<f32>" },
};

/**
 * The auto-domain stage: the finite [min, max] of an f32 column, as ordered
 * u32 words. Symbols: rows. Its summary is the domain itself, decided by
 * decideDomain (which withholds the cleared seed while a non-empty answer is
 * still possible: vs7 trap 2).
 */
export const DOMAIN_1D_PRODUCT: ProductSpec = {
  id: "@gggplot/reductions:domain_1d@1",
  inputs: [{ name: "values", format: "f32", length: "rows" }],
  buffers: [{ name: "domain", format: "u32", length: 2 }],
  passes: [
    { kernel: DOMAIN_CLEAR, write: "domain", size: 2 },
    {
      kernel: FINITE_DOMAIN_1D,
      reads: { value: "values" },
      write: "domain",
      size: "rows",
    },
  ],
  summary: { port: "domain", decide: "domain" },
};

/**
 * stat_bin as a product: a [group, bin] histogram grid, its summary, bar and
 * tile vertices, and per-cell heatmap colors. Symbols: rows, bins, groups,
 * hasGroups, position, lo, binwidth (resolveHistogram1dBins).
 */
export const HISTOGRAM_GRID_PRODUCT: ProductSpec = {
  id: "@gggplot/reductions:histogram_grid@1",
  inputs: [
    { name: "values", format: "f32", length: "rows" },
    { name: "groupIds", format: "u32", length: "rows" },
  ],
  buffers: [
    { name: "counts", format: "u32", length: CELLS },
    { name: "summary", format: "u32", length: { add: ["groups", 1] } },
    { name: "barVertices", format: "vec2<f32>", length: { mul: [CELLS, 4] } },
    { name: "tileVertices", format: "vec2<f32>", length: { mul: [CELLS, 4] } },
    {
      name: "heatmapColors",
      format: "vec4<f32>",
      length: { mul: [CELLS, 4] },
    },
  ],
  passes: [
    { kernel: CLEAR_U32, write: "counts", size: CELLS },
    {
      kernel: GROUPED_HISTOGRAM_1D,
      reads: { value: "values", groupId: "groupIds" },
      write: "counts",
      args: {
        bins: "bins",
        groups: "groups",
        hasGroups: "hasGroups",
        lo: "lo",
        binwidth: "binwidth",
      },
      size: "rows",
    },
    { kernel: CLEAR_U32, write: "summary", size: { add: ["groups", 1] } },
    {
      kernel: GRID_SUMMARY,
      reads: { count: "counts" },
      write: "summary",
      args: { groups: "groups", position: "position" },
      size: "bins",
    },
    {
      kernel: HISTOGRAM_BAR_VERTICES,
      reads: { count: "counts", summary: "summary" },
      write: "barVertices",
      args: {
        bins: "bins",
        groups: "groups",
        position: "position",
        lo: "lo",
        binwidth: "binwidth",
      },
      size: CELLS,
    },
    {
      kernel: HISTOGRAM_TILE_VERTICES,
      write: "tileVertices",
      args: { bins: "bins", lo: "lo", binwidth: "binwidth" },
      size: CELLS,
    },
    {
      kernel: GRID_HEATMAP_COLORS,
      reads: { count: "counts", summary: "summary" },
      write: "heatmapColors",
      args: { groups: "groups" },
      size: CELLS,
    },
  ],
  summary: { port: "summary", decide: "gridSummary" },
};

/** stat_bin with per-group fill colors (the palette bar-color pass). */
export const HISTOGRAM_GRID_PALETTE_PRODUCT: ProductSpec = {
  ...HISTOGRAM_GRID_PRODUCT,
  id: "@gggplot/reductions:histogram_grid_palette@1",
  inputs: [
    ...HISTOGRAM_GRID_PRODUCT.inputs,
    { name: "palette", format: "vec4<f32>", length: "groups" },
  ],
  buffers: [
    ...HISTOGRAM_GRID_PRODUCT.buffers,
    { name: "barColors", format: "vec4<f32>", length: { mul: [CELLS, 4] } },
  ],
  passes: [
    ...HISTOGRAM_GRID_PRODUCT.passes,
    {
      kernel: GRID_BAR_VERTEX_COLORS,
      reads: { paletteColor: "palette" },
      write: "barColors",
      args: { perGroup: "bins" },
      size: CELLS,
    },
  ],
};
