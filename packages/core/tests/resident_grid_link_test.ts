// <Kernel> linking for the passes shared by the resident count and histogram
// grids (gggplot-vs7.7 / vs7.8).
//
// The RAW form of both passes is already covered on a real device by
// reductions/tests/gpu_test.ts, which asserts the resident kernels' readback.
// What is unproven without these is the LINKED form: that the same body, bound
// through Use.GPU's linker with <Kernel>'s positional value list, computes the
// same thing. So these assert the linked form against an independently derived
// expectation rather than against the raw shader.
import { assert, assertEquals } from "@std/assert";
import {
  bindBundle,
  bindingsToModules,
  bundleToAttributes,
  linkBundle,
  resolveBindings,
} from "@use-gpu/shader/wgsl";
import * as CoreNamespace from "@use-gpu/core";
import {
  CLEAR_U32_KERNEL,
  COUNT_BAR_VERTICES_KERNEL,
  GRID_BAR_VERTEX_COLORS_KERNEL,
  GRID_SUMMARY_KERNEL,
  GROUPED_COUNT_1D_KERNEL,
} from "../src/render/resident_grid_kernels.ts";

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

async function readU32(
  device: GPUDevice,
  source: GPUBuffer,
  count: number,
): Promise<Uint32Array> {
  const staging = device.createBuffer({
    size: count * 4,
    usage: USAGE.COPY_DST | USAGE.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(source, 0, staging, 0, count * 4);
  device.queue.submit([encoder.finish()]);
  await staging.mapAsync(USAGE.MAP_READ);
  const values = new Uint32Array(staging.getMappedRange().slice(0));
  staging.unmap();
  staging.destroy();
  return values;
}

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

Deno.test("the linked u32 clear zeroes exactly its declared size", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  // Deliberately longer than the clear's dispatch size: the guard that stops it
  // at getSize().x is the whole point of the shared body, and a clear that runs
  // past its length would silently wipe a neighbouring region of a shared grid.
  const length = 8;
  const cleared = 5;
  const seeded = Uint32Array.from({ length }, (_, i) => i + 1);
  const buffer = device.createBuffer({
    size: seeded.byteLength,
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, seeded);

  runLinked(
    device,
    CLEAR_U32_KERNEL,
    [() => [cleared, 1], {
      buffer,
      format: "u32",
      length,
      size: [length],
      version: 1,
      readWrite: true,
    }],
    1,
  );

  assertEquals(
    [...await readU32(device, buffer, length)],
    [0, 0, 0, 0, 0, 6, 7, 8],
  );
  buffer.destroy();
  device.destroy();
});

Deno.test("the linked grid summary totals groups and the stacked maximum", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  // counts is laid out group-major: index = group * bins + bin.
  const bins = 3;
  const groups = 2;
  const counts = Uint32Array.from([1, 2, 3, 10, 20, 30]);
  const countsBuffer = device.createBuffer({
    size: counts.byteLength,
    usage: USAGE.STORAGE | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(countsBuffer, 0, counts);

  // groups + 1: one total per group, then the stacked maximum.
  const summaryLength = groups + 1;
  const summaryBuffer = device.createBuffer({
    size: summaryLength * 4,
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(summaryBuffer, 0, new Uint32Array(summaryLength));

  // position 1 is "stack", whose maximum is over per-bin column sums:
  // max(1+10, 2+20, 3+30) = 33. Group totals are 1+2+3 and 10+20+30.
  runLinked(
    device,
    GRID_SUMMARY_KERNEL,
    [
      () => [bins, 1],
      groups,
      1,
      {
        buffer: countsBuffer,
        format: "u32",
        length: counts.length,
        size: [counts.length],
        version: 1,
      },
      {
        buffer: summaryBuffer,
        format: "atomic<u32>",
        length: summaryLength,
        size: [summaryLength],
        version: 1,
        readWrite: true,
      },
    ],
    1,
  );

  assertEquals([...await readU32(device, summaryBuffer, summaryLength)], [
    6,
    60,
    33,
  ]);
  countsBuffer.destroy();
  summaryBuffer.destroy();
  device.destroy();
});

async function readF32(
  device: GPUDevice,
  source: GPUBuffer,
  count: number,
): Promise<Float32Array> {
  const staging = device.createBuffer({
    size: count * 4,
    usage: USAGE.COPY_DST | USAGE.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(source, 0, staging, 0, count * 4);
  device.queue.submit([encoder.finish()]);
  await staging.mapAsync(USAGE.MAP_READ);
  const values = new Float32Array(staging.getMappedRange().slice(0));
  staging.unmap();
  staging.destroy();
  return values;
}

Deno.test("the linked palette expansion fills four vertices per cell", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  // Two groups of two cells each. Every cell writes its group's colour to four
  // consecutive vertices, so cells 0-1 are red and cells 2-3 are green.
  const perGroup = 2;
  const cells = 4;
  const palette = Float32Array.from([1, 0, 0, 1, 0, 1, 0, 1]);
  const paletteBuffer = device.createBuffer({
    size: palette.byteLength,
    usage: USAGE.STORAGE | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(paletteBuffer, 0, palette);

  const vertexFloats = cells * 4 * 4;
  const colorsBuffer = device.createBuffer({
    size: vertexFloats * 4,
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(colorsBuffer, 0, new Float32Array(vertexFloats));

  runLinked(
    device,
    GRID_BAR_VERTEX_COLORS_KERNEL,
    [
      () => [cells, 1],
      perGroup,
      {
        buffer: paletteBuffer,
        format: "vec4<f32>",
        length: 2,
        size: [2],
        version: 1,
      },
      {
        buffer: colorsBuffer,
        format: "vec4<f32>",
        length: cells * 4,
        size: [cells * 4],
        version: 1,
        readWrite: true,
      },
    ],
    1,
  );

  const colors = [...await readF32(device, colorsBuffer, vertexFloats)];
  const red = [1, 0, 0, 1];
  const green = [0, 1, 0, 1];
  // Eight vertices of red (cells 0 and 1), then eight of green.
  assertEquals(
    colors.slice(0, 32),
    Array.from({ length: 8 }, () => red).flat(),
  );
  assertEquals(
    colors.slice(32),
    Array.from({ length: 8 }, () => green).flat(),
  );
  paletteBuffer.destroy();
  colorsBuffer.destroy();
  device.destroy();
});

Deno.test("the linked grouped count bins rows and drops out-of-range ids", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  const rows = 7;
  const valuesCount = 3;
  const groups = 2;
  // Deliberately lopsided so a transposed index or an off-by-one in
  // group*values+value shows up, rather than a uniform grid that would look
  // correct under several wrong layouts. The last row's value id is out of
  // range and must be dropped by the guard, not clamped into a real cell.
  const valueIds = Uint32Array.from([0, 0, 1, 2, 2, 2, 5]);
  const groupIds = Uint32Array.from([0, 0, 0, 1, 1, 1, 0]);

  const storage = (data: Uint32Array) => {
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: USAGE.STORAGE | USAGE.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  };
  const valueBuffer = storage(valueIds);
  const groupBuffer = storage(groupIds);

  const cells = valuesCount * groups;
  const countsBuffer = device.createBuffer({
    size: cells * 4,
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(countsBuffer, 0, new Uint32Array(cells));

  const source = (buffer: GPUBuffer, length: number) => ({
    buffer,
    format: "u32",
    length,
    size: [length],
    version: 1,
  });

  runLinked(
    device,
    GROUPED_COUNT_1D_KERNEL,
    [
      () => [rows, 1],
      valuesCount,
      groups,
      1,
      source(valueBuffer, rows),
      source(groupBuffer, rows),
      {
        buffer: countsBuffer,
        format: "atomic<u32>",
        length: cells,
        size: [cells],
        version: 1,
        readWrite: true,
      },
    ],
    1,
  );

  // group 0: value 0 twice, value 1 once. group 1: value 2 three times.
  assertEquals([...await readU32(device, countsBuffer, cells)], [
    2,
    1,
    0,
    0,
    0,
    3,
  ]);
  valueBuffer.destroy();
  groupBuffer.destroy();
  countsBuffer.destroy();
  device.destroy();
});

Deno.test("the linked bar vertices lay out one quad per cell", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  // One group, two categories, identity position: each bar is a 0.9-wide quad
  // centred on its category index, rising from zero to its count.
  const valuesCount = 2;
  const groups = 1;
  const cells = valuesCount * groups;
  const counts = Uint32Array.from([3, 5]);
  const countsBuffer = device.createBuffer({
    size: counts.byteLength,
    usage: USAGE.STORAGE | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(countsBuffer, 0, counts);
  const summary = Uint32Array.from([8, 5]);
  const summaryBuffer = device.createBuffer({
    size: summary.byteLength,
    usage: USAGE.STORAGE | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(summaryBuffer, 0, summary);

  const floats = cells * 4 * 2;
  const verticesBuffer = device.createBuffer({
    size: floats * 4,
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(verticesBuffer, 0, new Float32Array(floats));

  const u32Source = (buffer: GPUBuffer, length: number) => ({
    buffer,
    format: "u32",
    length,
    size: [length],
    version: 1,
  });

  runLinked(
    device,
    COUNT_BAR_VERTICES_KERNEL,
    [
      () => [cells, 1],
      valuesCount,
      groups,
      0,
      u32Source(countsBuffer, counts.length),
      u32Source(summaryBuffer, summary.length),
      {
        buffer: verticesBuffer,
        format: "vec2<f32>",
        length: cells * 4,
        size: [cells * 4],
        version: 1,
        readWrite: true,
      },
    ],
    1,
  );

  // 0.9 is not exactly representable in f32, so the half-width offsets are
  // compared with a tolerance rather than for equality.
  const got = [...await readF32(device, verticesBuffer, floats)];
  const want = [
    -0.45,
    0,
    -0.45,
    3,
    0.45,
    3,
    0.45,
    0,
    0.55,
    0,
    0.55,
    5,
    1.45,
    5,
    1.45,
    0,
  ];
  assertEquals(got.length, want.length);
  for (let i = 0; i < want.length; i++) {
    assert(
      Math.abs(got[i] - want[i]) < 1e-5,
      `vertex float ${i}: got ${got[i]}, want ${want[i]}`,
    );
  }
  countsBuffer.destroy();
  summaryBuffer.destroy();
  verticesBuffer.destroy();
  device.destroy();
});
