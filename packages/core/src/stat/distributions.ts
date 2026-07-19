import { groupedHistogram2d } from "@gggplot/reductions";
import type { Aes, DataFrame } from "../ir/types.ts";
import {
  columnValues,
  dataFrameFromColumns,
  numericColumnValues,
} from "../data/mod.ts";
import {
  groupColumnsOf,
  groupKeyAt,
  groupValuesAt,
  isDiscreteColumn,
  rowCount,
  sliceRows,
} from "../group/mod.ts";
import type { StatFn } from "./shared.ts";
import { encodeEffectiveGroups } from "./shared.ts";

export function quantile(sorted: number[], probability: number): number {
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower] +
    (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction;
}

/** Compact CPU-reference boxplot product: one row per effective x/group. */
export const statBoxplot: StatFn = (data, mapping, params) => {
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

export function densityGrid(
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

export function statDensityAxis(axis: "x" | "y"): StatFn {
  return (data, mapping, params) => {
    const valueCol = mapping[axis];
    if (!valueCol || !(valueCol in data)) return { data, mapping };
    const implicitGroupCols = groupColumnsOf(mapping, data).filter((column) =>
      column !== valueCol
    );
    // The OTHER position axis (x for ydensity/violin, y for density) is not
    // part of IMPLICIT_GROUP_AES, so a plain aes(x=<discrete>, y=<value>)
    // with no color/fill/shape/linetype mapped would otherwise pool every
    // position category into a single density curve and drop the position
    // column from the output entirely (gggplot-8vu). When no other implicit
    // group is already in play, promote the discrete position axis to a
    // grouping + carry-through column, mirroring ggplot2's stat_ydensity
    // computing one density per x group. Leave the established color/fill
    // grouping path untouched.
    const posAxis = axis === "y" ? "x" : "y";
    const posCol = mapping[posAxis];
    const posColIsDiscretePosition = implicitGroupCols.length === 0 &&
      !!posCol && posCol !== valueCol && posCol in data &&
      isDiscreteColumn(data, posCol, columnValues(data, posCol));
    const groupCols = posColIsDiscretePosition
      ? [...implicitGroupCols, posCol]
      : implicitGroupCols;
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
    // Downstream lowering (e.g. lowerViolin) splits marks by
    // splitByEffectiveGroup, which honors an explicit `group` aesthetic
    // before falling back to IMPLICIT_GROUP_AES. Since the promoted position
    // axis isn't in IMPLICIT_GROUP_AES, surface it as `group` so each
    // position category renders as its own curve. Only do this when the
    // caller didn't already set an explicit group — never override it.
    const groupMapping = posColIsDiscretePosition && !mapping.group
      ? { group: posCol }
      : {};
    return {
      data: dataFrameFromColumns(out),
      mapping: axis === "x"
        ? {
          ...mapping,
          x: valueCol,
          y: "density",
          density: "density",
          ...groupMapping,
        }
        : { ...mapping, y: valueCol, density: "density", ...groupMapping },
    };
  };
}

export const statDotplot: StatFn = (data, mapping, params) => {
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
export const statBin2d: StatFn = (data, mapping, params) => {
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

/** Grouped rectangular/hex cell summaries over a required numeric z mapping. */
export const statSummary2d: StatFn = (data, mapping, params) => {
  const xCol = mapping.x, yCol = mapping.y, zCol = mapping.z;
  if (
    !xCol || !yCol || !zCol || !(xCol in data) || !(yCol in data) ||
    !(zCol in data)
  ) {
    throw new TypeError(
      "[gggplot] 2D summary stats require numeric x, y, and z mappings",
    );
  }
  if (params.weight !== undefined) {
    throw new TypeError(
      "[gggplot] 2D summary stats do not support weights in V1",
    );
  }
  const xs = numericColumnValues(data, xCol),
    ys = numericColumnValues(data, yCol),
    zs = numericColumnValues(data, zCol);
  const finite = Array.from({
    length: Math.min(xs.length, ys.length, zs.length),
  }, (_, i) => i)
    .filter((i) =>
      [xs[i], ys[i], zs[i]].every((value) =>
        typeof value === "number" && Number.isFinite(value)
      )
    );
  if (!finite.length) {
    return {
      data: dataFrameFromColumns({
        [xCol]: [],
        [yCol]: [],
        value: [],
        count: [],
      }),
      mapping: {
        ...mapping,
        ...(mapping.fill || params.fill !== undefined ? {} : { fill: "value" }),
      },
    };
  }
  const xValues = finite.map((i) => xs[i] as number),
    yValues = finite.map((i) => ys[i] as number);
  const xMin = Math.min(...xValues),
    xMax = Math.max(...xValues),
    yMin = Math.min(...yValues),
    yMax = Math.max(...yValues);
  const bins = Math.max(1, Number(params.bins ?? 30));
  const pairWidth = Array.isArray(params.binwidth)
    ? params.binwidth
    : undefined;
  const requestedXWidth = Number(
    params.xbinwidth ?? pairWidth?.[0] ?? params.binwidth,
  );
  const requestedYWidth = Number(
    params.ybinwidth ?? pairWidth?.[1] ?? params.binwidth,
  );
  const pairBoundary = Array.isArray(params.boundary)
    ? params.boundary
    : undefined;
  const requestedXBoundary = Number(
    params.xboundary ?? pairBoundary?.[0] ?? params.boundary,
  );
  const requestedYBoundary = Number(
    params.yboundary ?? pairBoundary?.[1] ?? params.boundary,
  );
  const xOrigin = Number.isFinite(requestedXBoundary) &&
      Number.isFinite(requestedXWidth) && requestedXWidth > 0
    ? requestedXBoundary +
      Math.floor((xMin - requestedXBoundary) / requestedXWidth) *
        requestedXWidth
    : xMin;
  const yOrigin = Number.isFinite(requestedYBoundary) &&
      Number.isFinite(requestedYWidth) && requestedYWidth > 0
    ? requestedYBoundary +
      Math.floor((yMin - requestedYBoundary) / requestedYWidth) *
        requestedYWidth
    : yMin;
  const xBins = Number.isFinite(requestedXWidth) && requestedXWidth > 0
    ? Math.max(1, Math.ceil((xMax - xOrigin) / requestedXWidth))
    : Math.max(1, Number(params.xbins ?? bins));
  const yBins = Number.isFinite(requestedYWidth) && requestedYWidth > 0
    ? Math.max(1, Math.ceil((yMax - yOrigin) / requestedYWidth))
    : Math.max(1, Number(params.ybins ?? bins));
  if (![xBins, yBins].every(Number.isInteger)) {
    throw new TypeError(
      "[gggplot] 2D summary bins must resolve to positive integers",
    );
  }
  const xWidth = Number.isFinite(requestedXWidth) && requestedXWidth > 0
    ? requestedXWidth
    : (xMax > xMin ? (xMax - xMin) / xBins : 1);
  const yWidth = Number.isFinite(requestedYWidth) && requestedYWidth > 0
    ? requestedYWidth
    : (yMax > yMin ? (yMax - yMin) / yBins : 1);
  const groups = encodeEffectiveGroups(mapping, data, finite);
  const cells = new Map<
    string,
    { group: number; xi: number; yi: number; values: number[] }
  >();
  const hex = params.hex === true;
  finite.forEach((row, i) => {
    const xi = Math.min(
      xBins - 1,
      Math.max(0, Math.floor(((xs[row] as number) - xOrigin) / xWidth)),
    );
    const yOffset = hex && xi % 2 === 1 ? 0.5 : 0;
    const yi = Math.min(
      yBins - 1,
      Math.max(
        0,
        Math.floor(((ys[row] as number) - yOrigin) / yWidth - yOffset),
      ),
    );
    const group = groups.ids?.[i] ?? 0, key = `${group}:${yi}:${xi}`;
    const cell = cells.get(key) ?? { group, xi, yi, values: [] };
    cell.values.push(zs[row] as number);
    cells.set(key, cell);
  });
  const fun = params.fun ?? "mean";
  const summarize = (values: number[]): number => {
    if (typeof fun === "function") return Number(fun(values));
    const sorted = [...values].sort((a, b) => a - b);
    if (fun === "mean") {
      return values.reduce((a, b) => a + b, 0) / values.length;
    }
    if (fun === "median") return quantile(sorted, 0.5);
    if (fun === "sum") return values.reduce((a, b) => a + b, 0);
    if (fun === "min") return Math.min(...values);
    if (fun === "max") return Math.max(...values);
    throw new TypeError(
      `[gggplot] unsupported 2D summary reducer "${String(fun)}"`,
    );
  };
  const out: Record<string, unknown[]> = {
    [xCol]: [],
    [yCol]: [],
    value: [],
    count: [],
    binwidthX: [],
    binwidthY: [],
  };
  for (const column of groups.columns) out[column] = [];
  for (const cell of cells.values()) {
    out[xCol].push(xOrigin + (cell.xi + 0.5) * xWidth);
    out[yCol].push(
      yOrigin +
        (cell.yi + 0.5 + (hex && cell.xi % 2 === 1 ? 0.5 : 0)) * yWidth,
    );
    out.value.push(summarize(cell.values));
    out.count.push(cell.values.length);
    out.binwidthX.push(xWidth);
    out.binwidthY.push(yWidth);
    for (const column of groups.columns) {
      out[column].push(groups.values[cell.group][column]);
    }
  }
  return {
    data: dataFrameFromColumns(out),
    mapping: {
      ...mapping,
      ...(mapping.fill || params.fill !== undefined ? {} : { fill: "value" }),
    },
  };
};

// Peter J. Acklam's rational approximation of the standard-normal quantile.
