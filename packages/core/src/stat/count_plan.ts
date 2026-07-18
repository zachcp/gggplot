import type { ProductPlan } from "../plan/mod.ts";

export interface StatCountPlanOptions {
  x: string;
  group?: string;
  valuesCount: number;
  groupsCount: number;
}

/** Declares the resident [group, category] stat_count grid. */
export function createStatCountProductPlan(
  options: StatCountPlanOptions,
): ProductPlan {
  const inputs = [{ field: options.x, access: "read" as const }];
  if (options.group) inputs.push({ field: options.group, access: "read" });
  return {
    id: "@gggplot/core:stat_count@1",
    kind: "stat",
    executor: "auto",
    inputs,
    outputs: [{
      name: "count",
      dtype: "u32",
      shape: "grid",
      dimensions: ["group", "category"],
      role: "output",
    }],
    dependencies: [],
  };
}
