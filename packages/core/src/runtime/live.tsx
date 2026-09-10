/** @jsxRuntime classic */
/** @jsx createElement */
// The only Use.GPU-specific module in the runtime layer.

import type { LiveElement } from "@use-gpu/live";
import type { Column, TypedDataFrame } from "../data/mod.ts";
import type { FieldSpec } from "../plan/mod.ts";
import { rawArrayForColumn } from "./raw.ts";
import {
  type GPUStorageSource,
  isResidentColumn,
  type MountedColumn,
  type MountedDataFrame,
} from "./types.ts";
import { createElement, RawData } from "./usegpu_compat.ts";

function formatFor(field: FieldSpec, column: MountedColumn): "f32" | "u32" {
  if (field.dtype === "f32" && column.type === "numeric") return "f32";
  if (field.dtype === "u32" && column.type === "factor") return "u32";
  throw new Error(
    `Cannot mount ${field.name}: ${field.dtype} does not match ${column.type} column`,
  );
}

export interface GPUDataProviderProps {
  /**
   * Accepts a plain `TypedDataFrame` (unchanged, the default path) or a frame
   * that mixes in already-resident columns (ADR 006, gggplot-vs7.10).
   */
  data: TypedDataFrame | MountedDataFrame;
  fields: FieldSpec[];
  children: (sources: Record<string, GPUStorageSource>) => LiveElement;
}

/**
 * Occupies one level of the mount chain without mounting anything.
 *
 * The chain's DEPTH is part of the tree's identity: Live reconciles by position,
 * so a level that appears or disappears remounts everything beneath it. Before
 * this, a field with no column simply skipped its level, which meant the depth
 * tracked the number of PRESENT columns -- so adding a mapping, or a column
 * arriving late, silently remounted every source below it and re-uploaded them.
 * A resident column would skip a level too, for the same reason.
 *
 * Keeping one level per requested field, occupied or not, makes the depth a
 * function of `fields.length` alone.
 */
const HoldLevel = (
  { children }: { children: () => LiveElement },
): LiveElement => children();

/**
 * Nests stable RawData nodes and supplies their StorageSources by field name.
 *
 * `RawData` owns allocation/upload for CPU columns, and `rawArrayForColumn`
 * preserves array identity across view updates, so only replaced typed columns
 * upload again. A `ResidentColumn` bypasses `RawData` entirely -- its buffer is
 * already on the device, so its level holds depth and passes the existing source
 * straight through with no upload at all.
 *
 * WHY THIS IS STILL A NESTED CHAIN rather than one <Data schema={...}> node.
 * `<Data>` is an ARRAY-OF-STRUCTS AGGREGATOR, not a columnar mount. Reading
 * @use-gpu/workbench 0.20's data.mjs: `itemCount` comes from `data.length`, the
 * schema keys are probed as `data[0][key]`, and values are walked per item
 * through `copyRecursiveNumberArray` into buffers it allocates itself
 * (`allocateSchema`). Handing it our columnar typed arrays as one struct makes
 * `itemCount` 1; handing it rows would reintroduce exactly the per-row CPU
 * repack this epic removes, and would allocate fresh buffers on every change --
 * destroying the reference-identity guarantee `PackCache` depends on
 * (docs/RESIDENCY_MATRIX.md, "GPU mark-data upload residency").
 *
 * So <Data> is the wrong primitive for a columnar frame, and the nesting problem
 * it was proposed to solve is solved directly by `HoldLevel`: the chain is a
 * fixed `fields.length` deep, which is the property that actually mattered.
 * <RawData> stays correct here -- one typed array in, one source out, which is
 * exactly our shape.
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
    const column = (data as MountedDataFrame)[field.name];
    const next = (source?: GPUStorageSource) =>
      bind(index + 1, source ? { ...sources, [field.name]: source } : sources);

    if (!column) {
      return createElement(HoldLevel, {
        children: () => next(),
      }) as LiveElement;
    }
    if (isResidentColumn(column)) {
      // Validate the same f32/u32 match the CPU path enforces, so a mismatched
      // resident column fails at mount with the same message rather than
      // producing a silently wrong binding.
      formatFor(field, column);
      return createElement(HoldLevel, {
        children: () => next(column.source),
      }) as LiveElement;
    }
    return createElement(RawData, {
      data: rawArrayForColumn(column as Column),
      format: formatFor(field, column),
      children: (source: GPUStorageSource) => next(source),
    }) as LiveElement;
  };
  return bind(0, {});
};
