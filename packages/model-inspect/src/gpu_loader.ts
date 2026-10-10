// The GPU loader tier specified by docs/ADR_006_GPU_NATIVE_LOADERS.md
// (gggplot-vs7.3), implemented for byte-backed sources (gggplot-vs7.9).
//
// SafeTensors is the motivating case because its layout is already exactly what
// the GPU wants: a JSON header of data_offsets into one flat payload. For an
// f32 tensor the byte range IS the buffer contents, so the whole loader is one
// writeBuffer -- no slice, no decode, no boxed array.
//
// Raw WebGPU only. Nothing here imports @use-gpu; the package keeps the same
// standalone/headless posture as @gggplot/reductions, which owns its device
// code the same way. See ADR 006 decision 1.

import {
  alignedUploadBytes,
  ByteArrayTensorSource,
  type GPUTensorSource,
  residentUploadCeiling,
  type TensorDownsampleRequest,
  type TensorRangeRequest,
  type TensorStorageSource,
  tensorUploadPlan,
  validateTensorRange,
} from "./residency.ts";
import {
  DOWNSAMPLE_NEAREST_KERNEL,
  type DownsampleKernel,
  type DTypeAdapterKernel,
  TENSOR_ADAPTER_KERNELS,
} from "@gggplot/reductions";
import type { ModelDType } from "./types.ts";

// GPUBufferUsage is not guaranteed to exist in every Deno execution context, so
// the flags stay numeric literals -- same reasoning as reductions' plumbing.ts.
const USAGE = {
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
} as const;

/**
 * Whether a dtype can reach a storage buffer without a CPU decode.
 *
 * This is the plan table AND the adapter registry: a dtype whose plan names a
 * kernel that is not built falls back to the CPU `values` path. Callers should
 * branch on this rather than catching from `readRangeSource`.
 */
export function supportsRangeSource(dtype: ModelDType): boolean {
  const plan = tensorUploadPlan(dtype);
  if (plan.path === "unsupported") return false;
  if (plan.kernel === undefined) return plan.path === "direct";
  return plan.kernel in TENSOR_ADAPTER_KERNELS;
}

/** Element count in a range, from its byte length and dtype. */
export function rangeElementCount(request: TensorRangeRequest): number {
  const plan = tensorUploadPlan(request.dtype);
  if (plan.sourceBytes === 0) return 0;
  return Math.floor(request.byteLength / plan.sourceBytes);
}

interface AdapterPipeline {
  pipeline: GPUComputePipeline;
  layout: GPUBindGroupLayout;
}

// One pipeline per (device, kernel). Compiling a shader module per view change
// would put a several-millisecond stall on exactly the interaction this tier
// exists to make cheap.
const pipelineCache = new WeakMap<GPUDevice, Map<string, AdapterPipeline>>();

function compiledPipeline(
  device: GPUDevice,
  name: string,
  wgsl: string,
): AdapterPipeline {
  let perDevice = pipelineCache.get(device);
  if (!perDevice) {
    perDevice = new Map();
    pipelineCache.set(device, perDevice);
  }
  const cached = perDevice.get(name);
  if (cached) return cached;
  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        label: `gggplot-dtype-${name}`,
        code: wgsl,
      }),
      entryPoint: "main",
    },
  });
  const built = { pipeline, layout: pipeline.getBindGroupLayout(0) };
  perDevice.set(name, built);
  return built;
}

function adapterPipeline(
  device: GPUDevice,
  name: string,
  kernel: DTypeAdapterKernel,
): AdapterPipeline {
  return compiledPipeline(device, name, kernel.wgsl);
}

// One name: the gather body is dtype-agnostic (a raw word copy), so every
// dtype shares the same compiled pipeline instead of one per source dtype.
const DOWNSAMPLE_PIPELINE_NAME = "downsample_nearest";

function downsamplePipeline(
  device: GPUDevice,
  kernel: DownsampleKernel,
): AdapterPipeline {
  return compiledPipeline(device, DOWNSAMPLE_PIPELINE_NAME, kernel.wgsl);
}

/**
 * A byte-backed source that also yields GPU handles.
 *
 * It EXTENDS `ByteArrayTensorSource` rather than replacing it, so `readRange`
 * remains available unchanged: that is the CPU/export surface and the parity
 * reference each adapter pass is checked against (`gpu_loader_device_test.ts`
 * asserts the two agree element for element on a real device).
 */
export class ByteArrayGPUTensorSource extends ByteArrayTensorSource
  implements GPUTensorSource {
  /** Bumped per upload so a rebound source invalidates downstream dispatches. */
  private uploadCount = 0;

  constructor(
    readonly device: GPUDevice,
    id: string,
    version: string,
    bytes: Uint8Array,
    /**
     * Session ceiling, intersected with the device's storage-binding limit by
     * `residentUploadCeiling`. ADR 006 decision 3: no new budget field, so this
     * is the caller's existing `ContentBudget.maxResidentBytes`.
     */
    private readonly maxResidentBytes: number = Number.MAX_SAFE_INTEGER,
  ) {
    super(id, version, bytes);
  }

  supports(dtype: ModelDType): boolean {
    return supportsRangeSource(dtype);
  }

  // deno-lint-ignore require-await
  async readRangeSource(
    request: TensorRangeRequest,
  ): Promise<TensorStorageSource> {
    const errors = validateTensorRange(request, this.byteLength);
    if (errors.length > 0) {
      throw new RangeError(`Invalid tensor range: ${errors.join(", ")}`);
    }
    if (request.sourceId !== this.id) {
      throw new RangeError(
        `Tensor range source ${request.sourceId} does not match ${this.id}`,
      );
    }
    const plan = tensorUploadPlan(request.dtype);
    if (!supportsRangeSource(request.dtype)) {
      throw new RangeError(
        `${request.dtype} has no GPU upload path; use readRange and the CPU values path`,
      );
    }
    const length = rangeElementCount(request);
    // Check both allocations before creating either buffer. The widen/unpack
    // output is 4 bytes per element, so f16/i8 ranges can be 2x-4x the input.
    const staging = Math.max(4, alignedUploadBytes(request.byteLength));
    const output = plan.path === "direct" ? staging : Math.max(4, length * 4);
    this.assertResidentFits(staging, "staging");
    this.assertResidentFits(output, "output");
    const version = ++this.uploadCount;

    if (plan.path === "direct") {
      const buffer = this.uploadWords(request, `${request.dtype}-range`);
      return {
        buffer,
        format: plan.format!,
        length,
        size: [...request.shape],
        version,
        destroy: () => buffer.destroy(),
      };
    }

    // Widen/unpack: the range goes up as raw u32 words and one pass writes the
    // typed output. The staging buffer dies with this call; only the output
    // survives, so the resident cost is the OUTPUT size, not both.
    const kernel = TENSOR_ADAPTER_KERNELS[plan.kernel!];
    const words = this.uploadWords(request, `${request.dtype}-words`);
    const buffer = this.device.createBuffer({
      label: `gggplot-tensor-${request.dtype}`,
      size: Math.max(4, length * 4),
      usage: USAGE.STORAGE | USAGE.COPY_DST | USAGE.COPY_SRC,
    });
    try {
      this.runAdapter(plan.kernel!, kernel, words, buffer, length);
    } finally {
      words.destroy();
    }
    return {
      buffer,
      format: kernel.outputFormat,
      length,
      size: [...request.shape],
      version,
      destroy: () => buffer.destroy(),
    };
  }

  /**
   * Gathers a bounded overview grid on the GPU instead of reading the full
   * range back to CPU: the range is uploaded and dtype-adapted exactly as
   * `readRangeSource` would, then a second pass samples it down to
   * `targetRows` x `targetColumns`. The full intermediate buffer dies with
   * this call -- same "resident cost is the OUTPUT size" discipline as the
   * widen/unpack path above -- so nothing survives longer than the gather
   * that consumes it.
   */
  async readDownsampleSource(
    request: TensorDownsampleRequest,
  ): Promise<TensorStorageSource> {
    if (
      !Number.isSafeInteger(request.rows) || request.rows <= 0 ||
      !Number.isSafeInteger(request.columns) || request.columns <= 0 ||
      !Number.isSafeInteger(request.targetRows) || request.targetRows <= 0 ||
      !Number.isSafeInteger(request.targetColumns) ||
      request.targetColumns <= 0
    ) {
      throw new RangeError(
        "Downsample rows/columns/targetRows/targetColumns must be positive safe integers",
      );
    }
    const outputLength = request.targetRows * request.targetColumns;
    this.assertResidentFits(Math.max(4, outputLength * 4), "downsample output");
    const full = await this.readRangeSource(request);
    const buffer = this.device.createBuffer({
      label: `gggplot-tensor-downsample-${request.dtype}`,
      size: Math.max(4, outputLength * 4),
      usage: USAGE.STORAGE | USAGE.COPY_DST | USAGE.COPY_SRC,
    });
    try {
      this.runDownsample(full.buffer, buffer, request);
    } finally {
      full.destroy?.();
    }
    return {
      buffer,
      format: full.format,
      length: outputLength,
      size: [request.targetRows, request.targetColumns],
      version: ++this.uploadCount,
      destroy: () => buffer.destroy(),
    };
  }

  /** Refuses an allocation over the resident ceiling before the device sees it. */
  private assertResidentFits(bytes: number, label: string): void {
    const ceiling = residentUploadCeiling(this.device, this.maxResidentBytes);
    if (bytes > ceiling) {
      throw new RangeError(
        `Tensor range ${label} of ${bytes} bytes exceeds the ${ceiling}-byte resident ceiling`,
      );
    }
  }

  /**
   * THE one copy. `subarray` is a view, not a copy, so the only payload
   * movement is the queue's own staging write.
   */
  private uploadWords(request: TensorRangeRequest, label: string): GPUBuffer {
    const size = Math.max(4, alignedUploadBytes(request.byteLength));
    const buffer = this.device.createBuffer({
      label: `gggplot-tensor-${label}`,
      size,
      usage: USAGE.STORAGE | USAGE.COPY_DST | USAGE.COPY_SRC,
    });
    const start = request.byteOffset;
    const end = start + request.byteLength;
    if (request.byteLength === size && end <= this.bytes.byteLength) {
      this.device.queue.writeBuffer(buffer, 0, this.bytes.subarray(start, end));
      return buffer;
    }
    // Unaligned tail: writeBuffer sizes must be multiples of four, and an i8 or
    // bool range need not be. Pad rather than over-reading into the neighboring
    // tensor's bytes. The copy is bounded by the range itself and happens only
    // for the sub-word dtypes that can land off a word boundary.
    const padded = new Uint8Array(size);
    padded.set(this.bytes.subarray(start, end));
    this.device.queue.writeBuffer(buffer, 0, padded);
    return buffer;
  }

  private runAdapter(
    name: string,
    kernel: DTypeAdapterKernel,
    words: GPUBuffer,
    values: GPUBuffer,
    length: number,
  ): void {
    const { pipeline, layout } = adapterPipeline(this.device, name, kernel);
    const count = this.device.createBuffer({
      size: 4,
      usage: USAGE.UNIFORM | USAGE.COPY_DST,
    });
    this.device.queue.writeBuffer(count, 0, new Uint32Array([length]));
    const bindGroup = this.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: words } },
        { binding: 1, resource: { buffer: values } },
        { binding: 2, resource: { buffer: count } },
      ],
    });
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(length / 64));
    pass.end();
    this.device.queue.submit([encoder.finish()]);
    count.destroy();
  }

  private runDownsample(
    source: GPUBuffer,
    target: GPUBuffer,
    request: TensorDownsampleRequest,
  ): void {
    const { pipeline, layout } = downsamplePipeline(
      this.device,
      DOWNSAMPLE_NEAREST_KERNEL,
    );
    const params = this.device.createBuffer({
      size: 16,
      usage: USAGE.UNIFORM | USAGE.COPY_DST,
    });
    this.device.queue.writeBuffer(
      params,
      0,
      new Uint32Array([
        request.rows,
        request.columns,
        request.targetRows,
        request.targetColumns,
      ]),
    );
    const bindGroup = this.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: source } },
        { binding: 1, resource: { buffer: target } },
        { binding: 2, resource: { buffer: params } },
      ],
    });
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    const total = request.targetRows * request.targetColumns;
    pass.dispatchWorkgroups(Math.ceil(total / 64));
    pass.end();
    this.device.queue.submit([encoder.finish()]);
    params.destroy();
  }
}
