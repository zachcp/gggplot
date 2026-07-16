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

const REGISTRY: Record<Layer["stat"], StatFn> = {
  identity: statIdentity,
  count: statCount,
  bin: statBin,
  smooth: statSmooth,
  summary: statSummary,
};

export function applyStat(
  layer: Layer,
  mapping: Aes,
  data: InputData,
): StatResult {
  return REGISTRY[layer.stat](ingest(data), mapping, layer.params);
}
