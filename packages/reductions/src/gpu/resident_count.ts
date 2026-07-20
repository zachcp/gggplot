import {
  CLEAR_U32_WGSL,
  COUNT_BAR_VERTICES_WGSL,
  GRID_BAR_VERTEX_COLORS_WGSL,
  GROUPED_COUNT_1D_WGSL,
  HISTOGRAM_SUMMARY_WGSL,
} from "../wgsl.ts";
import { readBuffer, storage, uniform, USAGE } from "./plumbing.ts";

export type CountPosition = "identity" | "stack" | "dodge" | "fill";
export interface ResidentCount1DSourceInput {
  valueIds: GPUBuffer;
  rows: number;
  groupIds?: GPUBuffer;
  valuesCount: number;
  groupsCount: number;
  position?: CountPosition;
  /**
   * Optional per-group RGBA palette (length groupsCount*4, channels 0..1). When
   * present a color pass expands it into per-vertex `barColors`; when absent no
   * palette/color buffers are allocated and no extra pass is dispatched.
   */
  palette?: Float32Array;
}
export interface ResidentCountSummary {
  groupTotals: Uint32Array;
  stackedMaximum: number;
  byteLength: number;
}
export interface ResidentCount1D {
  counts: GPUBuffer;
  barVertices: GPUBuffer;
  /** Per-vertex RGBA bar colors; present only when created with a `palette`. */
  barColors: GPUBuffer | undefined;
  summary: GPUBuffer;
  valuesCount: number;
  groupsCount: number;
  dispatch(): void;
  readback(): Promise<Uint32Array>;
  readbackBarVertices(): Promise<Float32Array>;
  /** Per-vertex RGBA readback; empty when no palette was supplied. */
  readbackBarColors(): Promise<Float32Array>;
  readbackSummary(): Promise<ResidentCountSummary>;
  destroy(): void;
}

export function createResidentCount1DFromSources(
  device: GPUDevice,
  input: ResidentCount1DSourceInput,
): ResidentCount1D {
  const valuesCount = Math.max(0, input.valuesCount);
  const groupsCount = Math.max(1, input.groupsCount);
  const cells = valuesCount * groupsCount;
  const summaryLength = groupsCount + 1;
  const paramsData = new ArrayBuffer(32);
  const paramsView = new DataView(paramsData);
  paramsView.setUint32(0, input.rows, true);
  paramsView.setUint32(4, valuesCount, true);
  paramsView.setUint32(8, groupsCount, true);
  paramsView.setUint32(12, input.groupIds ? 1 : 0, true);
  paramsView.setUint32(
    24,
    ({ identity: 0, stack: 1, dodge: 2, fill: 3 } as const)[
      input.position ?? "stack"
    ],
    true,
  );
  const params = uniform(device, paramsData);
  const clearParams = uniform(device, new Uint32Array([cells, 0, 0, 0]).buffer);
  const summaryClearParams = uniform(
    device,
    new Uint32Array([summaryLength, 0, 0, 0]).buffer,
  );
  const counts = device.createBuffer({
    size: Math.max(4, cells * 4),
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  const barVertices = device.createBuffer({
    size: Math.max(8, cells * 32),
    usage: USAGE.STORAGE | USAGE.COPY_SRC,
  });
  const summary = device.createBuffer({
    size: Math.max(4, summaryLength * 4),
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  // Optional per-group palette → per-vertex color buffer (four RGBA per cell).
  const barColorsByteLength = cells * 4 * 4 * Float32Array.BYTES_PER_ELEMENT;
  const palette = input.palette ? storage(device, input.palette) : undefined;
  const barColors = palette
    ? device.createBuffer({
      size: Math.max(16, barColorsByteLength),
      usage: USAGE.STORAGE | USAGE.COPY_SRC,
    })
    : undefined;
  const groups = input.groupIds ?? input.valueIds;
  const pipeline = (code: string) =>
    device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code }),
        entryPoint: "main",
      },
    });
  const clear = pipeline(CLEAR_U32_WGSL);
  const count = pipeline(GROUPED_COUNT_1D_WGSL);
  const bars = pipeline(COUNT_BAR_VERTICES_WGSL);
  const summarize = pipeline(HISTOGRAM_SUMMARY_WGSL);
  const colorize = palette ? pipeline(GRID_BAR_VERTEX_COLORS_WGSL) : undefined;
  const bind = (p: GPUComputePipeline, entries: GPUBindGroupEntry[]) =>
    device.createBindGroup({ layout: p.getBindGroupLayout(0), entries });
  const clearBind = bind(clear, [{ binding: 0, resource: { buffer: counts } }, {
    binding: 1,
    resource: { buffer: clearParams },
  }]);
  const countBind = bind(count, [
    { binding: 0, resource: { buffer: input.valueIds } },
    { binding: 1, resource: { buffer: groups } },
    { binding: 2, resource: { buffer: counts } },
    { binding: 3, resource: { buffer: params } },
  ]);
  const summaryClearBind = bind(clear, [{
    binding: 0,
    resource: { buffer: summary },
  }, { binding: 1, resource: { buffer: summaryClearParams } }]);
  const summaryBind = bind(summarize, [
    { binding: 0, resource: { buffer: counts } },
    { binding: 1, resource: { buffer: summary } },
    { binding: 2, resource: { buffer: params } },
  ]);
  const barsBind = bind(bars, [{ binding: 0, resource: { buffer: counts } }, {
    binding: 1,
    resource: { buffer: barVertices },
    // Dodge slotting reads per-group totals; the summarize pass runs earlier
    // in the same encoder, so this pass observes the current totals.
  }, { binding: 2, resource: { buffer: params } }, {
    binding: 3,
    resource: { buffer: summary },
  }]);
  const colorBind = colorize && barColors && palette
    ? bind(colorize, [
      { binding: 0, resource: { buffer: palette } },
      { binding: 1, resource: { buffer: barColors } },
      { binding: 2, resource: { buffer: params } },
    ])
    : undefined;

  // A zero-length count grid never touches the GPU; every other read (always a
  // multiple of four bytes) is byte-identical to the shared staging helper.
  const read = <T extends Uint32Array | Float32Array>(
    source: GPUBuffer,
    bytes: number,
    create: (data: ArrayBuffer) => T,
  ): Promise<T> =>
    bytes === 0
      ? Promise.resolve(create(new ArrayBuffer(0)))
      : readBuffer(device, source, bytes, create);
  return {
    counts,
    barVertices,
    barColors,
    summary,
    valuesCount,
    groupsCount,
    dispatch() {
      if (cells === 0) return;
      const encoder = device.createCommandEncoder();
      const run = (p: GPUComputePipeline, b: GPUBindGroup, n: number) => {
        const pass = encoder.beginComputePass();
        pass.setPipeline(p);
        pass.setBindGroup(0, b);
        pass.dispatchWorkgroups(Math.ceil(n / 64));
        pass.end();
      };
      run(clear, clearBind, cells);
      if (input.rows > 0) run(count, countBind, input.rows);
      run(clear, summaryClearBind, summaryLength);
      run(summarize, summaryBind, valuesCount);
      run(bars, barsBind, cells);
      if (colorize && colorBind) run(colorize, colorBind, cells);
      device.queue.submit([encoder.finish()]);
    },
    readback: () => read(counts, cells * 4, (data) => new Uint32Array(data)),
    readbackBarVertices: () =>
      read(barVertices, cells * 32, (data) => new Float32Array(data)),
    readbackBarColors: () =>
      barColors
        ? read(barColors, barColorsByteLength, (data) => new Float32Array(data))
        : Promise.resolve(new Float32Array(0)),
    async readbackSummary() {
      const result = await read(
        summary,
        summaryLength * 4,
        (data) => new Uint32Array(data),
      );
      return {
        groupTotals: result.slice(0, groupsCount),
        stackedMaximum: result[groupsCount],
        byteLength: result.byteLength,
      };
    },
    destroy() {
      counts.destroy();
      barVertices.destroy();
      barColors?.destroy();
      palette?.destroy();
      summary.destroy();
      params.destroy();
      clearParams.destroy();
      summaryClearParams.destroy();
    },
  };
}
