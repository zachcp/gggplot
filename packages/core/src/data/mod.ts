export type MissingValue = null | undefined;

export interface NumericColumn {
  type: "numeric";
  values: Array<number | null>;
}

export interface FactorColumn {
  type: "factor";
  values: Array<string | null>;
  levels: string[];
  declaredLevels?: string[];
}

export type Column = NumericColumn | FactorColumn;
export type TypedDataFrame = Record<string, Column>;
export type LegacyDataFrame = Record<string, unknown[]>;
export type RowStore = Array<Record<string, unknown>>;
export type InputData = LegacyDataFrame | RowStore | TypedDataFrame;
export type DataFrameLike = TypedDataFrame | LegacyDataFrame;

const metadata = new WeakMap<LegacyDataFrame, TypedDataFrame>();

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

function columnStoreFromRows(rows: RowStore): LegacyDataFrame {
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

  const out: LegacyDataFrame = Object.fromEntries(
    names.map((name) => [name, []]),
  );
  for (const row of rows) {
    for (const name of names) out[name].push(row[name]);
  }
  return out;
}

function normalizeRaw(data: InputData): LegacyDataFrame | TypedDataFrame {
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

export function legacyDataFrame(data: TypedDataFrame): LegacyDataFrame {
  const legacy = Object.fromEntries(
    Object.entries(data).map(([name, column]) => [
      name,
      column.values.map((value) => value),
    ]),
  );
  metadata.set(legacy, data);
  return legacy;
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

export function sliceLegacyDataFrame(
  data: LegacyDataFrame,
  indices: number[],
): LegacyDataFrame {
  const meta = dataFrameMetadata(data);
  if (meta) return legacyDataFrame(sliceTypedDataFrame(meta, indices));

  return Object.fromEntries(
    Object.entries(data).map((
      [col, values],
    ) => [col, indices.map((i) => values[i])]),
  );
}

export function dataFrameMetadata(
  data: LegacyDataFrame,
): TypedDataFrame | undefined {
  return metadata.get(data);
}

export function columnMetadata(
  data: LegacyDataFrame,
  column: string,
): Column | undefined {
  return metadata.get(data)?.[column];
}

function typedMetadata(data: DataFrameLike): TypedDataFrame | undefined {
  return isTypedDataFrame(data) ? data : dataFrameMetadata(data);
}

export function isFactorColumn(data: DataFrameLike, column: string): boolean {
  return typedMetadata(data)?.[column]?.type === "factor";
}

export function factorLevelsFor(
  data: DataFrameLike,
  column: string,
): string[] | undefined {
  const meta = typedMetadata(data)?.[column];
  return meta?.type === "factor" ? meta.declaredLevels : undefined;
}

export function columnValues(data: DataFrameLike, column: string): unknown[] {
  return typedMetadata(data)?.[column]?.values ??
    (isTypedDataFrame(data) ? [] : data[column] ?? []);
}

export function numericColumnValues(
  data: DataFrameLike,
  column: string,
): Array<number | null> {
  const meta = typedMetadata(data)?.[column];
  if (meta?.type === "numeric") return meta.values;

  return columnValues(data, column).map((value) => {
    if (value == null || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  });
}

export function numericValueAt(
  data: DataFrameLike,
  column: string,
  row: number,
): number | null {
  return numericColumnValues(data, column)[row] ?? null;
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
