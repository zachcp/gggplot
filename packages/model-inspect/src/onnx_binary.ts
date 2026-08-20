import { ByteArrayTensorSource, type TensorSource } from "./residency.ts";
import type {
  ArtifactSource,
  Dimension,
  GraphEdge,
  GraphNode,
  JsonValue,
  ModelDocument,
  ModelDType,
  TensorDescriptor,
  ValueRef,
} from "./types.ts";

const textDecoder = new TextDecoder("utf-8", { fatal: true });
const DEFAULT_MAX_MODEL_BYTES = 512 * 1024 * 1024;
const DEFAULT_MAX_NODES = 100_000;
const DEFAULT_MAX_TENSORS = 100_000;
const DEFAULT_MAX_STRING_BYTES = 1024 * 1024;

export class OnnxFormatError extends Error {
  override name = "OnnxFormatError";
}

export interface OnnxDirectLoadOptions {
  source: ArtifactSource;
  /** Refuse unexpectedly large untrusted inputs before parsing protobuf fields. */
  maxModelBytes?: number;
  maxNodes?: number;
  maxTensors?: number;
  maxStringBytes?: number;
  sourceVersion?: string;
  /** Resolve ONNX external-data locations to an existing bounded source ID. */
  externalDataSourceId?: (location: string) => string | undefined;
}

export interface OnnxDirectInspection {
  document: ModelDocument;
  /** Reads raw initializer slices from the original ONNX bytes on demand. */
  source: TensorSource;
}

type WireType = 0 | 1 | 2 | 5;

interface Field {
  number: number;
  wire: WireType;
}

class ProtoReader {
  constructor(
    private readonly bytes: Uint8Array,
    private offset: number,
    private readonly end: number,
  ) {}

  get done(): boolean {
    return this.offset >= this.end;
  }

  next(): Field | undefined {
    if (this.done) return undefined;
    const tag = this.varint();
    if (tag === 0n) fail("ONNX protobuf contains a zero field tag");
    const number = Number(tag >> 3n);
    const wire = Number(tag & 7n);
    if (!Number.isSafeInteger(number) || number < 1) {
      fail("ONNX protobuf field number is invalid");
    }
    if (wire !== 0 && wire !== 1 && wire !== 2 && wire !== 5) {
      fail(`ONNX protobuf uses unsupported wire type ${wire}`);
    }
    return { number, wire: wire as WireType };
  }

  varint(): bigint {
    let value = 0n;
    for (let shift = 0n; shift < 70n; shift += 7n) {
      if (this.offset >= this.end) fail("ONNX protobuf varint is truncated");
      const byte = this.bytes[this.offset++];
      value |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return value;
    }
    fail("ONNX protobuf varint exceeds 10 bytes");
  }

  length(): { start: number; end: number } {
    const length = this.varint();
    if (length > BigInt(Number.MAX_SAFE_INTEGER)) {
      fail("ONNX protobuf field length exceeds Number.MAX_SAFE_INTEGER");
    }
    const start = this.offset;
    const end = start + Number(length);
    if (!Number.isSafeInteger(end) || end > this.end) {
      fail("ONNX protobuf field is truncated");
    }
    this.offset = end;
    return { start, end };
  }

  bytesField(): { start: number; end: number; bytes: Uint8Array } {
    const { start, end } = this.length();
    return { start, end, bytes: this.bytes.subarray(start, end) };
  }

  fixed32(): Uint8Array {
    const start = this.offset;
    this.advance(4);
    return this.bytes.subarray(start, start + 4);
  }

  string(maxStringBytes: number): string {
    const field = this.bytesField();
    if (field.bytes.byteLength > maxStringBytes) {
      fail(`ONNX string field exceeds configured ${maxStringBytes}-byte limit`);
    }
    try {
      return textDecoder.decode(field.bytes);
    } catch (error) {
      fail(`ONNX string field is invalid UTF-8: ${String(error)}`);
    }
  }

  child(): ProtoReader {
    const { start, end } = this.length();
    return new ProtoReader(this.bytes, start, end);
  }

  childWithRange(): { reader: ProtoReader; start: number; end: number } {
    const { start, end } = this.length();
    return { reader: new ProtoReader(this.bytes, start, end), start, end };
  }

  skip(wire: WireType) {
    if (wire === 0) {
      this.varint();
      return;
    }
    if (wire === 1) {
      this.advance(8);
      return;
    }
    if (wire === 2) {
      this.length();
      return;
    }
    this.advance(4);
  }

  private advance(length: number) {
    this.offset += length;
    if (this.offset > this.end) {
      fail("ONNX protobuf fixed-width field is truncated");
    }
  }
}

function fail(message: string): never {
  throw new OnnxFormatError(message);
}

function requireWire(field: Field, expected: WireType, context: string) {
  if (field.wire !== expected) {
    fail(`${context} uses wire type ${field.wire}, expected ${expected}`);
  }
}

function safeLimit(
  value: number | undefined,
  fallback: number,
  name: string,
): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
  return result;
}

function numberFromVarint(value: bigint, context: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    fail(`${context} exceeds Number.MAX_SAFE_INTEGER`);
  }
  return Number(value);
}

function signed64(value: bigint): bigint {
  return value >= (1n << 63n) ? value - (1n << 64n) : value;
}

/** Map TensorProto.DataType enum values into the portable dtype vocabulary. */
export function modelDTypeFromOnnxDataType(dataType: number): ModelDType {
  const types: Record<number, ModelDType> = {
    1: "f32",
    2: "u8",
    3: "i8",
    4: "u16",
    5: "i16",
    6: "i32",
    7: "i64",
    8: "string",
    9: "bool",
    10: "f16",
    11: "f64",
    12: "u32",
    13: "u64",
    16: "bf16",
    21: "u8",
    22: "i8",
  };
  return types[dataType] ?? `onnx:${dataType}`;
}

function dimensionFromVarint(value: bigint): Dimension {
  const signed = signed64(value);
  if (signed < 0n || signed > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { unknown: true };
  }
  return Number(signed);
}

interface ValueType {
  dtype?: ModelDType;
  shape?: Dimension[];
}

interface RawTensor {
  name: string;
  dtype: ModelDType;
  shape: Dimension[];
  rawData?: { byteOffset: number; byteLength: number };
  packedData?: { byteOffset: number; byteLength: number };
  externalData?: Record<string, string>;
  typedData: boolean;
}

interface RawNode {
  name?: string;
  op?: string;
  domain?: string;
  inputs: string[];
  outputs: string[];
  attributes?: Record<string, JsonValue>;
  containsSubgraph: boolean;
  sourceRange?: { byteOffset: number; byteLength: number };
}

interface RawGraph {
  name?: string;
  nodes: RawNode[];
  initializers: RawTensor[];
  inputs: Map<string, ValueType>;
  outputs: Map<string, ValueType>;
  values: Map<string, ValueType>;
}

function parseTensorShape(
  reader: ProtoReader,
  maxStringBytes: number,
): Dimension[] {
  const shape: Dimension[] = [];
  while (!reader.done) {
    const field = reader.next()!;
    if (field.number !== 1) {
      reader.skip(field.wire);
      continue;
    }
    requireWire(field, 2, "TensorShapeProto.dim");
    const dimensionReader = reader.child();
    let dimension: Dimension = { unknown: true };
    while (!dimensionReader.done) {
      const child = dimensionReader.next()!;
      if (child.number === 1) {
        requireWire(child, 0, "TensorShapeProto.Dimension.dim_value");
        dimension = dimensionFromVarint(dimensionReader.varint());
      } else if (child.number === 2) {
        requireWire(child, 2, "TensorShapeProto.Dimension.dim_param");
        const symbol = dimensionReader.string(maxStringBytes);
        dimension = symbol ? { symbol } : { unknown: true };
      } else {
        dimensionReader.skip(child.wire);
      }
    }
    shape.push(dimension);
  }
  return shape;
}

function parseType(reader: ProtoReader, maxStringBytes: number): ValueType {
  const result: ValueType = {};
  while (!reader.done) {
    const field = reader.next()!;
    if (field.number !== 1) {
      reader.skip(field.wire);
      continue;
    }
    requireWire(field, 2, "TypeProto.tensor_type");
    const tensor = reader.child();
    while (!tensor.done) {
      const tensorField = tensor.next()!;
      if (tensorField.number === 1) {
        requireWire(tensorField, 0, "TypeProto.Tensor.elem_type");
        result.dtype = modelDTypeFromOnnxDataType(
          numberFromVarint(tensor.varint(), "ONNX element type"),
        );
      } else if (tensorField.number === 2) {
        requireWire(tensorField, 2, "TypeProto.Tensor.shape");
        result.shape = parseTensorShape(tensor.child(), maxStringBytes);
      } else {
        tensor.skip(tensorField.wire);
      }
    }
  }
  return result;
}

function parseValueInfo(
  reader: ProtoReader,
  maxStringBytes: number,
): { name: string; type: ValueType } {
  let name = "";
  let type: ValueType = {};
  while (!reader.done) {
    const field = reader.next()!;
    if (field.number === 1) {
      requireWire(field, 2, "ValueInfoProto.name");
      name = reader.string(maxStringBytes);
    } else if (field.number === 2) {
      requireWire(field, 2, "ValueInfoProto.type");
      type = parseType(reader.child(), maxStringBytes);
    } else {
      reader.skip(field.wire);
    }
  }
  return { name, type };
}

function parseStringEntry(
  reader: ProtoReader,
  maxStringBytes: number,
): [string, string] {
  let key = "";
  let value = "";
  while (!reader.done) {
    const field = reader.next()!;
    if (field.number === 1) {
      requireWire(field, 2, "StringStringEntryProto.key");
      key = reader.string(maxStringBytes);
    } else if (field.number === 2) {
      requireWire(field, 2, "StringStringEntryProto.value");
      value = reader.string(maxStringBytes);
    } else reader.skip(field.wire);
  }
  return [key, value];
}

function parseTensor(reader: ProtoReader, maxStringBytes: number): RawTensor {
  let name = "";
  let dtype: ModelDType = "unknown";
  const shape: Dimension[] = [];
  let rawData: RawTensor["rawData"];
  let packedData: RawTensor["packedData"];
  let externalData: Record<string, string> | undefined;
  let typedData = false;
  while (!reader.done) {
    const field = reader.next()!;
    if (field.number === 1) {
      if (field.wire === 0) shape.push(dimensionFromVarint(reader.varint()));
      else if (field.wire === 2) {
        const packed = reader.child();
        while (!packed.done) shape.push(dimensionFromVarint(packed.varint()));
      } else fail("TensorProto.dims has an invalid wire type");
    } else if (field.number === 2) {
      requireWire(field, 0, "TensorProto.data_type");
      dtype = modelDTypeFromOnnxDataType(
        numberFromVarint(reader.varint(), "ONNX data type"),
      );
    } else if (field.number === 8) {
      requireWire(field, 2, "TensorProto.name");
      name = reader.string(maxStringBytes);
    } else if (field.number === 9) {
      requireWire(field, 2, "TensorProto.raw_data");
      const bytes = reader.bytesField();
      rawData = {
        byteOffset: bytes.start,
        byteLength: bytes.end - bytes.start,
      };
    } else if (field.number === 13) {
      requireWire(field, 2, "TensorProto.external_data");
      externalData ??= {};
      const [key, value] = parseStringEntry(reader.child(), maxStringBytes);
      if (key) externalData[key] = value;
    } else if (field.number === 4 || field.number === 10) {
      // float_data and double_data are protobuf-packed fixed-width scalars in
      // ordinary ONNX encoders. Their length-delimited body is already a
      // contiguous little-endian numeric range, so it can stay lazy exactly
      // like raw_data. Unpacked repeated scalars are intentionally metadata.
      typedData = true;
      if (field.wire === 2) {
        const bytes = reader.bytesField();
        const expectedWidth = field.number === 4 ? 4 : 8;
        if ((bytes.end - bytes.start) % expectedWidth === 0) {
          rawData ??= {
            byteOffset: bytes.start,
            byteLength: bytes.end - bytes.start,
          };
          packedData = {
            byteOffset: bytes.start,
            byteLength: bytes.end - bytes.start,
          };
        }
      } else {
        reader.skip(field.wire);
      }
    } else {
      // Repeated typed fields are deliberately skipped. They are neither
      // decoded nor copied; only raw_data/external_data can be lazy sources.
      if ([4, 5, 6, 7, 10, 11, 12].includes(field.number)) typedData = true;
      reader.skip(field.wire);
    }
  }
  return { name, dtype, shape, rawData, packedData, externalData, typedData };
}

function parseAttribute(reader: ProtoReader, maxStringBytes: number): {
  name?: string;
  value?: JsonValue;
  containsSubgraph: boolean;
} {
  let name: string | undefined;
  let value: JsonValue | undefined;
  let containsSubgraph = false;
  while (!reader.done) {
    const field = reader.next()!;
    if (field.number === 1) {
      requireWire(field, 2, "AttributeProto.name");
      name = reader.string(maxStringBytes);
    } else if (field.number === 2 && field.wire === 5) {
      // Preserve float bit patterns as a display value without evaluating code.
      const bytes = reader.fixed32();
      value = new DataView(bytes.buffer, bytes.byteOffset, 4).getFloat32(
        0,
        true,
      );
    } else if (field.number === 3 && field.wire === 0) {
      const int = signed64(reader.varint());
      value = int >= BigInt(Number.MIN_SAFE_INTEGER) &&
          int <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(int)
        : int.toString();
    } else if (field.number === 4) {
      requireWire(field, 2, "AttributeProto.s");
      value = reader.string(maxStringBytes);
    } else if (
      field.number === 5 || field.number === 6 || field.number === 9 ||
      field.number === 10
    ) {
      // Tensor and graph attributes are present, but must remain lazy/opaque.
      // AttributeProto.graph is field 6 and graphs is field 10.
      containsSubgraph ||= field.number === 6 || field.number === 10;
      reader.skip(field.wire);
    } else {
      reader.skip(field.wire);
    }
  }
  return { name, value, containsSubgraph };
}

function parseNode(reader: ProtoReader, maxStringBytes: number): RawNode {
  const inputs: string[] = [];
  const outputs: string[] = [];
  let name: string | undefined;
  let op: string | undefined;
  let domain: string | undefined;
  let attributes: Record<string, JsonValue> | undefined;
  let containsSubgraph = false;
  while (!reader.done) {
    const field = reader.next()!;
    if (field.number === 1) {
      requireWire(field, 2, "NodeProto.input");
      inputs.push(reader.string(maxStringBytes));
    } else if (field.number === 2) {
      requireWire(field, 2, "NodeProto.output");
      outputs.push(reader.string(maxStringBytes));
    } else if (field.number === 3) {
      requireWire(field, 2, "NodeProto.name");
      name = reader.string(maxStringBytes);
    } else if (field.number === 4) {
      requireWire(field, 2, "NodeProto.op_type");
      op = reader.string(maxStringBytes);
    } else if (field.number === 5) {
      requireWire(field, 2, "NodeProto.attribute");
      const attribute = parseAttribute(reader.child(), maxStringBytes);
      containsSubgraph ||= attribute.containsSubgraph;
      if (attribute.name && attribute.value !== undefined) {
        attributes ??= {};
        attributes[attribute.name] = attribute.value;
      }
    } else if (field.number === 7) {
      requireWire(field, 2, "NodeProto.domain");
      domain = reader.string(maxStringBytes);
    } else reader.skip(field.wire);
  }
  return { name, op, domain, inputs, outputs, attributes, containsSubgraph };
}

function parseGraph(
  reader: ProtoReader,
  maxStringBytes: number,
  maxNodes: number,
  maxTensors: number,
): RawGraph {
  const graph: RawGraph = {
    nodes: [],
    initializers: [],
    inputs: new Map(),
    outputs: new Map(),
    values: new Map(),
  };
  let tensorCount = 0;
  const countTensor = () => {
    tensorCount++;
    if (tensorCount > maxTensors) {
      fail(`ONNX graph exceeds configured ${maxTensors}-tensor limit`);
    }
  };
  while (!reader.done) {
    const field = reader.next()!;
    if (field.number === 1) {
      requireWire(field, 2, "GraphProto.node");
      if (graph.nodes.length >= maxNodes) {
        fail(`ONNX graph exceeds configured ${maxNodes}-node limit`);
      }
      const encoded = reader.childWithRange();
      const node = parseNode(encoded.reader, maxStringBytes);
      node.sourceRange = {
        byteOffset: encoded.start,
        byteLength: encoded.end - encoded.start,
      };
      graph.nodes.push(node);
    } else if (field.number === 2) {
      requireWire(field, 2, "GraphProto.name");
      graph.name = reader.string(maxStringBytes);
    } else if (field.number === 5) {
      requireWire(field, 2, "GraphProto.initializer");
      countTensor();
      graph.initializers.push(parseTensor(reader.child(), maxStringBytes));
    } else if (
      field.number === 11 || field.number === 12 || field.number === 13
    ) {
      requireWire(field, 2, "GraphProto.value metadata");
      countTensor();
      const value = parseValueInfo(reader.child(), maxStringBytes);
      if (!value.name) continue;
      const target = field.number === 11
        ? graph.inputs
        : field.number === 12
        ? graph.outputs
        : graph.values;
      target.set(value.name, value.type);
    } else reader.skip(field.wire);
  }
  return graph;
}

function parseModel(
  bytes: Uint8Array,
  maxStringBytes: number,
  maxNodes: number,
  maxTensors: number,
): { graph: RawGraph; opsets: string[]; metadata: Record<string, JsonValue> } {
  const reader = new ProtoReader(bytes, 0, bytes.byteLength);
  let graph: RawGraph | undefined;
  const opsets: string[] = [];
  const metadata: Record<string, JsonValue> = {};
  while (!reader.done) {
    const field = reader.next()!;
    if (field.number === 7) {
      requireWire(field, 2, "ModelProto.graph");
      if (graph) fail("ONNX ModelProto contains more than one main graph");
      graph = parseGraph(reader.child(), maxStringBytes, maxNodes, maxTensors);
    } else if (field.number === 8) {
      requireWire(field, 2, "ModelProto.opset_import");
      const entry = reader.child();
      let domain = "ai.onnx";
      let version: number | undefined;
      while (!entry.done) {
        const child = entry.next()!;
        if (child.number === 1) {
          requireWire(child, 2, "OperatorSetIdProto.domain");
          domain = entry.string(maxStringBytes) || "ai.onnx";
        } else if (child.number === 2) {
          requireWire(child, 0, "OperatorSetIdProto.version");
          version = numberFromVarint(entry.varint(), "ONNX opset version");
        } else entry.skip(child.wire);
      }
      opsets.push(`${domain}:${version ?? "unknown"}`);
    } else if (field.number === 14) {
      requireWire(field, 2, "ModelProto.metadata_props");
      const [key, value] = parseStringEntry(reader.child(), maxStringBytes);
      if (key) metadata[key] = value;
    } else reader.skip(field.wire);
  }
  if (!graph) fail("ONNX ModelProto has no graph");
  return { graph, opsets, metadata };
}

function idPart(name: string): string {
  return encodeURIComponent(name || "unnamed");
}

function valueId(graphId: string, name: string): string {
  return `${graphId}:value:${idPart(name)}`;
}

function descriptor(
  id: string,
  name: string,
  role: TensorDescriptor["role"],
  type: ValueType,
  source: ArtifactSource,
): TensorDescriptor {
  return {
    id,
    name,
    dtype: type.dtype ?? "unknown",
    shape: type.shape ?? [{ unknown: true }],
    role,
    residency: {
      policy: "metadata",
      cacheKey: `${source.id}:${id}:metadata`,
      upload: "never",
      readback: "never",
    },
    metadata: { onnxName: name },
  };
}

function logicalByteLength(
  shape: Dimension[],
  dtype: ModelDType,
): number | undefined {
  const widths: Record<string, number> = {
    f16: 2,
    f32: 4,
    f64: 8,
    bf16: 2,
    i8: 1,
    i16: 2,
    i32: 4,
    i64: 8,
    u8: 1,
    u16: 2,
    u32: 4,
    u64: 8,
    bool: 1,
  };
  const width = widths[dtype];
  if (!width || !shape.every((dimension) => typeof dimension === "number")) {
    return undefined;
  }
  const count = shape.reduce(
    (total, dimension) => total * (dimension as number),
    1,
  );
  return Number.isSafeInteger(count) &&
      count <= Math.floor(Number.MAX_SAFE_INTEGER / width)
    ? count * width
    : undefined;
}

/**
 * Inspect ONNX protobuf metadata directly. It does not instantiate a runtime,
 * execute operators, or read/copy any initializer payload.
 */
export function inspectOnnx(
  input: Uint8Array | ArrayBuffer,
  options: OnnxDirectLoadOptions,
): OnnxDirectInspection {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const maxModelBytes = safeLimit(
    options.maxModelBytes,
    DEFAULT_MAX_MODEL_BYTES,
    "maxModelBytes",
  );
  if (bytes.byteLength > maxModelBytes) {
    fail(`ONNX input exceeds configured ${maxModelBytes}-byte limit`);
  }
  const maxNodes = safeLimit(options.maxNodes, DEFAULT_MAX_NODES, "maxNodes");
  const maxTensors = safeLimit(
    options.maxTensors,
    DEFAULT_MAX_TENSORS,
    "maxTensors",
  );
  const maxStringBytes = safeLimit(
    options.maxStringBytes,
    DEFAULT_MAX_STRING_BYTES,
    "maxStringBytes",
  );
  const parsed = parseModel(bytes, maxStringBytes, maxNodes, maxTensors);
  const documentId = `onnx:${options.source.id}`;
  const graphId = `${documentId}:graph:${idPart(parsed.graph.name ?? "main")}`;
  const sourceVersion = options.sourceVersion ?? options.source.version ??
    "unknown";
  const tensors: Record<string, TensorDescriptor> = {};
  const tensorByValue = new Map<string, string>();
  const valueTypes = new Map(parsed.graph.values);
  for (const [name, type] of parsed.graph.inputs) valueTypes.set(name, type);
  for (const [name, type] of parsed.graph.outputs) valueTypes.set(name, type);

  for (const initializer of parsed.graph.initializers) {
    if (!initializer.name) continue;
    const id = `${documentId}:initializer:${idPart(initializer.name)}`;
    const byteLength = initializer.rawData?.byteLength ??
      logicalByteLength(initializer.shape, initializer.dtype);
    const location = initializer.externalData?.location;
    const externalSourceId = location
      ? options.externalDataSourceId?.(location)
      : undefined;
    const externalInteger = (value: string | undefined, label: string) => {
      if (value === undefined) return undefined;
      if (!/^\d+$/.test(value)) {
        fail(`ONNX external data ${label} must be a non-negative integer`);
      }
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed)) {
        fail(`ONNX external data ${label} exceeds Number.MAX_SAFE_INTEGER`);
      }
      return parsed;
    };
    const externalOffset = externalInteger(
      initializer.externalData?.offset,
      "offset",
    ) ?? 0;
    const externalLength = externalInteger(
      initializer.externalData?.length,
      "length",
    ) ?? byteLength;
    const payload = initializer.rawData
      ? {
        sourceId: options.source.id,
        byteOffset: initializer.rawData.byteOffset,
        byteLength: initializer.rawData.byteLength,
        encoding: "onnx" as const,
      }
      : externalSourceId && externalLength !== undefined
      ? {
        sourceId: externalSourceId,
        byteOffset: externalOffset,
        byteLength: externalLength,
        encoding: "onnx" as const,
      }
      : undefined;
    const concreteShape = initializer.shape.every((dimension) =>
        typeof dimension === "number"
      )
      ? initializer.shape as number[]
      : undefined;
    tensors[id] = {
      id,
      name: initializer.name,
      dtype: initializer.dtype,
      shape: initializer.shape,
      role: "parameter",
      byteLength,
      payload,
      storage: payload && concreteShape
        ? {
          sourceId: payload.sourceId,
          byteOffset: payload.byteOffset,
          byteLength: payload.byteLength,
          dtype: initializer.dtype,
          shape: concreteShape,
          order: "row-major",
        }
        : undefined,
      residency: {
        policy: payload ? "range" : "metadata",
        cacheKey:
          `onnx:${options.source.id}:${sourceVersion}:${initializer.name}`,
        upload: payload ? "on-demand" : "never",
        readback: payload ? "explicit" : "never",
      },
      provenance: payload
        ? [{
          sourceId: payload.sourceId,
          byteOffset: payload.byteOffset,
          byteLength: payload.byteLength,
          path: `graph.initializer:${initializer.name}`,
        }]
        : [{
          sourceId: options.source.id,
          path: `graph.initializer:${initializer.name}`,
          note: "Initializer has no contiguous lazy payload range.",
        }],
      metadata: {
        onnxName: initializer.name,
        payloadEncoding: initializer.packedData
          ? "packed_numeric_field"
          : initializer.rawData
          ? "raw_data"
          : location
          ? "external_data"
          : initializer.typedData
          ? "typed_field"
          : "unavailable",
        ...(location ? { externalLocation: location } : {}),
      },
    };
    tensorByValue.set(initializer.name, id);
    valueTypes.set(initializer.name, {
      dtype: initializer.dtype,
      shape: initializer.shape,
    });
  }

  // Typed graph values are metadata descriptors. They do not imply an upload.
  const createValueTensor = (name: string, role: TensorDescriptor["role"]) => {
    if (tensorByValue.has(name)) return;
    const id = `${documentId}:value:${idPart(name)}`;
    tensors[id] = descriptor(
      id,
      name,
      role,
      valueTypes.get(name) ?? {},
      options.source,
    );
    tensorByValue.set(name, id);
  };
  for (const name of parsed.graph.inputs.keys()) {
    createValueTensor(name, "input");
  }
  for (const name of parsed.graph.outputs.keys()) {
    createValueTensor(name, "output");
  }
  for (const name of parsed.graph.values.keys()) {
    createValueTensor(name, "intermediate");
  }

  const valueRef = (name: string): ValueRef => {
    const type = valueTypes.get(name);
    return {
      id: valueId(graphId, name),
      tensorId: tensorByValue.get(name),
      dtype: type?.dtype,
      shape: type?.shape,
    };
  };
  const nodes: GraphNode[] = [];
  const producer = new Map<string, string>();
  for (const name of parsed.graph.inputs.keys()) {
    const id = `${graphId}:input:${idPart(name)}`;
    nodes.push({
      id,
      kind: "input",
      name,
      op: "input",
      inputs: [],
      outputs: [valueRef(name)],
    });
    producer.set(name, id);
  }
  for (const initializer of parsed.graph.initializers) {
    if (!initializer.name) continue;
    const id = `${graphId}:constant:${idPart(initializer.name)}`;
    nodes.push({
      id,
      kind: "constant",
      name: initializer.name,
      op: "initializer",
      inputs: [],
      outputs: [valueRef(initializer.name)],
    });
    producer.set(initializer.name, id);
  }
  const opNodes: Array<{ id: string; raw: RawNode }> = [];
  for (const [index, raw] of parsed.graph.nodes.entries()) {
    const id = `${graphId}:node:${index}`;
    opNodes.push({ id, raw });
    nodes.push({
      id,
      kind: "operator",
      name: raw.name,
      op: raw.op,
      domain: raw.domain,
      attributes: raw.attributes,
      inputs: raw.inputs.filter(Boolean).map(valueRef),
      outputs: raw.outputs.filter(Boolean).map(valueRef),
      parameters: raw.inputs.filter((name) =>
        tensorByValue.has(name) &&
        tensors[tensorByValue.get(name)!].role === "parameter"
      ).map((name) => tensorByValue.get(name)!),
      metadata: {
        onnxNodeIndex: index,
        ...(raw.containsSubgraph ? { containsSubgraph: true } : {}),
      },
      provenance: raw.sourceRange
        ? [{
          sourceId: options.source.id,
          byteOffset: raw.sourceRange.byteOffset,
          byteLength: raw.sourceRange.byteLength,
          path: `graph.node[${index}]`,
        }]
        : undefined,
    });
    for (const output of raw.outputs) if (output) producer.set(output, id);
  }
  const outputNodes = new Map<string, string>();
  for (const name of parsed.graph.outputs.keys()) {
    const id = `${graphId}:output:${idPart(name)}`;
    outputNodes.set(name, id);
    nodes.push({
      id,
      kind: "output",
      name,
      op: "output",
      inputs: [valueRef(name)],
      outputs: [],
    });
  }
  const edges: GraphEdge[] = [];
  for (const { id: nodeId, raw } of opNodes) {
    raw.inputs.forEach((name) => {
      if (!name) return;
      const from = producer.get(name);
      if (!from) return;
      edges.push({
        id: `${graphId}:edge:${edges.length}`,
        from,
        to: nodeId,
        valueId: valueId(graphId, name),
        tensorId: tensorByValue.get(name),
      });
    });
  }
  for (const [name, to] of outputNodes) {
    const from = producer.get(name);
    if (!from) continue;
    edges.push({
      id: `${graphId}:edge:${edges.length}`,
      from,
      to,
      valueId: valueId(graphId, name),
      tensorId: tensorByValue.get(name),
    });
  }
  const graph = {
    id: graphId,
    name: parsed.graph.name ?? "main",
    inputs: [...parsed.graph.inputs.keys()].map(valueRef),
    outputs: [...parsed.graph.outputs.keys()].map(valueRef),
    nodes,
    edges,
    metadata: {
      graphMetadata: "onnx-direct",
      operatorGraphAvailable: true,
      dynamicGraphsPresent: parsed.graph.nodes.some((node) =>
        node.containsSubgraph
      ),
      dynamicGraphLimitation:
        "Nested control-flow graphs are reported but are not expanded in the first direct parser.",
    },
  };
  const document: ModelDocument = {
    schema: "gggplot.model@1",
    id: documentId,
    name: options.source.uri ?? options.source.id,
    framework: { name: "ONNX", dialect: "ONNX" },
    source: options.source,
    graphs: [graph],
    tensors,
    metadata: {
      adapter: "onnx-direct",
      graphMetadata: "onnx-direct",
      opsets: parsed.opsets,
      ...parsed.metadata,
    },
  };
  return {
    document,
    source: new ByteArrayTensorSource(options.source.id, sourceVersion, bytes),
  };
}
