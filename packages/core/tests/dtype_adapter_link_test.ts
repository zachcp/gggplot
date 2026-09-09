// <Kernel> linking for the dtype adapter passes (gggplot-vs7.9).
//
// The RAW form of all seven is already proven on a real device by
// model-inspect/tests/gpu_loader_device_test.ts, which asserts each one against
// the CPU decoder element for element. What is unproven without these is the
// LINKED form: that the same body, bound through Use.GPU's linker with
// <Kernel>'s positional value list, computes the same thing.
//
// Every adapter has the same binding shape -- one source, one target, no args --
// so the value list is always [() => [count, 1], words, values]. That uniformity
// is the point: seven dtypes, two bodies, one call signature.
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
  bindBundle,
  bindingsToModules,
  bundleToAttributes,
  linkBundle,
  resolveBindings,
} from "@use-gpu/shader/wgsl";
import * as CoreNamespace from "@use-gpu/core";
import {
  UNPACK_BOOL_KERNEL,
  UNPACK_I16_KERNEL,
  UNPACK_I8_KERNEL,
  UNPACK_U16_KERNEL,
  UNPACK_U8_KERNEL,
  WIDEN_BF16_KERNEL,
  WIDEN_F16_KERNEL,
} from "../src/render/dtype_adapter_kernels.ts";

// deno-lint-ignore no-explicit-any
const any = (value: unknown): any => value;
const Core = any(CoreNamespace).default ?? CoreNamespace;

const requireWebGpu = Deno.env.get("GGGPLOT_REQUIRE_WEBGPU") === "1";

async function requestTestDevice(): Promise<GPUDevice | null> {
  const gpu = globalThis.navigator?.gpu;
  if (!gpu) {
    assert(!requireWebGpu, "navigator.gpu is required");
    return null;
  }
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    assert(!requireWebGpu, "WebGPU adapter is required");
    return null;
  }
  return await adapter.requestDevice();
}

const USAGE = {
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  STORAGE: 0x0080,
};
/** GPUShaderStage.COMPUTE; the WebGPU globals are not reliable under Deno. */
const SHADER_STAGE_COMPUTE = 0x4;
/** queue/dispatch.mjs's LOCAL_DEFINES — a compute kernel with no globals. */
const LOCAL_DEFINES = {
  "@group(VIRTUAL)": "@group(0)",
  "@group(VOLATILE)": "@group(1)",
  "@group(CUSTOM)": "@group(2)",
  "@group(LOCAL)": "@group(3)",
};

/** Links one bundle against positional values and runs it, as <Kernel> does. */
function runLinked(
  device: GPUDevice,
  bundle: unknown,
  values: unknown[],
  workgroups: number,
): void {
  const attributes = any(bundleToAttributes)(bundle);
  const bound = any(bindBundle)(
    bundle,
    any(bindingsToModules)(Core.makeShaderBindings(attributes, values)),
    LOCAL_DEFINES,
  );
  const resolved = any(resolveBindings)([bound], LOCAL_DEFINES, false);
  const linked: string = any(linkBundle)(
    resolved.modules[0],
    {},
    LOCAL_DEFINES,
  );
  const bindingEntries = Core.makeBindGroupLayoutEntries(
    resolved.bindings,
    resolved.bindingVisibilities,
  );
  const uniformEntry = Core.makeUniformLayoutEntry(
    resolved.fields,
    SHADER_STAGE_COMPUTE,
    bindingEntries.length,
  );
  const entries = uniformEntry
    ? [...bindingEntries, uniformEntry]
    : bindingEntries;
  const pipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [device.createBindGroupLayout({ entries })],
    }),
    compute: {
      module: device.createShaderModule({ code: linked }),
      entryPoint: "main",
    },
  });
  const storage = Core.makeBoundUniforms(
    device,
    pipeline,
    resolved.fields,
    resolved.bindings,
    0,
    false,
  );
  if (storage.pipe && storage.buffer) {
    const constants: Record<string, unknown> = {};
    for (const field of resolved.fields) {
      constants[field.attribute.name] = field.constant;
    }
    storage.pipe.fill(constants);
    Core.uploadBuffer(device, storage.buffer, storage.pipe.data);
  }
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  if (storage.bindGroup) pass.setBindGroup(0, storage.bindGroup);
  pass.dispatchWorkgroups(workgroups);
  pass.end();
  device.queue.submit([encoder.finish()]);
}

async function readTyped<T>(
  device: GPUDevice,
  source: GPUBuffer,
  count: number,
  create: (buffer: ArrayBuffer) => T,
): Promise<T> {
  const staging = device.createBuffer({
    size: count * 4,
    usage: USAGE.COPY_DST | USAGE.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(source, 0, staging, 0, count * 4);
  device.queue.submit([encoder.finish()]);
  await staging.mapAsync(USAGE.MAP_READ);
  const values = create(staging.getMappedRange().slice(0));
  staging.unmap();
  staging.destroy();
  return values;
}

/** Uploads packed source bytes as the u32 word source every adapter reads. */
function wordSource(device: GPUDevice, bytes: Uint8Array) {
  const size = Math.max(4, Math.ceil(bytes.byteLength / 4) * 4);
  const padded = new Uint8Array(size);
  padded.set(bytes);
  const buffer = device.createBuffer({
    size,
    usage: USAGE.STORAGE | USAGE.COPY_DST | USAGE.COPY_SRC,
  });
  device.queue.writeBuffer(buffer, 0, padded);
  return {
    buffer,
    format: "u32",
    length: size / 4,
    size: [size / 4],
    version: 1,
  };
}

function target(device: GPUDevice, count: number, format: string) {
  const buffer = device.createBuffer({
    size: Math.max(4, count * 4),
    usage: USAGE.STORAGE | USAGE.COPY_DST | USAGE.COPY_SRC,
  });
  return {
    source: {
      buffer,
      format,
      length: count,
      size: [count],
      version: 1,
      readWrite: true,
    },
    buffer,
  };
}

/** Runs one adapter through the linker and returns its raw output bytes. */
async function runAdapter(
  device: GPUDevice,
  bundle: unknown,
  bytes: Uint8Array,
  count: number,
  format: string,
): Promise<ArrayBuffer> {
  const words = wordSource(device, bytes);
  const out = target(device, count, format);
  runLinked(
    device,
    bundle,
    [() => [count, 1], words, out.source],
    Math.ceil(count / 64),
  );
  return await readTyped(device, out.buffer, count, (b) => b);
}

function bf16Bytes(values: number[]): Uint8Array {
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
    const magnitude = Math.abs(value);
    if (magnitude === 0) {
      out[i] = value < 0 ? 0x8000 : 0;
      continue;
    }
    const exponent = Math.floor(Math.log2(magnitude));
    out[i] = (value < 0 ? 0x8000 : 0) | ((exponent + 15) << 10) |
      Math.round((magnitude / 2 ** exponent - 1) * 1024);
  }
  return new Uint8Array(out.buffer);
}

Deno.test("the linked bf16 widening reconstructs the truncated f32 exactly", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  // Deliberately more elements than one word holds and an ODD count, so the
  // low/high half selection is actually exercised in both positions and the
  // final word is only half used.
  const values = [1.5, -2.25, 0, 0.5, -7.125];
  const out = await runAdapter(
    device,
    WIDEN_BF16_KERNEL,
    bf16Bytes(values),
    values.length,
    "f32",
  );
  assertEquals(Array.from(new Float32Array(out)), values);
});

Deno.test("the linked f16 widening matches the half-float it was given", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  const values = [1.5, -2.25, 0, 0.5, -7.125];
  const out = await runAdapter(
    device,
    WIDEN_F16_KERNEL,
    f16Bytes(values),
    values.length,
    "f32",
  );
  const actual = Array.from(new Float32Array(out));
  for (let i = 0; i < values.length; i++) {
    assertAlmostEquals(actual[i], values[i], 1e-6, `element ${i}`);
  }
});

Deno.test("the linked signed unpacks sign-extend rather than zero-filling", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  // -128 and -1 are exactly the values a logical shift would turn into 128 and
  // 255, so a zero-filling regression cannot pass this.
  const i8 = new Int8Array([-128, -1, 0, 1, 127]);
  assertEquals(
    Array.from(
      new Int32Array(
        await runAdapter(
          device,
          UNPACK_I8_KERNEL,
          new Uint8Array(i8.buffer),
          5,
          "i32",
        ),
      ),
    ),
    [-128, -1, 0, 1, 127],
  );

  const i16 = new Int16Array([-32768, -1, 0, 1, 32767]);
  assertEquals(
    Array.from(
      new Int32Array(
        await runAdapter(
          device,
          UNPACK_I16_KERNEL,
          new Uint8Array(i16.buffer),
          5,
          "i32",
        ),
      ),
    ),
    [-32768, -1, 0, 1, 32767],
  );
});

Deno.test("the linked unsigned unpacks keep the full range", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  const u8 = new Uint8Array([0, 1, 255, 128, 7]);
  assertEquals(
    Array.from(
      new Uint32Array(await runAdapter(device, UNPACK_U8_KERNEL, u8, 5, "u32")),
    ),
    [0, 1, 255, 128, 7],
  );

  const u16 = new Uint16Array([0, 1, 65535, 32768, 7]);
  assertEquals(
    Array.from(
      new Uint32Array(
        await runAdapter(
          device,
          UNPACK_U16_KERNEL,
          new Uint8Array(u16.buffer),
          5,
          "u32",
        ),
      ),
    ),
    [0, 1, 65535, 32768, 7],
  );
});

Deno.test("the linked bool unpack matches decodeValue's plain byte read", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  // 0xff stays 255. That is decodeValue's behavior (a getUint8), and the
  // dual-surface rule is same input, same output -- not "whichever is nicer".
  const bytes = new Uint8Array([0, 1, 0xff, 0, 1]);
  assertEquals(
    Array.from(
      new Uint32Array(
        await runAdapter(device, UNPACK_BOOL_KERNEL, bytes, 5, "u32"),
      ),
    ),
    [0, 1, 255, 0, 1],
  );
});

Deno.test("an adapter writes nothing past its declared element count", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  // Four bytes of input is four u8 elements, but the dispatch is told there are
  // only two. The guard at getSize().x is what stops the pass from writing over
  // a neighbouring region of a shared output buffer.
  const words = wordSource(device, new Uint8Array([7, 8, 9, 10]));
  const out = target(device, 4, "u32");
  device.queue.writeBuffer(out.buffer, 0, new Uint32Array([99, 99, 99, 99]));
  runLinked(device, UNPACK_U8_KERNEL, [() => [2, 1], words, out.source], 1);
  assertEquals(
    Array.from(
      await readTyped(device, out.buffer, 4, (b) => new Uint32Array(b)),
    ),
    [7, 8, 99, 99],
  );
});
