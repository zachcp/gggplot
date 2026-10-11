// gggplot-wkc: marks and guides render the same generation of an async GPU
// domain; pending contributions never train as empty; only an explicit,
// guide-free opt-in binds a live domain slot.
import { assert, assertEquals } from "@std/assert";
import * as reductions from "@gggplot/reductions";
import type { KernelSpec } from "@gggplot/reductions";
import {
  dispatchVersion,
  type Generation,
  LIVE_DOMAIN_KERNELS,
  stamped,
  viewGeneration,
} from "../src/runtime/generation_gate.ts";
import {
  assembleRoot,
  createRootCaches,
  plotSpec,
} from "../src/components/root_assembly.ts";
import { layerFromProps } from "../src/components/geom_layer.ts";
import { GeomPoint } from "../src/components/geoms.ts";
import { componentProbe } from "../src/components/probe.ts";
import { buildFacetPanels } from "../src/compile/mod.ts";
import { ingest } from "../src/data/mod.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";

interface Summary {
  stackedMaximum: number;
}

Deno.test("version skew: stale summaries size guides, never live marks", () => {
  // A resident bar view across a data bump, as useAwait sequences it: the
  // product redispatches at version 2 at once, while the summary sizing its
  // y range is still version 1's until the readback for 2 lands.
  const v1: Generation<Summary> = { version: 1, value: { stackedMaximum: 40 } };
  const v2: Generation<Summary> = { version: 2, value: { stackedMaximum: 90 } };

  assertEquals(viewGeneration(null, 1), { domain: null, drawMarks: false });
  assertEquals(viewGeneration(v1, 1), { domain: v1.value, drawMarks: true });
  // The skew case: marks at 2 inside a range sized for 1. Guides keep the
  // previous domain; marks wait.
  assertEquals(viewGeneration(v1, 2), { domain: v1.value, drawMarks: false });
  assertEquals(viewGeneration(v2, 2), { domain: v2.value, drawMarks: true });
});

Deno.test("a stamped read carries the version it was asked for", async () => {
  const reads: number[] = [];
  const read = stamped(7, (version) => {
    reads.push(version);
    return Promise.resolve({ stackedMaximum: version * 10 });
  });
  assertEquals(await read(), { version: 7, value: { stackedMaximum: 70 } });
  assertEquals(reads, [7]);
});

Deno.test("a sized grid holds its generation until its sizing is current", () => {
  // First mount: nothing earlier to hold.
  assertEquals(dispatchVersion(null, 1, false), 1);
  // Bounds for 1 are in: dispatch 1.
  assertEquals(dispatchVersion(1, 1, true), 1);
  // Data bumped to 2, bounds still 1's: hold 1, so new rows are never
  // binned into the previous bounds.
  assertEquals(dispatchVersion(1, 2, false), 1);
  // Bounds for 2 land: dispatch 2.
  assertEquals(dispatchVersion(1, 2, true), 2);
});

Deno.test("vs7 trap 2: a pending layer trains nothing", () => {
  const data = ingest({ x: [1, 2, 3], y: [3, 1, 2] });
  const base = plotSpec(data, { x: "x", y: "y" }, undefined, undefined, []);
  const layer = layerFromProps(GeomPoint.layerProps({}));
  const panels = buildFacetPanels(base.facet, base.data, base.labels);
  const layout = {
    width: 640,
    height: 400,
    measureText: approximateTextMeasurer,
  };
  const caches = createRootCaches();
  componentProbe.reset();
  // One layer reported, a second still waiting on its GPU summary: training
  // now would treat the second's contribution as empty.
  const pending = assembleRoot(
    base,
    [
      { kind: "layer", id: 1, layer },
      { kind: "layer", id: 2, layer, pending: true },
    ],
    panels,
    layout,
    caches,
  );
  assertEquals(pending, null);
  assertEquals(componentProbe.assembleCalls, 0);
  assertEquals(componentProbe.statCalls, 0);
  const ready = assembleRoot(
    base,
    [
      { kind: "layer", id: 1, layer },
      { kind: "layer", id: 2, layer },
    ],
    panels,
    layout,
    caches,
  );
  assert(ready, "assembles once every layer has reported");
  assertEquals(componentProbe.assembleCalls, 1);
});

/** Every kernel the reductions package exports. */
const kernels = Object.values(reductions).filter((value): value is KernelSpec =>
  !!value && typeof value === "object" && "body" in value && "id" in value &&
  "reads" in value
);

Deno.test("only opted-in kernels bind a live domain slot", () => {
  assert(kernels.length > 0);
  // A grid summary holds per-group totals then the domain (its maximum) at
  // index `groups`. Totals are layout (dodge slots, fill normalization); the
  // domain is what guides show, so binding it live is the opt-in.
  const readsDomain = kernels
    .filter((kernel) => String(kernel.body).includes("getSummary(getGroups())"))
    .map((kernel) => kernel.id)
    .sort();
  assertEquals(readsDomain, [...LIVE_DOMAIN_KERNELS].sort());
});

Deno.test("the tile heatmap's view reads no readback", async () => {
  // The opt-in's condition: no guide reads the live domain, so the tile strip
  // view awaits nothing at all.
  const source = await Deno.readTextFile(
    new URL("../src/runtime/resident_tile_view.tsx", import.meta.url),
  );
  const code = source.split("\n").filter((line) =>
    !line.trim().startsWith("//") && !line.trim().startsWith("*")
  ).join("\n");
  assertEquals(code.includes("readSummary("), false);
  assertEquals(code.includes("useAwait("), false);
});
