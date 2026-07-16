import {
  factorIds,
  numericBuffer,
  type Column,
} from "../data/mod.ts";

const rawArrays = new WeakMap<Column, Float32Array | Uint32Array>();

/**
 * Stable CPU lowering for the mounted backend's RawData source.
 * A column identity change produces a new array and therefore one upload;
 * view-only updates retain the cached array and do not upload.
 */
export function rawArrayForColumn(column: Column): Float32Array | Uint32Array {
  const cached = rawArrays.get(column);
  if (cached) return cached;
  const array = column.type === "numeric" ? numericBuffer(column) : factorIds(column);
  rawArrays.set(column, array);
  return array;
}
