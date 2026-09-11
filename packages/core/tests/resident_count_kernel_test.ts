// The MOUNTED stat_count grid: all five passes of runtime/resident_count_kernel_live.tsx
// linked and dispatched into ONE compute pass, exactly as <Kernel> does (gggplot-vs7.7).
//
// resident_grid_link_test.ts already proves each pass body in isolation. What
// that cannot see is the two things the mounted swap actually got wrong twice:
//
//   1. VALUE ORDER. <Kernel> pairs a positional value list
//      [dataSize, ...args, ...sources, ...targets] against the bundle's
//      attributes, and a misorder does not fail loudly — it binds a buffer to a
//      size lambda, or one accessor to another. So the lists below are the ones
//      CountKernels builds, in the same order, and must stay in sync with it.
//   2. PASS ORDER. Declaration order inside <Stage>s is the schedule, because
//      ComputePass runs every gathered `compute` call in tree order into one
//      encoder. `summarize` has to land strictly before the bar-vertex pass:
//      dodge layout reads per-group totals through getSummary to decide which
//      groups are present. The fixture below is chosen so getting that wrong
//      changes the output rather than merely being unproven — one declared
//      group is ABSENT from the data, so an unsummarized (all-zero) summary
//      makes the shader see zero present groups and widen every bar to the full
//      band instead of dodging two half-bands.
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
  bindBundle,
  bindingsToModules,
  bundleToAttributes,
  linkBundle,
  resolveBindings,
} from "@use-gpu/shader/wgsl";
import * as CoreNamespace from "@use-gpu/core";
import { gridPositionCode } from "@gggplot/reductions";
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
/** Every pass body declares @workgroup_size(64), which <Kernel> parses off it. */
const WORKGROUP = 64;

/** One linked pass, ready to be encoded into a shared compute pass. */
interface LinkedPass {
  encode(pass: GPUComputePassEncoder): void;
}

/**
 * Links one bundle against positional values, the way <Kernel> does, but stops
 * short of submitting so several passes can share one encoder.
 */
function linkPass(
  device: GPUDevice,
  bundle: unknown,
  values: unknown[],
  size: number,
): LinkedPass {
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
  // <Kernel> re-fills its uniform block on every dispatch, which is what lets a
  // scalar arg change without rebuilding the pipeline; here once is enough.
  if (storage.pipe && storage.buffer) {
    const constants: Record<string, unknown> = {};
    for (const field of resolved.fields) {
      constants[field.attribute.name] = field.constant;
    }
    storage.pipe.fill(constants);
    Core.uploadBuffer(device, storage.buffer, storage.pipe.data);
  }
  return {
    encode(pass: GPUComputePassEncoder) {
      pass.setPipeline(pipeline);
      if (storage.bindGroup) pass.setBindGroup(0, storage.bindGroup);
      pass.dispatchWorkgroups(Math.ceil(size / WORKGROUP));
    },
  };
}

async function read<T extends Uint32Array | Float32Array>(
  device: GPUDevice,
  source: GPUBuffer,
  count: number,
  create: (data: ArrayBuffer) => T,
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

Deno.test("the mounted count grid's five passes produce dodged bars in one compute pass", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  // Three declared groups, two categories, and group 1 ABSENT from the data —
  // see the header for why that absence is the point.
  const perGroup = 2;
  const groupsCount = 3;
  const cells = perGroup * groupsCount;
  const summaryLength = groupsCount + 1;
  const valueIds = Uint32Array.from([0, 0, 1, 0, 1, 1]);
  const groupIds = Uint32Array.from([0, 0, 0, 2, 2, 2]);
  const rows = valueIds.length;
  const position = gridPositionCode("dodge");
  const palette = Float32Array.from([1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1]);

  const upload = (data: Uint32Array | Float32Array) => {
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  };
  const valuesBuffer = upload(valueIds);
  const groupsBuffer = upload(groupIds);
  const paletteBuffer = upload(palette);
  // Seeded with garbage so the two clear passes are proven, not assumed: an
  // unrun clear leaves these values in the accumulations.
  const countsBuffer = upload(new Uint32Array(cells).fill(99));
  const summaryBuffer = upload(new Uint32Array(summaryLength).fill(77));
  const vertexFloats = cells * 4 * 2;
  const verticesBuffer = upload(new Float32Array(vertexFloats).fill(-1));
  const colorFloats = cells * 4 * 4;
  const colorsBuffer = upload(new Float32Array(colorFloats).fill(-1));

  const source = (buffer: GPUBuffer, format: string, length: number) => ({
    buffer,
    format,
    length,
    size: [length],
    version: 1,
  });
  const target = (buffer: GPUBuffer, format: string, length: number) => ({
    ...source(buffer, format, length),
    readWrite: true,
  });
  const counts = source(countsBuffer, "u32", cells);
  const summary = source(summaryBuffer, "u32", summaryLength);

  // The value lists and their order mirror CountKernels one for one.
  const passes = [
    linkPass(device, CLEAR_U32_KERNEL, [
      () => [cells, 1],
      target(countsBuffer, "u32", cells),
    ], cells),
    linkPass(device, GROUPED_COUNT_1D_KERNEL, [
      () => [rows, 1],
      perGroup,
      groupsCount,
      1,
      source(valuesBuffer, "u32", rows),
      source(groupsBuffer, "u32", rows),
      target(countsBuffer, "atomic<u32>", cells),
    ], rows),
    linkPass(device, CLEAR_U32_KERNEL, [
      () => [summaryLength, 1],
      target(summaryBuffer, "u32", summaryLength),
    ], summaryLength),
    linkPass(device, GRID_SUMMARY_KERNEL, [
      () => [perGroup, 1],
      groupsCount,
      position,
      counts,
      target(summaryBuffer, "atomic<u32>", summaryLength),
    ], perGroup),
    linkPass(device, COUNT_BAR_VERTICES_KERNEL, [
      () => [cells, 1],
      perGroup,
      groupsCount,
      position,
      counts,
      summary,
      target(verticesBuffer, "vec2<f32>", cells * 4),
    ], cells),
    linkPass(device, GRID_BAR_VERTEX_COLORS_KERNEL, [
      () => [cells, 1],
      perGroup,
      source(paletteBuffer, "vec4<f32>", groupsCount),
      target(colorsBuffer, "vec4<f32>", cells * 4),
    ], cells),
  ];

  // ONE encoder and ONE compute pass for all six dispatches, which is the shape
  // <Compute>'s ComputePass builds. Read-after-write between dispatches inside a
  // single pass is what the intra-pass ordering above relies on; it is pinned
  // independently by usegpu_kernel_link_test.ts.
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  for (const linked of passes) linked.encode(pass);
  pass.end();
  device.queue.submit([encoder.finish()]);

  // counts is group-major: index = group * perGroup + value.
  assertEquals(
    [...await read(device, countsBuffer, cells, (d) => new Uint32Array(d))],
    [2, 1, 0, 0, 1, 2],
  );
  // Per-group totals, then dodge's maximum (the largest single cell).
  assertEquals(
    [
      ...await read(
        device,
        summaryBuffer,
        summaryLength,
        (d) => new Uint32Array(d),
      ),
    ],
    [3, 0, 3, 2],
  );

  // Two groups present, so dodge halves the 0.9 band: group 0 takes
  // [value-0.45, value), group 2 takes [value, value+0.45). Group 1's cells
  // stay degenerate at zero height. A summary that had not been filled would
  // instead give every group the full 0.9 band starting at value-0.45.
  const vertices = [
    ...await read(
      device,
      verticesBuffer,
      vertexFloats,
      (d) => new Float32Array(d),
    ),
  ];
  const quad = (left: number, width: number, y0: number, y1: number) => [
    left,
    y0,
    left,
    y1,
    left + width,
    y1,
    left + width,
    y0,
  ];
  const expected = [
    ...quad(-0.45, 0.45, 0, 2), // group 0, value 0
    ...quad(0.55, 0.45, 0, 1), // group 0, value 1
    ...quad(0.0, 0.45, 0, 0), // group 1 absent, value 0
    ...quad(1.0, 0.45, 0, 0), // group 1 absent, value 1
    ...quad(0.0, 0.45, 0, 1), // group 2, value 0
    ...quad(1.0, 0.45, 0, 2), // group 2, value 1
  ];
  assertEquals(vertices.length, expected.length);
  for (const [i, want] of expected.entries()) {
    // 0.45 and 0.55 are not exact in f32.
    assertAlmostEquals(vertices[i], want, 1e-6, `vertex float ${i}`);
  }

  // Four identical RGBA vertices per cell, two cells per group.
  const colors = [
    ...await read(
      device,
      colorsBuffer,
      colorFloats,
      (d) => new Float32Array(d),
    ),
  ];
  const expectedColors = [
    ...Array.from({ length: 8 }, () => [1, 0, 0, 1]).flat(),
    ...Array.from({ length: 8 }, () => [0, 1, 0, 1]).flat(),
    ...Array.from({ length: 8 }, () => [0, 0, 1, 1]).flat(),
  ];
  assertEquals(colors, expectedColors);

  for (
    const buffer of [
      valuesBuffer,
      groupsBuffer,
      paletteBuffer,
      countsBuffer,
      summaryBuffer,
      verticesBuffer,
      colorsBuffer,
    ]
  ) buffer.destroy();
  device.destroy();
});
