import { assertEquals, assertExists } from "@std/assert";
import {
  benchmarkResidentHistogram,
  createResidentCount1DFromSources,
  createResidentDomain1D,
  createResidentHistogram1D,
  createResidentHistogram1DFromSources,
  groupedCount1d,
  groupedCount1dGpu,
  groupedHistogram1d,
  groupedHistogram1dGpu,
  groupedHistogram2d,
  groupedHistogram2dGpu,
  packHistogram1dParams,
  packHistogram1dSourceParams,
  packHistogram2dParams,
} from "../src/mod.ts";

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

Deno.test("packHistogram1dParams matches WGSL uniform layout", () => {
  const packed = packHistogram1dParams({
    values: new Float32Array(17),
    lo: -2,
    hi: 10,
    bins: 6,
    groupIds: new Uint32Array(17),
    groupsCount: 3,
  });
  const view = new DataView(packed.params);

  assertEquals(packed.params.byteLength, 32);
  assertEquals(view.getUint32(0, true), 17);
  assertEquals(view.getUint32(4, true), 6);
  assertEquals(view.getUint32(8, true), 3);
  assertEquals(view.getUint32(12, true), 1);
  assertEquals(view.getFloat32(16, true), -2);
  assertEquals(view.getFloat32(20, true), 2);
  assertEquals(packed.countsLength, 18);
});

Deno.test("packHistogram1dParams resolves binwidth into count shape", () => {
  const packed = packHistogram1dParams({
    values: new Float32Array(5),
    lo: 0,
    hi: 10,
    binwidth: 4,
  });

  assertEquals(packed.bins, 3);
  assertEquals(packed.groupsCount, 1);
  assertEquals(packed.countsLength, 3);
});

Deno.test("packHistogram1dSourceParams declares an already-resident source", () => {
  const packed = packHistogram1dSourceParams({
    rows: 5,
    lo: 0,
    hi: 10,
    binwidth: 4,
    groupsCount: 2,
    hasGroups: true,
  });
  const view = new DataView(packed.params);

  assertEquals(view.getUint32(0, true), 5);
  assertEquals(view.getUint32(12, true), 1);
  assertEquals(packed.bins, 3);
  assertEquals(packed.countsLength, 6);
});

Deno.test("packHistogram2dParams matches WGSL uniform layout", () => {
  const packed = packHistogram2dParams({
    x: new Float32Array(9),
    y: new Float32Array(9),
    xLo: 0,
    xHi: 8,
    yLo: -4,
    yHi: 4,
    xBins: 4,
    yBins: 2,
    groupIds: new Uint32Array(9),
    groupsCount: 5,
  });
  const view = new DataView(packed.params);

  assertEquals(packed.params.byteLength, 48);
  assertEquals(view.getUint32(0, true), 9);
  assertEquals(view.getUint32(4, true), 4);
  assertEquals(view.getUint32(8, true), 2);
  assertEquals(view.getUint32(12, true), 5);
  assertEquals(view.getUint32(16, true), 1);
  assertEquals(view.getFloat32(20, true), 0);
  assertEquals(view.getFloat32(24, true), -4);
  assertEquals(view.getFloat32(28, true), 2);
  assertEquals(view.getFloat32(32, true), 4);
  assertEquals(packed.countsLength, 40);
});

Deno.test("grouped count GPU and resident paths are bit-exact", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const input = {
    valueIds: Uint32Array.from({ length: 1025 }, (_, i) => (i * 193) % 513),
    valuesCount: 513,
    groupIds: Uint32Array.from({ length: 1025 }, (_, i) => i % 3),
    groupsCount: 5,
  };
  const cpu = groupedCount1d(input);
  const gpu = await groupedCount1dGpu(device, input);
  assertEquals([...gpu.counts], [...cpu.counts]);

  const usage = 0x0080 | 0x0008;
  const values = device.createBuffer({
    size: input.valueIds.byteLength,
    usage,
  });
  const groups = device.createBuffer({
    size: input.groupIds.byteLength,
    usage,
  });
  device.queue.writeBuffer(values, 0, input.valueIds);
  device.queue.writeBuffer(groups, 0, input.groupIds);
  const resident = createResidentCount1DFromSources(device, {
    valueIds: values,
    rows: input.valueIds.length,
    groupIds: groups,
    valuesCount: input.valuesCount,
    groupsCount: input.groupsCount,
    position: "stack",
  });
  resident.dispatch();
  assertEquals([...await resident.readback()], [...cpu.counts]);
  const summary = await resident.readbackSummary();
  assertEquals([...summary.groupTotals], [342, 342, 341, 0, 0]);
  assertEquals(summary.byteLength, 24);
  resident.destroy();
  values.destroy();
  groups.destroy();
  device.destroy();
});

Deno.test("groupedHistogram1dGpu matches CPU counts when WebGPU is available", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const input = {
    values: new Float32Array([0, 1, 2, 3, 0, 1]),
    lo: 0,
    hi: 3,
    binwidth: 2,
    groupIds: new Uint32Array([0, 0, 0, 0, 1, 1]),
    groupsCount: 2,
  };

  const cpu = groupedHistogram1d(input);
  const gpuResult = await groupedHistogram1dGpu(device, input);

  assertEquals([...gpuResult.counts], [...cpu.counts]);
  assertEquals([...gpuResult.totals], [...cpu.totals]);
  assertEquals(gpuResult.backend, "webgpu");
  device.destroy();
});

Deno.test("groupedCount1dGpu is bit-exact across grouped and wide categorical inputs", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const cases = [
    { valueIds: new Uint32Array([0, 0, 0]), valuesCount: 1 },
    {
      valueIds: new Uint32Array([3, 0, 3, 1, 2, 0, 999, 1]),
      valuesCount: 4,
      groupIds: new Uint32Array([1, 0, 0, 2, 1, 2, 0, 9]),
      groupsCount: 4,
    },
    {
      valueIds: Uint32Array.from({ length: 1025 }, (_, i) => (i * 193) % 513),
      valuesCount: 513,
      groupIds: Uint32Array.from({ length: 1025 }, (_, i) => i % 3),
      groupsCount: 5,
    },
  ];
  for (const input of cases) {
    const cpu = groupedCount1d(input);
    const gpu = await groupedCount1dGpu(device, input);
    assertEquals([...gpu.counts], [...cpu.counts]);
    assertEquals(gpu.shape, cpu.shape);
    assertEquals(gpu.backend, "webgpu");
  }
  device.destroy();
});

Deno.test("groupedHistogram1dGpu skips non-finite values like the CPU stat", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const input = {
    values: new Float32Array([0, Number.NaN, 1, Number.POSITIVE_INFINITY]),
    lo: 0,
    hi: 2,
    bins: 2,
  };
  const gpuResult = await groupedHistogram1dGpu(device, input);

  assertEquals([...gpuResult.counts], [...groupedHistogram1d(input).counts]);
  device.destroy();
});

Deno.test("resident histogram keeps its grid on-GPU and clears before every dispatch", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const input = {
    values: new Float32Array([0, 1, 2, 3, 0, 1]),
    lo: 0,
    hi: 3,
    binwidth: 2,
    groupIds: new Uint32Array([0, 0, 0, 0, 1, 1]),
    groupsCount: 2,
  };
  const resident = createResidentHistogram1D(device, input);
  resident.dispatch();
  const first = await resident.readback();
  resident.dispatch();
  const second = await resident.readback();
  const vertices = await resident.readbackBarVertices();
  const summary = await resident.readbackSummary();
  assertEquals([...first], [...groupedHistogram1d(input).counts]);
  assertEquals([...second], [...first]);
  assertEquals([...vertices.slice(0, 16)], [
    0,
    0,
    0,
    2,
    2,
    2,
    2,
    0,
    2,
    0,
    2,
    2,
    4,
    2,
    4,
    0,
  ]);
  assertEquals([...vertices.slice(16, 24)], [0, 2, 0, 4, 2, 4, 2, 2]);
  assertEquals([...summary.groupTotals], [4, 2]);
  assertEquals(summary.stackedMaximum, 4);
  assertEquals(summary.byteLength, 12);
  assertEquals(resident.metrics(), {
    inputUploadBytes: 48,
    derivedAllocationBytes: 284,
    dispatches: 2,
    computePasses: 12,
    readbackBytes: 160,
    summaryReadbackBytes: 12,
  });
  resident.destroy();
  device.destroy();
});

Deno.test("resident histogram consumes caller-owned GPU buffers without re-uploading", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const values = new Float32Array([0, 1, 2, 3, 0, 1]);
  const groups = new Uint32Array([0, 0, 0, 0, 1, 1]);
  const usage = 0x0080 | 0x0008;
  const valuesBuffer = device.createBuffer({ size: values.byteLength, usage });
  const groupsBuffer = device.createBuffer({ size: groups.byteLength, usage });
  device.queue.writeBuffer(valuesBuffer, 0, values);
  device.queue.writeBuffer(groupsBuffer, 0, groups);
  const input = {
    values,
    lo: 0,
    hi: 3,
    binwidth: 2,
    groupIds: groups,
    groupsCount: 2,
  };
  const resident = createResidentHistogram1DFromSources(device, {
    values: valuesBuffer,
    rows: values.length,
    groupIds: groupsBuffer,
    lo: input.lo,
    hi: input.hi,
    binwidth: input.binwidth,
    groupsCount: input.groupsCount,
  });

  resident.dispatch();
  assertEquals([...await resident.readback()], [
    ...groupedHistogram1d(input).counts,
  ]);
  assertEquals(resident.metrics().inputUploadBytes, 0);
  resident.destroy();
  valuesBuffer.destroy();
  groupsBuffer.destroy();
  device.destroy();
});

Deno.test("resident histogram positions remain GPU-native for identity, dodge, and fill", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const testDevice = device;
  const values = new Float32Array([0, 0, 0]);
  const groups = new Uint32Array([0, 0, 1]);
  const usage = 0x0080 | 0x0008;
  const valuesBuffer = device.createBuffer({ size: values.byteLength, usage });
  const groupsBuffer = device.createBuffer({ size: groups.byteLength, usage });
  device.queue.writeBuffer(valuesBuffer, 0, values);
  device.queue.writeBuffer(groupsBuffer, 0, groups);

  async function vertices(position: "identity" | "dodge" | "fill") {
    const resident = createResidentHistogram1DFromSources(testDevice, {
      values: valuesBuffer,
      rows: values.length,
      groupIds: groupsBuffer,
      lo: 0,
      hi: 1,
      bins: 1,
      groupsCount: 3,
      position,
    });
    resident.dispatch();
    const result = await resident.readbackBarVertices();
    const tiles = await resident.readbackTileVertices();
    const summary = await resident.readbackSummary();
    resident.destroy();
    return { result, tiles, summary };
  }

  const identity = await vertices("identity");
  const dodge = await vertices("dodge");
  const fill = await vertices("fill");
  assertEquals([...identity.result.slice(0, 16)], [
    0,
    0,
    0,
    2,
    1,
    2,
    1,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    0,
  ]);
  assertEquals([...dodge.result.slice(0, 16)], [
    0,
    0,
    0,
    2,
    0.5,
    2,
    0.5,
    0,
    0.5,
    0,
    0.5,
    1,
    1,
    1,
    1,
    0,
  ]);
  assertEquals(fill.result[1] > 0.66 && fill.result[1] < 0.67, true);
  assertEquals(fill.result[9] > 0.66 && fill.result[9] < 0.67, true);
  assertEquals(fill.result[11], 1);
  assertEquals([...identity.tiles.slice(0, 16)], [
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    0,
    0,
    1,
    0,
    2,
    1,
    2,
    1,
    1,
  ]);
  assertEquals([...identity.tiles.slice(16, 24)], [2, 0, 2, 1, 3, 1, 3, 0]);
  assertEquals(identity.summary.stackedMaximum, 2);
  assertEquals(dodge.summary.stackedMaximum, 2);
  assertEquals(fill.summary.stackedMaximum, 1);
  valuesBuffer.destroy();
  groupsBuffer.destroy();
  device.destroy();
});

Deno.test("resident histogram benchmark reports GPU-only dispatch and render path", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const resident = createResidentHistogram1D(device, {
    values: new Float32Array([0, 1, 2, 3]),
    lo: 0,
    hi: 4,
    bins: 2,
  });

  const report = await benchmarkResidentHistogram(device, resident, {
    drawCount: 1,
    updatePath: "view",
  });

  assertEquals(report.compileAllocationBytes, report.derivedAllocationBytes);
  assertEquals(report.inputUploadBytes, 32);
  assertEquals(report.computePasses, 6);
  assertEquals(report.readbackBytes, 0);
  assertEquals(report.summaryReadbackBytes, 0);
  assertEquals(report.drawCount, 1);
  assertEquals(report.updatePath, "view");
  if (report.dispatchMs < 0) {
    throw new Error("dispatch time must be non-negative");
  }
  resident.destroy();
  device.destroy();
});

Deno.test("resident domain reads finite bounds through an eight-byte summary", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const values = new Float32Array([
    -3,
    Number.NaN,
    2,
    Number.POSITIVE_INFINITY,
    -1,
  ]);
  const buffer = device.createBuffer({
    size: values.byteLength,
    usage: 0x0080 | 0x0008,
  });
  device.queue.writeBuffer(buffer, 0, values);
  const domain = createResidentDomain1D(device, buffer, values.length);

  domain.dispatch();
  assertEquals(await domain.readback(), {
    min: -3,
    max: 2,
    empty: false,
    byteLength: 8,
  });
  domain.destroy();
  buffer.destroy();
  device.destroy();
});

Deno.test("groupedHistogram2dGpu matches CPU counts when WebGPU is available", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const input = {
    x: new Float32Array([0, 1, 2, 3, 0]),
    y: new Float32Array([0, 1, 2, 3, 3]),
    xLo: 0,
    xHi: 4,
    yLo: 0,
    yHi: 4,
    xBins: 2,
    yBins: 2,
    groupIds: new Uint32Array([0, 0, 0, 0, 1]),
    groupsCount: 2,
  };

  const cpu = groupedHistogram2d(input);
  const gpuResult = await groupedHistogram2dGpu(device, input);

  assertEquals([...gpuResult.counts], [...cpu.counts]);
  assertEquals([...gpuResult.totals], [...cpu.totals]);
  assertEquals(gpuResult.backend, "webgpu");
  device.destroy();
});
