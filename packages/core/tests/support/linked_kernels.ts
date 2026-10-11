// The linkable form of each catalog kernel, generated from its KernelSpec
// (gggplot-euh/0rv) exactly as <ProductKernels> links it. The hand-kept
// `@link` preambles these names used to refer to are gone; the link tests
// keep their names so their value lists read the same.
import { wgsl } from "@use-gpu/shader/wgsl";
import {
  CLEAR_U32,
  COUNT_BAR_VERTICES,
  DOMAIN_CLEAR,
  FINITE_DOMAIN_1D,
  GRID_BAR_VERTEX_COLORS,
  GRID_HEATMAP_COLORS,
  GRID_SUMMARY,
  GROUPED_COUNT_1D,
  GROUPED_HISTOGRAM_1D,
  HISTOGRAM_BAR_VERTICES,
  HISTOGRAM_TILE_VERTICES,
  type KernelSpec,
  linkSource,
} from "@gggplot/reductions";

const link = (kernel: KernelSpec): unknown => wgsl`${linkSource(kernel)}`;

export const CLEAR_U32_KERNEL: unknown = link(CLEAR_U32);
export const COUNT_BAR_VERTICES_KERNEL: unknown = link(COUNT_BAR_VERTICES);
export const DOMAIN_CLEAR_KERNEL: unknown = link(DOMAIN_CLEAR);
export const FINITE_DOMAIN_1D_KERNEL: unknown = link(FINITE_DOMAIN_1D);
export const GRID_BAR_VERTEX_COLORS_KERNEL: unknown = link(
  GRID_BAR_VERTEX_COLORS,
);
export const GRID_HEATMAP_COLORS_KERNEL: unknown = link(GRID_HEATMAP_COLORS);
export const GRID_SUMMARY_KERNEL: unknown = link(GRID_SUMMARY);
export const GROUPED_COUNT_1D_KERNEL: unknown = link(GROUPED_COUNT_1D);
export const GROUPED_HISTOGRAM_1D_KERNEL: unknown = link(GROUPED_HISTOGRAM_1D);
export const HISTOGRAM_BAR_VERTICES_KERNEL: unknown = link(
  HISTOGRAM_BAR_VERTICES,
);
export const HISTOGRAM_TILE_VERTICES_KERNEL: unknown = link(
  HISTOGRAM_TILE_VERTICES,
);
