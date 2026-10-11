// gggplot-lbk: <GGData> mounts each column once, as its own keyed fiber.
import { assert, assertEquals } from "@std/assert";
import { ingest, touchColumn, typedArrayForColumn } from "../src/data/mod.ts";
import {
  GGData,
  GGDataContext,
  type GGDataValue,
} from "../src/components/gg_data.ts";
import { createResidentColumn } from "../src/runtime/column_loader.ts";
import { createElement, useContext } from "../src/runtime/usegpu_compat.ts";
import type { MountedDataFrame } from "../src/runtime/types.ts";
import { liveGpuHarness, requestTestDevice } from "./support/live_gpu.ts";

/** Renders <GGData> with a probe child that records the provided value. */
function mount(harness: ReturnType<typeof liveGpuHarness>) {
  const seen: { value: GGDataValue | null } = { value: null };
  const Probe = () => {
    seen.value = useContext<GGDataValue | null>(GGDataContext);
    return null;
  };
  return {
    seen,
    render: (data: MountedDataFrame) =>
      harness.render(createElement(GGData, { data }, createElement(Probe))),
  };
}

Deno.test("GGData uploads each column once and provides it", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const harness = liveGpuHarness(device);
  const { seen, render } = mount(harness);
  const frame = ingest({ x: [1, 2, 3], g: ["a", "b", "a"] });
  render(frame);
  assertEquals(harness.writes.length, 2);
  assertEquals(Object.keys(seen.value!.columns).sort(), ["g", "x"]);
  assertEquals(seen.value!.columns.x.dtype, "f32");
  assertEquals(seen.value!.columns.g.dtype, "u32");
  assertEquals(seen.value!.columns.x.source.length, 3);
  harness.writes.length = 0;
  render(frame);
  assertEquals(harness.writes.length, 0, "a re-render uploads nothing");
  device.destroy();
});

Deno.test("a resident column mounts with zero uploads", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const resident = createResidentColumn(device, new Float32Array([1, 2, 3]));
  const harness = liveGpuHarness(device);
  const { seen, render } = mount(harness);
  render({ r: resident });
  assertEquals(harness.writes.length, 0);
  assert(seen.value!.columns.r.source === resident.source, "passed through");
  device.destroy();
});

Deno.test("a late column mounts only itself; a touched column re-uploads only itself", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const harness = liveGpuHarness(device);
  const { seen, render } = mount(harness);
  const base = ingest({ x: [1, 2, 3], y: [4, 5, 6] });
  render({ x: base.x });
  const xSource = seen.value!.columns.x.source;
  const xVersion = xSource.version;

  harness.writes.length = 0;
  render({ x: base.x, y: base.y });
  assertEquals(harness.writes.length, 1, "only y uploads");
  assertEquals(harness.writes[0], typedArrayForColumn(base.y).buffer);
  assert(seen.value!.columns.x.source === xSource, "x is not remounted");
  assertEquals(seen.value!.columns.x.source.version, xVersion);

  harness.writes.length = 0;
  base.y.values[0] = 40;
  touchColumn(base.y);
  render({ x: base.x, y: base.y });
  assertEquals(harness.writes.length, 1, "only y re-uploads");
  assertEquals(seen.value!.columns.y.version, 1);
  assertEquals(seen.value!.columns.x.source.version, xVersion);
  device.destroy();
});
