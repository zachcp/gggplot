import { groupedSummary1d } from "@gggplot/reductions";
import {
  columnValues,
  dataFrameFromColumns,
  numericColumnValues,
} from "../data/mod.ts";
import { groupColumnsOf, groupKeyAt, groupValuesAt } from "../group/mod.ts";
import type { StatFn } from "./shared.ts";
import { encodeEffectiveGroups, encodeValueIds } from "./shared.ts";

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
export const statSummary: StatFn = (data, mapping, params) => {
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
