import type {
  GroupedBoxplot1DInput,
  GroupedBoxplot1DResult,
  GroupedCount1DInput,
  GroupedCount1DResult,
  GroupedDensity1DInput,
  GroupedDensity1DResult,
  GroupedHistogram1DInput,
  GroupedHistogram1DResult,
  GroupedHistogram2DInput,
  GroupedHistogram2DResult,
  GroupedLinearRegression1DInput,
  GroupedLinearRegression1DResult,
  GroupedSummary1DInput,
  GroupedSummary1DResult,
} from "./types.ts";

function assertAlignedGroups(
  valueLength: number,
  groupIds: Uint32Array | undefined,
): void {
  if (groupIds && groupIds.length !== valueLength) {
    throw new Error(
      `[gggplot/reductions] groupIds length ${groupIds.length} does not match values length ${valueLength}`,
    );
  }
}

function assertAlignedValues(
  leftName: string,
  leftLength: number,
  rightName: string,
  rightLength: number,
): void {
  if (leftLength !== rightLength) {
    throw new Error(
      `[gggplot/reductions] ${leftName} length ${leftLength} does not match ${rightName} length ${rightLength}`,
    );
  }
}

function inferGroupsCount(groupIds: Uint32Array | undefined): number {
  if (!groupIds || groupIds.length === 0) return 1;
  let max = 0;
  for (const id of groupIds) max = Math.max(max, id);
  return max + 1;
}

function offset2(group: number, width: number, x: number): number {
  return group * width + x;
}

function medianSorted(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 1
    ? values[mid]
    : (values[mid - 1] + values[mid]) / 2;
}

function quantileSorted(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  if (values.length === 1) return values[0];
  const index = (values.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  const frac = index - lo;
  return values[lo] * (1 - frac) + values[hi] * frac;
}

export function groupedCount1d(
  input: GroupedCount1DInput,
): GroupedCount1DResult {
  const { valueIds, valuesCount } = input;
  if (valuesCount < 0) {
    throw new Error("[gggplot/reductions] valuesCount must be non-negative");
  }
  assertAlignedGroups(valueIds.length, input.groupIds);

  const groupsCount = input.groupsCount ?? inferGroupsCount(input.groupIds);
  const counts = new Uint32Array(groupsCount * valuesCount);

  for (let i = 0; i < valueIds.length; i++) {
    const valueId = valueIds[i];
    if (valueId >= valuesCount) continue;
    const groupId = input.groupIds?.[i] ?? 0;
    if (groupId >= groupsCount) continue;
    counts[offset2(groupId, valuesCount, valueId)]++;
  }

  return {
    counts,
    valuesCount,
    groupsCount,
    shape: [groupsCount, valuesCount],
    backend: "cpu",
  };
}

function resolveHistogramBins(input: GroupedHistogram1DInput): {
  bins: number;
  binwidth: number;
} {
  if (input.binwidth != null) {
    const binwidth = input.binwidth;
    const bins = binwidth > 0
      ? Math.max(1, Math.ceil((input.hi - input.lo) / binwidth))
      : 1;
    return { bins, binwidth };
  }

  const bins = Math.max(1, input.bins ?? 30);
  const binwidth = input.hi > input.lo ? (input.hi - input.lo) / bins : 1;
  return { bins, binwidth };
}

export function groupedHistogram1d(
  input: GroupedHistogram1DInput,
): GroupedHistogram1DResult {
  assertAlignedGroups(input.values.length, input.groupIds);

  const { bins, binwidth } = resolveHistogramBins(input);
  const groupsCount = input.groupsCount ?? inferGroupsCount(input.groupIds);
  const counts = new Uint32Array(groupsCount * bins);
  const totals = new Uint32Array(groupsCount);

  for (let i = 0; i < input.values.length; i++) {
    const value = input.values[i];
    if (!Number.isFinite(value)) continue;
    const groupId = input.groupIds?.[i] ?? 0;
    if (groupId >= groupsCount) continue;
    const rawBin = binwidth > 0 ? Math.floor((value - input.lo) / binwidth) : 0;
    const bin = Math.min(Math.max(rawBin, 0), bins - 1);
    counts[offset2(groupId, bins, bin)]++;
    totals[groupId]++;
  }

  const density = new Float32Array(groupsCount * bins);
  for (let group = 0; group < groupsCount; group++) {
    const total = totals[group];
    for (let bin = 0; bin < bins; bin++) {
      const offset = offset2(group, bins, bin);
      density[offset] = binwidth > 0 && total > 0
        ? counts[offset] / (total * binwidth)
        : 0;
    }
  }

  const centers = new Float32Array(bins);
  for (let bin = 0; bin < bins; bin++) {
    centers[bin] = input.lo + (bin + 0.5) * binwidth;
  }

  return {
    counts,
    density,
    centers,
    totals,
    lo: input.lo,
    hi: input.hi,
    binwidth,
    bins,
    groupsCount,
    shape: [groupsCount, bins],
    backend: "cpu",
  };
}

export function groupedSummary1d(
  input: GroupedSummary1DInput,
): GroupedSummary1DResult {
  const { xIds, xCount, values } = input;
  if (xCount < 0) {
    throw new Error("[gggplot/reductions] xCount must be non-negative");
  }
  assertAlignedValues("xIds", xIds.length, "values", values.length);
  assertAlignedGroups(values.length, input.groupIds);

  const groupsCount = input.groupsCount ?? inferGroupsCount(input.groupIds);
  const size = groupsCount * xCount;
  const counts = new Uint32Array(size);
  const sums = new Float64Array(size);
  const mins = new Float64Array(size).fill(Number.POSITIVE_INFINITY);
  const maxs = new Float64Array(size).fill(Number.NEGATIVE_INFINITY);
  const includeMedian = input.includeMedian ?? true;
  const lists = includeMedian
    ? Array.from({ length: size }, () => [] as number[])
    : [];

  for (let i = 0; i < values.length; i++) {
    const value = Number(values[i]);
    if (!Number.isFinite(value)) continue;
    const xId = xIds[i];
    if (xId >= xCount) continue;
    const groupId = input.groupIds?.[i] ?? 0;
    if (groupId >= groupsCount) continue;
    const offset = offset2(groupId, xCount, xId);
    counts[offset]++;
    sums[offset] += value;
    mins[offset] = Math.min(mins[offset], value);
    maxs[offset] = Math.max(maxs[offset], value);
    if (includeMedian) lists[offset].push(value);
  }

  const means = new Float64Array(size);
  const medians = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    if (counts[i] === 0) {
      means[i] = Number.NaN;
      mins[i] = Number.NaN;
      maxs[i] = Number.NaN;
      medians[i] = Number.NaN;
      continue;
    }
    means[i] = sums[i] / counts[i];
    if (includeMedian) {
      lists[i].sort((a, b) => a - b);
      medians[i] = medianSorted(lists[i]);
    } else {
      medians[i] = Number.NaN;
    }
  }

  return {
    counts,
    sums,
    means,
    mins,
    maxs,
    medians,
    xCount,
    groupsCount,
    shape: [groupsCount, xCount],
    backend: "cpu",
  };
}

export function groupedLinearRegression1d(
  input: GroupedLinearRegression1DInput,
): GroupedLinearRegression1DResult {
  assertAlignedValues("x", input.x.length, "y", input.y.length);
  assertAlignedGroups(input.x.length, input.groupIds);

  const groupsCount = input.groupsCount ?? inferGroupsCount(input.groupIds);
  const counts = new Uint32Array(groupsCount);
  const sumX = new Float64Array(groupsCount);
  const sumY = new Float64Array(groupsCount);
  const sumXX = new Float64Array(groupsCount);
  const sumXY = new Float64Array(groupsCount);
  const sumYY = new Float64Array(groupsCount);

  for (let i = 0; i < input.x.length; i++) {
    const x = Number(input.x[i]);
    const y = Number(input.y[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const group = input.groupIds?.[i] ?? 0;
    if (group >= groupsCount) continue;
    counts[group]++;
    sumX[group] += x;
    sumY[group] += y;
    sumXX[group] += x * x;
    sumXY[group] += x * y;
    sumYY[group] += y * y;
  }

  const slope = new Float64Array(groupsCount);
  const intercept = new Float64Array(groupsCount);
  for (let group = 0; group < groupsCount; group++) {
    const n = counts[group];
    const denom = n * sumXX[group] - sumX[group] ** 2;
    slope[group] = n > 0 && denom !== 0
      ? (n * sumXY[group] - sumX[group] * sumY[group]) / denom
      : 0;
    intercept[group] = n > 0
      ? (sumY[group] - slope[group] * sumX[group]) / n
      : Number.NaN;
  }

  return {
    counts,
    sumX,
    sumY,
    sumXX,
    sumXY,
    sumYY,
    slope,
    intercept,
    backend: "cpu",
  };
}

export function groupedBoxplot1d(
  input: GroupedBoxplot1DInput,
): GroupedBoxplot1DResult {
  assertAlignedGroups(input.values.length, input.groupIds);

  const groupsCount = input.groupsCount ?? inferGroupsCount(input.groupIds);
  const coef = input.coef ?? 1.5;
  const lists = Array.from({ length: groupsCount }, () => [] as number[]);
  for (let i = 0; i < input.values.length; i++) {
    const value = Number(input.values[i]);
    if (!Number.isFinite(value)) continue;
    const group = input.groupIds?.[i] ?? 0;
    if (group >= groupsCount) continue;
    lists[group].push(value);
  }

  const counts = new Uint32Array(groupsCount);
  const lower = new Float64Array(groupsCount);
  const q1 = new Float64Array(groupsCount);
  const median = new Float64Array(groupsCount);
  const q3 = new Float64Array(groupsCount);
  const upper = new Float64Array(groupsCount);
  const outlierValues: number[] = [];
  const outlierGroups: number[] = [];

  for (let group = 0; group < groupsCount; group++) {
    const values = lists[group].sort((a, b) => a - b);
    counts[group] = values.length;
    if (values.length === 0) {
      lower[group] =
        q1[group] =
        median[group] =
        q3[group] =
        upper[group] =
          Number.NaN;
      continue;
    }
    q1[group] = quantileSorted(values, 0.25);
    median[group] = quantileSorted(values, 0.5);
    q3[group] = quantileSorted(values, 0.75);
    const iqr = q3[group] - q1[group];
    const lowFence = q1[group] - coef * iqr;
    const highFence = q3[group] + coef * iqr;
    const inliers = values.filter((value) =>
      value >= lowFence && value <= highFence
    );
    lower[group] = inliers[0] ?? values[0];
    upper[group] = inliers[inliers.length - 1] ?? values[values.length - 1];
    for (const value of values) {
      if (value < lowFence || value > highFence) {
        outlierValues.push(value);
        outlierGroups.push(group);
      }
    }
  }

  return {
    counts,
    lower,
    q1,
    median,
    q3,
    upper,
    outlierValues: new Float64Array(outlierValues),
    outlierGroups: new Uint32Array(outlierGroups),
    groupsCount,
    backend: "cpu",
  };
}

export function groupedDensity1d(
  input: GroupedDensity1DInput,
): GroupedDensity1DResult {
  assertAlignedGroups(input.values.length, input.groupIds);

  const points = Math.max(1, input.points ?? 128);
  const groupsCount = input.groupsCount ?? inferGroupsCount(input.groupIds);
  const bandwidth = input.bandwidth ??
    Math.max(Number.EPSILON, (input.hi - input.lo) / 30);
  const centers = new Float64Array(points);
  const density = new Float64Array(groupsCount * points);
  const totals = new Uint32Array(groupsCount);
  const step = points > 1 ? (input.hi - input.lo) / (points - 1) : 0;

  for (let point = 0; point < points; point++) {
    centers[point] = input.lo + point * step;
  }

  const invSqrt2Pi = 1 / Math.sqrt(2 * Math.PI);
  for (let i = 0; i < input.values.length; i++) {
    const value = Number(input.values[i]);
    if (!Number.isFinite(value)) continue;
    const group = input.groupIds?.[i] ?? 0;
    if (group >= groupsCount) continue;
    totals[group]++;
    for (let point = 0; point < points; point++) {
      const z = (centers[point] - value) / bandwidth;
      density[offset2(group, points, point)] += Math.exp(-0.5 * z * z) *
        invSqrt2Pi;
    }
  }

  for (let group = 0; group < groupsCount; group++) {
    const total = totals[group];
    if (total === 0) continue;
    for (let point = 0; point < points; point++) {
      density[offset2(group, points, point)] /= total * bandwidth;
    }
  }

  return {
    centers,
    density,
    totals,
    lo: input.lo,
    hi: input.hi,
    bandwidth,
    points,
    groupsCount,
    shape: [groupsCount, points],
    backend: "cpu",
  };
}

export function groupedHistogram2d(
  input: GroupedHistogram2DInput,
): GroupedHistogram2DResult {
  assertAlignedValues("x", input.x.length, "y", input.y.length);
  assertAlignedGroups(input.x.length, input.groupIds);

  const xBins = Math.max(1, input.xBins ?? 30);
  const yBins = Math.max(1, input.yBins ?? 30);
  const groupsCount = input.groupsCount ?? inferGroupsCount(input.groupIds);
  const xBinwidth = input.xHi > input.xLo ? (input.xHi - input.xLo) / xBins : 1;
  const yBinwidth = input.yHi > input.yLo ? (input.yHi - input.yLo) / yBins : 1;
  const counts = new Uint32Array(groupsCount * yBins * xBins);
  const totals = new Uint32Array(groupsCount);

  for (let i = 0; i < input.x.length; i++) {
    const x = Number(input.x[i]);
    const y = Number(input.y[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const group = input.groupIds?.[i] ?? 0;
    if (group >= groupsCount) continue;
    const xRaw = Math.floor((x - input.xLo) / xBinwidth);
    const yRaw = Math.floor((y - input.yLo) / yBinwidth);
    const xBin = Math.min(Math.max(xRaw, 0), xBins - 1);
    const yBin = Math.min(Math.max(yRaw, 0), yBins - 1);
    counts[group * yBins * xBins + yBin * xBins + xBin]++;
    totals[group]++;
  }

  const xCenters = new Float32Array(xBins);
  const yCenters = new Float32Array(yBins);
  for (let x = 0; x < xBins; x++) {
    xCenters[x] = input.xLo + (x + 0.5) * xBinwidth;
  }
  for (let y = 0; y < yBins; y++) {
    yCenters[y] = input.yLo + (y + 0.5) * yBinwidth;
  }

  return {
    counts,
    xCenters,
    yCenters,
    totals,
    xLo: input.xLo,
    xHi: input.xHi,
    yLo: input.yLo,
    yHi: input.yHi,
    xBins,
    yBins,
    groupsCount,
    shape: [groupsCount, yBins, xBins],
    backend: "cpu",
  };
}
