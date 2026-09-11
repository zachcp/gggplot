// The MOUNTED stat_bin grid: all seven passes of runtime/resident_histogram_kernel_live.tsx
// linked and dispatched into ONE compute pass, exactly as <Kernel> does (gggplot-vs7.8).
//
// The histogram counterpart of resident_count_kernel_test.ts, and it exists for
// the same two reasons that file does — see its header for why value order and
// pass order are the things worth pinning, and why neither is visible to the
// unit suite or to a pixel floor.
//
// This one additionally covers what the count grid has no analogue for:
//   - THE BIN GEOMETRY ARGS. lo and binwidth are shader args here, and binwidth
//     is DERIVED when the caller gave a bin count, so a wrong or re-derived
//     value silently shifts every bar and tile along x. The fixture uses a
//     non-integer lo and a binwidth that is not 1 so any confusion between the
//     two, or a dropped arg, moves the output.
//   - THE TILE PASS, which takes no counts source at all. That is what removed
//     the raw path's Dawn auto-layout workaround: the linker emits bindings from
//     actual links, so the declared-but-unused count binding that Dawn dropped
//     from an `auto` layout cannot exist in the linked form.
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
  GRID_BAR_VERTEX_COLORS_KERNEL,
  GRID_SUMMARY_KERNEL,
  GROUPED_HISTOGRAM_1D_KERNEL,
  HISTOGRAM_BAR_VERTICES_KERNEL,
  HISTOGRAM_TILE_VERTICES_KERNEL,
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

Deno.test("the mounted bin grid's seven passes produce stacked bars and tiles in one compute pass", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  // Two bins, two groups, both present. lo and binwidth are deliberately not
  // 0 and 1: bins span [1.5, 4.0) and [4.0, 6.5).
  const bins = 2;
  const groupsCount = 2;
  const cells = bins * groupsCount;
  const summaryLength = groupsCount + 1;
  const lo = 1.5;
  const binwidth = 2.5;
  // Group 0: 2.0 and 3.0 land in bin 0, 5.0 in bin 1. Group 1: 2.5 in bin 0,
  // 6.0 and 100.0 in bin 1 — the last CLAMPED into the end bin, not dropped.
  const values = Float32Array.from([2.0, 3.0, 5.0, 2.5, 6.0, 100.0]);
  const groupIds = Uint32Array.from([0, 0, 0, 1, 1, 1]);
  const rows = values.length;
  const position = gridPositionCode("stack");
  const palette = Float32Array.from([1, 0, 0, 1, 0, 1, 0, 1]);

  const upload = (data: Uint32Array | Float32Array) => {
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  };
  const valuesBuffer = upload(values);
  const groupsBuffer = upload(groupIds);
  const paletteBuffer = upload(palette);
  // Seeded with garbage so the two clear passes are proven, not assumed.
  const countsBuffer = upload(new Uint32Array(cells).fill(99));
  const summaryBuffer = upload(new Uint32Array(summaryLength).fill(77));
  const vertexFloats = cells * 4 * 2;
  const barsBuffer = upload(new Float32Array(vertexFloats).fill(-1));
  const tilesBuffer = upload(new Float32Array(vertexFloats).fill(-1));
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

  // The value lists and their order mirror HistogramKernels one for one.
  const passes = [
    linkPass(device, CLEAR_U32_KERNEL, [
      () => [cells, 1],
      target(countsBuffer, "u32", cells),
    ], cells),
    linkPass(device, GROUPED_HISTOGRAM_1D_KERNEL, [
      () => [rows, 1],
      bins,
      groupsCount,
      1,
      lo,
      binwidth,
      source(valuesBuffer, "f32", rows),
      source(groupsBuffer, "u32", rows),
      target(countsBuffer, "atomic<u32>", cells),
    ], rows),
    linkPass(device, CLEAR_U32_KERNEL, [
      () => [summaryLength, 1],
      target(summaryBuffer, "u32", summaryLength),
    ], summaryLength),
    linkPass(device, GRID_SUMMARY_KERNEL, [
      () => [bins, 1],
      groupsCount,
      position,
      counts,
      target(summaryBuffer, "atomic<u32>", summaryLength),
    ], bins),
    linkPass(device, HISTOGRAM_BAR_VERTICES_KERNEL, [
      () => [cells, 1],
      bins,
      groupsCount,
      position,
      lo,
      binwidth,
      counts,
      summary,
      target(barsBuffer, "vec2<f32>", cells * 4),
    ], cells),
    linkPass(device, HISTOGRAM_TILE_VERTICES_KERNEL, [
      () => [cells, 1],
      bins,
      lo,
      binwidth,
      target(tilesBuffer, "vec2<f32>", cells * 4),
    ], cells),
    linkPass(device, GRID_BAR_VERTEX_COLORS_KERNEL, [
      () => [cells, 1],
      bins,
      source(paletteBuffer, "vec4<f32>", groupsCount),
      target(colorsBuffer, "vec4<f32>", cells * 4),
    ], cells),
  ];

  // ONE encoder and ONE compute pass for all seven dispatches, which is the
  // shape <Compute>'s ComputePass builds.
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  for (const linked of passes) linked.encode(pass);
  pass.end();
  device.queue.submit([encoder.finish()]);

  // counts is group-major: index = group * bins + bin.
  assertEquals(
    [...await read(device, countsBuffer, cells, (d) => new Uint32Array(d))],
    [2, 1, 1, 2],
  );
  // Per-group totals, then stack's maximum over per-bin column sums:
  // max(2+1, 1+2) = 3.
  assertEquals(
    [
      ...await read(
        device,
        summaryBuffer,
        summaryLength,
        (d) => new Uint32Array(d),
      ),
    ],
    [3, 3, 3],
  );

  const quad = (x0: number, x1: number, y0: number, y1: number) => [
    x0,
    y0,
    x0,
    y1,
    x1,
    y1,
    x1,
    y0,
  ];
  const bin0 = [lo, lo + binwidth]; // [1.5, 4.0)
  const bin1 = [lo + binwidth, lo + 2 * binwidth]; // [4.0, 6.5)

  // Stacked: group 0 sits on the axis, group 1 rides on group 0's total for the
  // SAME BIN — which is the read of `counts` that only holds once the grid has
  // been fully accumulated.
  const bars = [
    ...await read(device, barsBuffer, vertexFloats, (d) => new Float32Array(d)),
  ];
  const expectedBars = [
    ...quad(bin0[0], bin0[1], 0, 2), // group 0, bin 0: count 2
    ...quad(bin1[0], bin1[1], 0, 1), // group 0, bin 1: count 1
    ...quad(bin0[0], bin0[1], 2, 3), // group 1, bin 0: stacked on 2
    ...quad(bin1[0], bin1[1], 1, 3), // group 1, bin 1: stacked on 1
  ];
  assertEquals(bars.length, expectedBars.length);
  for (const [i, want] of expectedBars.entries()) {
    assertAlmostEquals(bars[i], want, 1e-5, `bar float ${i}`);
  }

  // Tiles are purely geometric: bin span on x, group row on y, no counts.
  const tiles = [
    ...await read(
      device,
      tilesBuffer,
      vertexFloats,
      (d) => new Float32Array(d),
    ),
  ];
  const expectedTiles = [
    ...quad(bin0[0], bin0[1], 0, 1),
    ...quad(bin1[0], bin1[1], 0, 1),
    ...quad(bin0[0], bin0[1], 1, 2),
    ...quad(bin1[0], bin1[1], 1, 2),
  ];
  assertEquals(tiles.length, expectedTiles.length);
  for (const [i, want] of expectedTiles.entries()) {
    assertAlmostEquals(tiles[i], want, 1e-5, `tile float ${i}`);
  }

  // Four identical RGBA vertices per cell, two cells (bins) per group.
  assertEquals(
    [
      ...await read(
        device,
        colorsBuffer,
        colorFloats,
        (d) => new Float32Array(d),
      ),
    ],
    [
      ...Array.from({ length: 8 }, () => [1, 0, 0, 1]).flat(),
      ...Array.from({ length: 8 }, () => [0, 1, 0, 1]).flat(),
    ],
  );

  for (
    const buffer of [
      valuesBuffer,
      groupsBuffer,
      paletteBuffer,
      countsBuffer,
      summaryBuffer,
      barsBuffer,
      tilesBuffer,
      colorsBuffer,
    ]
  ) buffer.destroy();
  device.destroy();
});
