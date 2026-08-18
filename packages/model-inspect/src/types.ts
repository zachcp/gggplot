/** JSON-compatible metadata used by portable model documents. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
  [key: string]: JsonValue;
};

export type ModelDType =
  | "f16"
  | "f32"
  | "f64"
  | "bf16"
  | "i8"
  | "i16"
  | "i32"
  | "i64"
  | "u8"
  | "u16"
  | "u32"
  | "u64"
  | "bool"
  | "string"
  | (string & {});

export type Dimension =
  | number
  | { symbol: string; value?: number }
  | { unknown: true };

export type TensorRole =
  | "input"
  | "output"
  | "parameter"
  | "buffer"
  | "activation"
  | "constant"
  | "intermediate";

export interface ArtifactSource {
  id: string;
  format: string;
  kind: "file" | "url" | "memory" | "runtime";
  uri?: string;
  version?: string;
  byteLength?: number;
  sha256?: string;
}

/** A source range that can be fetched without putting bytes in the IR. */
export interface PayloadRef {
  sourceId: string;
  byteOffset: number;
  byteLength: number;
  encoding?: "raw" | "safetensors" | "onnx" | "runtime";
}

/** Source identity survives a switch between graph geometry and tensor content. */
export interface ProvenanceRef {
  sourceId: string;
  byteOffset?: number;
  byteLength?: number;
  path?: string;
  note?: string;
}

export interface TensorStorage {
  sourceId: string;
  byteOffset: number;
  byteLength: number;
  dtype: ModelDType;
  shape: number[];
  strides?: number[];
  order: "row-major" | "column-major" | "strided";
  physical?: {
    bufferFormat: "f16" | "f32" | "u32" | "i32" | "rgba32float";
    components: 1 | 2 | 4;
    conversion?: "none" | "normalize" | "dequantize";
  };
}

export interface ResidencySpec {
  policy: "metadata" | "summary" | "range" | "resident";
  cacheKey: string;
  upload: "never" | "on-demand" | "once" | "streamed";
  maxBytes?: number;
  readback: "never" | "summary-only" | "explicit";
}

export interface TensorSummary {
  count: number;
  finiteCount?: number;
  min?: number;
  max?: number;
  mean?: number;
  standardDeviation?: number;
  sparsity?: number;
  histogram?: {
    bins: number[];
    counts: number[];
  };
}

export interface TensorDescriptor {
  id: string;
  name?: string;
  dtype: ModelDType;
  shape: Dimension[];
  device?: string;
  byteLength?: number;
  role: TensorRole;
  payload?: PayloadRef;
  storage?: TensorStorage;
  residency?: ResidencySpec;
  summary?: TensorSummary;
  provenance?: ProvenanceRef[];
  metadata?: Record<string, JsonValue>;
}

export interface ValueRef {
  id: string;
  tensorId?: string;
  dtype?: ModelDType;
  shape?: Dimension[];
  provenance?: ProvenanceRef[];
}

export type GraphNodeKind =
  | "module"
  | "operator"
  | "constant"
  | "input"
  | "output"
  | "unknown";

export interface SourceLocation {
  file?: string;
  line?: number;
  column?: number;
  symbol?: string;
}

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  name?: string;
  op?: string;
  domain?: string;
  attributes?: Record<string, JsonValue>;
  inputs: ValueRef[];
  outputs: ValueRef[];
  parameters?: string[];
  /** Exporter-provided hierarchy; loaders must not fabricate module names. */
  parentId?: string;
  scopePath?: string[];
  source?: SourceLocation;
  provenance?: ProvenanceRef[];
  /** Adapter-provided, JSON-safe annotations such as original ONNX ordinal. */
  metadata?: Record<string, JsonValue>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  valueId?: string;
  tensorId?: string;
  fromPortIndex?: number;
  toPortIndex?: number;
  provenance?: ProvenanceRef[];
}

export interface ModelGraph {
  id: string;
  name?: string;
  inputs: ValueRef[];
  outputs: ValueRef[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: Record<string, JsonValue>;
}

export interface RuntimeArtifact {
  id: string;
  kind:
    | "embedding"
    | "activation"
    | "attention"
    | "logits"
    | "summary"
    | "custom";
  sourceId?: string;
  nodeId?: string;
  tensorId?: string;
  shape?: Dimension[];
  dtype?: ModelDType;
  payload?: PayloadRef;
  storage?: TensorStorage;
  residency?: ResidencySpec;
  metadata?: Record<string, JsonValue>;
}

export interface ModelDocument {
  schema: "gggplot.model@1";
  id: string;
  name?: string;
  framework?: {
    name: string;
    version?: string;
    dialect?: string;
  };
  source: ArtifactSource;
  graphs: ModelGraph[];
  tensors: Record<string, TensorDescriptor>;
  artifacts?: RuntimeArtifact[];
  metadata?: Record<string, JsonValue>;
}
