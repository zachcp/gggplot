import type { Aes, DataFrame } from "../ir/types.ts";
import { dataFrameFromColumns, numericColumnValues } from "../data/mod.ts";
import { groupColumnsOf, groupKeyAt } from "../group/mod.ts";
import type { StatFn } from "./shared.ts";

export type AlignInterpolation = "linear" | "step";
export type AlignDuplicate = "sum" | "mean" | "first" | "last";
export type AlignOutside = "zero" | "nearest";

export interface StatAlignContract {
  grid: "union" | number[];
  interpolation: AlignInterpolation;
  duplicate: AlignDuplicate;
  outside: AlignOutside;
}

/** Serializable, backend-independent stat_align defaults. */
export const STAT_ALIGN_CONTRACT: StatAlignContract = {
  grid: "union",
  interpolation: "linear",
  duplicate: "sum",
  outside: "zero",
};

function option<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  name: string,
): T {
  if (value == null) return fallback;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new TypeError(
      `[gggplot] stat_align ${name} must be ${allowed.join(" or ")}`,
    );
  }
  return value as T;
}

function resolveGrid(value: unknown, observed: number[]): number[] {
  if (value == null || value === "union") {
    return [...new Set(observed)].sort((a, b) => a - b);
  }
  if (
    !Array.isArray(value) ||
    value.some((x) => typeof x !== "number" || !Number.isFinite(x))
  ) {
    throw new TypeError(
      '[gggplot] stat_align grid must be "union" or finite numbers',
    );
  }
  return [...new Set(value as number[])].sort((a, b) => a - b);
}

function collapse(values: number[], duplicate: AlignDuplicate): number {
  if (duplicate === "first") return values[0];
  if (duplicate === "last") return values.at(-1)!;
  const sum = values.reduce((total, value) => total + value, 0);
  return duplicate === "mean" ? sum / values.length : sum;
}

function interpolate(
  points: Array<[number, number]>,
  x: number,
  method: AlignInterpolation,
  outside: AlignOutside,
): number {
  if (points.length === 0) return 0;
  if (x < points[0][0]) return outside === "nearest" ? points[0][1] : 0;
  if (x > points.at(-1)![0]) {
    return outside === "nearest" ? points.at(-1)![1] : 0;
  }
  let lo = 0;
  let hi = points.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] === x) return points[mid][1];
    if (points[mid][0] < x) lo = mid + 1;
    else hi = mid - 1;
  }
  const left = points[Math.max(0, hi)];
  const right = points[Math.min(points.length - 1, lo)];
  if (method === "step" || left[0] === right[0]) return left[1];
  const t = (x - left[0]) / (right[0] - left[0]);
  return left[1] + (right[1] - left[1]) * t;
}

/** Resample effective groups onto one deterministic shared x grid. */
export const statAlign: StatFn = (data, mapping, params) => {
  if (!mapping.x || !mapping.y) {
    throw new TypeError(
      "[gggplot] stat_align requires numeric x and y aesthetics",
    );
  }
  if (
    data[mapping.x]?.type !== "numeric" || data[mapping.y]?.type !== "numeric"
  ) {
    throw new TypeError(
      "[gggplot] stat_align requires numeric x and y aesthetics",
    );
  }
  const xs = numericColumnValues(data, mapping.x);
  const ys = numericColumnValues(data, mapping.y);
  const interpolation = option(
    params.interpolation,
    ["linear", "step"] as const,
    "linear",
    "interpolation",
  );
  const duplicate = option(
    params.duplicate,
    ["sum", "mean", "first", "last"] as const,
    "sum",
    "duplicate",
  );
  const outside = option(
    params.outside,
    ["zero", "nearest"] as const,
    "zero",
    "outside",
  );
  const groupColumns = groupColumnsOf(mapping, data);
  const groups = new Map<
    string,
    { rows: number[]; values: Record<string, unknown> }
  >();
  const observed: number[] = [];
  for (let row = 0; row < Math.min(xs.length, ys.length); row++) {
    const x = xs[row];
    const y = ys[row];
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    observed.push(x);
    const key = groupKeyAt(data, groupColumns, row);
    let group = groups.get(key);
    if (!group) {
      group = {
        rows: [],
        values: Object.fromEntries(
          groupColumns.map((
            column,
          ) => [column, data[column]?.values[row] ?? null]),
        ),
      };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  const grid = resolveGrid(params.grid, observed);
  const output: Record<string, unknown[]> = {
    [mapping.x]: [],
    [mapping.y]: [],
  };
  for (const column of groupColumns) output[column] = [];
  for (const group of groups.values()) {
    const duplicates = new Map<number, number[]>();
    for (const row of group.rows) {
      const x = xs[row]!;
      const list = duplicates.get(x) ?? [];
      list.push(ys[row]!);
      duplicates.set(x, list);
    }
    const points = [...duplicates].map(([x, values]) =>
      [x, collapse(values, duplicate)] as [number, number]
    ).sort((a, b) => a[0] - b[0]);
    for (const x of grid) {
      output[mapping.x].push(x);
      output[mapping.y].push(interpolate(points, x, interpolation, outside));
      for (const column of groupColumns) {
        output[column].push(group.values[column]);
      }
    }
  }
  return { data: dataFrameFromColumns(output), mapping };
};
