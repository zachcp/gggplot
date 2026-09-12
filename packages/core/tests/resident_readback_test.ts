// The readback acceptance predicates and the channel that carries their answers
// (gggplot-vs7.4). These were async polling loops until the resident readbacks
// moved onto Use.GPU's <Readback>; as pure functions over one frame's copy they
// can be pinned directly, which matters because both of them exist to reject a
// state that is indistinguishable from a correct answer by any other means.

import { assertEquals, assertRejects } from "@std/assert";
import {
  decideGridSummary,
  GRID_SUMMARY_PENDING,
} from "../src/runtime/resident_grid_pending.ts";
import { decideDomain } from "../src/runtime/resident_domain_kernel_live.tsx";
import { createReadbackChannel } from "../src/runtime/resident_readback.tsx";

/** A summary buffer's copy: [group totals..., stacked maximum], padded. */
const summaryWords = (
  totals: number[],
  stackedMaximum: number,
): Uint32Array => {
  // The readback pool's buffers are reserved larger than the summary, so a real
  // copy always carries trailing words that are not part of the answer.
  const words = new Uint32Array(16);
  words.set(totals, 0);
  words[totals.length] = stackedMaximum;
  return words;
};

const NON_EMPTY = { groupsCount: 4, expectNonEmpty: true };

Deno.test("a summary still carrying the pending marker is not an answer", () => {
  assertEquals(
    decideGridSummary(
      summaryWords([0, 0, 0, 0], GRID_SUMMARY_PENDING),
      NON_EMPTY,
      false,
    ),
    { status: "wait" },
  );
});

Deno.test("a marker that outlives the frame budget is a failure, not a zero", () => {
  const decision = decideGridSummary(
    summaryWords([0, 0, 0, 0], GRID_SUMMARY_PENDING),
    NON_EMPTY,
    true,
  );
  assertEquals(decision.status, "failed");
});

Deno.test("zero waits while a nonzero summary is still possible", () => {
  // The whole point of the asymmetry: a cleared-but-unsummarized grid reads
  // exactly like an empty one, and accepting it collapses the chart's y-range.
  assertEquals(
    decideGridSummary(summaryWords([0, 0, 0, 0], 0), NON_EMPTY, false),
    { status: "wait" },
  );
  // ...but it is the answer once no better one is coming, or when the grid
  // cannot produce a nonzero summary at all.
  assertEquals(
    decideGridSummary(summaryWords([0, 0, 0, 0], 0), NON_EMPTY, true).status,
    "ready",
  );
  assertEquals(
    decideGridSummary(summaryWords([0, 0, 0, 0], 0), {
      groupsCount: 4,
      expectNonEmpty: false,
    }, false).status,
    "ready",
  );
});

Deno.test("a summary is taken by position, never from the copy's length", () => {
  const decision = decideGridSummary(
    summaryWords([5000, 5000, 5000, 5000], 5000),
    NON_EMPTY,
    false,
  );
  assertEquals(decision.status, "ready");
  if (decision.status !== "ready") return;
  assertEquals(Array.from(decision.value.groupTotals), [
    5000,
    5000,
    5000,
    5000,
  ]);
  assertEquals(decision.value.stackedMaximum, 5000);
  // Five u32 words, not the sixteen the pool's buffer actually holds.
  assertEquals(decision.value.byteLength, 20);
});

const EMPTY_SEED = new Uint32Array([0xffffffff, 0]);
const IRIS_SEPAL_LENGTH = new Uint32Array([3230243226, 3237792973]);

Deno.test("an untouched domain accumulator is not an answer", () => {
  assertEquals(
    decideDomain(new Uint32Array([0, 0]), { expectNonEmpty: true }, false),
    { status: "wait" },
  );
  assertEquals(
    decideDomain(new Uint32Array([0, 0]), { expectNonEmpty: true }, true)
      .status,
    "failed",
  );
});

Deno.test("the domain clear's seed is not accepted as an empty domain", () => {
  // THE REGRESSION THIS EXISTS FOR. The clear pass seeds [0xffffffff, 0], which
  // is bit-identical to a reduction that found no finite value, and each kernel
  // compiles independently — so the clear routinely lands frames before the
  // reduction. Accepting it left the resident tile strip with no bin grid and
  // no chart at all, silently.
  assertEquals(
    decideDomain(EMPTY_SEED, { expectNonEmpty: true }, false),
    { status: "wait" },
  );
  // With no rows to reduce, empty is the immediate right answer.
  const noRows = decideDomain(EMPTY_SEED, { expectNonEmpty: false }, false);
  assertEquals(noRows.status, "ready");
  if (noRows.status === "ready") assertEquals(noRows.value.empty, true);
  // So is it once the budget is spent: every value really was non-finite.
  const spent = decideDomain(EMPTY_SEED, { expectNonEmpty: true }, true);
  assertEquals(spent.status, "ready");
  if (spent.status === "ready") assertEquals(spent.value.empty, true);
});

Deno.test("real accumulator words decode to the column's bounds", () => {
  // Captured off the GPU on the grouped-histogram route: iris sepal length.
  const decision = decideDomain(
    IRIS_SEPAL_LENGTH,
    { expectNonEmpty: true },
    false,
  );
  assertEquals(decision.status, "ready");
  if (decision.status !== "ready") return;
  assertEquals(decision.value.empty, false);
  assertEquals(Math.round(decision.value.min * 10) / 10, 4.3);
  assertEquals(Math.round(decision.value.max * 10) / 10, 7.9);
});

Deno.test("a channel answers only the version its reader asked for", async () => {
  const channel = createReadbackChannel<number>();
  // Nothing is copied back until someone is actually waiting: the tile strip
  // reads no summary, and must cost no readback.
  assertEquals(channel.wanted(7), false);
  const pending = channel.read(7);
  assertEquals(channel.wanted(7), true);
  // An answer for another version neither resolves this read nor satisfies it.
  channel.publish(6, 600);
  assertEquals(channel.wanted(7), true);
  channel.publish(7, 700);
  assertEquals(await pending, 700);
  // Answered: no further copies for this version, and a re-render does not
  // stall waiting for one.
  assertEquals(channel.wanted(7), false);
  assertEquals(await channel.read(7), 700);
  // A newer version starts over rather than inheriting the old answer.
  assertEquals(channel.wanted(8), false);
  const next = channel.read(8);
  assertEquals(channel.wanted(8), true);
  channel.publish(8, 800);
  assertEquals(await next, 800);
});

Deno.test("a failed readback reaches its reader as a rejection", async () => {
  const channel = createReadbackChannel<number>();
  const pending = channel.read(1);
  channel.fail(1, new Error("[gggplot] resident grid summary: never produced"));
  await assertRejects(() => pending, Error, "never produced");
});
