import { assertEquals } from "@std/assert";
import {
  dimensionFromOnnx,
  loadOnnxRuntimeWebModel,
  modelDTypeFromOnnxType,
  modelDocumentFromOnnxSession,
} from "../src/onnx.ts";
import { validateModelDocument } from "../src/validate.ts";

Deno.test("maps ONNX tensor types and symbolic dimensions", () => {
  assertEquals(modelDTypeFromOnnxType("tensor(float16)"), "f16");
  assertEquals(modelDTypeFromOnnxType("float32"), "f32");
  assertEquals(modelDTypeFromOnnxType("tensor(int64)"), "i64");
  assertEquals(dimensionFromOnnx("batch"), { symbol: "batch" });
  assertEquals(dimensionFromOnnx({ dimValue: 3 }), 3);
  assertEquals(dimensionFromOnnx(null), { unknown: true });
});

Deno.test("builds and validates a runtime I/O model document", () => {
  const document = modelDocumentFromOnnxSession(
    { id: "memory:model.onnx", format: "onnx", kind: "memory" },
    {
      inputNames: ["input_ids"],
      outputNames: ["logits"],
      inputMetadata: {
        input_ids: { type: "tensor(int64)", shape: ["batch", 4] },
      },
      outputMetadata: {
        logits: { type: "tensor(float)", shape: ["batch", 4, 8] },
      },
    },
  );

  assertEquals(validateModelDocument(document), []);
  assertEquals(document.graphs[0].metadata?.graphMetadata, "runtime-io");
  assertEquals(document.graphs[0].nodes.length, 3);
  assertEquals(document.graphs[0].edges.length, 2);
  assertEquals(document.tensors["input:input_ids"].shape, [
    { symbol: "batch" },
    4,
  ]);
  assertEquals(document.tensors["output:logits"].dtype, "f32");
});

Deno.test("loads through an injected session factory", async () => {
  let receivedModel: string | undefined;
  let receivedProviders: readonly string[] | undefined;
  const adapter = await loadOnnxRuntimeWebModel({
    source: { id: "url:model.onnx", format: "onnx", kind: "url" },
    model: "https://example.test/model.onnx",
    sessionFactory: {
      create: async (model, options) => {
        receivedModel = typeof model === "string" ? model : undefined;
        receivedProviders = options?.executionProviders;
        return { inputNames: [], outputNames: [] };
      },
    },
    sessionOptions: { executionProviders: ["webgpu"] },
  });

  assertEquals(receivedModel, "https://example.test/model.onnx");
  assertEquals(receivedProviders, ["webgpu"]);
  assertEquals(adapter.name, "onnxruntime-web");
  assertEquals((await adapter.inspect()).graphs[0].nodes.length, 1);
});
