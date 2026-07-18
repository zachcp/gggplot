import {
  CLEAR_U32_WGSL,
  GROUPED_COUNT_1D_WGSL,
  GROUPED_HISTOGRAM_1D_WGSL,
  GROUPED_HISTOGRAM_2D_WGSL,
} from "./wgsl.ts";
import type {
  GpuGroupedCount1DResult,
  GpuGroupedHistogram1DResult,
  GpuGroupedHistogram2DResult,
  GroupedCount1DInput,
  GroupedHistogram1DInput,
  GroupedHistogram2DInput,
} from "./types.ts";

const GPU_BUFFER_USAGE = {
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
} as const;

const GPU_MAP_MODE = {
  READ: 0x0001,
} as const;

function now(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function inferGroupsCount(groupIds: Uint32Array | undefined): number {
  if (!groupIds || groupIds.length === 0) return 1;
  let max = 0;
  for (const id of groupIds) max = Math.max(max, id);
  return max + 1;
}

export function packCount1dParams(input: GroupedCount1DInput): {
  params: ArrayBuffer;
  groupsCount: number;
  countsLength: number;
} {
  if (input.valuesCount < 0) {
    throw new Error("[gggplot/reductions] valuesCount must be non-negative");
  }
  if (input.groupIds && input.groupIds.length !== input.valueIds.length) {
    throw new Error(
      "[gggplot/reductions] groupIds length must match input length",
    );
  }
  const groupsCount = input.groupsCount ?? inferGroupsCount(input.groupIds);
  const params = new ArrayBuffer(16);
  const view = new DataView(params);
  view.setUint32(0, input.valueIds.length, true);
  view.setUint32(4, input.valuesCount, true);
  view.setUint32(8, groupsCount, true);
  view.setUint32(12, input.groupIds ? 1 : 0, true);
  return { params, groupsCount, countsLength: groupsCount * input.valuesCount };
}

function resolveHistogram1dBins(
  input: Pick<GroupedHistogram1DInput, "lo" | "hi" | "bins" | "binwidth">,
): {
  bins: number;
  binwidth: number;
} {
  if (input.binwidth != null) {
    const binwidth = input.binwidth;
    return {
      binwidth,
      bins: binwidth > 0
        ? Math.max(1, Math.ceil((input.hi - input.lo) / binwidth))
        : 1,
    };
  }

  const bins = Math.max(1, input.bins ?? 30);
  return {
    bins,
    binwidth: input.hi > input.lo ? (input.hi - input.lo) / bins : 1,
  };
}

export function packHistogram1dParams(
  input: GroupedHistogram1DInput,
): {
  params: ArrayBuffer;
  bins: number;
  binwidth: number;
  groupsCount: number;
  countsLength: number;
} {
  return packHistogram1dSourceParams({
    rows: input.values.length,
    lo: input.lo,
    hi: input.hi,
    bins: input.bins,
    binwidth: input.binwidth,
    groupsCount: input.groupsCount ?? inferGroupsCount(input.groupIds),
    hasGroups: input.groupIds != null,
  });
}

/**
 * Packs histogram parameters when values already live in GPU storage. The
 * caller supplies the declared source shape instead of a CPU typed array.
 */
export function packHistogram1dSourceParams(input: {
  rows: number;
  lo: number;
  hi: number;
  bins?: number;
  binwidth?: number;
  groupsCount: number;
  hasGroups: boolean;
  position?: "identity" | "stack" | "dodge" | "fill";
}): {
  params: ArrayBuffer;
  bins: number;
  binwidth: number;
  groupsCount: number;
  countsLength: number;
} {
  const { bins, binwidth } = resolveHistogram1dBins(input);
  const groupsCount = Math.max(1, input.groupsCount);
  const params = new ArrayBuffer(32);
  const view = new DataView(params);
  view.setUint32(0, input.rows, true);
  view.setUint32(4, bins, true);
  view.setUint32(8, groupsCount, true);
  view.setUint32(12, input.hasGroups ? 1 : 0, true);
  view.setFloat32(16, input.lo, true);
  view.setFloat32(20, binwidth, true);
  view.setUint32(
    24,
    ({ identity: 0, stack: 1, dodge: 2, fill: 3 } as const)[
      input.position ?? "stack"
    ],
    true,
  );
  return {
    params,
    bins,
    binwidth,
    groupsCount,
    countsLength: bins * groupsCount,
  };
}

export function packHistogram2dParams(
  input: GroupedHistogram2DInput,
): {
  params: ArrayBuffer;
  xBins: number;
  yBins: number;
  xBinwidth: number;
  yBinwidth: number;
  groupsCount: number;
  countsLength: number;
} {
  const xBins = Math.max(1, input.xBins ?? 30);
  const yBins = Math.max(1, input.yBins ?? 30);
  const groupsCount = input.groupsCount ?? inferGroupsCount(input.groupIds);
  const xBinwidth = input.xHi > input.xLo ? (input.xHi - input.xLo) / xBins : 1;
  const yBinwidth = input.yHi > input.yLo ? (input.yHi - input.yLo) / yBins : 1;
  const params = new ArrayBuffer(48);
  const view = new DataView(params);
  view.setUint32(0, input.x.length, true);
  view.setUint32(4, xBins, true);
  view.setUint32(8, yBins, true);
  view.setUint32(12, groupsCount, true);
  view.setUint32(16, input.groupIds ? 1 : 0, true);
  view.setFloat32(20, input.xLo, true);
  view.setFloat32(24, input.yLo, true);
  view.setFloat32(28, xBinwidth, true);
  view.setFloat32(32, yBinwidth, true);
  return {
    params,
    xBins,
    yBins,
    xBinwidth,
    yBinwidth,
    groupsCount,
    countsLength: xBins * yBins * groupsCount,
  };
}

function createStorageBuffer(
  device: GPUDevice,
  data: Uint32Array | Float32Array,
  usage: GPUBufferUsageFlags,
): GPUBuffer {
  const buffer = device.createBuffer({
    size: Math.max(4, data.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | usage,
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function createUniformBuffer(device: GPUDevice, data: ArrayBuffer): GPUBuffer {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

async function readU32Buffer(
  device: GPUDevice,
  source: GPUBuffer,
  count: number,
): Promise<Uint32Array> {
  const readback = device.createBuffer({
    size: Math.max(4, count * Uint32Array.BYTES_PER_ELEMENT),
    usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(source, 0, readback, 0, readback.size);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPU_MAP_MODE.READ);
  const copy = new Uint32Array(readback.getMappedRange().slice(0));
  readback.unmap();
  readback.destroy();
  return copy.subarray(0, count);
}

function dispatchClear(
  device: GPUDevice,
  encoder: GPUCommandEncoder,
  countsBuffer: GPUBuffer,
  countsLength: number,
  workgroupSize = 64,
): void {
  const clearParams = new ArrayBuffer(16);
  new DataView(clearParams).setUint32(0, countsLength, true);
  const clearParamBuffer = createUniformBuffer(device, clearParams);
  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code: CLEAR_U32_WGSL }),
      entryPoint: "main",
    },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: countsBuffer } },
      { binding: 1, resource: { buffer: clearParamBuffer } },
    ],
  });
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(countsLength / workgroupSize));
  pass.end();
}

function histogram1dScalars(
  input: GroupedHistogram1DInput,
  counts: Uint32Array,
  bins: number,
  binwidth: number,
  groupsCount: number,
): Omit<GpuGroupedHistogram1DResult, "backend" | "timings"> {
  const totals = new Uint32Array(groupsCount);
  const density = new Float32Array(counts.length);
  const centers = new Float32Array(bins);
  for (let bin = 0; bin < bins; bin++) {
    centers[bin] = input.lo + (bin + 0.5) * binwidth;
  }
  for (let group = 0; group < groupsCount; group++) {
    for (let bin = 0; bin < bins; bin++) {
      totals[group] += counts[group * bins + bin];
    }
    for (let bin = 0; bin < bins; bin++) {
      const offset = group * bins + bin;
      density[offset] = binwidth > 0 && totals[group] > 0
        ? counts[offset] / (totals[group] * binwidth)
        : 0;
    }
  }
  return {
    counts,
    density,
    centers,
    totals,
    lo: input.lo,
    hi: input.hi,
    binwidth,
    bins,
    groupsCount,
    shape: [groupsCount, bins],
  };
}

export async function groupedHistogram1dGpu(
  device: GPUDevice,
  input: GroupedHistogram1DInput,
): Promise<GpuGroupedHistogram1DResult> {
  const start = now();
  const packed = packHistogram1dParams(input);
  const valuesBuffer = createStorageBuffer(
    device,
    input.values,
    GPU_BUFFER_USAGE.COPY_SRC,
  );
  const groupIds = input.groupIds ?? new Uint32Array(input.values.length);
  const groupBuffer = createStorageBuffer(
    device,
    groupIds,
    GPU_BUFFER_USAGE.COPY_SRC,
  );
  const countsBuffer = device.createBuffer({
    size: Math.max(4, packed.countsLength * Uint32Array.BYTES_PER_ELEMENT),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC |
      GPU_BUFFER_USAGE.COPY_DST,
  });
  const paramsBuffer = createUniformBuffer(device, packed.params);
  const uploadEnd = now();

  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code: GROUPED_HISTOGRAM_1D_WGSL }),
      entryPoint: "main",
    },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: valuesBuffer } },
      { binding: 1, resource: { buffer: groupBuffer } },
      { binding: 2, resource: { buffer: countsBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } },
    ],
  });

  const encoder = device.createCommandEncoder();
  dispatchClear(device, encoder, countsBuffer, packed.countsLength);
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(input.values.length / 64));
  pass.end();
  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();
  const dispatchEnd = now();

  const counts = await readU32Buffer(device, countsBuffer, packed.countsLength);
  const readbackEnd = now();
  valuesBuffer.destroy();
  groupBuffer.destroy();
  countsBuffer.destroy();
  paramsBuffer.destroy();

  return {
    ...histogram1dScalars(
      input,
      counts,
      packed.bins,
      packed.binwidth,
      packed.groupsCount,
    ),
    backend: "webgpu",
    timings: {
      uploadMs: uploadEnd - start,
      dispatchMs: dispatchEnd - uploadEnd,
      readbackMs: readbackEnd - dispatchEnd,
      totalMs: readbackEnd - start,
    },
  };
}

export async function groupedCount1dGpu(
  device: GPUDevice,
  input: GroupedCount1DInput,
): Promise<GpuGroupedCount1DResult> {
  const start = now();
  const packed = packCount1dParams(input);
  const valuesBuffer = createStorageBuffer(
    device,
    input.valueIds,
    GPU_BUFFER_USAGE.COPY_SRC,
  );
  const groupIds = input.groupIds ?? new Uint32Array(input.valueIds.length);
  const groupBuffer = createStorageBuffer(
    device,
    groupIds,
    GPU_BUFFER_USAGE.COPY_SRC,
  );
  const countsBuffer = device.createBuffer({
    size: Math.max(4, packed.countsLength * Uint32Array.BYTES_PER_ELEMENT),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC |
      GPU_BUFFER_USAGE.COPY_DST,
  });
  const paramsBuffer = createUniformBuffer(device, packed.params);
  const uploadEnd = now();

  if (packed.countsLength > 0 && input.valueIds.length > 0) {
    const pipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code: GROUPED_COUNT_1D_WGSL }),
        entryPoint: "main",
      },
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: valuesBuffer } },
        { binding: 1, resource: { buffer: groupBuffer } },
        { binding: 2, resource: { buffer: countsBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } },
      ],
    });
    const encoder = device.createCommandEncoder();
    dispatchClear(device, encoder, countsBuffer, packed.countsLength);
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(input.valueIds.length / 64));
    pass.end();
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
  }
  const dispatchEnd = now();
  const counts = packed.countsLength > 0
    ? await readU32Buffer(device, countsBuffer, packed.countsLength)
    : new Uint32Array();
  const readbackEnd = now();
  valuesBuffer.destroy();
  groupBuffer.destroy();
  countsBuffer.destroy();
  paramsBuffer.destroy();
  return {
    counts,
    valuesCount: input.valuesCount,
    groupsCount: packed.groupsCount,
    shape: [packed.groupsCount, input.valuesCount],
    backend: "webgpu",
    timings: {
      uploadMs: uploadEnd - start,
      dispatchMs: dispatchEnd - uploadEnd,
      readbackMs: readbackEnd - dispatchEnd,
      totalMs: readbackEnd - start,
    },
  };
}

export async function groupedHistogram2dGpu(
  device: GPUDevice,
  input: GroupedHistogram2DInput,
): Promise<GpuGroupedHistogram2DResult> {
  const start = now();
  const packed = packHistogram2dParams(input);
  const xBuffer = createStorageBuffer(
    device,
    input.x,
    GPU_BUFFER_USAGE.COPY_SRC,
  );
  const yBuffer = createStorageBuffer(
    device,
    input.y,
    GPU_BUFFER_USAGE.COPY_SRC,
  );
  const groupIds = input.groupIds ?? new Uint32Array(input.x.length);
  const groupBuffer = createStorageBuffer(
    device,
    groupIds,
    GPU_BUFFER_USAGE.COPY_SRC,
  );
  const countsBuffer = device.createBuffer({
    size: Math.max(4, packed.countsLength * Uint32Array.BYTES_PER_ELEMENT),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC |
      GPU_BUFFER_USAGE.COPY_DST,
  });
  const paramsBuffer = createUniformBuffer(device, packed.params);
  const uploadEnd = now();

  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code: GROUPED_HISTOGRAM_2D_WGSL }),
      entryPoint: "main",
    },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: xBuffer } },
      { binding: 1, resource: { buffer: yBuffer } },
      { binding: 2, resource: { buffer: groupBuffer } },
      { binding: 3, resource: { buffer: countsBuffer } },
      { binding: 4, resource: { buffer: paramsBuffer } },
    ],
  });

  const encoder = device.createCommandEncoder();
  dispatchClear(device, encoder, countsBuffer, packed.countsLength);
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(input.x.length / 64));
  pass.end();
  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();
  const dispatchEnd = now();

  const counts = await readU32Buffer(device, countsBuffer, packed.countsLength);
  const readbackEnd = now();
  xBuffer.destroy();
  yBuffer.destroy();
  groupBuffer.destroy();
  countsBuffer.destroy();
  paramsBuffer.destroy();

  const totals = new Uint32Array(packed.groupsCount);
  for (let group = 0; group < packed.groupsCount; group++) {
    for (let i = 0; i < packed.xBins * packed.yBins; i++) {
      totals[group] += counts[group * packed.xBins * packed.yBins + i];
    }
  }
  const xCenters = new Float32Array(packed.xBins);
  const yCenters = new Float32Array(packed.yBins);
  for (let x = 0; x < packed.xBins; x++) {
    xCenters[x] = input.xLo + (x + 0.5) * packed.xBinwidth;
  }
  for (let y = 0; y < packed.yBins; y++) {
    yCenters[y] = input.yLo + (y + 0.5) * packed.yBinwidth;
  }

  return {
    counts,
    xCenters,
    yCenters,
    totals,
    xLo: input.xLo,
    xHi: input.xHi,
    yLo: input.yLo,
    yHi: input.yHi,
    xBins: packed.xBins,
    yBins: packed.yBins,
    groupsCount: packed.groupsCount,
    shape: [packed.groupsCount, packed.yBins, packed.xBins],
    backend: "webgpu",
    timings: {
      uploadMs: uploadEnd - start,
      dispatchMs: dispatchEnd - uploadEnd,
      readbackMs: readbackEnd - dispatchEnd,
      totalMs: readbackEnd - start,
    },
  };
}
