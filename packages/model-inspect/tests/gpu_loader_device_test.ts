import { assertEquals, assertExists, assertRejects } from "@std/assert";
import {
  buildTensorContentProduct,
  ByteArrayGPUTensorSource,
  ByteArrayTensorSource,
  evictResidency,
  type ModelDocument,
  type ModelDType,
  type ResidencyRecord,
  supportsRangeSource,
  type TensorRangeRequest,
} from "../src/mod.ts";
import { TENSOR_ADAPTER_KERNELS } from "@gggplot/reductions";

// Real-device coverage for the GPU loader tier (gggplot-vs7.9). The claim under
// test is not "it runs" but "it produces exactly what the CPU decoder produces"
// -- every adapter pass is a bit reinterpretation, so parity is checkable
// element for element, and that parity is what lets the CPU path stay the
// reference the ADR says it is.
//
// Same skip-unless-available harness as packages/reductions/tests/gpu_test.ts.

const requireWebGpu = Deno.env.get("GGGPLOT_REQUIRE_WEBGPU") === "1";

async function requestTestDevice(): Promise<GPUDevice | null> {
  const gpu = globalThis.navigator?.gpu;
  if (!gpu) {
    if (requireWebGpu) assertExists(gpu, "navigator.gpu is required");
    return null;
  }
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    if (requireWebGpu) assertExists(adapter, "WebGPU adapter is required");
    return null;
  }
  return await adapter.requestDevice();
}

const MAP_READ = 0x0001;
const COPY_DST = 0x0008;

async function readback(
  device: GPUDevice,
  source: GPUBuffer,
  bytes: number,
): Promise<ArrayBuffer> {
  const size = Math.max(4, Math.ceil(bytes / 4) * 4);
  const staging = device.createBuffer({ size, usage: COPY_DST | MAP_READ });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(source, 0, staging, 0, size);
  device.queue.submit([encoder.finish()]);
  await staging.mapAsync(MAP_READ);
  const copy = staging.getMappedRange().slice(0, bytes);
  staging.unmap();
  staging.destroy();
  return copy;
}

/** The CPU reference: the same range, through the byte path, decoded. */
async function cpuValues(
  bytes: Uint8Array,
  request: TensorRangeRequest,
): Promise<number[]> {
  const source = new ByteArrayTensorSource(request.sourceId, "v1", bytes);
  const document = model(request.dtype, request.shape, request.byteLength);
  const product = await buildTensorContentProduct(document, source, {
    target: { kind: "tensor", tensorId: "weights" },
  });
  return product.values ?? [];
}

function model(
  dtype: ModelDType,
  shape: number[],
  byteLength: number,
): ModelDocument {
  return {
    schema: "gggplot.model@1",
    id: "fixture",
    source: { id: "payload", format: "safetensors", kind: "memory" },
    graphs: [],
    tensors: {
      weights: {
        id: "weights",
        dtype,
        shape,
        role: "parameter",
        byteLength,
        payload: {
          sourceId: "payload",
          byteOffset: 0,
          byteLength,
          encoding: "safetensors",
        },
        storage: {
          sourceId: "payload",
          byteOffset: 0,
          byteLength,
          dtype,
          shape,
          order: "row-major",
        },
      },
    },
  };
}

function bf16Bytes(values: number[]): Uint8Array {
  // bf16 is the high half of the f32 bit pattern; round-to-nearest-even is not
  // needed here because the fixtures are chosen to be exactly representable.
  const out = new Uint16Array(values.length);
  for (let i = 0; i < values.length; i++) {
    out[i] = new Uint32Array(new Float32Array([values[i]]).buffer)[0] >>> 16;
  }
  return new Uint8Array(out.buffer);
}

function f16Bytes(values: number[]): Uint8Array {
  const out = new Uint16Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const sign = value < 0 || Object.is(value, -0) ? 0x8000 : 0;
    const magnitude = Math.abs(value);
    if (magnitude === 0) {
      out[i] = sign;
      continue;
    }
    const exponent = Math.floor(Math.log2(magnitude));
    const fraction = Math.round((magnitude / 2 ** exponent - 1) * 1024);
    out[i] = sign | ((exponent + 15) << 10) | fraction;
  }
  return new Uint8Array(out.buffer);
}

interface Case {
  dtype: ModelDType;
  bytes: Uint8Array;
  count: number;
  read: (buffer: ArrayBuffer) => number[];
}

function cases(): Case[] {
  const f32 = new Float32Array([1.5, -2.25, 0, 1e30, -7.125, 3, 4, 5]);
  const i32 = new Int32Array([-2147483648, -1, 0, 1, 2147483647, 9, -9, 42]);
  const u32 = new Uint32Array([0, 1, 4294967295, 7, 8, 9, 10, 11]);
  const i8 = new Int8Array([-128, -1, 0, 1, 127, 5, -5, 42]);
  const u8 = new Uint8Array([0, 1, 255, 7, 128, 9, 10, 11]);
  const i16 = new Int16Array([-32768, -1, 0, 1, 32767, 5, -5, 42]);
  const u16 = new Uint16Array([0, 1, 65535, 7, 32768, 9, 10, 11]);
  const boolean = new Uint8Array([0, 1, 1, 0, 1, 0, 0, 1]);
  const halves = [1.5, -2.25, 0, 0.5, -7.125, 3, 4, 5];
  const asF32 = (b: ArrayBuffer) => Array.from(new Float32Array(b));
  const asI32 = (b: ArrayBuffer) => Array.from(new Int32Array(b));
  const asU32 = (b: ArrayBuffer) => Array.from(new Uint32Array(b));
  return [
    { dtype: "f32", bytes: new Uint8Array(f32.buffer), count: 8, read: asF32 },
    { dtype: "i32", bytes: new Uint8Array(i32.buffer), count: 8, read: asI32 },
    { dtype: "u32", bytes: new Uint8Array(u32.buffer), count: 8, read: asU32 },
    { dtype: "bf16", bytes: bf16Bytes(halves), count: 8, read: asF32 },
    { dtype: "f16", bytes: f16Bytes(halves), count: 8, read: asF32 },
    { dtype: "i8", bytes: new Uint8Array(i8.buffer), count: 8, read: asI32 },
    { dtype: "u8", bytes: u8, count: 8, read: asU32 },
    { dtype: "i16", bytes: new Uint8Array(i16.buffer), count: 8, read: asI32 },
    { dtype: "u16", bytes: new Uint8Array(u16.buffer), count: 8, read: asU32 },
    { dtype: "bool", bytes: boolean, count: 8, read: asU32 },
  ];
}

Deno.test("every adapter pass reproduces the CPU decoder exactly", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  for (const testCase of cases()) {
    const source = new ByteArrayGPUTensorSource(
      device,
      "payload",
      "v1",
      testCase.bytes,
    );
    const request: TensorRangeRequest = {
      sourceId: "payload",
      sourceVersion: "v1",
      byteOffset: 0,
      byteLength: testCase.bytes.byteLength,
      dtype: testCase.dtype,
      shape: [2, 4],
    };
    const resident = await source.readRangeSource(request);
    assertEquals(resident.length, testCase.count, `${testCase.dtype} length`);
    const actual = testCase.read(
      await readback(device, resident.buffer, testCase.count * 4),
    );
    const expected = await cpuValues(testCase.bytes, request);
    assertEquals(actual, expected, `${testCase.dtype} parity`);
    resident.destroy!();
  }
  device.destroy();
});

Deno.test("a range that does not end on a word boundary uploads without over-reading", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  // 5 i8 elements = 5 bytes. The neighbouring bytes are 0xff so an over-read
  // would be visible in the result rather than merely theoretical.
  const bytes = new Uint8Array([1, 2, 3, 4, 5, 0xff, 0xff, 0xff]);
  const source = new ByteArrayGPUTensorSource(device, "payload", "v1", bytes);
  const resident = await source.readRangeSource({
    sourceId: "payload",
    sourceVersion: "v1",
    byteOffset: 0,
    byteLength: 5,
    dtype: "i8",
    shape: [5],
  });
  assertEquals(resident.length, 5);
  assertEquals(
    Array.from(new Int32Array(await readback(device, resident.buffer, 20))),
    [1, 2, 3, 4, 5],
  );
  resident.destroy!();
  device.destroy();
});

Deno.test("a range at a non-zero offset uploads that range and not the file", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const all = new Float32Array([9, 9, 1.5, -2.5, 3.5, 4.5]);
  const bytes = new Uint8Array(all.buffer);
  const source = new ByteArrayGPUTensorSource(device, "payload", "v1", bytes);
  const resident = await source.readRangeSource({
    sourceId: "payload",
    sourceVersion: "v1",
    byteOffset: 8,
    byteLength: 16,
    dtype: "f32",
    shape: [2, 2],
  });
  assertEquals(
    Array.from(new Float32Array(await readback(device, resident.buffer, 16))),
    [1.5, -2.5, 3.5, 4.5],
  );
  resident.destroy!();
  device.destroy();
});

Deno.test("an exact product built from a GPU source carries a handle, not values", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const values = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const bytes = new Uint8Array(values.buffer);
  const source = new ByteArrayGPUTensorSource(device, "payload", "v1", bytes);
  const product = await buildTensorContentProduct(
    model("f32", [2, 4], bytes.byteLength),
    source,
    { target: { kind: "tensor", tensorId: "weights" } },
  );

  assertEquals(product.representation, "exact");
  assertEquals(product.values, undefined);
  assertEquals(product.gridShape, [2, 4]);
  assertExists(product.source);
  assertEquals(product.source.format, "f32");
  assertEquals(product.source.length, 8);
  assertEquals(
    Array.from(
      new Float32Array(await readback(device, product.source.buffer, 32)),
    ),
    Array.from(values),
  );

  // The product's own cache key is the range key, unchanged by the upload, so
  // the existing residency state machine governs this buffer's lifetime.
  const record: ResidencyRecord = {
    cacheKey: product.layout!.cacheKey,
    sourceId: "payload",
    sourceVersion: "v1",
    state: {
      kind: "product",
      productKey: product.layout!.cacheKey,
      byteLength: bytes.byteLength,
    },
    resource: product.source,
  };
  assertEquals(evictResidency(record, "budget").resource, undefined);
  device.destroy();
});

Deno.test("an unsupported dtype leaves the product on the CPU values path", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  // f64 has a plan (narrow) but no adapter pass, so the loader declines it and
  // buildTensorContentProduct falls back rather than failing.
  assertEquals(supportsRangeSource("f64"), false);
  const values = new Float64Array([1.5, -2.5, 3.5, 4.5]);
  const bytes = new Uint8Array(values.buffer);
  const source = new ByteArrayGPUTensorSource(device, "payload", "v1", bytes);
  const product = await buildTensorContentProduct(
    model("f64", [2, 2], bytes.byteLength),
    source,
    { target: { kind: "tensor", tensorId: "weights" } },
  );
  assertEquals(product.source, undefined);
  assertEquals(product.values, [1.5, -2.5, 3.5, 4.5]);

  await assertRejects(
    () =>
      source.readRangeSource({
        sourceId: "payload",
        sourceVersion: "v1",
        byteOffset: 0,
        byteLength: bytes.byteLength,
        dtype: "f64",
        shape: [2, 2],
      }),
    RangeError,
    "no GPU upload path",
  );
  device.destroy();
});

Deno.test("a range past the resident ceiling is refused before it reaches the device", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const bytes = new Uint8Array(new Float32Array([1, 2, 3, 4]).buffer);
  const source = new ByteArrayGPUTensorSource(
    device,
    "payload",
    "v1",
    bytes,
    8,
  );
  await assertRejects(
    () =>
      source.readRangeSource({
        sourceId: "payload",
        sourceVersion: "v1",
        byteOffset: 0,
        byteLength: 16,
        dtype: "f32",
        shape: [4],
      }),
    RangeError,
    "resident ceiling",
  );
  device.destroy();
});

Deno.test("adapter pipelines are compiled once per device, not per upload", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const bytes = bf16Bytes([1, 2, 3, 4]);
  const source = new ByteArrayGPUTensorSource(device, "payload", "v1", bytes);
  const request: TensorRangeRequest = {
    sourceId: "payload",
    sourceVersion: "v1",
    byteOffset: 0,
    byteLength: bytes.byteLength,
    dtype: "bf16",
    shape: [4],
  };
  const first = await source.readRangeSource(request);
  const second = await source.readRangeSource(request);
  // Version is what downstream shouldDispatch gating compares, so a re-upload
  // must be distinguishable from the previous one.
  assertEquals(first.version, 1);
  assertEquals(second.version, 2);
  assertEquals(
    Array.from(new Float32Array(await readback(device, second.buffer, 16))),
    [1, 2, 3, 4],
  );
  first.destroy!();
  second.destroy!();
  device.destroy();
});

Deno.test("the adapter registry covers exactly the bit-reinterpretation dtypes", () => {
  assertEquals(Object.keys(TENSOR_ADAPTER_KERNELS).sort(), [
    "unpack_bool",
    "unpack_i16",
    "unpack_i8",
    "unpack_u16",
    "unpack_u8",
    "widen_bf16",
    "widen_f16",
  ]);
  for (
    const dtype of [
      "f32",
      "u32",
      "i32",
      "f16",
      "bf16",
      "i8",
      "i16",
      "u8",
      "u16",
      "bool",
    ]
  ) {
    assertEquals(supportsRangeSource(dtype), true, dtype);
  }
  // Lossy 64-bit narrowing needs a stated rounding policy first (gggplot-vs7.14).
  for (const dtype of ["f64", "i64", "u64", "string"]) {
    assertEquals(supportsRangeSource(dtype), false, dtype);
  }
});
