import type { ProductPlan } from "../plan/mod.ts";

export interface HistogramBarTopologyOptions {
  position: "identity" | "stack" | "dodge" | "fill";
}

/**
 * GPU-side grid-to-bar adapter. It consumes the resident stat_bin grid and
 * produces mark topology, never CPU row-shaped count data.
 */
export function createHistogramBarTopologyPlan(
  options: HistogramBarTopologyOptions = { position: "stack" },
): ProductPlan {
  return {
    id: "@gggplot/core:geom_histogram_grid@1",
    kind: "geom",
    executor: "gpu",
    inputs: [
      { field: "count", access: "read" },
      { field: "bin_center", access: "read" },
    ],
    outputs: [
      {
        name: "bar_positions",
        dtype: "f32",
        shape: "row",
        dimensions: ["group", "bin", "corner", "axis"],
        role: "output",
      },
      {
        name: "bar_faces",
        dtype: "u32",
        shape: "topology",
        dimensions: ["group", "bin", "triangle", "index"],
        role: "topology",
      },
    ],
    dependencies: ["@gggplot/core:stat_bin@1", `position:${options.position}`],
  };
}
