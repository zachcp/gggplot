import type { Column, TypedDataFrame } from "../data/mod.ts";
import type { FieldSpec, ProductPlan } from "../plan/mod.ts";

/** Opaque binding supplied by the mounted Use.GPU adapter. */
export interface GPUFieldSource {
  readonly id?: string;
}

/** Runtime-only storage shape returned by a mounted Use.GPU `RawData` node. */
export interface GPUStorageSource extends GPUFieldSource {
  readonly buffer: GPUBuffer;
  readonly format: string;
  readonly length: number;
  readonly size: readonly number[];
  readonly version: number;
  readonly addressSpace?: "storage" | "uniform";
}

/**
 * A column the caller already owns on the GPU.
 *
 * The column-path counterpart to `GPUTensorSource` (ADR 006): where a plain
 * `Column` is lowered by `typedArrayForColumn` and uploaded by `<RawData>`, a
 * resident column is ALREADY a buffer and mounts with no upload at all. It is
 * for callers who own typed data to begin with -- an Arrow buffer, a fetched
 * binary blob, or the output of a kernel that already ran.
 *
 * `levels` is the factor half of the same dual surface the residency matrix
 * describes: "a CPU-owned ordered dictionary for labels and a GPU u32
 * code/lookup table for mapping". Strings never enter a shader, so the codes go
 * in `source` and the dictionary stays here.
 */
export interface ResidentColumn {
  readonly kind: "resident";
  readonly source: GPUStorageSource;
  readonly type: "numeric" | "factor";
  /** Ordered level dictionary; required for a factor, meaningless otherwise. */
  readonly levels?: readonly string[];
}

/** Either column form a mounted plot can bind. */
export type MountedColumn = Column | ResidentColumn;

/** A frame that may mix CPU columns and already-resident ones. */
export type MountedDataFrame = Record<string, MountedColumn>;

export function isResidentColumn(
  column: MountedColumn,
): column is ResidentColumn {
  return (column as ResidentColumn).kind === "resident";
}

/** The only runtime-specific dependency required by the semantic runtime. */
export interface GPUFieldSourceFactory {
  create(field: FieldSpec, column: Column): GPUFieldSource;
  release?(source: GPUFieldSource): void;
}

export interface ResolvedCPUField extends FieldSpec {
  column: Column;
  contentVersion: number;
}

export interface ResolvedGPUField extends FieldSpec {
  source: GPUFieldSource;
  contentVersion: number;
}

export interface ResolvedProduct {
  plan: ProductPlan;
  cpu: Record<string, ResolvedCPUField>;
  gpu: Record<string, ResolvedGPUField>;
}

export interface GPUPlotRuntimeOptions {
  sourceFactory: GPUFieldSourceFactory;
  data: TypedDataFrame;
}
