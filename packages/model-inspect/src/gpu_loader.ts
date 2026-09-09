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
  type TensorRangeRequest,
  type TensorStorageSource,
  tensorUploadPlan,
  validateTensorRange,
} from "./residency.ts";
import {
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

function adapterPipeline(
  device: GPUDevice,
  name: string,
  kernel: DTypeAdapterKernel,
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
        code: kernel.wgsl,
      }),
      entryPoint: "main",
    },
  });
  const built = { pipeline, layout: pipeline.getBindGroupLayout(0) };
  perDevice.set(name, built);
  return built;
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
    const ceiling = residentUploadCeiling(this.device, this.maxResidentBytes);
    if (request.byteLength > ceiling) {
      throw new RangeError(
        `Tensor range of ${request.byteLength} bytes exceeds the ${ceiling}-byte resident ceiling`,
      );
    }
    const length = rangeElementCount(request);
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
}
