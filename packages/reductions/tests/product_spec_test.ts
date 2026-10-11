// gggplot-euh: kernels and products as plain data. Both preambles are
// generated from a KernelSpec; the headless executor runs a ProductSpec.
import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertThrows,
} from "@std/assert";
import {
  CLEAR_U32,
  COUNT_BAR_VERTICES,
  COUNT_GRID_PRODUCT,
  createResidentCount1DFromSources,
  createResidentDomain1D,
  createResidentHistogram1DFromSources,
  DOMAIN_1D_PRODUCT,
  evalSize,
  floatFromOrdered,
  GRID_SUMMARY,
  gridPositionCode,
  GROUPED_COUNT_1D,
  groupedCount1d,
  HISTOGRAM_GRID_PRODUCT,
  linkPreamble,
  type ProductSpec,
  rawSource,
  resolveHistogram1dBins,
  runProduct,
  validateProductSpec,
} from "../src/mod.ts";

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

Deno.test("link preambles declare size, args, reads, then the target", () => {
  // The order <Kernel> pairs values in: [size, ...args, ...sources, target].
  assertEquals(
    linkPreamble(GROUPED_COUNT_1D),
    [
      "@link fn getSize() -> vec2<u32>;",
      "@link fn getValues() -> u32;",
      "@link fn getGroups() -> u32;",
      "@link fn getHasGroups() -> u32;",
      "@link fn getValueId(i: u32) -> u32;",
      "@link fn getGroupId(i: u32) -> u32;",
      "@link var<storage, read_write> counts: array<atomic<u32>>;",
    ].join("\n"),
  );
  assertEquals(
    linkPreamble(COUNT_BAR_VERTICES).split("\n").at(-1),
    "@link var<storage, read_write> vertices: array<vec2<f32>>;",
  );
});

Deno.test("raw preambles bind reads, then the target, then the params", () => {
  const source = rawSource(GRID_SUMMARY);
  assert(
    source.includes("@group(0) @binding(0) var<storage, read> read_count"),
  );
  assert(
    source.includes(
      "@group(0) @binding(1) var<storage, read_write> summary: array<atomic<u32>>;",
    ),
  );
  assert(source.includes("@group(0) @binding(2) var<uniform> params: Params;"));
  assert(
    source.includes("fn getPosition() -> u32 { return params.position; }"),
  );
});

Deno.test("size expressions and spec validation", () => {
  assertEquals(
    evalSize({ mul: ["bins", { add: ["groups", 1] }] }, {
      bins: 3,
      groups: 2,
    }),
    9,
  );
  assertThrows(() => evalSize("missing", {}), Error, "unknown symbol");
  validateProductSpec(COUNT_GRID_PRODUCT);
  const unbound: ProductSpec = {
    ...COUNT_GRID_PRODUCT,
    passes: [{ kernel: GROUPED_COUNT_1D, write: "counts", size: "rows" }],
  };
  assertThrows(() => validateProductSpec(unbound), Error, "unbound");
  const wrongFormat: ProductSpec = {
    ...COUNT_GRID_PRODUCT,
    passes: [{ kernel: CLEAR_U32, write: "barVertices", size: 1 }],
  };
  assertThrows(() => validateProductSpec(wrongFormat), Error, "format");
  const writesInput: ProductSpec = {
    ...COUNT_GRID_PRODUCT,
    passes: [{ kernel: CLEAR_U32, write: "valueIds", size: 1 }],
  };
  assertThrows(() => validateProductSpec(writesInput), Error, "input port");
});

Deno.test("the count grid product runs headless and matches the CPU", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const valueIds = Uint32Array.of(0, 1, 2, 1, 1, 0, 2, 2, 2, 1);
  const groupIds = Uint32Array.of(0, 0, 1, 1, 0, 1, 1, 0, 1, 1);
  const upload = (array: Uint32Array) => {
    const buffer = device.createBuffer({
      size: array.byteLength,
      usage: 0x0080 | 0x0008, // STORAGE | COPY_DST (no global in every Deno context)
    });
    device.queue.writeBuffer(buffer, 0, array);
    return buffer;
  };
  const run = runProduct(device, COUNT_GRID_PRODUCT, {
    rows: valueIds.length,
    bins: 3,
    groups: 2,
    hasGroups: 1,
    position: gridPositionCode("stack"),
  }, { valueIds: upload(valueIds), groupIds: upload(groupIds) });
  const counts = await run.readU32("counts");
  const cpu = groupedCount1d({
    valueIds,
    valuesCount: 3,
    groupIds,
    groupsCount: 2,
  });
  assertEquals([...counts], [...cpu.counts]);
  const summary = await run.readU32("summary");
  // Group totals, then the stacked maximum (category 2 holds 4).
  assertEquals([...summary], [4, 6, 4]);
  // Bit-equal to the hand-wired executor this spec replaces, for every
  // position mode (the bar layout reads the summary).
  for (const position of ["identity", "stack", "dodge", "fill"] as const) {
    const fromSpec = runProduct(device, COUNT_GRID_PRODUCT, {
      rows: valueIds.length,
      bins: 3,
      groups: 2,
      hasGroups: 1,
      position: gridPositionCode(position),
    }, { valueIds: upload(valueIds), groupIds: upload(groupIds) });
    const handWired = createResidentCount1DFromSources(device, {
      valueIds: upload(valueIds),
      groupIds: upload(groupIds),
      rows: valueIds.length,
      valuesCount: 3,
      groupsCount: 2,
      position,
    });
    handWired.dispatch();
    assertEquals(
      [...await fromSpec.readF32("barVertices")],
      [...await handWired.readbackBarVertices()],
      position,
    );
    assertEquals(
      [...await fromSpec.readU32("summary")],
      [
        ...await handWired.readback().then(() =>
          handWired.readbackSummary().then((s) => [
            ...s.groupTotals,
            s.stackedMaximum,
          ])
        ),
      ],
      position,
    );
    fromSpec.destroy();
    handWired.destroy();
  }
  run.destroy();
  device.destroy();
});

Deno.test("the histogram and domain products match the hand-wired executors", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const values = Float32Array.of(4.3, 5.1, 5.8, 6.4, 7.9, 5.5, 6.1, Number.NaN);
  const groupIds = Uint32Array.of(0, 1, 2, 0, 1, 2, 0, 1);
  const upload = (array: Float32Array | Uint32Array) => {
    const buffer = device.createBuffer({
      size: array.byteLength,
      usage: 0x0080 | 0x0008,
    });
    device.queue.writeBuffer(buffer, 0, array);
    return buffer;
  };

  // Domain: the same ordered-float [min, max] words.
  const domain = runProduct(device, DOMAIN_1D_PRODUCT, {
    rows: values.length,
  }, { values: upload(values) });
  const handDomain = createResidentDomain1D(
    device,
    upload(values),
    values.length,
  );
  handDomain.dispatch();
  const words = await domain.readU32("domain");
  const hand = await handDomain.readback();
  assertAlmostEquals(floatFromOrdered(words[0]), hand.min, 1e-6);
  assertAlmostEquals(floatFromOrdered(words[1]), hand.max, 1e-6);
  domain.destroy();

  const lo = 4.3, hi = 7.9;
  const { bins, binwidth } = resolveHistogram1dBins({ lo, hi, bins: 5 });
  for (const position of ["identity", "stack", "dodge", "fill"] as const) {
    const run = runProduct(device, HISTOGRAM_GRID_PRODUCT, {
      rows: values.length,
      bins,
      groups: 3,
      hasGroups: 1,
      position: gridPositionCode(position),
      lo,
      binwidth,
    }, { values: upload(values), groupIds: upload(groupIds) });
    const wired = createResidentHistogram1DFromSources(device, {
      values: upload(values),
      rows: values.length,
      groupIds: upload(groupIds),
      lo,
      hi,
      bins: 5,
      groupsCount: 3,
      position,
    });
    wired.dispatch();
    assertEquals([...await run.readU32("counts")], [...await wired.readback()]);
    const summary = await wired.readbackSummary();
    assertEquals([...await run.readU32("summary")], [
      ...summary.groupTotals,
      summary.stackedMaximum,
    ]);
    assertEquals(
      [...await run.readF32("barVertices")],
      [...await wired.readbackBarVertices()],
      position,
    );
    assertEquals(
      [...await run.readF32("tileVertices")],
      [...await wired.readbackTileVertices()],
    );
    assertEquals(
      [...await run.readF32("heatmapColors")],
      [...await wired.readbackHeatmapColors()],
    );
    run.destroy();
    wired.destroy();
  }
  device.destroy();
});
