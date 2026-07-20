import { DOMAIN_CLEAR_WGSL, FINITE_DOMAIN_1D_WGSL } from "../wgsl.ts";
import { readBuffer, uniform, USAGE } from "./plumbing.ts";

export interface ResidentDomain1DResult {
  readonly min: number;
  readonly max: number;
  readonly empty: boolean;
  readonly byteLength: 8;
}

export interface ResidentDomain1D {
  readonly domain: GPUBuffer;
  dispatch(): void;
  readback(): Promise<ResidentDomain1DResult>;
  destroy(): void;
}

function floatFromOrdered(ordered: number): number {
  const bits = (ordered & 0x80000000) === 0 ? ~ordered : ordered ^ 0x80000000;
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setUint32(0, bits >>> 0, true);
  return view.getFloat32(0, true);
}

/**
 * Reduces a caller-owned f32 storage buffer to finite bounds. It owns only the
 * two-word accumulator and uniform; callers retain the input source buffer.
 */
export function createResidentDomain1D(
  device: GPUDevice,
  values: GPUBuffer,
  rows: number,
): ResidentDomain1D {
  const domain = device.createBuffer({
    size: 8,
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  const params = uniform(device, new Uint32Array([rows, 0, 0, 0]).buffer);
  const clear = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code: DOMAIN_CLEAR_WGSL }),
      entryPoint: "main",
    },
  });
  const reduce = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code: FINITE_DOMAIN_1D_WGSL }),
      entryPoint: "main",
    },
  });
  const clearBind = device.createBindGroup({
    layout: clear.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: domain } }],
  });
  const reduceBind = device.createBindGroup({
    layout: reduce.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: values } },
      { binding: 1, resource: { buffer: domain } },
      { binding: 2, resource: { buffer: params } },
    ],
  });

  return {
    domain,
    dispatch() {
      const encoder = device.createCommandEncoder();
      const clearPass = encoder.beginComputePass();
      clearPass.setPipeline(clear);
      clearPass.setBindGroup(0, clearBind);
      clearPass.dispatchWorkgroups(1);
      clearPass.end();
      const reducePass = encoder.beginComputePass();
      reducePass.setPipeline(reduce);
      reducePass.setBindGroup(0, reduceBind);
      reducePass.dispatchWorkgroups(Math.ceil(rows / 64));
      reducePass.end();
      device.queue.submit([encoder.finish()]);
    },
    async readback() {
      const values = await readBuffer(
        device,
        domain,
        8,
        (buffer) => new Uint32Array(buffer),
      );
      const empty = values[0] === 0xffffffff && values[1] === 0;
      return {
        min: empty ? Number.NaN : floatFromOrdered(values[0]),
        max: empty ? Number.NaN : floatFromOrdered(values[1]),
        empty,
        byteLength: 8,
      };
    },
    destroy() {
      domain.destroy();
      params.destroy();
    },
  };
}
