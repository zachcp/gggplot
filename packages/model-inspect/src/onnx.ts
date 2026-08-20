import type {
  ArtifactSource,
  Dimension,
  GraphEdge,
  GraphNode,
  ModelDocument,
  ModelDType,
  ModelGraph,
  TensorDescriptor,
  ValueRef,
} from "./types.ts";
import {
  ONNXRUNTIME_WEBGPU_CAPABILITIES,
  type ModelRuntimeAdapter,
} from "./runtime.ts";

/** The metadata shape exposed by ONNX Runtime Web sessions. */
export interface OnnxTensorMetadataLike {
  name?: string;
  type?: string;
  shape?: readonly OnnxDimensionLike[];
}

export type OnnxDimensionLike =
  | number
  | string
  | null
  | undefined
  | { dimValue?: number; dimParam?: string };

export interface OnnxSessionLike {
  inputNames: readonly string[];
  outputNames: readonly string[];
  inputMetadata?: OnnxMetadataCollection;
  outputMetadata?: OnnxMetadataCollection;
}

export type OnnxMetadataCollection =
  | readonly OnnxTensorMetadataLike[]
  | Record<string, OnnxTensorMetadataLike | undefined>;

export interface OnnxSessionOptionsLike {
  executionProviders?: readonly string[];
  graphOptimizationLevel?: string;
  [key: string]: unknown;
}

export interface OnnxSessionFactoryLike {
  create(
    model: Uint8Array | ArrayBuffer | string,
    options?: OnnxSessionOptionsLike,
  ): Promise<OnnxSessionLike>;
}

export interface OnnxModelLoadOptions {
  source: ArtifactSource;
  model: Uint8Array | ArrayBuffer | string;
  sessionFactory: OnnxSessionFactoryLike;
  sessionOptions?: OnnxSessionOptionsLike;
}

/** Map ORT's human-readable tensor type names to the model IR's dtype vocabulary. */
export function modelDTypeFromOnnxType(type: string | undefined): ModelDType {
  if (!type) return "unknown";
  const normalized = type.toLowerCase().replaceAll(" ", "");
  const tensorType = normalized.match(/^tensor\((.+)\)$/)?.[1] ?? normalized;
  const aliases: Record<string, ModelDType> = {
    float16: "f16",
    half: "f16",
    float: "f32",
    float32: "f32",
    double: "f64",
    float64: "f64",
    bfloat16: "bf16",
    int8: "i8",
    int16: "i16",
    int32: "i32",
    int64: "i64",
    uint8: "u8",
    uint16: "u16",
    uint32: "u32",
    uint64: "u64",
    bool: "bool",
    string: "string",
  };
  return aliases[tensorType] ?? tensorType;
}

export function dimensionFromOnnx(value: OnnxDimensionLike): Dimension {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : { unknown: true };
  }
  if (typeof value === "string" && value.length > 0) {
    return { symbol: value };
  }
  if (value && typeof value === "object") {
    if (typeof value.dimParam === "string" && value.dimParam.length > 0) {
      return { symbol: value.dimParam };
    }
    if (typeof value.dimValue === "number" && value.dimValue >= 0) {
      return value.dimValue;
    }
  }
  return { unknown: true };
}

function metadataShape(metadata: OnnxTensorMetadataLike | undefined): Dimension[] {
  return metadata?.shape === undefined
    ? [{ unknown: true }]
    : metadata.shape.map(dimensionFromOnnx);
}

function metadataFor(
  collection: OnnxMetadataCollection | undefined,
  name: string,
  index: number,
): OnnxTensorMetadataLike | undefined {
  if (!collection) return undefined;
  if (Array.isArray(collection)) {
    return collection.find((metadata) => metadata.name === name) ??
      collection[index];
  }
  return (collection as Record<string, OnnxTensorMetadataLike | undefined>)[
    name
  ];
}

function valueRef(
  id: string,
  tensorId: string,
  dtype: ModelDType,
  shape: Dimension[],
): ValueRef {
  return { id, tensorId, dtype, shape };
}

interface IoDescription {
  name: string;
  role: "input" | "output";
  metadata?: OnnxTensorMetadataLike;
}

function makeIoTensor(
  source: ArtifactSource,
  io: IoDescription,
): { tensor: TensorDescriptor; value: ValueRef; node: GraphNode } {
  const id = `${io.role}:${io.name}`;
  const dtype = modelDTypeFromOnnxType(io.metadata?.type);
  const shape = metadataShape(io.metadata);
  const value = valueRef(id, id, dtype, shape);
  const tensor: TensorDescriptor = {
    id,
    name: io.name,
    dtype,
    shape,
    role: io.role,
    residency: {
      policy: "metadata",
      cacheKey: `${source.id}:${id}:metadata`,
      upload: "never",
      readback: "never",
    },
    metadata: { source: "onnxruntime-web", ioName: io.name },
  };
  const node: GraphNode = {
    id,
    kind: io.role,
    name: io.name,
    op: io.role,
    inputs: io.role === "input" ? [] : [value],
    outputs: io.role === "input" ? [value] : [],
  };
  return { tensor, value, node };
}

/**
 * Build a portable model document from ORT's session metadata.
 *
 * A session exposes reliable I/O metadata, but is not by itself a portable
 * operator graph. This emits a runtime-I/O graph with one opaque session node
 * and records that limitation in graph metadata.
 */
export function modelDocumentFromOnnxSession(
  source: ArtifactSource,
  session: OnnxSessionLike,
): ModelDocument {
  const documentId = `onnx:${source.id}`;
  const tensors: Record<string, TensorDescriptor> = {};
  const graphInputs: ValueRef[] = [];
  const graphOutputs: ValueRef[] = [];
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const inputRefs: ValueRef[] = [];
  const outputRefs: ValueRef[] = [];

  for (const [index, name] of session.inputNames.entries()) {
    const io = makeIoTensor(source, {
      name,
      role: "input",
      metadata: metadataFor(session.inputMetadata, name, index),
    });
    tensors[io.tensor.id] = io.tensor;
    graphInputs.push(io.value);
    inputRefs.push(io.value);
    nodes.push(io.node);
  }
  for (const [index, name] of session.outputNames.entries()) {
    const io = makeIoTensor(source, {
      name,
      role: "output",
      metadata: metadataFor(session.outputMetadata, name, index),
    });
    tensors[io.tensor.id] = io.tensor;
    graphOutputs.push(io.value);
    outputRefs.push(io.value);
    nodes.push(io.node);
  }

  const runtimeNodeId = `${documentId}:session`;
  nodes.push({
    id: runtimeNodeId,
    kind: "unknown",
    name: "ONNX Runtime session",
    op: "onnxruntime-session",
    inputs: inputRefs,
    outputs: outputRefs,
    attributes: { graphMetadata: "runtime-io" },
  });

  for (const input of inputRefs) {
    edges.push({
      id: `${input.id}->${runtimeNodeId}`,
      from: input.id,
      to: runtimeNodeId,
      valueId: input.id,
      tensorId: input.tensorId,
    });
  }
  for (const output of outputRefs) {
    edges.push({
      id: `${runtimeNodeId}->${output.id}`,
      from: runtimeNodeId,
      to: output.id,
      valueId: output.id,
      tensorId: output.tensorId,
    });
  }

  const graph: ModelGraph = {
    id: `${documentId}:graph`,
    name: "ONNX Runtime session I/O",
    inputs: graphInputs,
    outputs: graphOutputs,
    nodes,
    edges,
    metadata: { graphMetadata: "runtime-io", operatorGraphAvailable: false },
  };

  return {
    schema: "gggplot.model@1",
    id: documentId,
    name: source.uri ?? source.id,
    framework: { name: "ONNX Runtime Web", dialect: "ONNX" },
    source,
    graphs: [graph],
    tensors,
    metadata: { adapter: "onnxruntime-web", graphMetadata: "runtime-io" },
  };
}

/** Create a runtime adapter around an already-created ORT session document. */
export function onnxRuntimeWebAdapter(
  document: ModelDocument,
): ModelRuntimeAdapter {
  return {
    name: "onnxruntime-web",
    capabilities: ONNXRUNTIME_WEBGPU_CAPABILITIES,
    inspect: async () => document,
  };
}

/** Load a model through an injected ORT-compatible session factory. */
export async function loadOnnxRuntimeWebModel(
  options: OnnxModelLoadOptions,
): Promise<ModelRuntimeAdapter> {
  const session = await options.sessionFactory.create(
    options.model,
    options.sessionOptions,
  );
  return onnxRuntimeWebAdapter(
    modelDocumentFromOnnxSession(options.source, session),
  );
}
