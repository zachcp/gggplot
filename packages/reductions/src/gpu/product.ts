// Headless executor for a ProductSpec (gggplot-euh): the same spec <Kernel>s
// mount in core, run here from its generated raw preambles on a plain
// GPUDevice. This is what keeps CPU/GPU parity testable in Deno.
import {
  evalSize,
  type KernelSpec,
  type ProductSpec,
  rawSource,
  type Symbols,
  validateProductSpec,
} from "../product_spec.ts";
import { readBuffer, uniform, USAGE } from "./plumbing.ts";

const ELEMENT_BYTES: Record<string, number> = {
  "u32": 4,
  "f32": 4,
  "vec2<f32>": 8,
  "vec4<f32>": 16,
};

const pipelines = new WeakMap<GPUDevice, Map<string, GPUComputePipeline>>();

/** One compiled pipeline per kernel per device. */
function pipelineFor(
  device: GPUDevice,
  kernel: KernelSpec,
): GPUComputePipeline {
  let cache = pipelines.get(device);
  if (!cache) pipelines.set(device, cache = new Map());
  let pipeline = cache.get(kernel.id);
  if (!pipeline) {
    pipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code: rawSource(kernel) }),
        entryPoint: "main",
      },
    });
    cache.set(kernel.id, pipeline);
  }
  return pipeline;
}

/** The params uniform: size, then each arg as a 4-byte scalar. */
function paramsFor(
  kernel: KernelSpec,
  size: number,
  args: Record<string, number>,
): ArrayBuffer {
  const data = new ArrayBuffer(Math.max(16, 4 * (1 + kernel.args.length)));
  const view = new DataView(data);
  view.setUint32(0, size, true);
  kernel.args.forEach((arg, i) => {
    if (arg.format === "f32") {
      view.setFloat32(4 * (i + 1), args[arg.name], true);
    } else view.setUint32(4 * (i + 1), args[arg.name], true);
  });
  return data;
}

export interface ProductRun {
  /** Every port's buffer: the inputs as given, the owned ones allocated here. */
  buffers: Record<string, GPUBuffer>;
  /** Byte length of each owned buffer's meaningful range. */
  bytes: Record<string, number>;
  /** Reads an owned or input port back as u32 words. */
  readU32: (port: string) => Promise<Uint32Array>;
  /** Reads a port back as f32 values. */
  readF32: (port: string) => Promise<Float32Array>;
  /** Destroys the buffers this run allocated (not the inputs). */
  destroy: () => void;
}

/**
 * Allocates the product's buffers, dispatches every pass in order in one
 * encoder, and returns the buffers. Inputs are caller-owned storage buffers.
 */
export function runProduct(
  device: GPUDevice,
  spec: ProductSpec,
  symbols: Symbols,
  inputs: Readonly<Record<string, GPUBuffer>>,
): ProductRun {
  validateProductSpec(spec);
  const buffers: Record<string, GPUBuffer> = { ...inputs };
  const bytes: Record<string, number> = {};
  const owned: GPUBuffer[] = [];
  for (const port of spec.inputs) {
    if (!inputs[port.name]) {
      throw new Error(`[gggplot] ${spec.id}: input ${port.name} missing`);
    }
    bytes[port.name] = evalSize(port.length, symbols) *
      ELEMENT_BYTES[port.format];
  }
  for (const port of spec.buffers) {
    const length = evalSize(port.length, symbols);
    bytes[port.name] = length * ELEMENT_BYTES[port.format];
    const buffer = device.createBuffer({
      label: `${spec.id}:${port.name}`,
      size: Math.max(4, bytes[port.name]),
      usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
    });
    buffers[port.name] = buffer;
    owned.push(buffer);
  }
  const uniforms: GPUBuffer[] = [];
  const encoder = device.createCommandEncoder();
  for (const pass of spec.passes) {
    const size = evalSize(pass.size, symbols);
    if (size === 0) continue;
    const args = Object.fromEntries(
      Object.entries(pass.args ?? {}).map((
        [k, v],
      ) => [k, evalSize(v, symbols)]),
    );
    const params = uniform(device, paramsFor(pass.kernel, size, args));
    uniforms.push(params);
    const pipeline = pipelineFor(device, pass.kernel);
    const reads = pass.kernel.reads.map((read) =>
      buffers[pass.reads![read.name]]
    );
    const entries: GPUBindGroupEntry[] = [
      ...reads.map((buffer, i) => ({ binding: i, resource: { buffer } })),
      { binding: reads.length, resource: { buffer: buffers[pass.write] } },
      { binding: reads.length + 1, resource: { buffer: params } },
    ];
    const compute = encoder.beginComputePass();
    compute.setPipeline(pipeline);
    compute.setBindGroup(
      0,
      device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries,
      }),
    );
    compute.dispatchWorkgroups(Math.ceil(size / 64));
    compute.end();
  }
  device.queue.submit([encoder.finish()]);
  return {
    buffers,
    bytes,
    readU32: (port) =>
      readBuffer(device, buffers[port], bytes[port], (b) => new Uint32Array(b)),
    readF32: (port) =>
      readBuffer(
        device,
        buffers[port],
        bytes[port],
        (b) => new Float32Array(b),
      ),
    destroy: () => {
      for (const buffer of [...owned, ...uniforms]) buffer.destroy();
    },
  };
}
