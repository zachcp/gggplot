import { dataFrameFromColumns, numericColumnValues } from "../data/mod.ts";
import { groupColumnsOf, groupKeyAt, groupValuesAt } from "../group/mod.ts";
import type { StatFn } from "./shared.ts";

/**
 * Linear-interpolated sample quantile (type-7, matching NumPy/R default).
 * Shared by loess's robust-median reweighting and quantile regression.
 */
export function sampleQuantile(values: number[], probability: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lo = Math.floor(index), hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

function pinballFit(
  pairs: [number, number][],
  probability: number,
): [number, number] {
  const xs = pairs.map(([x]) => x), ys = pairs.map(([, y]) => y);
  if (Math.min(...xs) === Math.max(...xs)) {
    return [sampleQuantile(ys, probability), 0];
  }
  const candidates: [number, number][] = [[sampleQuantile(ys, probability), 0]];
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const dx = pairs[j][0] - pairs[i][0];
      if (dx === 0) continue;
      const slope = (pairs[j][1] - pairs[i][1]) / dx;
      candidates.push([pairs[i][1] - slope * pairs[i][0], slope]);
    }
  }
  const loss = ([intercept, slope]: [number, number]) =>
    pairs.reduce((sum, [x, y]) => {
      const residual = y - intercept - slope * x;
      return sum +
        (residual >= 0 ? probability * residual : (probability - 1) * residual);
    }, 0);
  return candidates.reduce((best, candidate) => {
    const delta = loss(candidate) - loss(best);
    return delta < -1e-12 ||
        (Math.abs(delta) <= 1e-12 && (candidate[1] < best[1] ||
          (candidate[1] === best[1] && candidate[0] < best[0])))
      ? candidate
      : best;
  });
}

export const statQuantileProduct: StatFn = (data, mapping, params) => {
  if (params.method !== undefined && params.method !== "rq") {
    throw new TypeError('[gggplot] stat quantile method must be "rq"');
  }
  const requested = params.quantiles ?? [0.25, 0.5, 0.75];
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new TypeError(
      "[gggplot] quantiles must be a non-empty sorted array inside (0,1)",
    );
  }
  const quantiles = requested.map(Number);
  if (
    quantiles.some((q, i) =>
      !Number.isFinite(q) || q <= 0 || q >= 1 ||
      (i > 0 && q <= quantiles[i - 1])
    )
  ) {
    throw new TypeError(
      "[gggplot] quantiles must be a non-empty sorted array inside (0,1)",
    );
  }
  const xCol = mapping.x, yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) {
    throw new TypeError(
      "[gggplot] stat quantile requires numeric x and y mappings",
    );
  }
  const groupCols = groupColumnsOf(mapping, data).filter((column) =>
    column !== xCol && column !== yCol && column !== "quantile"
  );
  const xs = numericColumnValues(data, xCol),
    ys = numericColumnValues(data, yCol);
  const grouped = new Map<
    string,
    { pairs: [number, number][]; values: Record<string, unknown> }
  >();
  for (let row = 0; row < Math.min(xs.length, ys.length); row++) {
    const x = xs[row], y = ys[row];
    if (
      typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" ||
      !Number.isFinite(y)
    ) continue;
    const key = groupKeyAt(data, groupCols, row);
    const group = grouped.get(key) ??
      { pairs: [], values: groupValuesAt(data, groupCols, row) };
    group.pairs.push([x, y]);
    grouped.set(key, group);
  }
  const out: Record<string, unknown[]> = {
    quantilex: [],
    quantiley: [],
    quantile: [],
    quantileGroup: [],
  };
  for (const column of groupCols) out[column] = [];
  for (const [groupKey, group] of grouped) {
    if (group.pairs.length < 2) {
      throw new TypeError(
        "[gggplot] stat quantile requires at least two finite rows per group",
      );
    }
    const lo = Math.min(...group.pairs.map(([x]) => x)),
      hi = Math.max(...group.pairs.map(([x]) => x));
    for (const q of quantiles) {
      const [intercept, slope] = pinballFit(group.pairs, q);
      out.quantilex.push(lo, hi);
      out.quantiley.push(intercept + slope * lo, intercept + slope * hi);
      out.quantile.push(q, q);
      out.quantileGroup.push(`${groupKey}:${q}`, `${groupKey}:${q}`);
      for (const column of groupCols) {
        out[column].push(group.values[column], group.values[column]);
      }
    }
  }
  return {
    data: dataFrameFromColumns(out),
    mapping: {
      ...mapping,
      x: "quantilex",
      y: "quantiley",
      group: "quantileGroup",
    },
  };
};
