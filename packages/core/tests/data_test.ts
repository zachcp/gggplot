import { assertEquals } from "@std/assert";
import {
  asFactor,
  asNumeric,
  columnMetadata,
  dataFrameMetadata,
  factorIds,
  factorLevelsFor,
  ingest,
  legacyDataFrame,
  numericBuffer,
  numericColumnValues,
  sliceLegacyDataFrame,
} from "../src/data/mod.ts";

Deno.test("ingest accepts column-store data and infers numeric/factor columns", () => {
  const data = ingest({
    x: [1, 2, 3],
    group: ["a", "b", "a"],
  });

  assertEquals(data.x, { type: "numeric", values: [1, 2, 3] });
  assertEquals(data.group, {
    type: "factor",
    values: ["a", "b", "a"],
    levels: ["a", "b"],
  });
});

Deno.test("ingest accepts row-store data and preserves first-seen columns", () => {
  const data = ingest([
    { x: 1, group: "a" },
    { x: 2, group: "b", extra: "yes" },
    { x: 3, group: "a" },
  ]);

  assertEquals(Object.keys(data), ["x", "group", "extra"]);
  assertEquals(data.x, { type: "numeric", values: [1, 2, 3] });
  assertEquals(data.extra, {
    type: "factor",
    values: [null, "yes", null],
    levels: ["yes"],
  });
});

Deno.test("ingest supports asFactor override for numeric-coded categories", () => {
  const data = ingest({
    cyl: [4, 6, 8, 4],
  }, {
    columns: { cyl: asFactor(["8", "6", "4"]) },
  });

  assertEquals(data.cyl, {
    type: "factor",
    values: ["4", "6", "8", "4"],
    levels: ["8", "6", "4"],
  });
});

Deno.test("ingest supports asNumeric override for numeric strings", () => {
  const data = ingest({
    mpg: ["21", "22.5", "", "nope"],
  }, {
    columns: { mpg: asNumeric() },
  });

  assertEquals(data.mpg, {
    type: "numeric",
    values: [21, 22.5, null, null],
  });
});

Deno.test("legacyDataFrame materializes typed columns for current pipeline", () => {
  const typed = ingest({
    x: [1, null, 3],
    g: ["a", "b", null],
  });

  assertEquals(legacyDataFrame(typed), {
    x: [1, null, 3],
    g: ["a", "b", null],
  });
});

Deno.test("legacyDataFrame preserves typed metadata as a transitional sidecar", () => {
  const typed = ingest({
    cyl: [4, 6, 8],
  }, {
    columns: { cyl: asFactor(["8", "6", "4"]) },
  });
  const legacy = legacyDataFrame(typed);

  assertEquals(dataFrameMetadata(legacy), typed);
  assertEquals(columnMetadata(legacy, "cyl")?.type, "factor");
  assertEquals(factorLevelsFor(legacy, "cyl"), ["8", "6", "4"]);
});

Deno.test("sliceLegacyDataFrame preserves typed metadata", () => {
  const typed = ingest({
    cyl: [4, 6, 8, 4],
  }, {
    columns: { cyl: asFactor(["8", "6", "4"]) },
  });
  const sliced = sliceLegacyDataFrame(legacyDataFrame(typed), [0, 2]);

  assertEquals(sliced.cyl, ["4", "8"]);
  assertEquals(factorLevelsFor(sliced, "cyl"), ["8", "6", "4"]);
  assertEquals(columnMetadata(sliced, "cyl")?.type, "factor");
});

Deno.test("factorIds and numericBuffer lower typed columns to GPU-friendly buffers", () => {
  const data = ingest({
    x: [1, null, 3],
    g: ["b", "a", null],
  }, {
    columns: { g: asFactor(["a", "b"]) },
  });

  assertEquals([
    ...factorIds(data.g as Extract<typeof data.g, { type: "factor" }>),
  ], [
    1,
    0,
    0xffffffff,
  ]);
  assertEquals([
    ...numericBuffer(data.x as Extract<typeof data.x, { type: "numeric" }>),
  ], [
    1,
    Number.NaN,
    3,
  ]);
});

Deno.test("numericColumnValues reads typed numeric metadata before legacy arrays", () => {
  const legacy = legacyDataFrame(ingest({
    x: ["1", "bad", "3"],
  }, {
    columns: { x: asNumeric() },
  }));

  assertEquals(numericColumnValues(legacy, "x"), [1, null, 3]);
});
