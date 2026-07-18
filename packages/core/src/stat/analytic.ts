import type { DataFrame } from "../ir/types.ts";
import {
  columnValues,
  dataFrameFromColumns,
  ingest,
  numericColumnValues,
} from "../data/mod.ts";
import {
  groupColumnsOf,
  groupKeyAt,
  groupValuesAt,
  rowCount,
  sliceRows,
} from "../group/mod.ts";
import type { InputData } from "../data/mod.ts";
import type { StatFn } from "./shared.ts";
import { quantile } from "./distributions.ts";

/** Expand consecutive grouped points into serializable connector vertices. */
export const statConnectProduct: StatFn = (data, mapping, params) => {
  const xCol = mapping.x, yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) {
    throw new TypeError(
      "[gggplot] stat connect requires numeric x and y mappings",
    );
  }
  const connection = String(params.connection ?? "linear");
  if (!["linear", "hv", "vh", "mid", "sigmoid"].includes(connection)) {
    throw new TypeError(`[gggplot] unsupported connection "${connection}"`);
  }
  const samples = Number(params.samples ?? (connection === "sigmoid" ? 24 : 1));
  const steepness = Number(params.steepness ?? 8);
  if (!Number.isInteger(samples) || samples < 1 || samples > 1000) {
    throw new TypeError(
      "[gggplot] stat connect samples must be an integer from 1 to 1000",
    );
  }
  if (!Number.isFinite(steepness) || steepness <= 0) {
    throw new TypeError("[gggplot] stat connect steepness must be positive");
  }
  const xs = numericColumnValues(data, xCol),
    ys = numericColumnValues(data, yCol);
  const groupCols = groupColumnsOf(mapping, data).filter((column) =>
    column !== xCol && column !== yCol
  );
  const groups = new Map<
    string,
    { rows: number[]; values: Record<string, unknown> }
  >();
  for (let row = 0; row < Math.min(xs.length, ys.length); row++) {
    if (
      ![xs[row], ys[row]].every((value) =>
        typeof value === "number" && Number.isFinite(value)
      )
    ) continue;
    const key = groupKeyAt(data, groupCols, row);
    const group = groups.get(key) ??
      { rows: [], values: groupValuesAt(data, groupCols, row) };
    group.rows.push(row);
    groups.set(key, group);
  }
  const out: Record<string, unknown[]> = { [xCol]: [], [yCol]: [] };
  for (const column of groupCols) out[column] = [];
  const push = (x: number, y: number, values: Record<string, unknown>) => {
    out[xCol].push(x);
    out[yCol].push(y);
    for (const column of groupCols) out[column].push(values[column]);
  };
  for (const group of groups.values()) {
    group.rows.sort((a, b) => (xs[a] as number) - (xs[b] as number) || a - b);
    if (!group.rows.length) continue;
    const first = group.rows[0];
    push(xs[first] as number, ys[first] as number, group.values);
    for (let index = 1; index < group.rows.length; index++) {
      const previous = group.rows[index - 1], current = group.rows[index];
      const x0 = xs[previous] as number,
        y0 = ys[previous] as number,
        x1 = xs[current] as number,
        y1 = ys[current] as number;
      if (connection === "hv") push(x1, y0, group.values);
      else if (connection === "vh") push(x0, y1, group.values);
      else if (connection === "mid") {
        const middle = (x0 + x1) / 2;
        push(middle, y0, group.values);
        push(middle, y1, group.values);
      } else {
        const lo = 1 / (1 + Math.exp(steepness / 2));
        const hi = 1 / (1 + Math.exp(-steepness / 2));
        for (let sample = 1; sample < samples; sample++) {
          const t = sample / samples;
          const eased = connection === "sigmoid"
            ? (1 / (1 + Math.exp(-steepness * (t - 0.5))) - lo) / (hi - lo)
            : t;
          push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * eased, group.values);
        }
      }
      push(x1, y1, group.values);
    }
  }
  return { data: dataFrameFromColumns(out), mapping };
};

export function normalQuantile(p: number): number {
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

export function statQqProduct(line: boolean): StatFn {
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

export const statEllipse: StatFn = (data, mapping, params) => {
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

export const statFunctionProduct: StatFn = (data, mapping, params) => {
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

export function contourBreaks(
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

function positivePair(
  value: unknown,
  fallback: [number, number],
  name: string,
): [number, number] {
  if (value == null) return fallback;
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError(
      `[gggplot] density2d ${name} must be a positive [x, y] pair`,
    );
  }
  const pair: [number, number] = [Number(value[0]), Number(value[1])];
  if (!pair.every((part) => Number.isFinite(part) && part > 0)) {
    throw new TypeError(
      `[gggplot] density2d ${name} must be a positive [x, y] pair`,
    );
  }
  return pair;
}

function referenceBandwidth(values: number[]): number {
  if (values.length < 2) return 1;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, values.length - 1);
  const sd = Math.sqrt(variance);
  const span = Math.max(...values) - Math.min(...values);
  return Math.max(
    Number.EPSILON,
    1.06 * (sd || span / Math.sqrt(12) || 1) * values.length ** (-0.2),
  );
}

/** Grouped product-kernel KDE followed by the existing line/filled contour product. */
export function statDensity2dProduct(filled: boolean): StatFn {
  return (data, mapping, params) => {
    const xCol = mapping.x, yCol = mapping.y;
    if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) {
      throw new TypeError(
        "[gggplot] density2d requires numeric x and y mappings",
      );
    }
    const gridN = Number(params.n ?? 100);
    if (!Number.isInteger(gridN) || gridN < 2) {
      throw new TypeError(
        "[gggplot] density2d n must be an integer of at least 2",
      );
    }
    const contourVar = String(params.contourVar ?? "density");
    if (!["density", "ndensity", "count"].includes(contourVar)) {
      throw new TypeError(
        '[gggplot] density2d contourVar must be "density", "ndensity", or "count"',
      );
    }
    const adjust = positivePair(params.adjust, [1, 1], "adjust");
    const groupCols = groupColumnsOf(mapping, data).filter((column) =>
      column !== xCol && column !== yCol
    );
    const xs = numericColumnValues(data, xCol);
    const ys = numericColumnValues(data, yCol);
    const grouped = new Map<
      string,
      { pairs: [number, number][]; group: Record<string, unknown> }
    >();
    for (let row = 0; row < Math.min(xs.length, ys.length); row++) {
      const x = xs[row], y = ys[row];
      if (
        typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" ||
        !Number.isFinite(y)
      ) continue;
      const key = groupKeyAt(data, groupCols, row);
      const entry = grouped.get(key) ??
        { pairs: [], group: groupValuesAt(data, groupCols, row) };
      entry.pairs.push([x, y]);
      grouped.set(key, entry);
    }
    const combined: Record<string, unknown[]> = {};
    let resultMapping = mapping;
    for (const entry of grouped.values()) {
      if (!entry.pairs.length) continue;
      const gx = entry.pairs.map(([x]) => x),
        gy = entry.pairs.map(([, y]) => y);
      const automatic: [number, number] = [
        referenceBandwidth(gx),
        referenceBandwidth(gy),
      ];
      const baseH = positivePair(params.h, automatic, "h");
      const hx = baseH[0] * adjust[0], hy = baseH[1] * adjust[1];
      const xlo = Math.min(...gx) - 3 * hx, xhi = Math.max(...gx) + 3 * hx;
      const ylo = Math.min(...gy) - 3 * hy, yhi = Math.max(...gy) + 3 * hy;
      const gridX: number[] = [], gridY: number[] = [], density: number[] = [];
      const constant = 1 / (2 * Math.PI * hx * hy * entry.pairs.length);
      for (let yi = 0; yi < gridN; yi++) {
        const y = ylo + (yhi - ylo) * yi / (gridN - 1);
        for (let xi = 0; xi < gridN; xi++) {
          const x = xlo + (xhi - xlo) * xi / (gridN - 1);
          let sum = 0;
          for (const [px, py] of entry.pairs) {
            const dx = (x - px) / hx, dy = (y - py) / hy;
            sum += Math.exp(-0.5 * (dx * dx + dy * dy));
          }
          gridX.push(x);
          gridY.push(y);
          density.push(constant * sum);
        }
      }
      const peak = Math.max(...density);
      const gridColumns: Record<string, unknown[]> = {
        densityx: gridX,
        densityy: gridY,
        density,
        ndensity: density.map((value) => peak > 0 ? value / peak : 0),
        count: density.map((value) => value * entry.pairs.length),
        n: density.map(() => entry.pairs.length),
      };
      for (const column of groupCols) {
        gridColumns[column] = density.map(() => entry.group[column]);
      }
      const grid = dataFrameFromColumns(gridColumns);
      const contourMapping = {
        ...mapping,
        x: "densityx",
        y: "densityy",
        z: contourVar,
      };
      const contour = filled
        ? statContourFilled(grid, contourMapping, params)
        : statContour(grid, contourMapping, params);
      resultMapping = contour.mapping;
      for (const [column, values] of Object.entries(contour.data)) {
        (combined[column] ??= []).push(...columnValues(contour.data, column));
      }
      const length = Object.values(contour.data)[0]?.values.length ?? 0;
      for (const column of groupCols) {
        if (!(column in combined)) combined[column] = [];
        if (!(column in contour.data)) {
          combined[column].push(...Array(length).fill(entry.group[column]));
        }
      }
    }
    return { data: dataFrameFromColumns(combined), mapping: resultMapping };
  };
}

export const statContour: StatFn = (data, mapping, params) => {
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

export const statContourFilled: StatFn = (data, mapping, params) => {
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
