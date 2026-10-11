// The only Use.GPU-specific module in the runtime layer.

import type { LiveElement } from "@use-gpu/live";
import {
  type Column,
  columnVersion,
  type TypedDataFrame,
} from "../data/mod.ts";
import type { FieldSpec } from "../plan/mod.ts";
import { rawArrayForColumn } from "./raw.ts";
import {
  type GPUStorageSource,
  isResidentColumn,
  type MountedColumn,
  type MountedDataFrame,
} from "./types.ts";
import {
  createElement,
  Fragment,
  QueueReconciler,
  useNoRawSource,
  useOne,
  useRawSource,
} from "./usegpu_compat.ts";

function formatFor(field: FieldSpec, column: MountedColumn): "f32" | "u32" {
  if (field.dtype === "f32" && column.type === "numeric") return "f32";
  if (field.dtype === "u32" && column.type === "factor") return "u32";
  throw new Error(
    `Cannot mount ${field.name}: ${field.dtype} does not match ${column.type} column`,
  );
}

/** One-element stand-ins for an empty column (see MountColumns). */
const EMPTY = { f32: new Float32Array(1), u32: new Uint32Array(1) };

/** How one requested field mounts: uploaded, already resident, or absent. */
export type ColumnMount =
  | { name: string; kind: "absent" }
  | { name: string; kind: "resident"; source: GPUStorageSource }
  | {
    name: string;
    kind: "upload";
    array: Float32Array | Uint32Array;
    format: "f32" | "u32";
    /** The column's content version (gggplot-67c). */
    version: number;
  };

/**
 * Decide, and validate, how each requested field mounts. Pure: no device and
 * no hooks, so a mismatched column fails before anything mounts.
 *
 * A `ResidentColumn` is already a buffer, so it mounts with no upload at all.
 * It still gets the same f32/u32 check as a CPU column, so a mismatch fails
 * with the same message rather than producing a silently wrong binding.
 */
export function planColumnMounts(
  data: TypedDataFrame | MountedDataFrame,
  fields: readonly FieldSpec[],
): ColumnMount[] {
  return fields.map((field): ColumnMount => {
    const column = (data as MountedDataFrame)[field.name];
    if (!column) return { name: field.name, kind: "absent" };
    const format = formatFor(field, column);
    if (isResidentColumn(column)) {
      return { name: field.name, kind: "resident", source: column.source };
    }
    return {
      name: field.name,
      kind: "upload",
      array: rawArrayForColumn(column as Column),
      format,
      version: columnVersion(column as Column),
    };
  });
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
 * One flat raw-source hook per requested field (gggplot-vnh.17).
 *
 * The hook COUNT is part of this component's identity: Live matches hooks by
 * call order, so every field occupies exactly one slot whether it uploads or
 * not, and `useNoRawSource` fills the slot of an absent or resident field. A
 * column arriving late or a mapping being added therefore re-uploads only that
 * column. `rawArrayForColumn` preserves array identity across view updates, and
 * useRawSource uploads only when that identity changes.
 *
 * This replaced a nested chain of one <RawData> per field plus a `HoldLevel`
 * placeholder that pinned the chain's depth for the same reason.
 */
const MountColumns = (
  { mounts, children }: {
    mounts: ColumnMount[];
    children: GPUDataProviderProps["children"];
  },
): LiveElement => {
  const sources: Record<string, GPUStorageSource> = {};
  for (const mount of mounts) {
    if (mount.kind === "upload") {
      const empty = mount.array.length === 0;
      // A zero-byte buffer cannot be bound ("binding size is zero"). <RawData>
      // always allocated at least one element, so an empty column still does,
      // and reports its true length of 0.
      // The column's version is the one change signal (gggplot-67c). A
      // touched column also yields a new typed array, so either alone would
      // re-upload; passing the version states the contract rather than
      // relying on that.
      const source = useRawSource(
        empty ? EMPTY[mount.format] : mount.array,
        mount.format,
        undefined,
        undefined,
        mount.version,
      );
      sources[mount.name] = empty
        ? { ...source, length: 0, size: [0] }
        : source;
    } else {
      useNoRawSource();
      if (mount.kind === "resident") sources[mount.name] = mount.source;
    }
  }
  // What <RawData> did for each field: re-signal the frame queue when any
  // upload's version moves. Without it, a kernel or readback that waits on new
  // data is never scheduled (the stat_bin domain readback went blank).
  const versions = Object.values(sources).map((s) => s.version).join(",");
  const trigger = useOne(() => QueueReconciler.signal(), versions);
  return createElement(Fragment, {}, trigger, children(sources));
};

/**
 * Mounts typed columns once and supplies their StorageSources by field name.
 *
 * WHY NOT one <Data schema={...}> node. `<Data>` is an ARRAY-OF-STRUCTS
 * AGGREGATOR, not a columnar mount. Reading @use-gpu/workbench 0.20's
 * data.mjs: `itemCount` comes from `data.length`, the schema keys are probed as
 * `data[0][key]`, and values are walked per item through
 * `copyRecursiveNumberArray` into buffers it allocates itself
 * (`allocateSchema`). Handing it our columnar typed arrays as one struct makes
 * `itemCount` 1; handing it rows would reintroduce the per-row CPU repack and
 * allocate fresh buffers on every change.
 */
export const GPUDataProvider = (
  { data, fields, children }: GPUDataProviderProps,
): LiveElement =>
  // Keyed by field count: a different count is a different hook layout, so it
  // remounts rather than misaligning hook slots.
  createElement(MountColumns, {
    key: `fields-${fields.length}`,
    mounts: planColumnMounts(data, fields),
    children,
  }) as LiveElement;
