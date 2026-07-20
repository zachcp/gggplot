import { assertEquals } from "@std/assert";
import {
  asFactor,
  asNumeric,
  factorIds,
  factorLevelsFor,
  ingest,
  numericBuffer,
  numericColumnValues,
  sliceTypedDataFrame,
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

Deno.test("sliceTypedDataFrame preserves factor levels and declared order", () => {
  const typed = ingest({
    cyl: [4, 6, 8, 4],
  }, {
    columns: { cyl: asFactor(["8", "6", "4"]) },
  });
  const sliced = sliceTypedDataFrame(typed, [0, 2]);

  assertEquals(sliced.cyl.values, ["4", "8"]);
  assertEquals(factorLevelsFor(sliced, "cyl"), ["8", "6", "4"]);
  assertEquals(sliced.cyl.type, "factor");
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

Deno.test("numericColumnValues coerces numeric-string factor columns", () => {
  // A factor column of numeric strings (no asNumeric override) still yields
  // numbers for position math, with unparseable entries as null.
  const typed = ingest({ x: ["1", "bad", "3"] }, {
    columns: { x: asFactor() },
  });

  assertEquals(numericColumnValues(typed, "x"), [1, null, 3]);
});
