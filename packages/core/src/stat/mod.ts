// Stat transforms — stage ① of the pipeline.
//
// A stat consumes a layer's data + resolved mapping and returns a (possibly
// new) DataFrame plus any mapping additions the stat computed (e.g. stat_count
// adds a "count" column mapped to y).

import type { Aes, DataFrame, Layer } from "../ir/types.ts";
export {
  createStatBinProductPlan,
  type StatBinPlanOptions,
} from "./bin_plan.ts";
import {
  groupedCount1d,
  groupedHistogram1d,
  groupedHistogram2d,
  groupedLinearRegression1d,
  groupedSummary1d,
} from "@gggplot/reductions";
import {
  groupColumnsOf,
  groupKeyAt,
  groupValuesAt,
  rowCount,
  sliceRows,
} from "../group/mod.ts";
import {
  columnValues,
  dataFrameFromColumns,
  ingest,
  numericColumnValues,
} from "../data/mod.ts";
import type { InputData } from "../data/mod.ts";

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

function encodeValueIds(values: unknown[]): {
  ids: Uint32Array;
  values: unknown[];
} {
  const keys = new Map<string, number>();
  const outValues: unknown[] = [];
  const ids = new Uint32Array(values.length);

  for (let i = 0; i < values.length; i++) {
    const key = String(values[i]);
    let id = keys.get(key);
    if (id == null) {
      id = outValues.length;
      keys.set(key, id);
      outValues.push(values[i]);
    }
    ids[i] = id;
  }

  return { ids, values: outValues };
}

function encodeEffectiveGroups(
  mapping: Aes,
  data: DataFrame,
  indices?: number[],
): {
  columns: string[];
  ids?: Uint32Array;
  values: Record<string, unknown>[];
} {
  const columns = groupColumnsOf(mapping, data);
  const n = indices?.length ?? rowCount(data);
  if (columns.length === 0) return { columns, values: [{}] };

  const keys = new Map<string, number>();
  const values: Record<string, unknown>[] = [];
  const ids = new Uint32Array(n);

  for (let i = 0; i < n; i++) {
    const row = indices?.[i] ?? i;
    const key = groupKeyAt(data, columns, row);
    let id = keys.get(key);
    if (id == null) {
      id = values.length;
      keys.set(key, id);
      values.push(groupValuesAt(data, columns, row));
    }
    ids[i] = id;
  }

  return { columns, ids, values };
}

/**
 * Resolves the DSL's `weight` stat parameter. It is intentionally a column
 * name (or a fixed finite scalar), never an integer coercion: a weighted stat
 * has floating-count semantics and must stay on CPU until the resident backend
 * gains a deterministic floating reduction.
 */
function statWeights(
  data: DataFrame,
  params: Record<string, unknown>,
  sourceRows: readonly number[],
): Float64Array | undefined {
  const requested = params.weight;
  if (requested == null) return undefined;
  if (typeof requested === "number") {
    if (!Number.isFinite(requested)) {
      throw new TypeError('[gggplot] stat "weight" must be finite');
    }
    return Float64Array.from(sourceRows, () => requested);
  }
  if (typeof requested !== "string" || !(requested in data)) {
    throw new TypeError(
      '[gggplot] stat "weight" must name a numeric data column or be a finite number',
    );
  }
  const column = data[requested];
  if (!column || column.type !== "numeric") {
    throw new TypeError(
      `[gggplot] stat "weight" column "${requested}" must be numeric`,
    );
  }
  const values = numericColumnValues(data, requested);
  return Float64Array.from(sourceRows, (row) => values[row] ?? Number.NaN);
}

/** Count rows per distinct x value; produces `count`, mapped to y unless already set. */
const statCount: StatFn = (data, mapping, params) => {
  const xCol = mapping.x;
  if (!xCol || !(xCol in data)) {
    console.warn(
      `[gggplot] stat "count" requires an x mapping; falling back to identity`,
    );
    return { data, mapping };
  }

  const encodedX = encodeValueIds(columnValues(data, xCol));
  const groups = encodeEffectiveGroups(mapping, data);
  const weights = statWeights(data, params, [...encodedX.ids.keys()]);
  const reduced = weights
    ? (() => {
      const counts = new Float64Array(
        encodedX.values.length * groups.values.length,
      );
      for (let row = 0; row < encodedX.ids.length; row++) {
        const weight = weights[row];
        if (!Number.isFinite(weight)) continue;
        const group = groups.ids?.[row] ?? 0;
        counts[group * encodedX.values.length + encodedX.ids[row]] += weight;
      }
      return {
        counts,
        groupsCount: groups.values.length,
        valuesCount: encodedX.values.length,
      };
    })()
    : groupedCount1d({
      valueIds: encodedX.ids,
      valuesCount: encodedX.values.length,
      groupIds: groups.ids,
      groupsCount: groups.values.length,
    });

  const xOut: unknown[] = [];
  const countOut: number[] = [];
  const groupOut: Record<string, unknown[]> = Object.fromEntries(
    groups.columns.map((col) => [col, []]),
  );

  for (let group = 0; group < reduced.groupsCount; group++) {
    for (let value = 0; value < reduced.valuesCount; value++) {
      const count = reduced.counts[group * reduced.valuesCount + value];
      if (count === 0) continue;
      xOut.push(encodedX.values[value]);
      countOut.push(count);
      for (const col of groups.columns) {
        groupOut[col].push(groups.values[group][col]);
      }
    }
  }

  return {
    data: dataFrameFromColumns({
      [xCol]: xOut,
      ...groupOut,
      count: countOut,
    }),
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
    console.warn(
      `[gggplot] stat "bin" requires an x mapping; falling back to identity`,
    );
    return { data, mapping };
  }

  const values: number[] = [];
  const sourceRows: number[] = [];
  const xValues = numericColumnValues(data, xCol);
  for (let i = 0; i < xValues.length; i++) {
    const value = xValues[i];
    if (value == null || !Number.isFinite(value)) continue;
    values.push(value);
    sourceRows.push(i);
  }
  if (values.length === 0) return { data, mapping };

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const bins = (params.bins as number) ?? 30;
  const binwidth = (params.binwidth as number) ??
    (hi > lo ? (hi - lo) / bins : 1);

  const groups = encodeEffectiveGroups(mapping, data, sourceRows);
  const weights = statWeights(data, params, sourceRows);
  const reduced = weights
    ? (() => {
      const binsCount = Math.max(1, Math.ceil((hi - lo) / binwidth));
      const counts = new Float64Array(binsCount * groups.values.length);
      const totals = new Float64Array(groups.values.length);
      for (let row = 0; row < values.length; row++) {
        const weight = weights[row];
        if (!Number.isFinite(weight)) continue;
        const group = groups.ids?.[row] ?? 0;
        const bin = Math.min(
          binsCount - 1,
          Math.max(0, Math.floor((values[row] - lo) / binwidth)),
        );
        counts[group * binsCount + bin] += weight;
        totals[group] += weight;
      }
      return {
        counts,
        totals,
        bins: binsCount,
        binwidth,
        groupsCount: groups.values.length,
        centers: Float64Array.from({ length: binsCount }, (_, bin) =>
          lo + (bin + 0.5) * binwidth),
      };
    })()
    : groupedHistogram1d({
      values: new Float32Array(values),
      lo,
      hi,
      binwidth,
      groupIds: groups.ids,
      groupsCount: groups.values.length,
    });

  const centers: number[] = [];
  const countOut: number[] = [];
  const density: number[] = [];
  const groupOut: Record<string, unknown[]> = Object.fromEntries(
    groups.columns.map((col) => [col, []]),
  );
  for (let group = 0; group < reduced.groupsCount; group++) {
    for (let bin = 0; bin < reduced.bins; bin++) {
      const offset = group * reduced.bins + bin;
      centers.push(reduced.centers[bin]);
      countOut.push(reduced.counts[offset]);
      density.push(
        reduced.binwidth > 0 && reduced.totals[group] > 0
          ? reduced.counts[offset] / (reduced.totals[group] * reduced.binwidth)
          : 0,
      );
      for (const col of groups.columns) {
        groupOut[col].push(groups.values[group][col]);
      }
    }
  }

  return {
    data: dataFrameFromColumns({
      [xCol]: centers,
      ...groupOut,
      count: countOut,
      density,
    }),
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
function smoothGroup(
  data: DataFrame,
  mapping: Aes,
  params: Record<string, unknown>,
): DataFrame | null {
  const xCol = mapping.x;
  const yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) return null;

  const pairs: [number, number][] = [];
  const rawX = numericColumnValues(data, xCol);
  const rawY = numericColumnValues(data, yCol);
  const n = Math.min(rawX.length, rawY.length);
  for (let i = 0; i < n; i++) {
    const x = rawX[i];
    const y = rawY[i];
    if (x != null && y != null) pairs.push([x, y]);
  }
  if (pairs.length < 2) return null;

  const m = pairs.length;
  const regression = groupedLinearRegression1d({
    x: new Float64Array(pairs.map(([x]) => x)),
    y: new Float64Array(pairs.map(([, y]) => y)),
  });
  const slope = regression.slope[0];
  const intercept = regression.intercept[0];
  const xbar = regression.sumX[0] / m;
  const sxx = regression.sumXX[0] - regression.sumX[0] ** 2 / m;
  const sse = regression.sumYY[0] -
    2 * intercept * regression.sumY[0] -
    2 * slope * regression.sumXY[0] +
    m * intercept ** 2 +
    2 * intercept * slope * regression.sumX[0] +
    slope ** 2 * regression.sumXX[0];
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
      const seY = Math.sqrt(
        Math.max(0, s2) * (1 / m + (sxx > 0 ? (x - xbar) ** 2 / sxx : 0)),
      );
      ymin.push(y - Z * seY);
      ymax.push(y + Z * seY);
    }
  }

  return dataFrameFromColumns({
    [xCol]: fittedX,
    y: fittedY,
    ...(se ? { ymin, ymax } : {}),
  });
}

const statSmooth: StatFn = (data, mapping, params) => {
  const xCol = mapping.x;
  const yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) {
    console.warn(
      `[gggplot] stat "smooth" requires x and y mappings; falling back to identity`,
    );
    return { data, mapping };
  }

  const method = (params.method as string) ?? "lm";
  if (method !== "lm") {
    console.warn(
      `[gggplot] stat "smooth" method "${method}" not implemented; using "lm"`,
    );
  }

  const se = params.se !== false;
  const groupCols = groupColumnsOf(mapping, data);
  const grouped = new Map<
    string,
    { indices: number[]; values: Record<string, unknown> }
  >();
  const n = rowCount(data);
  for (let i = 0; i < n; i++) {
    const key = groupKeyAt(data, groupCols, i);
    let group = grouped.get(key);
    if (!group) {
      group = { indices: [], values: groupValuesAt(data, groupCols, i) };
      grouped.set(key, group);
    }
    group.indices.push(i);
  }

  const out: Record<string, unknown[]> = {
    [xCol]: [],
    y: [],
    ...(se ? { ymin: [], ymax: [] } : {}),
  };
  for (const col of groupCols) out[col] = [];

  for (const group of grouped.values()) {
    const groupData = sliceRows(data, group.indices);
    const fitted = smoothGroup(groupData, mapping, params);
    if (!fitted) continue;
    const m = columnValues(fitted, xCol).length;
    for (const col of Object.keys(fitted)) {
      out[col].push(...columnValues(fitted, col));
    }
    for (const col of groupCols) {
      (out[col] as unknown[]).push(...new Array(m).fill(group.values[col]));
    }
  }

  if (out[xCol].length === 0) return { data, mapping };

  return {
    data: dataFrameFromColumns(out),
    mapping: {
      ...mapping,
      y: "y",
      ...(se ? { ymin: "ymin", ymax: "ymax" } : {}),
    },
  };
};

const AGGREGATORS: Record<string, (values: number[]) => number> = {
  mean: (vs) => vs.reduce((a, b) => a + b, 0) / vs.length,
  median: (vs) => {
    const sorted = [...vs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
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
    console.warn(
      `[gggplot] stat "summary" requires x and y mappings; falling back to identity`,
    );
    return { data, mapping };
  }

  const fun = params.fun as string | ((values: number[]) => number) | undefined;
  const groupCols = groupColumnsOf(mapping, data);

  if (typeof fun !== "function") {
    const metric = fun ?? "mean";
    const known = new Set(["mean", "median", "sum", "min", "max"]);
    if (!known.has(metric)) {
      console.warn(
        `[gggplot] stat "summary" fun "${fun}" not recognized; using "mean"`,
      );
    }
    const selected = known.has(metric) ? metric : "mean";
    const xs = columnValues(data, xCol);
    const ys = numericColumnValues(data, yCol);
    const n = Math.min(xs.length, ys.length);
    const rowIndices = Array.from({ length: n }, (_, i) => i);
    const encodedX = encodeValueIds(xs.slice(0, n));
    const groups = encodeEffectiveGroups(mapping, data, rowIndices);
    const reduced = groupedSummary1d({
      xIds: encodedX.ids,
      xCount: encodedX.values.length,
      values: new Float64Array(
        Array.from({ length: n }, (_, i) => ys[i] ?? Number.NaN),
      ),
      groupIds: groups.ids,
      groupsCount: groups.values.length,
      includeMedian: selected === "median",
    });

    const observed = new Uint8Array(reduced.groupsCount * reduced.xCount);
    for (let i = 0; i < n; i++) {
      const group = groups.ids?.[i] ?? 0;
      observed[group * reduced.xCount + encodedX.ids[i]] = 1;
    }

    const xOut: unknown[] = [];
    const yOut: number[] = [];
    const groupOut: Record<string, unknown[]> = Object.fromEntries(
      groups.columns.map((col) => [col, []]),
    );
    const valuesByMetric = {
      mean: reduced.means,
      median: reduced.medians,
      sum: reduced.sums,
      min: reduced.mins,
      max: reduced.maxs,
    } as const;
    const values = valuesByMetric[selected as keyof typeof valuesByMetric];
    for (let group = 0; group < reduced.groupsCount; group++) {
      for (let x = 0; x < reduced.xCount; x++) {
        const offset = group * reduced.xCount + x;
        if (!observed[offset]) continue;
        xOut.push(encodedX.values[x]);
        yOut.push(values[offset]);
        for (const col of groups.columns) {
          groupOut[col].push(groups.values[group][col]);
        }
      }
    }

    return {
      data: dataFrameFromColumns({
        [xCol]: xOut,
        ...groupOut,
        [yCol]: yOut,
      }),
      mapping,
    };
  }

  const aggregate = typeof fun === "function"
    ? fun
    : AGGREGATORS[fun ?? "mean"];
  if (!aggregate) {
    console.warn(
      `[gggplot] stat "summary" fun "${fun}" not recognized; using "mean"`,
    );
  }
  const agg = aggregate ?? AGGREGATORS.mean;

  const groups = new Map<
    string,
    { x: unknown; groupValues: Record<string, unknown>; values: number[] }
  >();
  const xs = columnValues(data, xCol);
  const ys = numericColumnValues(data, yCol);
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    const key = `${String(xs[i])}\0${groupKeyAt(data, groupCols, i)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        x: xs[i],
        groupValues: groupValuesAt(data, groupCols, i),
        values: [],
      });
    }
    const y = ys[i];
    if (y != null) groups.get(key)!.values.push(y);
  }

  const rows = [...groups.values()];
  return {
    data: dataFrameFromColumns({
      [xCol]: rows.map((row) => row.x),
      ...Object.fromEntries(
        groupCols.map((col) => [col, rows.map((row) => row.groupValues[col])]),
      ),
      [yCol]: rows.map((row) => agg(row.values)),
    }),
    mapping,
  };
};

function quantile(sorted: number[], probability: number): number {
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower] +
    (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction;
}

/** Compact CPU-reference boxplot product: one row per effective x/group. */
const statBoxplot: StatFn = (data, mapping, params) => {
  if (
    mapping.lower && mapping.middle && mapping.upper && mapping.ymin &&
    mapping.ymax
  ) {
    return { data, mapping };
  }
  const xCol = mapping.x;
  const yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) {
    return { data, mapping };
  }
  const groupCols = groupColumnsOf(mapping, data).filter((column) =>
    column !== xCol
  );
  const groups = new Map<
    string,
    { x: unknown; values: number[]; group: Record<string, unknown> }
  >();
  const xs = columnValues(data, xCol);
  const ys = numericColumnValues(data, yCol);
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const y = ys[i];
    if (typeof y !== "number" || !Number.isFinite(y)) continue;
    const key = `${String(xs[i])}\0${groupKeyAt(data, groupCols, i)}`;
    const entry = groups.get(key) ??
      { x: xs[i], values: [], group: groupValuesAt(data, groupCols, i) };
    entry.values.push(y);
    groups.set(key, entry);
  }
  const rows = [...groups.values()].map((entry) => {
    const values = entry.values.sort((a, b) => a - b);
    const lower = quantile(values, 0.25);
    const middle = quantile(values, 0.5);
    const upper = quantile(values, 0.75);
    const iqr = upper - lower;
    const fenceLow = lower - ((params.coef as number) ?? 1.5) * iqr;
    const fenceHigh = upper + ((params.coef as number) ?? 1.5) * iqr;
    return {
      entry,
      lower,
      middle,
      upper,
      ymin: values.find((value) => value >= fenceLow) ?? values[0],
      ymax: [...values].reverse().find((value) => value <= fenceHigh) ??
        values.at(-1)!,
    };
  });
  return {
    data: dataFrameFromColumns({
      [xCol]: rows.map((row) => row.entry.x),
      ...Object.fromEntries(
        groupCols.map((column) => [
          column,
          rows.map((row) => row.entry.group[column]),
        ]),
      ),
      lower: rows.map((row) => row.lower),
      middle: rows.map((row) => row.middle),
      upper: rows.map((row) => row.upper),
      ymin: rows.map((row) => row.ymin),
      ymax: rows.map((row) => row.ymax),
    }),
    mapping: {
      ...mapping,
      lower: "lower",
      middle: "middle",
      upper: "upper",
      ymin: "ymin",
      ymax: "ymax",
    },
  };
};

function densityGrid(
  values: number[],
  n: number,
  bandwidth?: number,
): { samples: number[]; density: number[] } {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { samples: [], density: [] };
  const lo = sorted[0], hi = sorted.at(-1)!;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance = sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, sorted.length - 1);
  const bw = bandwidth ??
    Math.max(
      Number.EPSILON,
      1.06 * Math.sqrt(variance) * sorted.length ** -0.2,
    );
  const samples = Array.from(
    { length: n },
    (_, i) => lo + (hi - lo || 1) * i / Math.max(1, n - 1),
  );
  const norm = sorted.length * bw * Math.sqrt(2 * Math.PI);
  return {
    samples,
    density: samples.map((sample) =>
      sorted.reduce(
        (sum, value) => sum + Math.exp(-0.5 * ((sample - value) / bw) ** 2),
        0,
      ) / norm
    ),
  };
}

function statDensityAxis(axis: "x" | "y"): StatFn {
  return (data, mapping, params) => {
    const valueCol = mapping[axis];
    if (!valueCol || !(valueCol in data)) return { data, mapping };
    const groupCols = groupColumnsOf(mapping, data).filter((column) =>
      column !== valueCol
    );
    const grouped = new Map<
      string,
      { rows: number[]; group: Record<string, unknown> }
    >();
    for (let i = 0; i < rowCount(data); i++) {
      const key = groupKeyAt(data, groupCols, i);
      const entry = grouped.get(key) ??
        { rows: [], group: groupValuesAt(data, groupCols, i) };
      entry.rows.push(i);
      grouped.set(key, entry);
    }
    const out: Record<string, unknown[]> = { [valueCol]: [], density: [] };
    for (const column of groupCols) out[column] = [];
    for (const entry of grouped.values()) {
      const raw = numericColumnValues(data, valueCol);
      const grid = densityGrid(
        entry.rows.map((row) => raw[row]).filter((value): value is number =>
          typeof value === "number" && Number.isFinite(value)
        ),
        Math.max(2, (params.n as number) ?? 128),
        params.bw as number | undefined,
      );
      out[valueCol].push(...grid.samples);
      out.density.push(...grid.density);
      for (const column of groupCols) {
        out[column].push(...grid.samples.map(() => entry.group[column]));
      }
    }
    return {
      data: dataFrameFromColumns(out),
      mapping: axis === "x"
        ? { ...mapping, x: valueCol, y: "density", density: "density" }
        : { ...mapping, y: valueCol, density: "density" },
    };
  };
}

const statDotplot: StatFn = (data, mapping, params) => {
  const xCol = mapping.x;
  if (!xCol || !(xCol in data)) return { data, mapping };
  const raw = numericColumnValues(data, xCol);
  const groupCols = groupColumnsOf(mapping, data).filter((column) =>
    column !== xCol
  );
  const grouped = new Map<
    string,
    { values: number[]; group: Record<string, unknown> }
  >();
  for (let i = 0; i < raw.length; i++) {
    const value = raw[i];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const key = groupKeyAt(data, groupCols, i);
    const entry = grouped.get(key) ?? {
      values: [],
      group: groupValuesAt(data, groupCols, i),
    };
    entry.values.push(value);
    grouped.set(key, entry);
  }
  const allValues = [...grouped.values()].flatMap((entry) => entry.values);
  if (!allValues.length) return { data, mapping };
  const bins = Math.max(1, (params.bins as number) ?? 30);
  const lo = Math.min(...allValues), hi = Math.max(...allValues);
  const width = (params.binwidth as number) ?? ((hi - lo || 1) / bins);
  const centers: number[] = [];
  const stacks: number[] = [];
  const groupOut: Record<string, unknown[]> = Object.fromEntries(
    groupCols.map((column) => [column, []]),
  );
  for (const entry of grouped.values()) {
    const counts = new Map<number, number>();
    for (const value of entry.values) {
      const bin = Math.floor((value - lo) / width);
      const stack = (counts.get(bin) ?? 0) + 1;
      counts.set(bin, stack);
      centers.push(lo + (bin + 0.5) * width);
      stacks.push(stack);
      for (const column of groupCols) {
        groupOut[column].push(entry.group[column]);
      }
    }
  }
  return {
    data: dataFrameFromColumns({
      [xCol]: centers,
      ...groupOut,
      dotstack: stacks,
    }),
    mapping: { ...mapping, x: xCol, y: "dotstack" },
  };
};

/** Dense grouped 2D count grid, compacted to observed cells for CPU marks. */
const statBin2d: StatFn = (data, mapping, params) => {
  const xCol = mapping.x;
  const yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) {
    return { data, mapping };
  }
  const xs = numericColumnValues(data, xCol);
  const ys = numericColumnValues(data, yCol);
  const finite = xs.flatMap((x, i) =>
    typeof x === "number" && Number.isFinite(x) && typeof ys[i] === "number" &&
      Number.isFinite(ys[i])
      ? [i]
      : []
  );
  if (!finite.length) return { data, mapping };
  const xValues = finite.map((i) => xs[i] as number);
  const yValues = finite.map((i) => ys[i] as number);
  const groups = encodeEffectiveGroups(mapping, data, finite);
  const xLo = Math.min(...xValues), xHi = Math.max(...xValues);
  const yLo = Math.min(...yValues), yHi = Math.max(...yValues);
  const bins = Math.max(1, (params.bins as number) ?? 30);
  const xBins = Math.max(1, (params.xbins as number) ?? bins);
  const yBins = Math.max(1, (params.ybins as number) ?? bins);
  const product = groupedHistogram2d({
    x: Float32Array.from(xValues),
    y: Float32Array.from(yValues),
    xLo,
    xHi,
    yLo,
    yHi,
    xBins,
    yBins,
    groupIds: groups.ids,
    groupsCount: groups.values.length,
  });
  const out: Record<string, unknown[]> = {
    [xCol]: [],
    [yCol]: [],
    count: [],
    binwidthX: [],
    binwidthY: [],
  };
  for (const column of groups.columns) out[column] = [];
  for (let group = 0; group < product.groupsCount; group++) {
    for (let y = 0; y < product.yBins; y++) {
      for (let x = 0; x < product.xBins; x++) {
        const count = product
          .counts[
            group * product.yBins * product.xBins + y * product.xBins + x
          ];
        if (!count) continue;
        out[xCol].push(product.xCenters[x]);
        out[yCol].push(product.yCenters[y]);
        out.count.push(count);
        out.binwidthX.push(xHi > xLo ? (xHi - xLo) / xBins : 1);
        out.binwidthY.push(yHi > yLo ? (yHi - yLo) / yBins : 1);
        for (const column of groups.columns) {
          out[column].push(groups.values[group][column]);
        }
      }
    }
  }
  return {
    data: dataFrameFromColumns(out),
    mapping: { ...mapping, x: xCol, y: yCol, fill: "count" },
  };
};

// Peter J. Acklam's rational approximation of the standard-normal quantile.
function normalQuantile(p: number): number {
  const a = [
    -39.6968302866538,
    220.946098424521,
    -275.928510446969,
    138.357751867269,
    -30.6647980661472,
    2.50662827745924,
  ];
  const b = [
    -54.4760987982241,
    161.585836858041,
    -155.698979859887,
    66.8013118877197,
    -13.2806815528857,
  ];
  const c = [
    -0.00778489400243029,
    -0.322396458041136,
    -2.40075827716184,
    -2.54973253934373,
    4.37466414146497,
    2.93816398269878,
  ];
  const d = [
    0.00778469570904146,
    0.32246712907004,
    2.445134137143,
    3.75440866190742,
  ];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
      c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - low) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
    q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function statQqProduct(line: boolean): StatFn {
  return (data, mapping) => {
    const sampleCol = mapping.y ?? mapping.x;
    if (!sampleCol || !(sampleCol in data)) return { data, mapping };
    const groupCols = groupColumnsOf(mapping, data).filter((column) =>
      column !== sampleCol
    );
    const grouped = new Map<
      string,
      { sample: number[]; group: Record<string, unknown> }
    >();
    const raw = numericColumnValues(data, sampleCol);
    for (let i = 0; i < raw.length; i++) {
      const value = raw[i];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const key = groupKeyAt(data, groupCols, i);
      const entry = grouped.get(key) ?? {
        sample: [],
        group: groupValuesAt(data, groupCols, i),
      };
      entry.sample.push(value);
      grouped.set(key, entry);
    }
    const out: Record<string, unknown[]> = { qqx: [], qqy: [] };
    for (const column of groupCols) out[column] = [];
    for (const entry of grouped.values()) {
      const sample = entry.sample.sort((a, b) => a - b);
      const xs = line
        ? [normalQuantile(0.25), normalQuantile(0.75)]
        : sample.map((_, i) => normalQuantile((i + 0.5) / sample.length));
      const ys = line
        ? [quantile(sample, 0.25), quantile(sample, 0.75)]
        : sample;
      out.qqx.push(...xs);
      out.qqy.push(...ys);
      for (const column of groupCols) {
        out[column].push(...xs.map(() => entry.group[column]));
      }
    }
    if (out.qqx.length === 0) return { data, mapping };
    return {
      data: dataFrameFromColumns(out),
      mapping: { ...mapping, x: "qqx", y: "qqy" },
    };
  };
}

const statEllipse: StatFn = (data, mapping, params) => {
  const xCol = mapping.x, yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) {
    return { data, mapping };
  }
  const groupCols = groupColumnsOf(mapping, data).filter((column) =>
    column !== xCol && column !== yCol
  );
  const grouped = new Map<
    string,
    { pairs: [number, number][]; group: Record<string, unknown> }
  >();
  const xs = numericColumnValues(data, xCol);
  const ys = numericColumnValues(data, yCol);
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const x = xs[i], y = ys[i];
    if (
      typeof x !== "number" || !Number.isFinite(x) ||
      typeof y !== "number" || !Number.isFinite(y)
    ) continue;
    const key = groupKeyAt(data, groupCols, i);
    const entry = grouped.get(key) ?? {
      pairs: [],
      group: groupValuesAt(data, groupCols, i),
    };
    entry.pairs.push([x, y]);
    grouped.set(key, entry);
  }
  const level = (params.level as number) ?? 0.95;
  const radius = Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, 1 - level)));
  const n = Math.max(4, (params.n as number) ?? 80);
  const out: Record<string, unknown[]> = { ellipsex: [], ellipsey: [] };
  for (const column of groupCols) out[column] = [];
  for (const entry of grouped.values()) {
    const pairs = entry.pairs;
    if (pairs.length < 2) continue;
    const mx = pairs.reduce((sum, [x]) => sum + x, 0) / pairs.length;
    const my = pairs.reduce((sum, [, y]) => sum + y, 0) / pairs.length;
    const denom = Math.max(1, pairs.length - 1);
    const sxx = pairs.reduce((sum, [x]) => sum + (x - mx) ** 2, 0) / denom;
    const syy = pairs.reduce((sum, [, y]) => sum + (y - my) ** 2, 0) / denom;
    const sxy = pairs.reduce((sum, [x, y]) => sum + (x - mx) * (y - my), 0) /
      denom;
    const trace = sxx + syy;
    const delta = Math.sqrt(Math.max(0, (sxx - syy) ** 2 + 4 * sxy ** 2));
    const l1 = Math.max(0, (trace + delta) / 2);
    const l2 = Math.max(0, (trace - delta) / 2);
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const points = Array.from({ length: n + 1 }, (_, i) => {
      const theta = 2 * Math.PI * i / n;
      const u = radius * Math.sqrt(l1) * Math.cos(theta);
      const v = radius * Math.sqrt(l2) * Math.sin(theta);
      return [
        mx + u * Math.cos(angle) - v * Math.sin(angle),
        my + u * Math.sin(angle) + v * Math.cos(angle),
      ];
    });
    out.ellipsex.push(...points.map(([x]) => x));
    out.ellipsey.push(...points.map(([, y]) => y));
    for (const column of groupCols) {
      out[column].push(...points.map(() => entry.group[column]));
    }
  }
  if (out.ellipsex.length === 0) return { data, mapping };
  return {
    data: dataFrameFromColumns(out),
    mapping: { ...mapping, x: "ellipsex", y: "ellipsey" },
  };
};

const statFunctionProduct: StatFn = (data, mapping, params) => {
  const fun = params.fun;
  if (typeof fun !== "function") return { data, mapping };
  const sourceX = mapping.x && mapping.x in data
    ? numericColumnValues(data, mapping.x).filter((value): value is number =>
      typeof value === "number" && Number.isFinite(value)
    )
    : [];
  const xlim = params.xlim as [number, number] | undefined;
  const lo = xlim?.[0] ?? (sourceX.length ? Math.min(...sourceX) : 0);
  const hi = xlim?.[1] ?? (sourceX.length ? Math.max(...sourceX) : 1);
  const n = Math.max(2, (params.n as number) ?? 101);
  const xs = Array.from({ length: n }, (_, i) => lo + (hi - lo) * i / (n - 1));
  return {
    data: dataFrameFromColumns({
      functionx: xs,
      functiony: xs.map((x) => (fun as (x: number) => number)(x)),
    }),
    mapping: { ...mapping, x: "functionx", y: "functiony" },
  };
};

function contourBreaks(
  values: number[],
  params: Record<string, unknown>,
): number[] {
  const explicit = params.breaks;
  if (Array.isArray(explicit)) {
    return explicit.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  }
  const lo = Math.min(...values), hi = Math.max(...values);
  const bins = Math.max(1, (params.bins as number) ?? 10);
  return Array.from(
    { length: Math.max(0, bins - 1) },
    (_, i) => lo + (hi - lo) * (i + 1) / bins,
  );
}

const statContour: StatFn = (data, mapping, params) => {
  const xCol = mapping.x, yCol = mapping.y, zCol = mapping.z ?? mapping.fill;
  if (
    !xCol || !yCol || !zCol || !(xCol in data) || !(yCol in data) ||
    !(zCol in data)
  ) return { data, mapping };
  const xs = [
    ...new Set(
      numericColumnValues(data, xCol).filter((v): v is number =>
        typeof v === "number" && Number.isFinite(v)
      ),
    ),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set(
      numericColumnValues(data, yCol).filter((v): v is number =>
        typeof v === "number" && Number.isFinite(v)
      ),
    ),
  ].sort((a, b) => a - b);
  const rawX = numericColumnValues(data, xCol),
    rawY = numericColumnValues(data, yCol),
    rawZ = numericColumnValues(data, zCol);
  const grid = new Map<string, number>();
  const zValues: number[] = [];
  for (let i = 0; i < Math.min(rawX.length, rawY.length, rawZ.length); i++) {
    const x = rawX[i], y = rawY[i], z = rawZ[i];
    if (
      typeof x === "number" && typeof y === "number" && typeof z === "number" &&
      Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ) {
      grid.set(`${x}\0${y}`, z);
      zValues.push(z);
    }
  }
  const out = {
    contourx: [] as number[],
    contoury: [] as number[],
    contourxend: [] as number[],
    contouryend: [] as number[],
    level: [] as number[],
  };
  const interpolate = (
    a: [number, number, number],
    b: [number, number, number],
    level: number,
  ): [number, number] => {
    const t = a[2] === b[2] ? 0.5 : (level - a[2]) / (b[2] - a[2]);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  for (const level of contourBreaks(zValues, params)) {
    for (let yi = 0; yi < ys.length - 1; yi++) {
      for (let xi = 0; xi < xs.length - 1; xi++) {
        const corners: [number, number, number][] = [
          [xs[xi], ys[yi], grid.get(`${xs[xi]}\0${ys[yi]}`) ?? NaN],
          [xs[xi + 1], ys[yi], grid.get(`${xs[xi + 1]}\0${ys[yi]}`) ?? NaN],
          [
            xs[xi + 1],
            ys[yi + 1],
            grid.get(`${xs[xi + 1]}\0${ys[yi + 1]}`) ?? NaN,
          ],
          [xs[xi], ys[yi + 1], grid.get(`${xs[xi]}\0${ys[yi + 1]}`) ?? NaN],
        ];
        if (
          corners.some((corner) => !Number.isFinite(corner[2]))
        ) continue;
        const points: [number, number][] = [];
        for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]] as const) {
          if ((corners[a][2] < level) !== (corners[b][2] < level)) {
            points.push(interpolate(corners[a], corners[b], level));
          }
        }
        for (let i = 0; i + 1 < points.length; i += 2) {
          out.contourx.push(points[i][0]);
          out.contoury.push(points[i][1]);
          out.contourxend.push(points[i + 1][0]);
          out.contouryend.push(points[i + 1][1]);
          out.level.push(level);
        }
      }
    }
  }
  return {
    data: dataFrameFromColumns(out),
    mapping: {
      ...mapping,
      x: "contourx",
      y: "contoury",
      xend: "contourxend",
      yend: "contouryend",
      color: "level",
    },
  };
};

const statContourFilled: StatFn = (data, mapping, params) => {
  const zCol = mapping.z ?? mapping.fill;
  if (!zCol || !(zCol in data)) return { data, mapping };
  const values = numericColumnValues(data, zCol);
  const finite = values.filter((v): v is number =>
    typeof v === "number" && Number.isFinite(v)
  );
  if (!finite.length) return { data, mapping };
  const breaks = contourBreaks(finite, params);
  const bands = values.map((value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return Number.NaN;
    return breaks.findIndex((limit) => value < limit) < 0
      ? breaks.length
      : breaks.findIndex((limit) => value < limit);
  });
  return {
    data: dataFrameFromColumns({
      ...Object.fromEntries(
        Object.keys(data).map((column) => [column, columnValues(data, column)]),
      ),
      contourband: bands,
    }),
    mapping: { ...mapping, fill: "contourband" },
  };
};

const REGISTRY: Record<Layer["stat"], StatFn> = {
  identity: statIdentity,
  count: statCount,
  bin: statBin,
  smooth: statSmooth,
  summary: statSummary,
  boxplot: statBoxplot,
  density: statDensityAxis("x"),
  ydensity: statDensityAxis("y"),
  dotplot: statDotplot,
  bin2d: statBin2d,
  binhex: statBin2d,
  qq: statQqProduct(false),
  qqline: statQqProduct(true),
  ellipse: statEllipse,
  function: statFunctionProduct,
  contour: statContour,
  contourfilled: statContourFilled,
};

export function applyStat(
  layer: Layer,
  mapping: Aes,
  data: InputData,
): StatResult {
  return REGISTRY[layer.stat](ingest(data), mapping, layer.params);
}
