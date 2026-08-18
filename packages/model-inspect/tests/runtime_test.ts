import { assertEquals } from "@std/assert";
import {
  chooseTensorOwnership,
  ONNXRUNTIME_WEBGPU_CAPABILITIES,
  type RuntimeGpuTensorBinding,
  sharedTensorCompatibility,
  type SharedTensorRequirements,
  TRANSFORMERS_JS_WEBGPU_CAPABILITIES,
} from "../src/mod.ts";

const device = {};
const otherDevice = {};
const binding: RuntimeGpuTensorBinding = {
  deviceToken: device,
  resource: { kind: "runtime-buffer" },
  sourceId: "fixture-output",
  byteOffset: 0,
  byteLength: 32,
  dtype: "f32",
  shape: [2, 4],
  strides: [4, 1],
  usage: "read-only",
};
const requirements: SharedTensorRequirements = {
  deviceToken: device,
  sourceId: "fixture-output",
  byteOffset: 0,
  byteLength: 32,
  dtype: "f32",
  shape: [2, 4],
  strides: [4, 1],
};

Deno.test("runtime capability profiles distinguish high-level and low-level adapters", () => {
  assertEquals(TRANSFORMERS_JS_WEBGPU_CAPABILITIES.runtime, "transformers-js");
  assertEquals(TRANSFORMERS_JS_WEBGPU_CAPABILITIES.gpuTensorInterop, "copy");
  assertEquals(ONNXRUNTIME_WEBGPU_CAPABILITIES.runtime, "onnxruntime-web");
  assertEquals(ONNXRUNTIME_WEBGPU_CAPABILITIES.gpuTensorInterop, "shared");
});

Deno.test("shared GPU tensor compatibility requires matching device and layout", () => {
  assertEquals(sharedTensorCompatibility(binding, requirements), {
    compatible: true,
  });
  assertEquals(
    sharedTensorCompatibility(binding, {
      ...requirements,
      deviceToken: otherDevice,
    }),
    {
      compatible: false,
      reason: "runtime and visualizer use different devices",
    },
  );
  assertEquals(
    sharedTensorCompatibility(binding, { ...requirements, shape: [4, 2] }),
    { compatible: false, reason: "shape differs" },
  );
});

Deno.test("ownership policy defaults to visualizer storage and falls back to bounded copy", () => {
  assertEquals(
    chooseTensorOwnership(
      ONNXRUNTIME_WEBGPU_CAPABILITIES,
      binding,
      requirements,
    ),
    "visualizer-owned",
  );
  assertEquals(
    chooseTensorOwnership(
      ONNXRUNTIME_WEBGPU_CAPABILITIES,
      binding,
      requirements,
      "runtime-shared",
    ),
    "runtime-shared",
  );
  assertEquals(
    chooseTensorOwnership(
      TRANSFORMERS_JS_WEBGPU_CAPABILITIES,
      binding,
      requirements,
      "runtime-shared",
    ),
    "runtime-copy-on-demand",
  );
  assertEquals(
    chooseTensorOwnership(
      ONNXRUNTIME_WEBGPU_CAPABILITIES,
      undefined,
      requirements,
      "runtime-shared",
    ),
    "runtime-copy-on-demand",
  );
});
