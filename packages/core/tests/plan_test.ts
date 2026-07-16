import { assertEquals } from "@std/assert";
import {
  type ExtensionDefinition,
  type ProductPlan,
  validateExtension,
  validateParameters,
  validateProductPlan,
} from "../src/plan/mod.ts";
import { createStatBinProductPlan } from "../src/stat/mod.ts";
import { createHistogramBarTopologyPlan } from "../src/geom/bar_grid.ts";

Deno.test("portable extension definitions validate versioned metadata and mappings", () => {
  const definition: ExtensionDefinition = {
    id: "@gggplot/core:stat_bin@1",
    kind: "stat",
    requiredAes: ["x"],
    missingValues: "drop",
    scope: "panel",
    showLegend: "auto",
    outputFields: [{
      name: "count",
      dtype: "u32",
      shape: "grid",
      dimensions: ["group", "bin"],
    }],
    computedAes: { y: { kind: "afterStat", field: "count" } },
  };
  assertEquals(validateExtension(definition), []);
  assertEquals(validateExtension({ ...definition, id: "stat_bin" }), [
    "extension id must be versioned, for example @scope/pkg:stat_bin@1",
  ]);
  const parameterized: ExtensionDefinition = {
    ...definition,
    parameters: {
      bins: { type: "number", default: 30 },
      closed: { type: "enum", required: true, values: ["left", "right"] },
    },
  };
  assertEquals(validateParameters(parameterized, { closed: "left" }), []);
  assertEquals(
    validateParameters(parameterized, { closed: "middle", extra: true }),
    [
      "parameter closed must be one of its declared values",
      "unknown parameter: extra",
    ],
  );
});

Deno.test("product plans describe fields without runtime resources", () => {
  const plan: ProductPlan = {
    id: "histogram",
    kind: "stat",
    executor: "auto",
    inputs: [{ field: "x", access: "read" }],
    outputs: [{
      name: "count",
      dtype: "u32",
      shape: "grid",
      dimensions: ["group", "bin"],
    }],
  };
  assertEquals(validateProductPlan(plan), []);
  assertEquals(
    validateProductPlan({
      ...plan,
      outputs: [{ ...plan.outputs[0], dimensions: [] }],
    }),
    [
      "non-scalar field count requires dimensions",
    ],
  );
});

Deno.test("stat_bin declares a GPU-native grid rather than row-shaped output", () => {
  const plan = createStatBinProductPlan({
    x: "value",
    group: "class",
    bins: 30,
    groupsCount: 4,
  });
  assertEquals(plan.inputs, [
    { field: "value", access: "read" },
    { field: "class", access: "read" },
  ]);
  assertEquals(plan.outputs[0], {
    name: "count",
    dtype: "u32",
    shape: "grid",
    dimensions: ["group", "bin"],
    role: "output",
  });
  assertEquals(validateProductPlan(plan), []);
});

Deno.test("histogram bar topology consumes the resident grid without row materialization", () => {
  const plan = createHistogramBarTopologyPlan({ position: "stack" });
  assertEquals(plan.executor, "gpu");
  assertEquals(plan.inputs, [
    { field: "count", access: "read" },
    { field: "bin_center", access: "read" },
  ]);
  assertEquals(plan.outputs.map((field) => field.shape), ["row", "topology"]);
  assertEquals(validateProductPlan(plan), []);
});

Deno.test("histogram grid topology declares fill and dodge as GPU products", () => {
  for (const position of ["dodge", "fill"] as const) {
    const plan = createHistogramBarTopologyPlan({ position });
    assertEquals(plan.executor, "gpu");
    assertEquals(plan.outputs[0].dimensions, [
      "group",
      "bin",
      "corner",
      "axis",
    ]);
    assertEquals(plan.dependencies?.at(-1), `position:${position}`);
  }
});
