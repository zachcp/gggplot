// gggplot-67c: a column's version is the one "this changed" signal. Mutating a
// column in place and calling touchColumn re-uploads exactly that column, and
// nothing else, through the mounted GPUDataProvider. Runs a real headless Live
// tree on a WebGPU device when one is available.
import { assert, assertEquals } from "@std/assert";
import {
  columnVersion,
  ingest,
  touchColumn,
  typedArrayForColumn,
} from "../src/data/mod.ts";
import { GPUDataProvider } from "../src/runtime/live.tsx";
import { createElement } from "../src/runtime/usegpu_compat.ts";
import { liveGpuHarness, requestTestDevice } from "./support/live_gpu.ts";
import type { FieldSpec } from "../src/plan/mod.ts";
import type { GPUStorageSource } from "../src/runtime/types.ts";

Deno.test("touchColumn bumps the version and refreshes the typed view", () => {
  const frame = ingest({ x: [1, 2, 3] });
  const before = typedArrayForColumn(frame.x);
  assertEquals(columnVersion(frame.x), 0);
  assert(typedArrayForColumn(frame.x) === before, "cached by identity");
  frame.x.values[0] = 10;
  assertEquals(touchColumn(frame.x), 1);
  const after = typedArrayForColumn(frame.x);
  assert(after !== before, "a touched column gets a fresh typed array");
  assertEquals(after[0], 10);
});

Deno.test("a touched column re-uploads once, and no other column does", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const harness = liveGpuHarness(device);
  const writes = harness.writes;

  const frame = ingest({ x: [1, 2, 3], y: [4, 5, 6] });
  const fields = [
    { name: "x", dtype: "f32" },
    { name: "y", dtype: "f32" },
  ] as FieldSpec[];
  let sources: Record<string, GPUStorageSource> = {};
  const tree = () =>
    createElement(GPUDataProvider, {
      data: frame,
      fields,
      children: (mounted: Record<string, GPUStorageSource>) => {
        sources = mounted;
        return null;
      },
    });

  harness.render(tree());
  assertEquals(writes.length, 2, "x and y each upload once at mount");
  const xVersion = sources.x.version;
  const yVersion = sources.y.version;

  // A re-render with nothing touched uploads nothing.
  writes.length = 0;
  harness.render(tree());
  assertEquals(writes.length, 0);

  // Mutate x in place and declare it.
  frame.x.values[1] = 20;
  touchColumn(frame.x);
  harness.render(tree());
  assertEquals(writes.length, 1, "exactly one re-upload");
  assertEquals(writes[0], typedArrayForColumn(frame.x).buffer);
  assert(sources.x.version > xVersion, "x's source version moved");
  assertEquals(sources.y.version, yVersion, "y's source did not");
  device.destroy();
});
