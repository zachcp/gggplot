/**
 * The semantic data layer. Columns keep their boxed public shape
 * (`Array<number|null>` / `Array<string|null>`) so NaN-vs-null semantics stay
 * intact across every stat. `typedArrayForColumn` (below) is Phase A of the
 * GPU-native plan's GPUDataFrame representation: a canonical typed
 * (Float32Array / Uint32Array) view of a column, cached on the column object's
 * identity, that GPU lowering and the reductions boundary consume without
 * re-crossing the boxed→typed boundary per call site. Phase B — storing
 * `values` themselves as typed arrays plus validity masks — is future work.
 */
export type MissingValue = null | undefined;

export interface NumericColumn {
  type: "numeric";
  values: Array<number | null>;
  /** Content version; see {@link touchColumn}. Absent means 0. */
  version?: number;
}

export interface FactorColumn {
  type: "factor";
  values: Array<string | null>;
  levels: string[];
  declaredLevels?: string[];
  /** Content version; see {@link touchColumn}. Absent means 0. */
  version?: number;
}

export type Column = NumericColumn | FactorColumn;
export type TypedDataFrame = Record<string, Column>;
/** Raw caller input: a plain object of parallel column arrays. */
export type ColumnStore = Record<string, unknown[]>;
export type RowStore = Array<Record<string, unknown>>;
export type InputData = ColumnStore | RowStore | TypedDataFrame;

export interface ColumnOverride {
  type: "numeric" | "factor";
  levels?: string[];
}

export interface IngestOptions {
  columns?: Record<string, ColumnOverride>;
}

export function asFactor(levels?: string[]): ColumnOverride {
  return { type: "factor", levels };
}

export function asNumeric(): ColumnOverride {
  return { type: "numeric" };
}

export function isTypedDataFrame(data: unknown): data is TypedDataFrame {
  return !!data && typeof data === "object" && !Array.isArray(data) &&
    Object.values(data as Record<string, unknown>).every((value) =>
      !!value && typeof value === "object" && "type" in value &&
      "values" in value &&
      ((value as { type?: unknown }).type === "numeric" ||
        (value as { type?: unknown }).type === "factor")
    );
}

function isRowStore(data: InputData): data is RowStore {
  return Array.isArray(data);
}

function columnStoreFromRows(rows: RowStore): ColumnStore {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const name of Object.keys(row)) {
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
  }

  const out: ColumnStore = Object.fromEntries(
    names.map((name) => [name, []]),
  );
  for (const row of rows) {
    for (const name of names) out[name].push(row[name]);
  }
  return out;
}

function normalizeRaw(data: InputData): ColumnStore | TypedDataFrame {
  if (isTypedDataFrame(data)) return data;
  return isRowStore(data) ? columnStoreFromRows(data) : data;
}

function inferType(values: unknown[]): Column["type"] {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === "number") return "numeric";
    if (typeof value === "string") {
      return value.trim() !== "" && Number.isFinite(Number(value))
        ? "numeric"
        : "factor";
    }
    return "factor";
  }
  return "factor";
}

function factorLevels(
  values: Array<string | null>,
  declared?: string[],
): string[] {
  const levels: string[] = [];
  const seen = new Set<string>();
  for (const level of declared ?? []) {
    if (!seen.has(level)) {
      seen.add(level);
      levels.push(level);
    }
  }
  for (const value of values) {
    if (value == null || seen.has(value)) continue;
    seen.add(value);
    levels.push(value);
  }
  return levels;
}

function toNumeric(values: unknown[]): NumericColumn {
  return {
    type: "numeric",
    values: values.map((value) => {
      if (value == null || value === "") return null;
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : null;
    }),
  };
}

function toFactor(values: unknown[], levels?: string[]): FactorColumn {
  const factorValues = values.map((value) =>
    value == null || value === "" ? null : String(value)
  );
  const column: FactorColumn = {
    type: "factor",
    values: factorValues,
    levels: factorLevels(factorValues, levels),
  };
  if (levels) {
    Object.defineProperty(column, "declaredLevels", {
      value: [...levels],
      enumerable: false,
    });
  }
  return column;
}

function copyFactorColumn(
  column: FactorColumn,
  values: Array<string | null>,
): FactorColumn {
  const copy: FactorColumn = {
    type: "factor",
    values,
    levels: [...column.levels],
  };
  if (column.declaredLevels) {
    Object.defineProperty(copy, "declaredLevels", {
      value: [...column.declaredLevels],
      enumerable: false,
    });
  }
  return copy;
}

/**
 * The public data boundary: the ONLY place raw caller-supplied data (a
 * RowStore, ColumnStore, or already-typed TypedDataFrame) becomes the
 * TypedDataFrame the rest of the pipeline (GGSpec["data"] = DataFrame =
 * TypedDataFrame) reads column arrays from.
 *
 * IMMUTABILITY CONTRACT (gggplot-tzc.5): for raw input (a plain object of
 * arrays or a row store), ingest() always MATERIALIZES FRESH column arrays
 * — toNumeric/toFactor build their `values` via `.map()` over the input,
 * never retaining the caller's own array by reference. Mutating the array
 * you originally passed in after calling ingest() (or after ggplot(...) /
 * .build(), which calls ingest() internally) therefore has no effect on the
 * resulting spec: spec.data is decoupled from the caller's own arrays at
 * the moment of ingestion, verified in this function (no code path returns
 * or wraps the raw `values` array itself into a Column).
 *
 * The one exception is intentional and load-bearing, not a gap: when `data`
 * is ALREADY a TypedDataFrame (isTypedDataFrame(normalized) is true —
 * i.e. it already came from a prior ingest() call), this function is an
 * IDENTITY PASSTHROUGH — it returns the exact same object, not a copy. This
 * makes ingest() idempotent for already-typed data (re-ingesting is a
 * no-op) and is what lets two separately-built DSL specs that reuse the
 * same already-ingested TypedDataFrame (ggplot(sameTypedData, aes).build()
 * called twice) observe IDENTICAL Column object references — the mechanism
 * gggplot-tzc.5's pack cache depends on to recognize a DSL-rebuilt spec as
 * depending on the same underlying data without any deep-equality check.
 *
 * Column identity plus its `version` is the coherence signal, and the version
 * is the ONE mechanism for "this column changed" (gggplot-67c, ADR-007
 * decision 8). A host that mutates a Column's `values` in place calls
 * {@link touchColumn} afterwards: the typed view, the pack cache and the
 * mounted GPU source all key on the version, so exactly that column is
 * re-lowered and re-uploaded.
 */
export function ingest(
  data: InputData,
  options: IngestOptions = {},
): TypedDataFrame {
  const normalized = normalizeRaw(data);
  if (isTypedDataFrame(normalized)) return normalized;

  const out: TypedDataFrame = {};
  for (const [name, values] of Object.entries(normalized)) {
    const override = options.columns?.[name];
    const type = override?.type ?? inferType(values);
    out[name] = type === "numeric"
      ? toNumeric(values)
      : toFactor(values, override?.levels);
  }
  return out;
}

/** Build a typed semantic data frame from stat/annotation output columns. */
export function dataFrameFromColumns(
  columns: Record<string, unknown[]>,
): TypedDataFrame {
  return ingest(columns);
}

export function sliceTypedDataFrame(
  data: TypedDataFrame,
  indices: number[],
): TypedDataFrame {
  return Object.fromEntries(
    Object.entries(data).map(([name, column]) => {
      if (column.type === "numeric") {
        return [
          name,
          {
            type: "numeric",
            values: indices.map((i) => column.values[i] ?? null),
          } satisfies NumericColumn,
        ];
      }
      return [
        name,
        copyFactorColumn(
          column,
          indices.map((i) => column.values[i] ?? null),
        ),
      ];
    }),
  );
}

export function isFactorColumn(data: TypedDataFrame, column: string): boolean {
  return data[column]?.type === "factor";
}

export function factorLevelsFor(
  data: TypedDataFrame,
  column: string,
): string[] | undefined {
  const col = data[column];
  return col?.type === "factor" ? col.declaredLevels : undefined;
}

export function columnValues(data: TypedDataFrame, column: string): unknown[] {
  return data[column]?.values ?? [];
}

export function numericColumnValues(
  data: TypedDataFrame,
  column: string,
): Array<number | null> {
  const col = data[column];
  if (col?.type === "numeric") return col.values;

  return columnValues(data, column).map((value) => {
    if (value == null || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  });
}

export function factorIds(column: FactorColumn): Uint32Array {
  const ids = new Uint32Array(column.values.length);
  const lookup = new Map(column.levels.map((level, index) => [level, index]));
  for (let i = 0; i < column.values.length; i++) {
    const value = column.values[i];
    ids[i] = value == null ? 0xffffffff : lookup.get(value) ?? 0xffffffff;
  }
  return ids;
}

export function numericBuffer(column: NumericColumn): Float32Array {
  const out = new Float32Array(column.values.length);
  for (let i = 0; i < column.values.length; i++) {
    out[i] = column.values[i] ?? Number.NaN;
  }
  return out;
}

const typedArrays = new WeakMap<
  Column,
  { version: number; array: Float32Array | Uint32Array }
>();

/** A column's content version: 0 until {@link touchColumn} bumps it. */
export function columnVersion(column: Column): number {
  return column.version ?? 0;
}

/**
 * Declare that `column.values` changed in place. Bumps the column's version,
 * which is what every cache keys on: the typed view below, the pack cache, and
 * the GPU source GPUDataProvider mounts, which re-uploads exactly this column.
 * Returns the new version.
 */
export function touchColumn(column: Column): number {
  column.version = columnVersion(column) + 1;
  return column.version;
}

/**
 * Canonical typed (GPU-lowering) representation of a column, cached on the
 * column object's identity: numeric → Float32Array (null → NaN, exactly what
 * `numericBuffer` builds); factor → Uint32Array level ids (0xffffffff for
 * null, exactly `factorIds`). Computed on first access and retained thereafter,
 * so a column reused across compiles/uploads yields the SAME typed array
 * (identity plus version is the coherence signal — see ingest()'s doc
 * comment). After an in-place mutation and {@link touchColumn}, the next call
 * builds a fresh array. `numericBuffer`/`factorIds` remain the
 * uncached builders this delegates to. Phase A of the GPUDataFrame plan; Phase
 * B (typed `values` storage) is future work.
 */
export function typedArrayForColumn(
  column: Column,
): Float32Array | Uint32Array {
  const version = columnVersion(column);
  const cached = typedArrays.get(column);
  if (cached && cached.version === version) return cached.array;
  const array = column.type === "numeric"
    ? numericBuffer(column)
    : factorIds(column);
  typedArrays.set(column, { version, array });
  return array;
}
