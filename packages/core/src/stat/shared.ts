import type { Aes, DataFrame } from "../ir/types.ts";
import { numericColumnValues } from "../data/mod.ts";
import {
  groupColumnsOf,
  groupKeyAt,
  groupValuesAt,
  rowCount,
} from "../group/mod.ts";

export interface StatResult {
  data: DataFrame;
  mapping: Aes;
}

export type StatFn = (
  data: DataFrame,
  mapping: Aes,
  params: Record<string, unknown>,
) => StatResult;

export const statIdentity: StatFn = (data, mapping) => ({ data, mapping });

export function encodeValueIds(values: unknown[]): {
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

export function encodeEffectiveGroups(
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
export function statWeights(
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
