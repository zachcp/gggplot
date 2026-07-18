import { assertEquals, assertThrows } from "@std/assert";
import {
  type ExtensionDefinition,
  ExtensionRegistry,
  type ProductPlan,
  validateExtension,
  validateParameters,
  validateProductPlan,
} from "../src/plan/mod.ts";
import {
  createStatBinProductPlan,
  createStatCountProductPlan,
} from "../src/stat/mod.ts";
import {
  createCountBarTopologyPlan,
  createHistogramBarTopologyPlan,
} from "../src/geom/bar.ts";

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

Deno.test("static extension registry resolves one definition for Live and emitted backends", () => {
  const definition: ExtensionDefinition = {
    id: "@gggplot/example:geom_cloud@1",
    kind: "geom",
    requiredAes: ["x", "y", "z"],
    missingValues: "drop",
    scope: "panel",
    capabilities: ["live", "emit"],
  };
  const liveValue = Symbol("PointCloud");
  const registry = new ExtensionRegistry().register(definition, {
    live: { value: liveValue },
    emit: { importFrom: "@gggplot/example", exportName: "PointCloud" },
  });

  const live = registry.resolveLive(definition.id);
  const emitted = registry.resolveEmit(definition.id);
  assertEquals(live.definition, emitted.definition);
  assertEquals(live.adapters.live.value, liveValue);
  assertEquals(emitted.adapters.emit, {
    importFrom: "@gggplot/example",
    exportName: "PointCloud",
  });
  assertEquals(JSON.parse(JSON.stringify(registry.manifest())), [definition]);
  definition.requiredAes?.push("color");
  assertEquals(registry.resolve(definition.id).definition.requiredAes, [
    "x",
    "y",
    "z",
  ]);
});

Deno.test("extension registry rejects duplicates, incompatible versions, and missing ids", () => {
  const definition: ExtensionDefinition = {
    id: "@gggplot/example:stat_cluster@1",
    kind: "stat",
    missingValues: "drop",
    scope: "panel",
    capabilities: ["cpu"],
  };
  const registry = new ExtensionRegistry().register(definition, {
    cpu: (input) => input,
  });
  assertThrows(
    () => registry.register(definition, { cpu: (input) => input }),
    Error,
    "Duplicate extension id",
  );
  assertThrows(
    () => registry.resolve("@gggplot/example:stat_cluster@2"),
    Error,
    "Incompatible extension version",
  );
  assertThrows(
    () => registry.resolve("@gggplot/example:stat_other@1"),
    Error,
    "Missing extension",
  );
});

Deno.test("extension registry enforces adapter metadata and JSON-only contracts", () => {
  const definition: ExtensionDefinition = {
    id: "@gggplot/example:geom_surface@1",
    kind: "geom",
    missingValues: "drop",
    scope: "panel",
    capabilities: ["live", "emit"],
  };
  assertThrows(
    () => new ExtensionRegistry().register(definition, { live: { value: {} } }),
    Error,
    "adapter mismatch",
  );
  assertThrows(
    () =>
      new ExtensionRegistry().register(definition, {
        live: { value: {} },
        emit: { importFrom: "", exportName: "Surface" },
      }),
    Error,
    "emit adapter requires importFrom and exportName",
  );
  assertThrows(
    () =>
      new ExtensionRegistry().register(
        {
          ...definition,
          parameters: {
            unsafe: {
              type: "string",
              default: (() => "not portable") as never,
            },
          },
        },
        {
          live: { value: {} },
          emit: { importFrom: "@gggplot/example", exportName: "Surface" },
        },
      ),
    Error,
    "non-JSON value function",
  );
  assertEquals(
    validateExtension({ ...definition, capabilities: ["live"] }),
    ["render extensions must declare both live and emit capabilities"],
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

Deno.test("stat_count and categorical bars share a resident grid contract", () => {
  const stat = createStatCountProductPlan({
    x: "category",
    group: "cohort",
    valuesCount: 8,
    groupsCount: 3,
  });
  assertEquals(stat.id, "@gggplot/core:stat_count@1");
  assertEquals(stat.outputs[0].dimensions, ["group", "category"]);
  assertEquals(validateProductPlan(stat), []);
  const geom = createCountBarTopologyPlan({ position: "dodge" });
  assertEquals(geom.inputs, [{ field: "count", access: "read" }]);
  assertEquals(geom.dependencies, [
    "@gggplot/core:stat_count@1",
    "position:dodge",
  ]);
  assertEquals(validateProductPlan(geom), []);
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
