import {
  columnValues,
  dataFrameFromColumns,
  numericColumnValues,
} from "../data/mod.ts";
import { groupColumnsOf, groupKeyAt, groupValuesAt } from "../group/mod.ts";
import type { StatFn } from "./shared.ts";

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
      for (const column of Object.keys(contour.data)) {
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
