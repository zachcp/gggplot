import { groupedCount1d, groupedHistogram1d } from "@gggplot/reductions";
import {
  columnValues,
  dataFrameFromColumns,
  numericColumnValues,
} from "../data/mod.ts";
import type { StatFn } from "./shared.ts";
import {
  encodeEffectiveGroups,
  encodeValueIds,
  statWeights,
} from "./shared.ts";
import {
  groupKeyAt,
  groupValuesAt,
  rowCount,
  sliceRows,
} from "../group/mod.ts";

/** Expand effective-group counts into unit tile rows, column-major from bottom-left. */
export const statWaffleProduct: StatFn = (data, mapping, params) => {
  const rows = Number(params.rows ?? 10);
  const maxCells = Number(params.maxCells ?? 10000);
  if (!Number.isInteger(rows) || rows < 1) {
    throw new TypeError(
      "[gggplot] stat waffle rows must be a positive integer",
    );
  }
  if (!Number.isInteger(maxCells) || maxCells < 1) {
    throw new TypeError(
      "[gggplot] stat waffle maxCells must be a positive integer",
    );
  }
  if ((params.direction ?? "column") !== "column") {
    throw new TypeError('[gggplot] stat waffle direction must be "column"');
  }
  const sourceRows = Array.from({ length: rowCount(data) }, (_, row) => row);
  const groups = encodeEffectiveGroups(mapping, data, sourceRows);
  const weights = statWeights(data, params, sourceRows);
  const counts = new Float64Array(groups.values.length || 1);
  for (let row = 0; row < sourceRows.length; row++) {
    const weight = weights?.[row] ?? 1;
    if (!Number.isFinite(weight)) continue;
    if (weight < 0) {
      throw new TypeError("[gggplot] stat waffle counts must be non-negative");
    }
    counts[groups.ids?.[row] ?? 0] += weight;
  }
  for (const count of counts) {
    if (!Number.isInteger(count)) {
      throw new TypeError(
        "[gggplot] stat waffle counts must resolve to integers",
      );
    }
  }
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total > maxCells) {
    throw new RangeError(
      `[gggplot] stat waffle ${total} cells exceeds maxCells ${maxCells}`,
    );
  }
  const out: Record<string, unknown[]> = { waffleX: [], waffleY: [] };
  for (const column of groups.columns) out[column] = [];
  let cell = 0;
  for (let group = 0; group < counts.length; group++) {
    for (let offset = 0; offset < counts[group]; offset++, cell++) {
      out.waffleX.push(Math.floor(cell / rows));
      out.waffleY.push(cell % rows);
      for (const column of groups.columns) {
        out[column].push(groups.values[group]?.[column]);
      }
    }
  }
  return {
    data: dataFrameFromColumns(out),
    mapping: { ...mapping, x: "waffleX", y: "waffleY" },
  };
};

export const statUniqueProduct: StatFn = (data, mapping) => {
  const columns = Object.keys(data);
  const count = columns.length ? columnValues(data, columns[0]).length : 0;
  const seen = new Set<string>();
  const retained: number[] = [];
  for (let row = 0; row < count; row++) {
    const key = columns.map((column) => {
      const value = columnValues(data, column)[row];
      if (typeof value === "number" && Number.isNaN(value)) return "number:NaN";
      return `${typeof value}:${String(value)}`;
    }).join("\0");
    if (seen.has(key)) continue;
    seen.add(key);
    retained.push(row);
  }
  return { data: sliceRows(data, retained), mapping };
};

export const statEcdfProduct: StatFn = (data, mapping, params) => {
  if (params.weight !== undefined) {
    throw new TypeError("[gggplot] stat ecdf does not support weights in V1");
  }
  const xCol = mapping.x;
  if (!xCol || !(xCol in data)) {
    throw new TypeError("[gggplot] stat ecdf requires a numeric x mapping");
  }
  const groupColumns = encodeEffectiveGroups(mapping, data).columns;
  const grouped = new Map<
    string,
    { values: number[]; group: Record<string, unknown> }
  >();
  const xs = numericColumnValues(data, xCol);
  for (let row = 0; row < xs.length; row++) {
    const value = xs[row];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const key = groupKeyAt(data, groupColumns, row);
    const group = grouped.get(key) ??
      { values: [], group: groupValuesAt(data, groupColumns, row) };
    group.values.push(value);
    grouped.set(key, group);
  }
  const out: Record<string, unknown[]> = { [xCol]: [], ecdf: [] };
  for (const column of groupColumns) out[column] = [];
  for (const group of grouped.values()) {
    group.values.sort((a, b) => a - b);
    const distinct: Array<[number, number]> = [];
    for (const value of group.values) {
      const last = distinct.at(-1);
      if (last?.[0] === value) last[1]++;
      else distinct.push([value, 1]);
    }
    const rows: Array<[number, number]> = [];
    if (params.pad !== false) rows.push([Number.NEGATIVE_INFINITY, 0]);
    let cumulative = 0;
    for (const [value, count] of distinct) {
      cumulative += count;
      rows.push([value, cumulative / group.values.length]);
    }
    if (params.pad !== false) rows.push([Number.POSITIVE_INFINITY, 1]);
    for (const [x, y] of rows) {
      out[xCol].push(x);
      out.ecdf.push(y);
      for (const column of groupColumns) out[column].push(group.group[column]);
    }
  }
  const resultData = dataFrameFromColumns(out);
  return {
    data: {
      ...resultData,
      [xCol]: { type: "numeric", values: out[xCol] as number[] },
    },
    mapping: { ...mapping, y: "ecdf" },
  };
};

/** Collapse duplicate x/y/effective-group tuples into serializable n/prop rows. */
export const statSumProduct: StatFn = (data, mapping, params) => {
  const xCol = mapping.x;
  const yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) {
    throw new TypeError('[gggplot] stat "sum" requires x and y mappings');
  }
  const xs = columnValues(data, xCol);
  const ys = columnValues(data, yCol);
  const sourceRows = [...Array(Math.min(xs.length, ys.length)).keys()];
  const groups = encodeEffectiveGroups(mapping, data, sourceRows);
  const weights = statWeights(data, params, sourceRows);
  const tuples = new Map<
    string,
    { x: unknown; y: unknown; group: number; n: number }
  >();
  for (let row = 0; row < sourceRows.length; row++) {
    const weight = weights?.[row] ?? 1;
    if (!Number.isFinite(weight)) continue;
    const group = groups.ids?.[row] ?? 0;
    const key = `${group}\0${String(xs[row])}\0${String(ys[row])}`;
    const tuple = tuples.get(key) ?? { x: xs[row], y: ys[row], group, n: 0 };
    tuple.n += weight;
    tuples.set(key, tuple);
  }
  const totals = new Float64Array(groups.values.length);
  for (const tuple of tuples.values()) totals[tuple.group] += tuple.n;
  const xOut: unknown[] = [];
  const yOut: unknown[] = [];
  const nOut: number[] = [];
  const propOut: number[] = [];
  const groupOut: Record<string, unknown[]> = Object.fromEntries(
    groups.columns.filter((column) => column !== xCol && column !== yCol)
      .map((column) => [column, []]),
  );
  for (const tuple of tuples.values()) {
    xOut.push(tuple.x);
    yOut.push(tuple.y);
    nOut.push(tuple.n);
    propOut.push(totals[tuple.group] === 0 ? 0 : tuple.n / totals[tuple.group]);
    for (const column of Object.keys(groupOut)) {
      groupOut[column].push(groups.values[tuple.group][column]);
    }
  }
  return {
    data: dataFrameFromColumns({
      [xCol]: xOut,
      [yCol]: yOut,
      ...groupOut,
      n: nOut,
      prop: propOut,
    }),
    mapping,
  };
};

/** Count rows per distinct x value; produces `count`, mapped to y unless already set. */
export const statCount: StatFn = (data, mapping, params) => {
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
export const statBin: StatFn = (data, mapping, params) => {
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
