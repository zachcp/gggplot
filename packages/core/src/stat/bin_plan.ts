import type { ProductPlan } from "../plan/mod.ts";

export interface StatBinPlanOptions {
  x: string;
  group?: string;
  bins: number;
  groupsCount: number;
}

/**
 * Declarative product for the first resident statistic. The `count` grid is
 * retained as GPU-native `[group, bin]` data; it is not expanded into rows.
 */
export function createStatBinProductPlan(
  options: StatBinPlanOptions,
): ProductPlan {
  const inputs = [{ field: options.x, access: "read" as const }];
  if (options.group) inputs.push({ field: options.group, access: "read" });
  return {
    id: "@gggplot/core:stat_bin@1",
    kind: "stat",
    executor: "auto",
    inputs,
    outputs: [
      {
        name: "count",
        dtype: "u32",
        shape: "grid",
        dimensions: ["group", "bin"],
        role: "output",
      },
      {
        name: "bin_center",
        dtype: "f32",
        shape: "row",
        dimensions: ["bin"],
        role: "output",
      },
    ],
    dependencies: [],
  };
}
