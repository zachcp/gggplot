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
