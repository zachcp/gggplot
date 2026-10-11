// gggplot-euh: the product generation lifecycle, replaying vs7 traps 1-2.
import { assert, assertEquals } from "@std/assert";
import { ProductGeneration } from "../src/runtime/product_generation.ts";
import {
  decideGridSummary,
  GRID_SUMMARY_PENDING,
  type GridSummary,
} from "../src/runtime/resident_grid_pending.ts";
import { decideDomain } from "../src/runtime/resident_domain_kernel_live.tsx";
import type { ResidentDomain1DResult } from "@gggplot/reductions";

const grid = (words: number[], exhausted = false) =>
  decideGridSummary(
    Uint32Array.from(words),
    { groupsCount: 2, expectNonEmpty: true },
    exhausted,
  );

Deno.test("trap 1: a pass having run is not readiness", () => {
  const generation = new ProductGeneration<GridSummary>();
  assert(generation.begin(1), "a new version arms");
  assert(!generation.begin(1), "the same version does not re-arm");
  // Marker intact: the summary clear has not run.
  generation.offer(1, grid([0, 0, GRID_SUMMARY_PENDING]));
  // Cleared but not summarized: the small clear compiled frames before the
  // accumulation. Bit-identical to an empty grid, so it must not be accepted.
  generation.offer(1, grid([0, 0, 0]));
  assertEquals(generation.phase, "pending");
  // The complete chain.
  assert(generation.offer(1, grid([4, 6, 4])));
  assertEquals(generation.phase, "ready");
  assertEquals(generation.value?.stackedMaximum, 4);
});

Deno.test("trap 2: a cleared domain seed is not an empty domain", () => {
  const generation = new ProductGeneration<ResidentDomain1DResult>();
  generation.begin(3);
  const seed = Uint32Array.of(0xffffffff, 0);
  generation.offer(3, decideDomain(seed, { expectNonEmpty: true }, false));
  assertEquals(generation.phase, "pending", "the seed waits");
  // Truly empty data still resolves, once the budget says no better answer.
  generation.offer(3, decideDomain(seed, { expectNonEmpty: true }, true));
  assertEquals(generation.phase, "ready");
  assert(generation.value?.empty);
});

Deno.test("a new version invalidates the old answer", () => {
  const generation = new ProductGeneration<GridSummary>();
  generation.begin(1);
  generation.begin(2);
  // A late copy of version 1 must not answer version 2.
  assert(!generation.offer(1, grid([4, 6, 4])));
  assertEquals(generation.phase, "pending");
  assert(generation.offer(2, grid([1, 1, 1])));
  assertEquals(generation.value?.stackedMaximum, 1);
});

Deno.test("an exhausted budget with the marker intact fails loudly", () => {
  const generation = new ProductGeneration<GridSummary>();
  generation.begin(1);
  generation.offer(1, grid([0, 0, GRID_SUMMARY_PENDING], true));
  assertEquals(generation.phase, "failed");
  assert(generation.reason?.includes("never produced"));
});

Deno.test("disposal stops every further copy", () => {
  const generation = new ProductGeneration<GridSummary>();
  generation.begin(1);
  generation.dispose();
  assert(!generation.alive());
  assert(!generation.offer(1, grid([4, 6, 4])));
  assert(!generation.begin(2), "a disposed product never re-arms");
  assertEquals(generation.value, undefined);
});
