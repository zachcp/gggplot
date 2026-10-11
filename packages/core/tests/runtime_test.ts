import { assertEquals, assertThrows } from "@std/assert";
import { ingest } from "../src/data/mod.ts";
import {
  GPUDataProvider,
  histogramBarChunks,
  histogramRange,
  histogramSourceInput,
  rawArrayForColumn,
} from "../src/runtime/mod.ts";

Deno.test("RawData lowering caches typed columns and preserves GPU-friendly formats", () => {
  const frame = ingest({ x: [1, null, 3], group: ["b", "a"] });
  const numeric = rawArrayForColumn(frame.x);
  assertEquals([...numeric], [1, Number.NaN, 3]);
  assertEquals(rawArrayForColumn(frame.x), numeric);
  assertEquals([...rawArrayForColumn(frame.group)], [0, 1]);
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
      version: 1,
      bins: 3,
      groupsCount: 2,
      rows: 6,
      alive: () => true,
      // deno-lint-ignore require-await -- stubs an async reader.
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
