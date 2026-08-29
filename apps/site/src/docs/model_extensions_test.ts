import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { validateExtension } from "@gggplot/core/plan";
import {
  MODEL_EXTENSIONS,
  MODEL_GRAPH_EXTENSION,
  MODEL_SCENE_3D_EXTENSION,
  MODEL_TENSOR_INVENTORY_EXTENSION,
  MODEL_TENSOR_MATRIX_EXTENSION,
  modelTensorInventoryRows,
} from "@gggplot/model-inspect";
import { inspectOnnx } from "@gggplot/model-inspect";
import {
  createModelExtensionRegistry,
  renderableDefinition,
} from "../model_extension_registry.ts";

Deno.test("every model extension definition is valid on its own", () => {
  for (const definition of MODEL_EXTENSIONS) {
    assertEquals(validateExtension(definition), [], definition.id);
  }
});

Deno.test("the package declares cpu only, never rendering", () => {
  for (const definition of MODEL_EXTENSIONS) {
    const capabilities = definition.capabilities ?? [];
    assertEquals(capabilities.includes("live"), false, definition.id);
    assertEquals(capabilities.includes("emit"), false, definition.id);
  }
});

Deno.test("the host registry resolves live and emit adapters", () => {
  const registry = createModelExtensionRegistry();
  for (const definition of MODEL_EXTENSIONS) {
    assert(registry.has(definition.id), `missing ${definition.id}`);
    const live = registry.resolveLive(definition.id);
    assertEquals(typeof live.adapters.live.value, "function");
    const emit = registry.resolveEmit(definition.id);
    // Emitted source resolves a static import, never a serialized closure.
    assert(emit.adapters.emit.importFrom.endsWith(".ts"));
    assert(emit.adapters.emit.exportName.length > 0);
  }
});

Deno.test("registry rejects a version it does not have", () => {
  const registry = createModelExtensionRegistry();
  assertThrows(
    () => registry.resolve("@gggplot/model-inspect:model_graph@2"),
    Error,
    "Incompatible extension version",
  );
  assertThrows(
    () => registry.resolve("@gggplot/model-inspect:model_missing@1"),
    Error,
    "Missing extension",
  );
});

Deno.test("the manifest stays serializable", () => {
  const manifest = createModelExtensionRegistry().manifest();
  assertEquals(manifest.length, MODEL_EXTENSIONS.length);
  // A definition that cannot round-trip JSON cannot be persisted or emitted.
  assertEquals(
    JSON.parse(JSON.stringify(manifest)).length,
    MODEL_EXTENSIONS.length,
  );
});

Deno.test("republishing for render does not mutate the package definition", () => {
  const before = structuredClone(MODEL_GRAPH_EXTENSION);
  const renderable = renderableDefinition(MODEL_GRAPH_EXTENSION);
  assertEquals(MODEL_GRAPH_EXTENSION, before);
  assertEquals(renderable.capabilities?.includes("live"), true);
  assertEquals(validateExtension(renderable), []);
});

Deno.test("the specialized/ordinary split is what the taxonomy claims", () => {
  // Ordinary: a table of tensors, one row each.
  assertEquals(
    MODEL_TENSOR_INVENTORY_EXTENSION.outputFields?.every((field) =>
      field.shape === "row"
    ),
    true,
  );
  // Specialized: topology and grids have no tabular equivalent.
  assert(
    MODEL_GRAPH_EXTENSION.outputFields?.some((field) =>
      field.shape === "topology"
    ),
  );
  assert(
    MODEL_SCENE_3D_EXTENSION.outputFields?.some((field) =>
      field.shape === "topology"
    ),
  );
  assert(
    MODEL_TENSOR_MATRIX_EXTENSION.outputFields?.some((field) =>
      field.shape === "grid"
    ),
  );
});

Deno.test("the inventory adapter runs through the registry on a real model", async () => {
  const bytes = new Uint8Array(
    await Deno.readFile(
      new URL("../../public/models/mnist-12.onnx", import.meta.url),
    ),
  );
  const document = inspectOnnx(bytes, {
    source: {
      id: "test:mnist",
      format: "onnx",
      kind: "memory",
      byteLength: bytes.byteLength,
    },
  }).document;
  const registry = createModelExtensionRegistry();
  const cpu = registry.resolve(MODEL_TENSOR_INVENTORY_EXTENSION.id).adapters
    .cpu!;
  const rows = await cpu({ document, limit: 3 }) as {
    tensor: string;
    bytes: number;
  }[];
  assertEquals(rows.length, 3);
  assertEquals(rows, modelTensorInventoryRows(document, 3));
  for (let i = 1; i < rows.length; i++) {
    assert(rows[i - 1].bytes >= rows[i].bytes);
  }
});

Deno.test("a cpu adapter rejects a context without a document", () => {
  const registry = createModelExtensionRegistry();
  const cpu = registry.resolve(MODEL_GRAPH_EXTENSION.id).adapters.cpu!;
  assertThrows(() => cpu({}), TypeError, "require a { document }");
});
