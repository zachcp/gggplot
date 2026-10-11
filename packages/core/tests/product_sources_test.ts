// gggplot-y43: a resident product under <GGData> reads the data tier's
// mounted columns when it plots that very frame, instead of uploading copies.
import { assert, assertEquals } from "@std/assert";
import { sharedSources } from "../src/runtime/product_host.tsx";
import type { GGDataValue } from "../src/components/gg_data.ts";
import { ingest } from "../src/data/mod.ts";
import type { GPUStorageSource } from "../src/runtime/types.ts";

const frame = ingest({ x: [1, 2], g: ["a", "b"] });
const source = (format: string) =>
  ({ format, length: 2, size: [2], version: 1 }) as unknown as GPUStorageSource;
const shared: GGDataValue = {
  frame,
  columns: {
    x: { source: source("f32"), version: 0, dtype: "f32" },
    g: { source: source("u32"), version: 0, dtype: "u32" },
  },
};

Deno.test("the data tier's sources serve its own frame", () => {
  const sources = sharedSources(shared, frame, ["x", "g"]);
  assert(sources);
  assert(sources.x === shared.columns.x.source);
  assert(sources.g === shared.columns.g.source);
});

Deno.test("any other frame mounts its own columns", () => {
  // A censored or layer-level frame is a different object: its rows differ.
  assertEquals(
    sharedSources(shared, ingest({ x: [1], g: ["a"] }), ["x"]),
    null,
  );
  assertEquals(sharedSources(null, frame, ["x"]), null);
  // A column the data tier did not mount.
  assertEquals(sharedSources(shared, frame, ["x", "missing"]), null);
});
