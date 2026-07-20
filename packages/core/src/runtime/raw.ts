import { type Column, typedArrayForColumn } from "../data/mod.ts";

/**
 * Stable CPU lowering for the mounted backend's RawData source.
 * A column identity change produces a new array and therefore one upload;
 * view-only updates retain the cached array and do not upload.
 *
 * This is a thin delegate over data/mod.ts's `typedArrayForColumn` — the
 * single, identity-cached typed view of a column (see its doc comment). The
 * export name is retained because runtime/mod.ts, streaming.ts, and live.tsx
 * import it.
 */
export function rawArrayForColumn(column: Column): Float32Array | Uint32Array {
  return typedArrayForColumn(column);
}
