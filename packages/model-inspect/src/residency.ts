import type { ModelDType, TensorStorage } from "./types.ts";

/** A bounded request into an artifact or runtime-owned tensor source. */
export interface TensorRangeRequest {
  sourceId: string;
  sourceVersion?: string;
  byteOffset: number;
  byteLength: number;
  dtype: ModelDType;
  shape: number[];
  strides?: number[];
}

/** Loader/runtime boundary; it returns bytes, never a GPU handle. */
export interface TensorSource {
  readonly id: string;
  readonly version: string;
  readonly byteLength?: number;
  readRange(request: TensorRangeRequest): Promise<ArrayBuffer>;
}

/**
 * A bounded, immutable view over bytes the caller already owns.
 *
 * Parsing a model may retain this source, but never copies tensor payloads
 * until a caller asks for a validated range. Browser File and URL sources can
 * implement the same TensorSource contract without keeping all bytes in
 * memory.
 */
export class ByteArrayTensorSource implements TensorSource {
  readonly byteLength: number;

  constructor(
    readonly id: string,
    readonly version: string,
    private readonly bytes: Uint8Array,
  ) {
    this.byteLength = bytes.byteLength;
  }

  // Implements the async TensorSource contract; sources backed by network or
  // disk do await here.
  // deno-lint-ignore require-await
  async readRange(request: TensorRangeRequest): Promise<ArrayBuffer> {
    const errors = validateTensorRange(request, this.byteLength);
    if (errors.length > 0) {
      throw new RangeError(`Invalid tensor range: ${errors.join(", ")}`);
    }
    if (request.sourceId !== this.id) {
      throw new RangeError(
        `Tensor range source ${request.sourceId} does not match ${this.id}`,
      );
    }
    const start = request.byteOffset;
    const end = start + request.byteLength;
    // slice() is intentionally the first payload copy: the model parser only
    // holds byte offsets, while a selected view receives exactly its range.
    return this.bytes.slice(start, end).buffer as ArrayBuffer;
  }
}

export type ResidencyState =
  | { kind: "metadata" }
  | { kind: "summary"; summaryKey: string }
  | { kind: "range"; rangeKey: string; byteLength: number }
  | { kind: "product"; productKey: string; byteLength: number }
  | { kind: "evicted"; reason: "budget" | "source-changed" | "manual" };

export interface ResidencyRecord {
  cacheKey: string;
  sourceId: string;
  sourceVersion: string;
  state: ResidencyState;
  /** Runtime-only identity for a useGPU source/buffer/texture. */
  resource?: unknown;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
        .join(",")
    }}`;
  }
  return JSON.stringify(value);
}

/** Stable identity for a logical range before it is assigned a GPU resource. */
export function tensorRangeCacheKey(request: TensorRangeRequest): string {
  return `tensor-range:${
    stable({
      sourceId: request.sourceId,
      sourceVersion: request.sourceVersion,
      byteOffset: request.byteOffset,
      byteLength: request.byteLength,
      dtype: request.dtype,
      shape: request.shape,
      strides: request.strides,
    })
  }`;
}

/** Stable identity for a physical representation of a logical tensor. */
export function tensorStorageCacheKey(
  storage: TensorStorage,
  sourceVersion?: string,
): string {
  return `tensor-storage:${stable({ sourceVersion, ...storage })}`;
}

export function validateTensorRange(
  request: TensorRangeRequest,
  sourceByteLength?: number,
): string[] {
  const errors: string[] = [];
  if (!request.sourceId) errors.push("sourceId is required");
  if (!Number.isSafeInteger(request.byteOffset) || request.byteOffset < 0) {
    errors.push("byteOffset must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(request.byteLength) || request.byteLength < 0) {
    errors.push("byteLength must be a non-negative safe integer");
  }
  if (
    sourceByteLength !== undefined &&
    request.byteOffset + request.byteLength > sourceByteLength
  ) {
    errors.push("requested range exceeds source length");
  }
  if (
    !Array.isArray(request.shape) ||
    !request.shape.every((value) => Number.isSafeInteger(value) && value >= 0)
  ) {
    errors.push("shape must contain non-negative safe integers");
  }
  if (
    request.strides &&
    !request.strides.every((value) => Number.isSafeInteger(value) && value >= 0)
  ) {
    errors.push("strides must contain non-negative safe integers");
  }
  return errors;
}

/**
 * State transition guard shared by loader/view adapters. It intentionally
 * does not allocate or upload anything; a host owns the resource lifecycle.
 */
export function transitionResidency(
  record: ResidencyRecord,
  next: ResidencyState,
): ResidencyRecord {
  if (next.kind === "range" && next.byteLength < 0) {
    throw new Error("range residency byteLength must be non-negative");
  }
  if (next.kind === "product" && next.byteLength < 0) {
    throw new Error("product residency byteLength must be non-negative");
  }
  if (next.kind === "evicted") {
    return { ...record, state: next, resource: undefined };
  }
  return { ...record, state: next };
}
