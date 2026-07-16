import type { AesName } from "../ir/types.ts";

/** Portable scalar formats. Runtime adapters own their physical GPU layout. */
export type FieldDType = "f32" | "u32" | "i32" | "bool" | "factor";
export type FieldShape = "scalar" | "row" | "grid" | "topology";

/** A serializable logical field; it intentionally contains no CPU/GPU handle. */
export interface FieldSpec {
  name: string;
  dtype: FieldDType;
  shape: FieldShape;
  dimensions: string[];
  nullable?: boolean;
  role?: "input" | "output" | "intermediate" | "topology";
}

export interface FieldPort {
  field: string;
  access: "read" | "write";
}

/** A portable dataflow node. Executors are selected only after mounting. */
export interface ProductPlan {
  id: string;
  kind: "source" | "stat" | "position" | "geom" | "guide";
  inputs: FieldPort[];
  outputs: FieldSpec[];
  dependencies?: string[];
  executor: "auto" | "cpu" | "gpu";
}

export type Scalar = string | number | boolean | null;
export type Expression =
  | { kind: "field"; name: string }
  | { kind: "constant"; value: Scalar }
  | { kind: "call"; op: "add" | "subtract" | "multiply" | "divide" | "negate"; args: Expression[] };

/** Mapping phases are explicit, preventing accidental CPU callback capture. */
export type MappingExpr =
  | { kind: "column"; column: string }
  | { kind: "afterStat"; field: string }
  | { kind: "afterScale"; expression: Expression };

export type SemanticMapping = Partial<Record<AesName, MappingExpr>>;
export type ExtensionKind = "stat" | "geom" | "position" | "scale" | "coord" | "facet";
export type ExecutionScope = "plot" | "panel" | "group" | "row";
export type MissingValuePolicy = "drop" | "propagate" | "zero" | "error";

export interface ParameterSpec {
  type: "number" | "string" | "boolean" | "enum";
  required?: boolean;
  default?: Scalar;
  values?: Scalar[];
}

/**
 * Declarative extension contract shared by CPU and GPU implementations.
 * Runtime registrations associate this id with CPU/WGSL executors separately.
 */
export interface ExtensionDefinition {
  id: string;
  kind: ExtensionKind;
  requiredAes?: AesName[];
  optionalAes?: AesName[];
  parameters?: Record<string, ParameterSpec>;
  missingValues: MissingValuePolicy;
  scope: ExecutionScope;
  outputFields?: FieldSpec[];
  computedAes?: SemanticMapping;
  showLegend?: boolean | "auto";
}
