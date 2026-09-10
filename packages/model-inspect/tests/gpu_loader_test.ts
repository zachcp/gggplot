import { assert, assertEquals, assertThrows } from "@std/assert";
import {
  alignedUploadBytes,
  buildTensorContentProduct,
  ByteArrayGPUTensorSource,
  ByteArrayTensorSource,
  DEFAULT_CONTENT_BUDGET,
  evictResidency,
  isGPUTensorSource,
  type ModelDocument,
  type ResidencyRecord,
  residentUploadCeiling,
  TENSOR_UPLOAD_PLANS,
  tensorRangeCacheKey,
  type TensorRangeRequest,
  type TensorStorageSource,
  tensorUploadPlan,
} from "../src/mod.ts";

// Contract coverage for the GPU loader tier specified in
// docs/ADR_006_GPU_NATIVE_LOADERS.md (gggplot-vs7.3). Nothing here touches a
// real device: the point is that the CONTRACTS are implementable and that the
// f32 fast path is provably one payload copy, which is what gggplot-vs7.9 then
// builds against a real GPUDevice.

const ROWS = 4;
const COLUMNS = 4;
const CELLS = ROWS * COLUMNS;
const BYTES = CELLS * 4;

function payload(): Uint8Array {
  const values = new Float32Array(CELLS);
  for (let i = 0; i < CELLS; i++) values[i] = i + 0.5;
  return new Uint8Array(values.buffer);
}

function model(): ModelDocument {
  return {
    schema: "gggplot.model@1",
    id: "fixture",
    source: { id: "payload", format: "safetensors", kind: "memory" },
    graphs: [],
    tensors: {
      weights: {
        id: "weights",
        dtype: "f32",
        shape: [ROWS, COLUMNS],
        role: "parameter",
        byteLength: BYTES,
        payload: {
          sourceId: "payload",
          byteOffset: 0,
          byteLength: BYTES,
          encoding: "safetensors",
        },
        storage: {
          sourceId: "payload",
          byteOffset: 0,
          byteLength: BYTES,
          dtype: "f32",
          shape: [ROWS, COLUMNS],
          order: "row-major",
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// A device stand-in that counts payload copies. `writeBuffer` is the ONLY way
// bytes reach the GPU on the fast path, so counting its calls and its byte
// total is the whole measurement.
// ---------------------------------------------------------------------------

interface DeviceProbe {
  device: GPUDevice;
  writes: { bytes: number }[];
  created: { size: number; destroyed: boolean }[];
}

function probeDevice(
  maxStorageBufferBindingSize = 128 * 1024 * 1024,
): DeviceProbe {
  const writes: { bytes: number }[] = [];
  const created: { size: number; destroyed: boolean }[] = [];
  const device = {
    limits: { maxStorageBufferBindingSize },
    createBuffer(descriptor: { size: number }) {
      const record = { size: descriptor.size, destroyed: false };
      created.push(record);
      return {
        size: descriptor.size,
        destroy() {
          record.destroyed = true;
        },
      };
    },
    queue: {
      writeBuffer(
        _buffer: unknown,
        _offset: number,
        data: ArrayBuffer | ArrayBufferView,
        _dataOffset?: number,
        size?: number,
      ) {
        writes.push({ bytes: size ?? data.byteLength });
      },
    },
  } as unknown as GPUDevice;
  return { device, writes, created };
}

Deno.test("f32 trace: the CPU path materializes the payload twice inside the loader", async () => {
  const bytes = payload();
  const source = new ByteArrayTensorSource("payload", "v1", bytes);
  const product = await buildTensorContentProduct(model(), source, {
    target: { kind: "tensor", tensorId: "weights" },
    axes: [0, 1],
  });

  assertEquals(product.representation, "exact");
  // Copy 1: readRange's slice(). Copy 2: the element-by-element decode into a
  // boxed JS array. Both happen before the product leaves this package; the
  // site then makes copies 3 (cell objects) and 4 (typedArrayForColumn's
  // Float32Array) -- see the ADR's trace table for those two.
  assertEquals(product.values?.length, CELLS);
  assertEquals(product.values?.[0], 0.5);
  assertEquals(product.source, undefined);
});

Deno.test("f32 trace: the GPU path is one copy, and it is a writeBuffer", async () => {
  const bytes = payload();
  const probe = probeDevice();
  const source = new ByteArrayGPUTensorSource(
    probe.device,
    "payload",
    "v1",
    bytes,
  );

  assert(isGPUTensorSource(source));
  const request: TensorRangeRequest = {
    sourceId: "payload",
    sourceVersion: "v1",
    byteOffset: 0,
    byteLength: BYTES,
    dtype: "f32",
    shape: [ROWS, COLUMNS],
  };
  const resident = await source.readRangeSource(request);

  assertEquals(probe.writes.length, 1);
  assertEquals(probe.writes[0].bytes, BYTES);
  assertEquals(resident.format, "f32");
  assertEquals(resident.length, CELLS);
  assertEquals(resident.size, [ROWS, COLUMNS]);
  // No readback: DEFAULT_CONTENT_BUDGET.maxReadbackBytes already declares zero.
  assertEquals(DEFAULT_CONTENT_BUDGET.maxReadbackBytes, 0);
});

Deno.test("the GPU source keys on the same cache key as the byte range", async () => {
  const bytes = payload();
  const probe = probeDevice();
  const source = new ByteArrayGPUTensorSource(
    probe.device,
    "payload",
    "v1",
    bytes,
  );
  const request: TensorRangeRequest = {
    sourceId: "payload",
    sourceVersion: "v1",
    byteOffset: 0,
    byteLength: BYTES,
    dtype: "f32",
    shape: [ROWS, COLUMNS],
  };
  // The point of reusing tensorRangeCacheKey: the key exists BEFORE the upload,
  // so the residency state machine is unchanged by the GPU tier.
  const key = tensorRangeCacheKey(request);
  const record: ResidencyRecord = {
    cacheKey: key,
    sourceId: "payload",
    sourceVersion: "v1",
    state: { kind: "range", rangeKey: key, byteLength: BYTES },
    resource: await source.readRangeSource(request),
  };
  assertEquals(record.cacheKey, tensorRangeCacheKey(request));

  const evicted = evictResidency(record, "budget");
  assertEquals(evicted.state.kind, "evicted");
  assertEquals(evicted.resource, undefined);
  // Eviction now has teeth: the branch that used to drop an `unknown` reference
  // releases the allocation behind it.
  assertEquals(probe.created[0].destroyed, true);
});

Deno.test("a borrowed source is evicted without destroying a buffer it does not own", () => {
  const borrowed: TensorStorageSource = {
    buffer: {} as GPUBuffer,
    format: "f32",
    length: CELLS,
    size: [ROWS, COLUMNS],
    version: 1,
  };
  const record: ResidencyRecord = {
    cacheKey: "borrowed",
    sourceId: "runtime",
    sourceVersion: "v1",
    state: { kind: "range", rangeKey: "borrowed", byteLength: BYTES },
    resource: borrowed,
  };
  // No destroy hook, no throw: a runtime-shared tensor stays the runtime's.
  assertEquals(evictResidency(record, "source-changed").resource, undefined);
});

Deno.test("every ModelDType has an upload plan, and only the 64-bit rows are lossy", () => {
  assertEquals(tensorUploadPlan("f32").path, "direct");
  assertEquals(tensorUploadPlan("f32").kernel, undefined);
  assertEquals(tensorUploadPlan("bf16").path, "widen");
  assertEquals(tensorUploadPlan("bool").path, "unpack");
  assertEquals(tensorUploadPlan("i64").path, "narrow");
  // `string` is not a numeric buffer dtype, and neither is a format the IR has
  // not been taught; both answer "unsupported" rather than throwing, so the
  // caller falls back to the CPU values path exactly as it does today.
  assertEquals(tensorUploadPlan("string").path, "unsupported");
  assertEquals(tensorUploadPlan("fp8_e4m3").path, "unsupported");

  const lossy = Object.entries(TENSOR_UPLOAD_PLANS)
    .filter(([, plan]) => plan.lossy)
    .map(([dtype]) => dtype)
    .sort();
  assertEquals(lossy, ["f64", "i64", "u64"]);

  for (const [dtype, plan] of Object.entries(TENSOR_UPLOAD_PLANS)) {
    // A supported dtype always names a storage format, and only "direct" is
    // allowed to have no adapter kernel.
    assert(plan.format !== undefined, `${dtype} must declare a format`);
    assertEquals(
      plan.kernel === undefined,
      plan.path === "direct",
      `${dtype}: only the direct path may omit a kernel`,
    );
  }
});

Deno.test("upload sizes round up to the four-byte alignment WebGPU requires", () => {
  assertEquals(alignedUploadBytes(0), 0);
  assertEquals(alignedUploadBytes(1), 4);
  assertEquals(alignedUploadBytes(16), 16);
  // A bool tensor of 17 rows is 17 bytes; the pad sits past the last element
  // and no accessor reads it, because `length` bounds the dispatch.
  assertEquals(alignedUploadBytes(17), 20);
  assertThrows(() => alignedUploadBytes(-1), RangeError);
});

Deno.test("the resident ceiling is the tighter of the session budget and the device limit", () => {
  const small = probeDevice(1024).device;
  assertEquals(
    residentUploadCeiling(small, DEFAULT_CONTENT_BUDGET.maxResidentBytes),
    1024,
  );
  const large = probeDevice(1024 * 1024 * 1024).device;
  assertEquals(
    residentUploadCeiling(large, DEFAULT_CONTENT_BUDGET.maxResidentBytes),
    DEFAULT_CONTENT_BUDGET.maxResidentBytes,
  );
});
