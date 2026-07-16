import { assertAlmostEquals, assertEquals, assertThrows } from "@std/assert";
import {
  createGroupedHistogram1dPlan,
  createGroupedHistogram2dPlan,
  groupedBoxplot1d,
  groupedCount1d,
  groupedDensity1d,
  groupedHistogram1d,
  groupedHistogram2d,
  groupedLinearRegression1d,
  groupedSummary1d,
} from "../src/mod.ts";

Deno.test("groupedCount1d counts value ids by group id", () => {
  const result = groupedCount1d({
    valueIds: new Uint32Array([0, 1, 0, 1, 1]),
    valuesCount: 2,
    groupIds: new Uint32Array([0, 0, 1, 1, 1]),
    groupsCount: 2,
  });

  assertEquals([...result.counts], [1, 1, 1, 2]);
  assertEquals(result.shape, [2, 2]);
});

Deno.test("groupedCount1d infers one group and keeps empty value columns", () => {
  const result = groupedCount1d({
    valueIds: new Uint32Array([2, 0, 2]),
    valuesCount: 4,
  });

  assertEquals(result.groupsCount, 1);
  assertEquals(result.valuesCount, 4);
  assertEquals([...result.counts], [1, 0, 2, 0]);
});

Deno.test("groupedCount1d ignores out-of-range value and group ids", () => {
  const result = groupedCount1d({
    valueIds: new Uint32Array([0, 1, 3, 1]),
    valuesCount: 2,
    groupIds: new Uint32Array([0, 1, 1, 4]),
    groupsCount: 2,
  });

  assertEquals([...result.counts], [1, 0, 0, 1]);
});

Deno.test("groupedCount1d validates group id alignment", () => {
  assertThrows(
    () =>
      groupedCount1d({
        valueIds: new Uint32Array([0, 1]),
        valuesCount: 2,
        groupIds: new Uint32Array([0]),
      }),
    Error,
    "groupIds length 1 does not match values length 2",
  );
});

Deno.test("groupedCount1d preserves explicit empty group shape", () => {
  const result = groupedCount1d({
    valueIds: new Uint32Array(),
    valuesCount: 3,
    groupsCount: 2,
  });

  assertEquals(result.shape, [2, 3]);
  assertEquals([...result.counts], [0, 0, 0, 0, 0, 0]);
});

Deno.test("groupedHistogram1d bins numeric values by group id", () => {
  const result = groupedHistogram1d({
    values: new Float32Array([0, 1, 2, 3, 0, 1]),
    lo: 0,
    hi: 3,
    binwidth: 2,
    groupIds: new Uint32Array([0, 0, 0, 0, 1, 1]),
    groupsCount: 2,
  });

  assertEquals([...result.centers], [1, 3]);
  assertEquals([...result.counts], [2, 2, 2, 0]);
  assertEquals([...result.totals], [4, 2]);
  assertEquals([...result.density], [0.25, 0.25, 0.5, 0]);
});

Deno.test("groupedHistogram1d resolves bins from bounds when binwidth is absent", () => {
  const result = groupedHistogram1d({
    values: new Float32Array([0, 1, 2, 3]),
    lo: 0,
    hi: 4,
    bins: 4,
  });

  assertEquals(result.bins, 4);
  assertEquals(result.binwidth, 1);
  assertEquals([...result.centers], [0.5, 1.5, 2.5, 3.5]);
  assertEquals([...result.counts], [1, 1, 1, 1]);
});

Deno.test("groupedHistogram1d clamps finite out-of-range values into edge bins", () => {
  const result = groupedHistogram1d({
    values: new Float32Array([-10, 0, 1, 2, 20]),
    lo: 0,
    hi: 2,
    bins: 2,
  });

  assertEquals([...result.counts], [2, 3]);
  assertEquals([...result.totals], [5]);
});

Deno.test("groupedHistogram1d skips non-finite values and normalizes density by group totals", () => {
  const result = groupedHistogram1d({
    values: new Float32Array([0, Number.NaN, 1, Number.POSITIVE_INFINITY, 2]),
    lo: 0,
    hi: 3,
    bins: 3,
    groupIds: new Uint32Array([0, 0, 0, 0, 1]),
    groupsCount: 2,
  });

  assertEquals([...result.counts], [1, 1, 0, 0, 0, 1]);
  assertEquals([...result.totals], [2, 1]);
  assertAlmostEquals(result.density[0], 0.5);
  assertAlmostEquals(result.density[1], 0.5);
  assertAlmostEquals(result.density[5], 1);
});

Deno.test("groupedHistogram1d keeps explicit empty group/bin shape", () => {
  const result = groupedHistogram1d({
    values: new Float32Array(),
    lo: 0,
    hi: 1,
    bins: 3,
    groupsCount: 2,
  });

  assertEquals(result.shape, [2, 3]);
  assertEquals([...result.counts], [0, 0, 0, 0, 0, 0]);
  assertEquals([...result.totals], [0, 0]);
  assertEquals([...result.density], [0, 0, 0, 0, 0, 0]);
});

Deno.test("createGroupedHistogram1dPlan exposes kernel source and dispatch sizing", () => {
  const plan = createGroupedHistogram1dPlan({
    values: new Float32Array(130),
    bins: 8,
    groupsCount: 3,
  });

  assertEquals(plan.dispatchSize, 3);
  assertEquals(plan.countsLength, 24);
  assertEquals(plan.shaders.groupedHistogram1D.includes("atomicAdd"), true);
  assertEquals(
    plan.shaders.histogramBarVertices?.includes("vertices[offset]"),
    true,
  );
  assertEquals(plan.shaders.histogramSummary?.includes("stacked"), true);
});

Deno.test("createGroupedHistogram1dPlan uses default shape for empty input", () => {
  const plan = createGroupedHistogram1dPlan({
    values: new Float32Array(),
  });

  assertEquals(plan.dispatchSize, 0);
  assertEquals(plan.countsLength, 30);
  assertEquals(plan.workgroupSize, 64);
  assertEquals(plan.shaders.clearU32.includes("values[i] = 0u"), true);
});

Deno.test("groupedSummary1d computes built-in summaries by group and x id", () => {
  const result = groupedSummary1d({
    xIds: new Uint32Array([0, 0, 1, 1, 1, 0]),
    xCount: 2,
    values: new Float64Array([2, 4, 10, 30, Number.NaN, 8]),
    groupIds: new Uint32Array([0, 0, 0, 1, 1, 1]),
    groupsCount: 2,
  });

  assertEquals(result.shape, [2, 2]);
  assertEquals([...result.counts], [2, 1, 1, 1]);
  assertEquals([...result.sums], [6, 10, 8, 30]);
  assertEquals([...result.means], [3, 10, 8, 30]);
  assertEquals([...result.medians], [3, 10, 8, 30]);
  assertEquals([...result.mins], [2, 10, 8, 30]);
  assertEquals([...result.maxs], [4, 10, 8, 30]);
});

Deno.test("groupedSummary1d reports NaN summaries for observed cells with no finite values", () => {
  const result = groupedSummary1d({
    xIds: new Uint32Array([0]),
    xCount: 2,
    values: new Float64Array([Number.NaN]),
  });

  assertEquals(result.counts[0], 0);
  assertEquals(Number.isNaN(result.means[0]), true);
  assertEquals(Number.isNaN(result.medians[0]), true);
  assertEquals(Number.isNaN(result.mins[1]), true);
});

Deno.test("groupedSummary1d can skip median lists for streaming summaries", () => {
  const result = groupedSummary1d({
    xIds: new Uint32Array([0, 0, 0]),
    xCount: 1,
    values: new Float64Array([10, 20, 30]),
    includeMedian: false,
  });

  assertEquals(result.counts[0], 3);
  assertEquals(result.sums[0], 60);
  assertEquals(result.means[0], 20);
  assertEquals(Number.isNaN(result.medians[0]), true);
});

Deno.test("groupedLinearRegression1d computes sufficient stats and fitted coefficients", () => {
  const result = groupedLinearRegression1d({
    x: new Float64Array([0, 1, 2, 0, 1, 2]),
    y: new Float64Array([1, 3, 5, 10, 10, 10]),
    groupIds: new Uint32Array([0, 0, 0, 1, 1, 1]),
    groupsCount: 2,
  });

  assertEquals([...result.counts], [3, 3]);
  assertEquals([...result.sumX], [3, 3]);
  assertEquals([...result.sumY], [9, 30]);
  assertAlmostEquals(result.slope[0], 2);
  assertAlmostEquals(result.intercept[0], 1);
  assertAlmostEquals(result.slope[1], 0);
  assertAlmostEquals(result.intercept[1], 10);
});

Deno.test("groupedBoxplot1d computes quartiles, whiskers, and outliers", () => {
  const result = groupedBoxplot1d({
    values: new Float64Array([1, 2, 3, 4, 100, 10, 12, 14, 16]),
    groupIds: new Uint32Array([0, 0, 0, 0, 0, 1, 1, 1, 1]),
    groupsCount: 2,
  });

  assertEquals([...result.counts], [5, 4]);
  assertEquals([...result.lower], [1, 10]);
  assertEquals([...result.upper], [4, 16]);
  assertEquals([...result.outlierValues], [100]);
  assertEquals([...result.outlierGroups], [0]);
  assertAlmostEquals(result.q1[0], 2);
  assertAlmostEquals(result.median[0], 3);
  assertAlmostEquals(result.q3[0], 4);
});

Deno.test("groupedDensity1d evaluates a normalized gaussian density grid", () => {
  const result = groupedDensity1d({
    values: new Float64Array([0, 0, 1, 10]),
    lo: 0,
    hi: 1,
    points: 3,
    bandwidth: 1,
    groupIds: new Uint32Array([0, 0, 0, 1]),
    groupsCount: 2,
  });

  assertEquals(result.shape, [2, 3]);
  assertEquals([...result.totals], [3, 1]);
  assertEquals([...result.centers], [0, 0.5, 1]);
  assertEquals(result.density[0] > result.density[2], true);
  assertEquals(result.density[3] < 1e-15, true);
});

Deno.test("groupedHistogram2d bins x/y values into grouped rectangular grids", () => {
  const result = groupedHistogram2d({
    x: new Float32Array([0, 1, 2, 3, 0]),
    y: new Float32Array([0, 1, 2, 3, 3]),
    xLo: 0,
    xHi: 4,
    yLo: 0,
    yHi: 4,
    xBins: 2,
    yBins: 2,
    groupIds: new Uint32Array([0, 0, 0, 0, 1]),
    groupsCount: 2,
  });

  assertEquals(result.shape, [2, 2, 2]);
  assertEquals([...result.xCenters], [1, 3]);
  assertEquals([...result.yCenters], [1, 3]);
  assertEquals([...result.counts], [2, 0, 0, 2, 0, 0, 1, 0]);
  assertEquals([...result.totals], [4, 1]);
});

Deno.test("createGroupedHistogram2dPlan exposes kernel source and dense grid sizing", () => {
  const plan = createGroupedHistogram2dPlan({
    x: new Float32Array(129),
    xBins: 4,
    yBins: 5,
    groupsCount: 2,
  });

  assertEquals(plan.kind, "grouped-histogram-2d");
  assertEquals(plan.dispatchSize, 3);
  assertEquals(plan.countsLength, 40);
  assertEquals(plan.shaders.groupedHistogram2D?.includes("atomicAdd"), true);
});
