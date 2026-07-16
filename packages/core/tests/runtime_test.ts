import { assertEquals, assertNotEquals, assertThrows } from "@std/assert";
import { ingest } from "../src/data/mod.ts";
import {
  GPUDataProvider,
  GPUPlotRuntime,
  GPUStreamingSourceAdapter,
  histogramBarChunks,
  histogramRange,
  histogramSourceInput,
  rawArrayForColumn,
} from "../src/runtime/mod.ts";
import type { ProductPlan } from "../src/plan/mod.ts";

const plan: ProductPlan = {
  id: "source",
  kind: "source",
  executor: "gpu",
  inputs: [],
  outputs: [{ name: "x", dtype: "f32", shape: "row", dimensions: ["row"] }],
};

Deno.test("GPUPlotRuntime keeps static source bindings stable across view updates", () => {
  let creates = 0;
  const runtime = new GPUPlotRuntime({
    data: ingest({ x: [1, 2] }),
    sourceFactory: { create: () => ({ id: `source-${++creates}` }) },
  });
  const first = runtime.resolve(plan).gpu.x;
  runtime.updateView();
  const second = runtime.resolve(plan).gpu.x;
  assertEquals(creates, 1);
  assertEquals(second.source, first.source);
});

Deno.test("GPUPlotRuntime rehydrates stable declarations after device loss or data replacement", () => {
  let creates = 0;
  const runtime = new GPUPlotRuntime({
    data: ingest({ x: [1, 2] }),
    sourceFactory: { create: () => ({ id: `source-${++creates}` }) },
  });
  const first = runtime.resolve(plan).gpu.x;
  runtime.deviceLost();
  const afterLoss = runtime.resolve(plan).gpu.x;
  runtime.setData(ingest({ x: [3, 4] }));
  const afterData = runtime.resolve(plan).gpu.x;
  assertEquals(creates, 3);
  assertNotEquals(first.source, afterLoss.source);
  assertNotEquals(afterLoss.contentVersion, afterData.contentVersion);
});

Deno.test("RawData lowering caches typed columns and preserves GPU-friendly formats", () => {
  const frame = ingest({ x: [1, null, 3], group: ["b", "a"] });
  const numeric = rawArrayForColumn(frame.x);
  assertEquals([...numeric], [1, Number.NaN, 3]);
  assertEquals(rawArrayForColumn(frame.x), numeric);
  assertEquals([...rawArrayForColumn(frame.group)], [0, 1]);
});

Deno.test("streaming sources write declared ranges, retain capacity, and rehydrate", () => {
  const writes: { offset: number; bytes: number }[] = [];
  const buffers: { destroyed: boolean }[] = [];
  const device = {
    createBuffer: () => {
      const buffer = {
        destroyed: false,
        destroy() {
          buffer.destroyed = true;
        },
      };
      buffers.push(buffer);
      return buffer;
    },
    queue: {
      writeBuffer: (
        _buffer: unknown,
        offset: number,
        data: ArrayBufferView,
      ) => {
        writes.push({ offset, bytes: data.byteLength });
      },
    },
  } as unknown as GPUDevice;
  const field = plan.outputs[0];
  const adapter = new GPUStreamingSourceAdapter(device);

  const initial = adapter.update(field, ingest({ x: [1, 2, 3] }).x);
  const changed = adapter.update(field, ingest({ x: [1, 20, 3] }).x, {
    start: 1,
    length: 1,
  });
  const appended = adapter.update(field, ingest({ x: [1, 20, 3, 4] }).x, {
    start: 3,
    length: 1,
  });
  const grown = adapter.update(field, ingest({ x: [1, 20, 3, 4, 5] }).x, {
    start: 4,
    length: 1,
  });

  assertEquals(initial.capacity, 4);
  assertEquals(changed.length, 3);
  assertEquals(appended.length, 4);
  assertEquals(grown.capacity, 8);
  assertEquals(writes, [
    { offset: 0, bytes: 12 },
    { offset: 4, bytes: 4 },
    { offset: 12, bytes: 4 },
    { offset: 0, bytes: 20 },
  ]);

  adapter.deviceLost();
  const rehydrated = adapter.rehydrate("x");
  assertNotEquals(rehydrated.buffer, initial.buffer);
  assertEquals(rehydrated.length, 5);
  assertEquals(writes.at(-1), { offset: 0, bytes: 20 });
  assertEquals(buffers[0].destroyed, true);
  adapter.destroy();
});

Deno.test("GPUDataProvider reports incompatible semantic fields before mounting", () => {
  const data = ingest({ x: [1, 2] });
  const failure = () =>
    GPUDataProvider({
      data,
      fields: [{ name: "x", dtype: "u32", shape: "row", dimensions: ["row"] }],
      children: () => null as never,
    });
  let message = "";
  try {
    failure();
  } catch (error) {
    message = (error as Error).message;
  }
  assertEquals(message, "Cannot mount x: u32 does not match numeric column");
});

Deno.test("histogramSourceInput retains mounted storage buffers", () => {
  const x = {
    buffer: {} as GPUBuffer,
    format: "f32",
    length: 4,
    size: [4],
    version: 1,
  };
  const group = {
    buffer: {} as GPUBuffer,
    format: "u32",
    length: 4,
    size: [4],
    version: 1,
  };
  const input = histogramSourceInput(x, group, {
    lo: 0,
    hi: 4,
    bins: 2,
    groupsCount: 2,
  });

  assertEquals(input.values, x.buffer);
  assertEquals(input.groupIds, group.buffer);
  assertEquals(input.rows, 4);
});

Deno.test("histogramBarChunks creates fixed topology without count rows", () => {
  assertEquals(
    histogramBarChunks({
      counts: {} as never,
      barVertices: {} as never,
      tileVertices: {} as never,
      summary: {} as never,
      bins: 3,
      groupsCount: 2,
      readSummary: async () => ({
        groupTotals: new Uint32Array(),
        stackedMaximum: 0,
        byteLength: 0,
      }),
    }),
    [4, 4, 4, 4, 4, 4],
  );
});

Deno.test("grouped mounted histograms require a declared grid shape", () => {
  const x = {
    buffer: {} as GPUBuffer,
    format: "f32",
    length: 2,
    size: [2],
    version: 1,
  };
  const group = {
    buffer: {} as GPUBuffer,
    format: "u32",
    length: 2,
    size: [2],
    version: 1,
  };
  assertThrows(
    () => histogramSourceInput(x, group, { lo: 0, hi: 1, bins: 1 }),
    Error,
    "require an explicit groupsCount",
  );
});

Deno.test("histogramRange gives a non-empty Cartesian domain for constant data", () => {
  assertEquals(histogramRange(2, 2), [1.5, 2.5]);
  assertEquals(histogramRange(-1, 3), [-1, 3]);
});
