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
    // `protected` so the GPU loader (gpu_loader.ts) can hand the queue a
    // SUBARRAY of these bytes. Going through readRange() there would slice
    // first and upload second, which is the second copy the whole tier exists
    // to remove.
    protected readonly bytes: Uint8Array,
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

/**
 * A GPU-resident tensor range: what the loader tier returns instead of bytes,
 * and the exact shape `useSource` and `<Kernel source>` consume.
 *
 * DELIBERATELY STRUCTURAL. @gggplot/model-inspect is headless and depends on no
 * npm package at all (deno.json: `@std/assert` and `@gggplot/core/plan`), so
 * this mirrors Use.GPU's `StorageSource` field-for-field rather than importing
 * it. That is the same call `packages/core/src/runtime/types.ts`'s
 * `GPUStorageSource` already makes on the mark side, and the reason
 * @gggplot/reductions can hand real buffers to a mounted tree without ever
 * naming @use-gpu. `GPUBuffer` is a platform type, not a dependency.
 * ADR 006 records the boundary decision and why the adapter lives in core.
 */
export interface TensorStorageSource {
  readonly buffer: GPUBuffer;
  /** WGSL storage element type; see TENSOR_UPLOAD_PLANS for the dtype map. */
  readonly format: "f32" | "u32" | "i32";
  /** Element count, not bytes. */
  readonly length: number;
  /** Logical dimensions of the uploaded range, outermost first. */
  readonly size: readonly number[];
  /** Bumped when contents change; this is what `shouldDispatch` compares. */
  readonly version: number;
  readonly addressSpace?: "storage" | "uniform";
  /**
   * Releases the buffer. Called by `evictResidency`, never by a render path.
   * Optional because a source can be a borrowed view of a buffer it does not
   * own — a runtime-shared tensor (`RuntimeGpuTensorBinding.resource`) is the
   * runtime's to destroy, not ours.
   */
  destroy?(): void;
}

/**
 * A loader that yields a GPU handle instead of bytes.
 *
 * `readRange` is inherited and stays: it is the CPU/test/export path and the
 * parity reference every dtype-adapter kernel is checked against. The two
 * methods must describe the SAME range for the same request — an implementation
 * that lets them drift makes the parity test meaningless.
 */
export interface GPUTensorSource extends TensorSource {
  readonly device: GPUDevice;
  /**
   * Whether this loader can take `dtype` to a buffer without a CPU decode.
   *
   * The dtype's own plan is necessary but not sufficient: a loader may not have
   * built the adapter pass its plan names. Callers branch on this rather than
   * catching from `readRangeSource`, which throws for an unsupported dtype.
   */
  supports(dtype: ModelDType): boolean;
  /** Uploads a validated range straight to a storage buffer. No CPU decode. */
  readRangeSource(request: TensorRangeRequest): Promise<TensorStorageSource>;
}

export function isGPUTensorSource(
  source: TensorSource,
): source is GPUTensorSource {
  return typeof (source as GPUTensorSource).readRangeSource === "function" &&
    typeof (source as GPUTensorSource).supports === "function";
}

/**
 * How a source dtype reaches a WGSL storage buffer.
 *
 * WGSL storage buffers speak f32/u32/i32 (and f16 only with the `shader-f16`
 * feature). Model tensors do not, so every dtype that is not already one of
 * those three needs a conversion — and the decision this table encodes is that
 * the conversion is a COMPUTE PASS, not the CPU decode loop
 * (`products.ts::readValues`) it replaces.
 */
export type TensorUploadPath =
  /** The byte range IS the buffer contents. One writeBuffer, no decode. */
  | "direct"
  /** Half-width float widened to f32 by an adapter kernel. Exact. */
  | "widen"
  /** Sub-word integers uploaded as u32 words and unpacked. Exact. */
  | "unpack"
  /** 64-bit narrowed to 32-bit by an adapter kernel. Lossy, by decision. */
  | "narrow"
  /** No numeric buffer representation; the product stays metadata-only. */
  | "unsupported";

export interface TensorUploadPlan {
  readonly path: TensorUploadPath;
  /** Bytes per element in the SOURCE range. */
  readonly sourceBytes: number;
  /** WGSL storage element type after upload; undefined when unsupported. */
  readonly format: "f32" | "u32" | "i32" | undefined;
  /**
   * Adapter `<Kernel>` bundle that converts the uploaded words, or undefined on
   * the zero-decode path. Named here rather than in core so the dtype policy is
   * one table a headless test can read; core owns the WGSL behind each name.
   */
  readonly kernel: string | undefined;
  /** True when the conversion cannot round-trip back to the source dtype. */
  readonly lossy: boolean;
}

const DIRECT_F32: TensorUploadPlan = {
  path: "direct",
  sourceBytes: 4,
  format: "f32",
  kernel: undefined,
  lossy: false,
};

/**
 * The dtype adapter table, as data rather than as a switch.
 *
 * f16 maps to a widening kernel even on a device that has `shader-f16`: a
 * second storage element type would fork every consumer of `format`, and the
 * mark path (`GPUStorageSource.format`, `requireStorage` in
 * `core/src/runtime/resident.ts`) only knows f32 and u32. The feature buys half
 * the buffer bytes and costs a format fork; ADR 006 takes the fork off the
 * table and revisits it only if a measured f16 tensor is buffer-bound.
 *
 * The 64-bit rows are lossy in exactly the way `decodeValue` already is — it
 * narrows i64/u64 through BigInt to a JS number, exact to 2^53. Moving the
 * narrowing into a kernel changes where the loss happens, not whether it does,
 * so the diagnostics the CPU path emits carry over unchanged.
 */
export const TENSOR_UPLOAD_PLANS: Readonly<
  Record<string, TensorUploadPlan>
> = Object.freeze({
  f32: DIRECT_F32,
  u32: {
    path: "direct",
    sourceBytes: 4,
    format: "u32",
    kernel: undefined,
    lossy: false,
  },
  i32: {
    path: "direct",
    sourceBytes: 4,
    format: "i32",
    kernel: undefined,
    lossy: false,
  },
  f16: {
    path: "widen",
    sourceBytes: 2,
    format: "f32",
    kernel: "widen_f16",
    lossy: false,
  },
  // Shift left 16 into the f32 bit pattern; bf16 is a truncated f32, so the
  // widening is exact and needs no rounding mode.
  bf16: {
    path: "widen",
    sourceBytes: 2,
    format: "f32",
    kernel: "widen_bf16",
    lossy: false,
  },
  i8: {
    path: "unpack",
    sourceBytes: 1,
    format: "i32",
    kernel: "unpack_i8",
    lossy: false,
  },
  i16: {
    path: "unpack",
    sourceBytes: 2,
    format: "i32",
    kernel: "unpack_i16",
    lossy: false,
  },
  u8: {
    path: "unpack",
    sourceBytes: 1,
    format: "u32",
    kernel: "unpack_u8",
    lossy: false,
  },
  u16: {
    path: "unpack",
    sourceBytes: 2,
    format: "u32",
    kernel: "unpack_u16",
    lossy: false,
  },
  bool: {
    path: "unpack",
    sourceBytes: 1,
    format: "u32",
    kernel: "unpack_bool",
    lossy: false,
  },
  f64: {
    path: "narrow",
    sourceBytes: 8,
    format: "f32",
    kernel: "narrow_f64",
    lossy: true,
  },
  i64: {
    path: "narrow",
    sourceBytes: 8,
    format: "i32",
    kernel: "narrow_i64",
    lossy: true,
  },
  u64: {
    path: "narrow",
    sourceBytes: 8,
    format: "u32",
    kernel: "narrow_u64",
    lossy: true,
  },
});

const UNSUPPORTED_UPLOAD: TensorUploadPlan = Object.freeze({
  path: "unsupported",
  sourceBytes: 0,
  format: undefined,
  kernel: undefined,
  lossy: false,
});

/**
 * How `dtype` reaches a storage buffer. `ModelDType` admits arbitrary strings
 * (a format we have not taught the IR yet), so an unknown dtype answers
 * "unsupported" rather than throwing: the caller falls back to the CPU values
 * path exactly as it does today for `string`.
 */
export function tensorUploadPlan(dtype: ModelDType): TensorUploadPlan {
  return TENSOR_UPLOAD_PLANS[dtype] ?? UNSUPPORTED_UPLOAD;
}

/**
 * Byte size to allocate and write for `byteLength` of payload.
 *
 * `createBuffer` sizes and `writeBuffer` sizes must both be multiples of four.
 * A tensor range need not be: a bool or i8 tensor with a row count that is not
 * a multiple of four ends on an odd byte. Rounding up is the whole fix — the
 * pad bytes sit past the last element and no accessor reads them, because
 * `length` (elements) and not the buffer size is what bounds every dispatch.
 */
export function alignedUploadBytes(byteLength: number): number {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new RangeError("byteLength must be a non-negative safe integer");
  }
  return Math.ceil(byteLength / 4) * 4;
}

/**
 * The largest range this device will accept as one storage binding, bounded by
 * the session's own budget.
 *
 * ADR 006: the GPU path gets NO new budget field. `maxResidentBytes` is already
 * the session ceiling and already governs the CPU path, so a second knob would
 * let the two disagree about what "resident" means. What the GPU path adds is
 * the DEVICE ceiling, which is not a policy choice at all — it is
 * `maxStorageBufferBindingSize`, and a range past it fails at bind time with an
 * error that does not name the tensor.
 */
export function residentUploadCeiling(
  device: GPUDevice,
  maxResidentBytes: number,
): number {
  return Math.min(maxResidentBytes, device.limits.maxStorageBufferBindingSize);
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
  /**
   * Runtime-only identity for the uploaded range.
   *
   * Narrowed from `unknown` by ADR 006. It is a storage source and not a
   * texture: every representation this tier serves (exact/tile/downsample)
   * renders through vertex expansion rather than a sampler, and the one
   * representation that would want a texture — a mip chain for the overview —
   * cannot filter an r32float in core WebGPU anyway. The ADR names the trigger
   * that would reopen it.
   */
  resource?: TensorStorageSource;
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
 * does not allocate, upload, or FREE anything; a host owns the resource
 * lifecycle. Clearing `resource` on eviction drops our reference to the
 * handle — it does not destroy the buffer, which is why `evictResidency`
 * exists below.
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

/**
 * Evicts a record and releases the GPU buffer it was holding.
 *
 * `transitionResidency` stays pure so it can be reasoned about and tested
 * without a device; this is the one place the destroy hook fires. Before ADR
 * 006 the evicted branch cleared an `unknown` — dropping a reference and
 * leaking the allocation behind it. With `resource` narrowed to a
 * `TensorStorageSource`, eviction finally has something to call.
 *
 * `destroy` is optional on purpose: a borrowed source (a runtime-shared tensor)
 * is evicted from OUR residency without destroying a buffer the runtime owns.
 */
export function evictResidency(
  record: ResidencyRecord,
  reason: "budget" | "source-changed" | "manual",
): ResidencyRecord {
  record.resource?.destroy?.();
  return transitionResidency(record, { kind: "evicted", reason });
}
