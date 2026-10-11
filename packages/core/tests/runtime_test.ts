import { assertEquals } from "@std/assert";
import { ingest } from "../src/data/mod.ts";
import {
  GPUDataProvider,
  histogramBarChunks,
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
