import type { Aes, DataFrame } from "../ir/types.ts";
import {
  columnValues,
  ingest,
  isFactorColumn,
  sliceTypedDataFrame,
} from "../data/mod.ts";
import type { InputData } from "../data/mod.ts";

// Connected geoms must split when any mapped discrete visual changes. In
// particular, a dash pattern belongs to one Line primitive, not to individual
// rows within a path. Linetype is inherently discrete even when its source
// column uses numeric codes (for example mtcars$am), so it always participates
// in default grouping.
const IMPLICIT_GROUP_AES = ["color", "fill", "shape", "linetype"] as const;
const SINGLE_GROUP = "__single__";

export function isDiscreteColumn(
  data: DataFrame,
  column: string,
  values: unknown[] | undefined,
): boolean {
  if (isFactorColumn(data, column)) return true;
  if (!values) return false;
  for (const v of values) {
    if (v == null) continue;
    return typeof v === "string";
  }
  return false;
}

function uniqueColumns(cols: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const col of cols) {
    if (!col || seen.has(col)) continue;
    seen.add(col);
    out.push(col);
  }
  return out;
}

/**
 * ggplot2's effective grouping rule: an explicit group aesthetic wins;
 * otherwise group by the interaction of mapped discrete aesthetics.
 */
export function groupColumnsOf(mapping: Aes, data: InputData): string[] {
  const typed = ingest(data);
  if (mapping.group && mapping.group in typed) return [mapping.group];

  return uniqueColumns(
    IMPLICIT_GROUP_AES
      .map((aes) => ({ aes, col: mapping[aes] }))
      .filter(({ aes, col }) =>
        col && col in typed &&
        (aes === "linetype" ||
          isDiscreteColumn(typed, col, columnValues(typed, col)))
      )
      .map(({ col }) => col),
  );
}

export function groupKeyAt(
  data: InputData,
  columns: string[],
  row: number,
): string {
  if (columns.length === 0) return SINGLE_GROUP;
  const typed = ingest(data);
  return columns.map((col) => String(columnValues(typed, col)[row])).join("\0");
}

export function groupValuesAt(
  data: InputData,
  columns: string[],
  row: number,
): Record<string, unknown> {
  const typed = ingest(data);
  return Object.fromEntries(
    columns.map((col) => [col, columnValues(typed, col)[row]]),
  );
}

export function rowCount(data: DataFrame): number {
  const first = Object.values(data)[0];
  return first?.values.length ?? 0;
}

export function sliceRows(data: DataFrame, indices: number[]): DataFrame {
  return sliceTypedDataFrame(data, indices);
}

export function splitByEffectiveGroup(
  mapping: Aes,
  data: DataFrame,
): { mapping: Aes; data: DataFrame }[] {
  const cols = groupColumnsOf(mapping, data);
  if (cols.length === 0) return [{ mapping, data }];

  const groups = new Map<string, number[]>();
  for (let i = 0; i < rowCount(data); i++) {
    const key = groupKeyAt(data, cols, i);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  }

  return [...groups.values()].map((indices) => ({
    mapping,
    data: sliceRows(data, indices),
  }));
}
