import { assertEquals, assertThrows } from "@std/assert";
import {
  assertValidModelDocument,
  type ModelDocument,
  validateModelDocument,
} from "../src/mod.ts";

const document: ModelDocument = {
  schema: "gggplot.model@1",
  id: "tiny-mlp",
  framework: { name: "fixture", dialect: "test" },
  source: { id: "tiny-mlp.onnx", kind: "memory", format: "onnx" },
  graphs: [{
    id: "main",
    inputs: [{ id: "input", dtype: "f32", shape: [1, 4] }],
    outputs: [{
      id: "output",
      tensorId: "output",
      dtype: "f32",
      shape: [1, 2],
    }],
    nodes: [{
      id: "linear",
      kind: "operator",
      op: "Gemm",
      inputs: [{ id: "input", dtype: "f32", shape: [1, 4] }],
      outputs: [{
        id: "output",
        tensorId: "output",
        dtype: "f32",
        shape: [1, 2],
      }],
      parameters: ["weights"],
    }],
    edges: [{
      id: "input-to-linear",
      from: "linear",
      to: "linear",
      valueId: "input",
    }],
  }],
  tensors: {
    weights: {
      id: "weights",
      dtype: "f32",
      shape: [2, 4],
      role: "parameter",
      payload: {
        sourceId: "tiny-mlp.onnx",
        byteOffset: 128,
        byteLength: 32,
        encoding: "onnx",
      },
      storage: {
        sourceId: "tiny-mlp.onnx",
        byteOffset: 128,
        byteLength: 32,
        dtype: "f32",
        shape: [2, 4],
        order: "row-major",
        physical: { bufferFormat: "f32", components: 1, conversion: "none" },
      },
      residency: {
        policy: "range",
        cacheKey: "weights:v1",
        upload: "on-demand",
        maxBytes: 4096,
        readback: "explicit",
      },
      summary: {
        count: 8,
        finiteCount: 8,
        min: -1,
        max: 1,
        mean: 0,
        sparsity: 0,
      },
    },
    output: {
      id: "output",
      dtype: "f32",
      shape: [1, 2],
      role: "output",
      residency: {
        policy: "metadata",
        cacheKey: "output:metadata",
        upload: "never",
        readback: "summary-only",
      },
    },
  },
};

Deno.test("validates a portable model document with residency metadata", () => {
  assertEquals(validateModelDocument(document), []);
  assertValidModelDocument(document);
});

Deno.test("rejects dangling graph parameter references and invalid storage", () => {
  const invalid = structuredClone(document);
  invalid.graphs[0].nodes[0].parameters = ["missing"];
  invalid.tensors.weights.storage!.order = "strided";
  invalid.tensors.weights.storage!.strides = undefined;
  const errors = validateModelDocument(invalid);
  assertEquals(
    errors.some((error) => error.includes("unknown tensor missing")),
    true,
  );
  assertEquals(
    errors.some((error) => error.includes("strides is required")),
    true,
  );
  assertThrows(
    () => assertValidModelDocument(invalid),
    Error,
    "Invalid model document",
  );
});

Deno.test("rejects metadata residency that requests an upload", () => {
  const invalid = structuredClone(document);
  invalid.tensors.output.residency!.upload = "once";
  assertEquals(
    validateModelDocument(invalid).some((error) =>
      error.includes("metadata policy")
    ),
    true,
  );
});
