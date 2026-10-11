// gggplot-fbq: the root's GPU refs keep their identity across retrains, so a
// bound shader re-reads them with no relink.
import { assert, assertEquals, assertStrictEquals } from "@std/assert";
import {
  createScaleBindingRefs,
  isGpuBindable,
  updateScaleBindingRefs,
} from "../src/render/scale_bindings.ts";
import { VIRIDIS_RAMP } from "../src/scale/palette.ts";
import type { TrainedScale } from "../src/scale/types.ts";

const color = (domain: [number, number], range?: string[]): TrainedScale => ({
  aes: "color",
  kind: "continuous",
  domain,
  ...(range ? { range } : {}),
});

Deno.test("only continuous numeric scales bind", () => {
  assert(isGpuBindable(color([0, 1])));
  assert(!isGpuBindable({ aes: "color", kind: "discrete", domain: ["a"] }));
  assert(!isGpuBindable(undefined));
});

Deno.test("updates write domains and ranges in place", () => {
  const refs = createScaleBindingRefs();
  const domainRef = refs.color.domain;
  const sizeRange = refs.size.range;
  updateScaleBindingRefs(refs, {
    color: color([2, 9]),
    size: { aes: "size", kind: "continuous", domain: [1, 4], range: [3, 12] },
  });
  assertStrictEquals(refs.color.domain, domainRef, "same ref object");
  assertEquals(refs.color.domain.current, [2, 9]);
  assertStrictEquals(refs.size.range, sizeRange);
  assertEquals(refs.size.range.current, [3, 12]);
  // A discrete scale leaves the refs alone.
  updateScaleBindingRefs(refs, {
    color: { aes: "color", kind: "discrete", domain: ["a"] },
  });
  assertEquals(refs.color.domain.current, [2, 9]);
});

Deno.test("a new ramp replaces the palette and its key; the same ramp keeps both", () => {
  const refs = createScaleBindingRefs();
  const palette = refs.color.palette;
  updateScaleBindingRefs(refs, { color: color([0, 1]) });
  assertStrictEquals(refs.color.palette, palette, "default ramp unchanged");
  updateScaleBindingRefs(refs, { color: color([0, 1], [...VIRIDIS_RAMP]) });
  assert(refs.color.palette !== palette);
  assertEquals(refs.color.palette.length, VIRIDIS_RAMP.length * 4);
  assertEquals(refs.color.paletteKey, VIRIDIS_RAMP.join(","));
});
