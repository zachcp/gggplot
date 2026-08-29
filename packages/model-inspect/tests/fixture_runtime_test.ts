import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  FIXTURE_CAPABILITIES,
  type FixtureCapture,
  FixtureCaptureError,
  fixtureRuntimeAdapter,
} from "../src/fixture_runtime.ts";
import type { ModelDocument, RuntimeArtifact } from "../src/types.ts";
import type { RuntimeGpuTensorBinding } from "../src/runtime.ts";

const document: ModelDocument = {
  schema: "gggplot.model@1",
  id: "fixture-model",
  source: { id: "fixture-src", format: "onnx", kind: "memory" },
  graphs: [{
    id: "g0",
    inputs: [],
    outputs: [],
    nodes: [{
      id: "n0",
      kind: "operator",
      op: "MatMul",
      inputs: [],
      outputs: [],
    }],
    edges: [],
  }],
  tensors: {},
};

const artifact: RuntimeArtifact = {
  id: "act-0",
  kind: "activation",
  nodeId: "n0",
  tensorId: "t0",
  sourceId: "act-src",
};

const bytes = new Uint8Array(new Float32Array([1, 2, 3, 4]).buffer);
const capture: FixtureCapture = {
  artifact,
  bytes,
  dtype: "f32",
  shape: [2, 2],
};

const adapter = (captures: FixtureCapture[] = [capture]) =>
  fixtureRuntimeAdapter({ document, captures });

Deno.test("fixture adapter satisfies the runtime contract without a device", async () => {
  const runtime = adapter();
  assertEquals(runtime.name, "fixture");
  assertEquals(runtime.capabilities.gpuTensorInterop, "none");
  assertEquals((await runtime.inspect()).id, "fixture-model");
  assert(runtime.capture, "the fixture must exercise the capture half");
});

Deno.test("captured bytes arrive through a bounded TensorSource", async () => {
  const output = await adapter().capture!({ artifactId: "act-0" });
  assertEquals(output.artifact.id, "act-0");
  assertEquals(output.ownership, "visualizer-owned");
  const range = await output.source!.readRange({
    sourceId: "act-src",
    byteOffset: 0,
    byteLength: 8,
    dtype: "f32",
    shape: [2],
  });
  assertEquals(Array.from(new Float32Array(range)), [1, 2]);
});

Deno.test("a capture over budget fails rather than truncating", async () => {
  await assertRejects(
    () => adapter().capture!({ artifactId: "act-0", maxBytes: 8 }),
    FixtureCaptureError,
    "over the 8 byte budget",
  );
  // Exactly at the budget is allowed; the bound is inclusive.
  const ok = await adapter().capture!({ artifactId: "act-0", maxBytes: 16 });
  assertEquals(ok.artifact.id, "act-0");
});

Deno.test("a capture may not answer for a different node or tensor", async () => {
  await assertRejects(
    () => adapter().capture!({ artifactId: "act-0", nodeId: "n1" }),
    FixtureCaptureError,
    "does not belong to node n1",
  );
  await assertRejects(
    () => adapter().capture!({ artifactId: "act-0", tensorId: "t9" }),
    FixtureCaptureError,
    "does not belong to tensor t9",
  );
  await assertRejects(
    () => adapter().capture!({ artifactId: "missing" }),
    FixtureCaptureError,
    "no recorded capture",
  );
});

Deno.test("shared ownership is granted only when the runtime can back it", async () => {
  const deviceToken = {};
  const gpu: RuntimeGpuTensorBinding = {
    deviceToken,
    resource: {},
    sourceId: "act-src",
    byteOffset: 0,
    byteLength: bytes.byteLength,
    dtype: "f32",
    shape: [2, 2],
    usage: "read-only",
  };
  // Asking for sharing from a runtime that reports no interop must not grant
  // it, however well-formed the binding looks.
  const noInterop = await fixtureRuntimeAdapter({
    document,
    captures: [{ ...capture, gpu }],
  }).capture!({ artifactId: "act-0", ownership: "runtime-shared" });
  assertEquals(noInterop.ownership, "runtime-copy-on-demand");

  const sharing = fixtureRuntimeAdapter({
    document,
    captures: [{ ...capture, gpu }],
    capabilities: { gpuTensorInterop: "shared" },
  });
  assertEquals(
    (await sharing.capture!({
      artifactId: "act-0",
      ownership: "runtime-shared",
    }))
      .ownership,
    "runtime-shared",
  );
  // A writable tensor fails validation and falls back to a bounded copy.
  const writable = fixtureRuntimeAdapter({
    document,
    captures: [{ ...capture, gpu: { ...gpu, usage: "read-write" } }],
    capabilities: { gpuTensorInterop: "shared" },
  });
  assertEquals(
    (await writable.capture!({
      artifactId: "act-0",
      ownership: "runtime-shared",
    }))
      .ownership,
    "runtime-copy-on-demand",
  );
});

Deno.test("fixture capabilities stay the conservative default", () => {
  assertEquals(FIXTURE_CAPABILITIES.externalData, false);
  assertEquals(FIXTURE_CAPABILITIES.quantizedDtypes, []);
});
