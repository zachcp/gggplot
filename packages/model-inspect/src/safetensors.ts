import { ByteArrayTensorSource, type TensorSource } from "./residency.ts";
import type {
  ArtifactSource,
  ModelDocument,
  ModelDType,
  TensorDescriptor,
} from "./types.ts";

const textDecoder = new TextDecoder("utf-8", { fatal: true });
const SAFE_TENSORS_PREFIX_BYTES = 8;
const DEFAULT_MAX_HEADER_BYTES = 16 * 1024 * 1024;

export class SafeTensorsFormatError extends Error {
  override name = "SafeTensorsFormatError";
}

export interface SafeTensorsLoadOptions {
  source: ArtifactSource;
  /** Limits untrusted JSON metadata before decoding it. */
  maxHeaderBytes?: number;
  /** Source version participates in residency cache identity. */
  sourceVersion?: string;
}

interface SafeTensorsHeaderTensor {
  dtype: string;
  shape: unknown;
  data_offsets: unknown;
  [key: string]: unknown;
}

export interface SafeTensorsInspection {
  document: ModelDocument;
  source: TensorSource;
  header: Record<string, unknown>;
}

function invalid(message: string): never {
  throw new SafeTensorsFormatError(message);
}

function safeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    invalid(`${label} must be a non-negative safe integer`);
  }
  return value;
}

/** Map the SafeTensors spelling into the portable model dtype vocabulary. */
export function modelDTypeFromSafeTensors(dtype: string): ModelDType {
  const normalized = dtype.toUpperCase();
  const aliases: Record<string, ModelDType> = {
    F16: "f16",
    F32: "f32",
    F64: "f64",
    BF16: "bf16",
    I8: "i8",
    I16: "i16",
    I32: "i32",
    I64: "i64",
    U8: "u8",
    U16: "u16",
    U32: "u32",
    U64: "u64",
    BOOL: "bool",
  };
  return aliases[normalized] ?? dtype.toLowerCase();
}

function parseTensor(
  name: string,
  entry: unknown,
  source: ArtifactSource,
  payloadStart: number,
  payloadByteLength: number,
  sourceVersion: string,
): TensorDescriptor {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    invalid(`Tensor ${name} must be an object`);
  }
  const tensor = entry as SafeTensorsHeaderTensor;
  if (typeof tensor.dtype !== "string" || !tensor.dtype) {
    invalid(`Tensor ${name}.dtype is required`);
  }
  if (!Array.isArray(tensor.shape)) {
    invalid(`Tensor ${name}.shape must be an array`);
  }
  const shape = tensor.shape.map((dimension, index) =>
    safeInteger(dimension, `Tensor ${name}.shape[${index}]`)
  );
  if (!Array.isArray(tensor.data_offsets) || tensor.data_offsets.length !== 2) {
    invalid(`Tensor ${name}.data_offsets must contain [start, end]`);
  }
  const relativeStart = safeInteger(
    tensor.data_offsets[0],
    `Tensor ${name}.data_offsets[0]`,
  );
  const relativeEnd = safeInteger(
    tensor.data_offsets[1],
    `Tensor ${name}.data_offsets[1]`,
  );
  if (relativeEnd < relativeStart || relativeEnd > payloadByteLength) {
    invalid(`Tensor ${name}.data_offsets are outside the payload`);
  }
  const byteLength = relativeEnd - relativeStart;
  const id = `safetensors:${source.id}:tensor:${encodeURIComponent(name)}`;
  const dtype = modelDTypeFromSafeTensors(tensor.dtype);
  return {
    id,
    name,
    dtype,
    shape,
    byteLength,
    role: "parameter",
    payload: {
      sourceId: source.id,
      byteOffset: payloadStart + relativeStart,
      byteLength,
      encoding: "safetensors",
    },
    storage: {
      sourceId: source.id,
      byteOffset: payloadStart + relativeStart,
      byteLength,
      dtype,
      shape,
      order: "row-major",
    },
    residency: {
      policy: "range",
      cacheKey: `safetensors:${source.id}:${sourceVersion}:${name}`,
      upload: "on-demand",
      readback: "explicit",
    },
    metadata: { safetensorsDtype: tensor.dtype, sourceOffset: relativeStart },
  };
}

/**
 * Parse a SafeTensors header without copying or decoding the tensor payload.
 * The returned source performs bounds validation before copying selected bytes.
 */
export function inspectSafeTensors(
  input: Uint8Array | ArrayBuffer,
  options: SafeTensorsLoadOptions,
): SafeTensorsInspection {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < SAFE_TENSORS_PREFIX_BYTES) {
    invalid("SafeTensors input is shorter than its 8-byte header length");
  }
  const headerLengthBig = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    SAFE_TENSORS_PREFIX_BYTES,
  ).getBigUint64(0, true);
  if (headerLengthBig > BigInt(Number.MAX_SAFE_INTEGER)) {
    invalid("SafeTensors header length exceeds Number.MAX_SAFE_INTEGER");
  }
  const headerLength = Number(headerLengthBig);
  const maxHeaderBytes = options.maxHeaderBytes ?? DEFAULT_MAX_HEADER_BYTES;
  if (!Number.isSafeInteger(maxHeaderBytes) || maxHeaderBytes < 1) {
    throw new RangeError("maxHeaderBytes must be a positive safe integer");
  }
  if (headerLength > maxHeaderBytes) {
    invalid(
      `SafeTensors header exceeds configured ${maxHeaderBytes}-byte limit`,
    );
  }
  const payloadStart = SAFE_TENSORS_PREFIX_BYTES + headerLength;
  if (payloadStart > bytes.byteLength) {
    invalid("SafeTensors header is truncated");
  }
  let header: Record<string, unknown>;
  try {
    const parsed = JSON.parse(
      textDecoder.decode(bytes.subarray(8, payloadStart)),
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      invalid("SafeTensors header must be a JSON object");
    }
    header = parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SafeTensorsFormatError) throw error;
    invalid(`SafeTensors header is invalid JSON: ${String(error)}`);
  }
  const sourceVersion = options.sourceVersion ?? options.source.version ??
    "unknown";
  const tensors: Record<string, TensorDescriptor> = {};
  const ranges: Array<{ name: string; start: number; end: number }> = [];
  for (const [name, entry] of Object.entries(header)) {
    if (name === "__metadata__") continue;
    const tensor = parseTensor(
      name,
      entry,
      options.source,
      payloadStart,
      bytes.byteLength - payloadStart,
      sourceVersion,
    );
    tensors[tensor.id] = tensor;
    ranges.push({
      name,
      start: tensor.payload!.byteOffset - payloadStart,
      end: tensor.payload!.byteOffset - payloadStart +
        tensor.payload!.byteLength,
    });
  }
  // SafeTensors specifies one contiguous payload region. Rejecting overlap and
  // holes prevents two tensor names from silently aliasing arbitrary bytes.
  ranges.sort((left, right) =>
    left.start - right.start || left.end - right.end
  );
  let expectedStart = 0;
  for (const range of ranges) {
    if (range.start !== expectedStart) {
      invalid(
        `SafeTensors payload has a gap or overlap before tensor ${range.name}`,
      );
    }
    expectedStart = range.end;
  }
  if (expectedStart !== bytes.byteLength - payloadStart) {
    invalid("SafeTensors payload is not fully described by tensor ranges");
  }
  const document: ModelDocument = {
    schema: "gggplot.model@1",
    id: `safetensors:${options.source.id}`,
    name: options.source.uri ?? options.source.id,
    framework: { name: "SafeTensors" },
    source: options.source,
    graphs: [],
    tensors,
    metadata: {
      adapter: "safetensors-direct",
      headerByteLength: headerLength,
      tensorCount: Object.keys(tensors).length,
    },
  };
  return {
    document,
    source: new ByteArrayTensorSource(options.source.id, sourceVersion, bytes),
    header,
  };
}
