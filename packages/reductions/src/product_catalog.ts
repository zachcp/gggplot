// The shared pass bodies as KernelSpecs, and the products built from them
// (gggplot-euh). A spec names exactly the accessors and storage its body
// already reads and writes; the preambles are generated (product_spec.ts).
import type { KernelSpec, ProductSpec } from "./product_spec.ts";
import {
  CLEAR_U32_BODY,
  COUNT_BAR_VERTICES_BODY,
  GRID_BAR_VERTEX_COLORS_BODY,
  GRID_SUMMARY_BODY,
  GROUPED_COUNT_1D_BODY,
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
