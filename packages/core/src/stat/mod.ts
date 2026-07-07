// Stat transforms — stage ① of the pipeline.
//
// A stat consumes a layer's data + resolved mapping and returns a (possibly
// new) DataFrame plus any mapping additions the stat computed (e.g. stat_count
// adds a "count" column mapped to y). `identity`, `count` and `bin` are
// implemented; smooth/summary remain stubs.

import type { Aes, DataFrame, Layer } from "../ir/types.ts";

export interface StatResult {
  data: DataFrame;
  /** Aesthetics the stat produced (merged over the layer mapping). */
  mapping: Aes;
}

export type StatFn = (
  data: DataFrame,
  mapping: Aes,
  params: Record<string, unknown>,
) => StatResult;

const statIdentity: StatFn = (data, mapping) => ({ data, mapping });

/** Count rows per distinct x value; produces `count`, mapped to y unless already set. */
const statCount: StatFn = (data, mapping) => {
  const xCol = mapping.x;
  if (!xCol || !(xCol in data)) {
    console.warn(`[gggplot] stat "count" requires an x mapping; falling back to identity`);
    return { data, mapping };
  }

  const counts = new Map<string, number>();
  const firstSeen = new Map<string, unknown>();
  for (const v of data[xCol]) {
    const key = String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!firstSeen.has(key)) firstSeen.set(key, v);
  }

  const keys = [...counts.keys()];
  return {
    data: {
      [xCol]: keys.map((k) => firstSeen.get(k)),
      count: keys.map((k) => counts.get(k)!),
    },
    mapping: { ...mapping, y: mapping.y ?? "count" },
  };
};

/**
 * Bin continuous x into fixed-width ranges; produces `count` and `density`
 * columns (x replaced by bin centers), mapped to y unless already set.
 * `params.binwidth` fixes the bin width directly; otherwise `params.bins`
 * (default 30, ggplot2's default) divides the data's range evenly.
 */
const statBin: StatFn = (data, mapping, params) => {
  const xCol = mapping.x;
  if (!xCol || !(xCol in data)) {
    console.warn(`[gggplot] stat "bin" requires an x mapping; falling back to identity`);
    return { data, mapping };
  }

  const xs = data[xCol]
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((n) => Number.isFinite(n));
  if (xs.length === 0) return { data, mapping };

  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const bins = (params.bins as number) ?? 30;
  const binwidth = (params.binwidth as number) ?? (hi > lo ? (hi - lo) / bins : 1);
  const nBins = binwidth > 0 ? Math.max(1, Math.ceil((hi - lo) / binwidth)) : 1;

  const counts = new Array(nBins).fill(0);
  for (const v of xs) {
    const idx = binwidth > 0 ? Math.floor((v - lo) / binwidth) : 0;
    counts[Math.min(Math.max(idx, 0), nBins - 1)]++;
  }

  const centers = counts.map((_, i) => lo + (i + 0.5) * binwidth);
  const total = xs.length;
  const density = counts.map((c) => (binwidth > 0 ? c / (total * binwidth) : 0));

  return {
    data: { [xCol]: centers, count: counts, density },
    mapping: { ...mapping, y: mapping.y ?? "count" },
  };
};

/**
 * Fit a trend line through (x, y) and re-emit it as `params.n` (default 80)
 * evenly spaced points spanning x's data range, replacing x's column values
 * (bin-center style, like stat_bin) and producing new `y`, and — unless
 * `params.se === false` — `ymin`/`ymax` columns for a 95%-ish confidence
 * ribbon, mapped onto y/ymin/ymax (overriding any prior mapping, since the
 * fitted point count differs from the input row count).
 *
 * Only `method: "lm"` (ordinary least-squares linear regression) is
 * implemented; ggplot2's default local regression (loess) is a real project
 * of its own (weighted local fits + a bandwidth/span parameter) and is left
 * as a follow-up — an unrecognized method warns and falls back to lm.
 *
 * The confidence band uses the standard OLS prediction-interval formula
 * `se(ŷ) = s * sqrt(1/n + (x - x̄)² / Sxx)` but a fixed z = 1.96 multiplier
 * rather than the exact Student's-t critical value for level/df — a
 * large-sample approximation, slightly narrower than ggplot2's true CI for
 * small n. Good enough for a visual trend band; not a statistics package.
 */
const statSmooth: StatFn = (data, mapping, params) => {
  const xCol = mapping.x;
  const yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) {
    console.warn(`[gggplot] stat "smooth" requires x and y mappings; falling back to identity`);
    return { data, mapping };
  }

  const method = (params.method as string) ?? "lm";
  if (method !== "lm") {
    console.warn(`[gggplot] stat "smooth" method "${method}" not implemented; using "lm"`);
  }

  const pairs: [number, number][] = [];
  const rawX = data[xCol];
  const rawY = data[yCol];
  const n = Math.min(rawX.length, rawY.length);
  for (let i = 0; i < n; i++) {
    const x = Number(rawX[i]);
    const y = Number(rawY[i]);
    if (Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
  }
  if (pairs.length < 2) return { data, mapping };

  const m = pairs.length;
  const xbar = pairs.reduce((s, [x]) => s + x, 0) / m;
  const ybar = pairs.reduce((s, [, y]) => s + y, 0) / m;
  const sxx = pairs.reduce((s, [x]) => s + (x - xbar) ** 2, 0);
  const sxy = pairs.reduce((s, [x, y]) => s + (x - xbar) * (y - ybar), 0);
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = ybar - slope * xbar;

  const sse = pairs.reduce((s, [x, y]) => s + (y - (intercept + slope * x)) ** 2, 0);
  const s2 = m > 2 ? sse / (m - 2) : 0;

  const se = params.se !== false;
  const numPoints = Math.max(2, (params.n as number) ?? 80);
  const xs = pairs.map(([x]) => x);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const step = numPoints > 1 ? (hi - lo) / (numPoints - 1) : 0;

  const fittedX: number[] = [];
  const fittedY: number[] = [];
  const ymin: number[] = [];
  const ymax: number[] = [];
  const Z = 1.96;
  for (let i = 0; i < numPoints; i++) {
    const x = lo + i * step;
    const y = intercept + slope * x;
    fittedX.push(x);
    fittedY.push(y);
    if (se) {
      const seY = Math.sqrt(Math.max(0, s2) * (1 / m + (sxx > 0 ? (x - xbar) ** 2 / sxx : 0)));
      ymin.push(y - Z * seY);
      ymax.push(y + Z * seY);
    }
  }

  return {
    data: { [xCol]: fittedX, y: fittedY, ...(se ? { ymin, ymax } : {}) },
    mapping: { ...mapping, y: "y", ...(se ? { ymin: "ymin", ymax: "ymax" } : {}) },
  };
};

const AGGREGATORS: Record<string, (values: number[]) => number> = {
  mean: (vs) => vs.reduce((a, b) => a + b, 0) / vs.length,
  median: (vs) => {
    const sorted = [...vs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  },
  sum: (vs) => vs.reduce((a, b) => a + b, 0),
  min: (vs) => Math.min(...vs),
  max: (vs) => Math.max(...vs),
};

/**
 * Aggregate y per distinct x value with `params.fun` (default "mean"; also
 * "median"/"sum"/"min"/"max", or a custom `(values: number[]) => number`),
 * replacing y's values in place — one aggregated row per x level, in
 * first-seen order. Pairs with geom_point/geom_line/geom_col etc. (ggplot2
 * defaults stat_summary to geom_pointrange, which this codebase doesn't
 * implement; use e.g. `geomPoint({ stat: "summary" })` instead).
 */
const statSummary: StatFn = (data, mapping, params) => {
  const xCol = mapping.x;
  const yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) {
    console.warn(`[gggplot] stat "summary" requires x and y mappings; falling back to identity`);
    return { data, mapping };
  }

  const fun = params.fun as string | ((values: number[]) => number) | undefined;
  const aggregate = typeof fun === "function" ? fun : AGGREGATORS[fun ?? "mean"];
  if (!aggregate) {
    console.warn(`[gggplot] stat "summary" fun "${fun}" not recognized; using "mean"`);
  }
  const agg = aggregate ?? AGGREGATORS.mean;

  const groups = new Map<string, number[]>();
  const firstSeen = new Map<string, unknown>();
  const xs = data[xCol];
  const ys = data[yCol];
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    const key = String(xs[i]);
    if (!groups.has(key)) {
      groups.set(key, []);
      firstSeen.set(key, xs[i]);
    }
    const y = Number(ys[i]);
    if (Number.isFinite(y)) groups.get(key)!.push(y);
  }

  // Only x/y are re-emitted (one row per group) -- like stat_count/stat_bin,
  // any other per-row columns (e.g. a fill/group column) don't have a
  // well-defined per-group value here and are dropped.
  const keys = [...groups.keys()];
  return {
    data: {
      [xCol]: keys.map((k) => firstSeen.get(k)),
      [yCol]: keys.map((k) => agg(groups.get(k)!)),
    },
    mapping,
  };
};

const REGISTRY: Record<Layer["stat"], StatFn> = {
  identity: statIdentity,
  count: statCount,
  bin: statBin,
  smooth: statSmooth,
  summary: statSummary,
};

export function applyStat(layer: Layer, mapping: Aes, data: DataFrame): StatResult {
  return REGISTRY[layer.stat](data, mapping, layer.params);
}
