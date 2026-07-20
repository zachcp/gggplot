/** @jsxRuntime classic */
/** @jsx createElement */
// The only Use.GPU-specific module in the runtime layer.

import type { LiveElement } from "@use-gpu/live";
import type { Column, TypedDataFrame } from "../data/mod.ts";
import type { FieldSpec } from "../plan/mod.ts";
import { rawArrayForColumn } from "./raw.ts";
import type { GPUStorageSource } from "./types.ts";
import { createElement, RawData } from "./usegpu_compat.ts";

function formatFor(field: FieldSpec, column: Column): "f32" | "u32" {
  if (field.dtype === "f32" && column.type === "numeric") return "f32";
  if (field.dtype === "u32" && column.type === "factor") return "u32";
  throw new Error(
    `Cannot mount ${field.name}: ${field.dtype} does not match ${column.type} column`,
  );
}

export interface GPUDataProviderProps {
  data: TypedDataFrame;
  fields: FieldSpec[];
  children: (sources: Record<string, GPUStorageSource>) => LiveElement;
}

/**
 * Nests stable RawData nodes and supplies their StorageSources by field name.
 * RawData owns allocation/upload; `rawArrayForColumn` preserves array identity
 * across view updates, so only replaced typed columns upload again.
 */
export const GPUDataProvider = (
  { data, fields, children }: GPUDataProviderProps,
): LiveElement => {
  const bind = (
    index: number,
    sources: Record<string, GPUStorageSource>,
  ): LiveElement => {
    if (index === fields.length) return children(sources);
    const field = fields[index];
    const column = data[field.name];
    if (!column) return bind(index + 1, sources);
    return createElement(RawData, {
      data: rawArrayForColumn(column),
      format: formatFor(field, column),
      children: (source: GPUStorageSource) =>
        bind(index + 1, {
          ...sources,
          [field.name]: source,
        }),
    }) as LiveElement;
  };
  return bind(0, {});
};
