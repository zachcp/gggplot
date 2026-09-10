import { assertEquals, assertThrows } from "@std/assert";
import {
  type ResidencyRecord,
  tensorRangeCacheKey,
  type TensorRangeRequest,
  tensorStorageCacheKey,
  transitionResidency,
  validateTensorRange,
} from "../src/mod.ts";

const request: TensorRangeRequest = {
  sourceId: "weights.safetensors",
  sourceVersion: "sha256:abc",
  byteOffset: 128,
  byteLength: 64,
  dtype: "f32",
  shape: [4, 4],
  strides: [4, 1],
};

Deno.test("range cache keys are stable and include source/layout identity", () => {
  const same = tensorRangeCacheKey({ ...request, shape: [4, 4] });
  assertEquals(same, tensorRangeCacheKey(request));
  assertEquals(
    same === tensorRangeCacheKey({ ...request, byteOffset: 192 }),
    false,
  );
  assertEquals(
    tensorStorageCacheKey({
      sourceId: "weights.safetensors",
      byteOffset: 128,
      byteLength: 64,
      dtype: "f32",
      shape: [4, 4],
      order: "row-major",
    }, "sha256:abc"),
    tensorStorageCacheKey({
      sourceId: "weights.safetensors",
      byteOffset: 128,
      byteLength: 64,
      dtype: "f32",
      shape: [4, 4],
      order: "row-major",
    }, "sha256:abc"),
  );
});

Deno.test("range validation catches out-of-bounds and malformed requests", () => {
  assertEquals(validateTensorRange(request, 256), []);
  assertEquals(
    validateTensorRange({ ...request, byteLength: 200 }, 256).includes(
      "requested range exceeds source length",
    ),
    true,
  );
  assertEquals(
    validateTensorRange({ ...request, strides: [-1] }, 256).includes(
      "strides must contain non-negative safe integers",
    ),
    true,
  );
});

Deno.test("eviction clears runtime resource identity", () => {
  const record: ResidencyRecord = {
    cacheKey: "tensor-range:test",
    sourceId: "source",
    sourceVersion: "v1",
    state: { kind: "range", rangeKey: "range", byteLength: 64 },
    // Narrowed from `unknown` by ADR 006. transitionResidency still only
    // DROPS the reference; releasing the buffer is evictResidency's job
    // (covered in gpu_loader_test.ts).
    resource: {
      buffer: {} as GPUBuffer,
      format: "f32",
      length: 16,
      size: [4, 4],
      version: 1,
    },
  };
  const evicted = transitionResidency(record, {
    kind: "evicted",
    reason: "budget",
  });
  assertEquals(evicted.resource, undefined);
  assertThrows(
    () =>
      transitionResidency(record, {
        kind: "product",
        productKey: "p",
        byteLength: -1,
      }),
    Error,
    "byteLength must be non-negative",
  );
});
