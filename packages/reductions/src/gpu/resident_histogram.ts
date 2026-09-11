import {
  CLEAR_U32_WGSL,
  GRID_BAR_VERTEX_COLORS_WGSL,
  GROUPED_HISTOGRAM_1D_WGSL,
  HISTOGRAM_BAR_VERTICES_WGSL,
  HISTOGRAM_SUMMARY_WGSL,
  HISTOGRAM_TILE_VERTICES_WGSL,
} from "../wgsl.ts";
import { packHistogram1dParams, packHistogram1dSourceParams } from "../gpu.ts";
import type { GroupedHistogram1DInput } from "../types.ts";
import { readBuffer, storage, uniform, USAGE } from "./plumbing.ts";

/** GPU-resident output grid for stat_bin; callers can bind `counts` directly. */
export interface ResidentHistogram1D {
  readonly counts: GPUBuffer;
  /** Packed XY vertices: [group, bin, corner, axis], four corners per bar. */
  readonly barVertices: GPUBuffer;
  /**
   * Per-vertex RGBA bar colors (four per cell), present only when the source
   * was created with a `palette`. Absent (undefined) leaves the mark on its
   * scalar `color` path with no extra allocation or dispatch.
   */
  readonly barColors: GPUBuffer | undefined;
  /**
   * The uploaded per-group RGBA palette; present only alongside `barColors`.
   *
   * Exposed because the MOUNTED path binds it itself: the <Kernel> port drives
   * the colour pass from this buffer instead of through this object's own bind
   * group (gggplot-vs7.8). The standalone executor still binds it internally.
   */
  readonly palette: GPUBuffer | undefined;
  /** Dense [group, bin] tile vertices for a grid mark. */
  readonly tileVertices: GPUBuffer;
  /** Compact [group totals..., stacked maximum] summary buffer. */
  readonly summary: GPUBuffer;
  readonly bins: number;
  /**
   * The RESOLVED bin geometry this grid was built for.
   *
   * `binwidth` is derived when the caller gave a bin count instead, so these
   * are the only trustworthy source for it. The mounted <Kernel> path needs
   * both as shader args and must use exactly the values packed into this
   * object's params uniform, never a re-derivation.
   */
  readonly lo: number;
  readonly binwidth: number;
  readonly groupsCount: number;
  /**
   * Records this kernel's passes into a command buffer WITHOUT submitting it.
   *
   * The mounted Use.GPU backend yeets the result into the frame's compute pass
   * so every kernel in a plot lands in ONE `device.queue.submit` (see
   * workbench's RenderComputePass). `dispatch()` is the standalone form for the
   * headless executor and tests, and is defined in terms of this.
   *
   * Returns null when the kernel has no work to record; callers must skip a
   * null rather than submitting it.
   */
  encode(): GPUCommandBuffer | null;
  dispatch(): void;
  readback(): Promise<Uint32Array>;
  readbackBarVertices(): Promise<Float32Array>;
  /** Per-vertex RGBA readback; empty when no palette was supplied. */
  readbackBarColors(): Promise<Float32Array>;
  readbackTileVertices(): Promise<Float32Array>;
  readbackSummary(): Promise<ResidentHistogramSummary>;
  metrics(): ResidentHistogramMetrics;
  destroy(): void;
}

export interface ResidentHistogramMetrics {
  readonly inputUploadBytes: number;
  readonly derivedAllocationBytes: number;
  readonly dispatches: number;
  readonly computePasses: number;
  readonly readbackBytes: number;
  readonly summaryReadbackBytes: number;
}

export interface ResidentHistogramSummary {
  readonly groupTotals: Uint32Array;
  readonly stackedMaximum: number;
  readonly byteLength: number;
}

/** GPU-buffer inputs for a histogram that must not incur a second upload. */
export interface ResidentHistogram1DSourceInput {
  readonly values: GPUBuffer;
  readonly rows: number;
  readonly groupIds?: GPUBuffer;
  readonly lo: number;
  readonly hi: number;
  readonly bins?: number;
  readonly binwidth?: number;
  readonly groupsCount: number;
  /** GPU-resident bar-grid layout; count accumulation remains unchanged. */
  readonly position?: "identity" | "stack" | "dodge" | "fill";
  /**
   * Optional per-group RGBA palette (length groupsCount*4, channels 0..1). When
   * present a color pass expands it into per-vertex `barColors`; when absent no
   * palette/color buffers are allocated and no extra pass is dispatched.
   */
  readonly palette?: Float32Array;
}

/**
 * Creates buffers/pipelines once. Each dispatch first clears the output grid,
 * then atomically accumulates bins; it performs no CPU readback unless asked.
 */
export function createResidentHistogram1D(
  device: GPUDevice,
  input: GroupedHistogram1DInput,
): ResidentHistogram1D {
  const values = storage(device, input.values);
  const groups = storage(
    device,
    input.groupIds ?? new Uint32Array(input.values.length),
  );
  const resident = createResidentHistogram1DFromSources(
    device,
    {
      values,
      rows: input.values.length,
      groupIds: groups,
      lo: input.lo,
      hi: input.hi,
      bins: input.bins,
      binwidth: input.binwidth,
      groupsCount: packHistogram1dParams(input).groupsCount,
      position: "stack",
    },
    input.values.byteLength +
      (input.groupIds?.byteLength ?? input.values.byteLength),
  );

  return {
    ...resident,
    destroy() {
      resident.destroy();
      values.destroy();
      groups.destroy();
    },
  };
}

/**
 * Executes against caller-owned storage (for example Use.GPU RawData sources).
 * It owns only its derived targets and uniforms, never the input buffers.
 */
export function createResidentHistogram1DFromSources(
  device: GPUDevice,
  input: ResidentHistogram1DSourceInput,
  inputUploadBytes = 0,
): ResidentHistogram1D {
  const packed = packHistogram1dSourceParams({
    rows: input.rows,
    lo: input.lo,
    hi: input.hi,
    bins: input.bins,
    binwidth: input.binwidth,
    groupsCount: input.groupsCount,
    hasGroups: input.groupIds != null,
    position: input.position,
  });
  const groups = input.groupIds ?? input.values;
  const counts = device.createBuffer({
    size: Math.max(4, packed.countsLength * Uint32Array.BYTES_PER_ELEMENT),
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  const barVertices = device.createBuffer({
    size: Math.max(
      8,
      packed.countsLength * 4 * 2 * Float32Array.BYTES_PER_ELEMENT,
    ),
    usage: USAGE.STORAGE | USAGE.COPY_SRC,
  });
  const tileVertices = device.createBuffer({
    size: Math.max(
      8,
      packed.countsLength * 4 * 2 * Float32Array.BYTES_PER_ELEMENT,
    ),
    usage: USAGE.STORAGE | USAGE.COPY_SRC,
  });
  const summaryLength = packed.groupsCount + 1;
  const summary = device.createBuffer({
    size: Math.max(4, summaryLength * Uint32Array.BYTES_PER_ELEMENT),
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  // Optional per-group palette → per-vertex color expansion. When absent the
  // color pass and its buffers do not exist, so the byte accounting and
  // dispatch count below stay identical to the pre-palette path.
  const barColorsByteLength = packed.countsLength * 4 *
    4 * Float32Array.BYTES_PER_ELEMENT;
  const palette = input.palette ? storage(device, input.palette) : undefined;
  const barColors = palette
    ? device.createBuffer({
      size: Math.max(16, barColorsByteLength),
      usage: USAGE.STORAGE | USAGE.COPY_SRC,
    })
    : undefined;
  let dispatches = 0;
  let readbackBytes = 0;
  let summaryReadbackBytes = 0;
  const derivedAllocationBytes = counts.size + barVertices.size +
    tileVertices.size + summary.size +
    (palette ? palette.size + barColors!.size : 0);
  const passesPerDispatch = palette ? 7 : 6;
  const params = uniform(device, packed.params);
  const clearParams = uniform(
    device,
    new Uint32Array([packed.countsLength, 0, 0, 0]).buffer,
  );
  const summaryClearParams = uniform(
    device,
    new Uint32Array([summaryLength, 0, 0, 0]).buffer,
  );
  /**
   * The standalone executor's pipelines and bind groups, built ON FIRST
   * `encode()` rather than at construction.
   *
   * The MOUNTED path no longer dispatches through them: it drives the same
   * seven pass bodies as <Kernel>s bound by Use.GPU's linker (gggplot-vs7.8),
   * and reaches into this object only for its buffers. So constructing seven
   * pipelines here would be seven shader compiles that nothing ever runs — and
   * `resident_grid.tsx` recreates the whole kernel on any option change, so it
   * would pay them again on every one. Deferring makes the mounted path free
   * while leaving the headless CPU/GPU parity harness bit-identical.
   */
  const buildPasses = () => {
    const pipeline = (code: string) =>
      device.createComputePipeline({
        layout: "auto",
        compute: {
          module: device.createShaderModule({ code }),
          entryPoint: "main",
        },
      });
    const clear = pipeline(CLEAR_U32_WGSL);
    const histogram = pipeline(GROUPED_HISTOGRAM_1D_WGSL);
    const bars = pipeline(HISTOGRAM_BAR_VERTICES_WGSL);
    const tiles = pipeline(HISTOGRAM_TILE_VERTICES_WGSL);
    const summarize = pipeline(HISTOGRAM_SUMMARY_WGSL);
    const colorize = palette
      ? pipeline(GRID_BAR_VERTEX_COLORS_WGSL)
      : undefined;
    const bind = (p: GPUComputePipeline, entries: GPUBindGroupEntry[]) =>
      device.createBindGroup({ layout: p.getBindGroupLayout(0), entries });
    const clearBind = bind(clear, [
      { binding: 0, resource: { buffer: counts } },
      { binding: 1, resource: { buffer: clearParams } },
    ]);
    const histogramBind = bind(histogram, [
      { binding: 0, resource: { buffer: input.values } },
      { binding: 1, resource: { buffer: groups } },
      { binding: 2, resource: { buffer: counts } },
      { binding: 3, resource: { buffer: params } },
    ]);
    const summaryClearBind = bind(clear, [
      { binding: 0, resource: { buffer: summary } },
      { binding: 1, resource: { buffer: summaryClearParams } },
    ]);
    const summarizeBind = bind(summarize, [
      { binding: 0, resource: { buffer: counts } },
      { binding: 1, resource: { buffer: summary } },
      { binding: 2, resource: { buffer: params } },
    ]);
    const barsBind = bind(bars, [
      { binding: 0, resource: { buffer: counts } },
      { binding: 1, resource: { buffer: barVertices } },
      { binding: 2, resource: { buffer: params } },
      // Dodge slotting reads per-group totals; the summary pass runs earlier
      // in the same encoder, so this pass observes the current totals.
      { binding: 3, resource: { buffer: summary } },
    ]);
    const colorBind = colorize
      ? bind(colorize, [
        { binding: 0, resource: { buffer: palette! } },
        { binding: 1, resource: { buffer: barColors! } },
        { binding: 2, resource: { buffer: params } },
      ])
      : undefined;
    // Two bindings, matching the tile preamble exactly: the pass derives its
    // grid from bin geometry and reads no counts. It used to declare an unused
    // count binding for symmetry, which Dawn dropped from the auto layout and
    // which this bind group then had to omit by hand; both are gone.
    const tilesBind = bind(tiles, [
      { binding: 0, resource: { buffer: tileVertices } },
      { binding: 1, resource: { buffer: params } },
    ]);
    return {
      clear,
      histogram,
      bars,
      tiles,
      summarize,
      colorize,
      clearBind,
      histogramBind,
      summaryClearBind,
      summarizeBind,
      barsBind,
      colorBind,
      tilesBind,
    };
  };
  let passes: ReturnType<typeof buildPasses> | undefined;

  const read = <T extends Uint32Array | Float32Array>(
    source: GPUBuffer,
    bytes: number,
    create: (buffer: ArrayBuffer) => T,
  ): Promise<T> => readBuffer(device, source, bytes, create);

  const encode = (): GPUCommandBuffer | null => {
    passes ??= buildPasses();
    const {
      clear,
      histogram,
      bars,
      tiles,
      summarize,
      colorize,
      clearBind,
      histogramBind,
      summaryClearBind,
      summarizeBind,
      barsBind,
      colorBind,
      tilesBind,
    } = passes;
    const encoder = device.createCommandEncoder();
    const clearPass = encoder.beginComputePass();
    clearPass.setPipeline(clear);
    clearPass.setBindGroup(0, clearBind);
    clearPass.dispatchWorkgroups(Math.ceil(packed.countsLength / 64));
    clearPass.end();
    const binPass = encoder.beginComputePass();
    binPass.setPipeline(histogram);
    binPass.setBindGroup(0, histogramBind);
    binPass.dispatchWorkgroups(Math.ceil(input.rows / 64));
    binPass.end();
    const summaryClearPass = encoder.beginComputePass();
    summaryClearPass.setPipeline(clear);
    summaryClearPass.setBindGroup(0, summaryClearBind);
    summaryClearPass.dispatchWorkgroups(Math.ceil(summaryLength / 64));
    summaryClearPass.end();
    const summaryPass = encoder.beginComputePass();
    summaryPass.setPipeline(summarize);
    summaryPass.setBindGroup(0, summarizeBind);
    summaryPass.dispatchWorkgroups(Math.ceil(packed.bins / 64));
    summaryPass.end();
    const barPass = encoder.beginComputePass();
    barPass.setPipeline(bars);
    barPass.setBindGroup(0, barsBind);
    barPass.dispatchWorkgroups(Math.ceil(packed.countsLength / 64));
    barPass.end();
    const tilePass = encoder.beginComputePass();
    tilePass.setPipeline(tiles);
    tilePass.setBindGroup(0, tilesBind);
    tilePass.dispatchWorkgroups(Math.ceil(packed.countsLength / 64));
    tilePass.end();
    if (colorize && colorBind) {
      // One vertex-color invocation per cell, after the bar-vertex pass so it
      // shares the same encoder submission; reads only the params group/width
      // fields plus the per-group palette.
      const colorPass = encoder.beginComputePass();
      colorPass.setPipeline(colorize);
      colorPass.setBindGroup(0, colorBind);
      colorPass.dispatchWorkgroups(Math.ceil(packed.countsLength / 64));
      colorPass.end();
    }
    dispatches++;
    return encoder.finish();
  };

  return {
    counts,
    barVertices,
    barColors,
    palette,
    tileVertices,
    summary,
    bins: packed.bins,
    lo: input.lo,
    binwidth: packed.binwidth,
    groupsCount: packed.groupsCount,
    encode,
    dispatch() {
      const command = encode();
      if (command) device.queue.submit([command]);
    },
    async readback() {
      const bytes = packed.countsLength * Uint32Array.BYTES_PER_ELEMENT;
      const result = await read(
        counts,
        bytes,
        (buffer) => new Uint32Array(buffer),
      );
      readbackBytes += bytes;
      return result;
    },
    async readbackBarVertices() {
      const bytes = packed.countsLength * 4 * 2 *
        Float32Array.BYTES_PER_ELEMENT;
      const result = await read(
        barVertices,
        bytes,
        (buffer) => new Float32Array(buffer),
      );
      readbackBytes += bytes;
      return result;
    },
    async readbackBarColors() {
      if (!barColors) return new Float32Array(0);
      const bytes = barColorsByteLength;
      const result = await read(
        barColors,
        bytes,
        (buffer) => new Float32Array(buffer),
      );
      readbackBytes += bytes;
      return result;
    },
    async readbackTileVertices() {
      const bytes = packed.countsLength * 4 * 2 *
        Float32Array.BYTES_PER_ELEMENT;
      const result = await read(
        tileVertices,
        bytes,
        (buffer) => new Float32Array(buffer),
      );
      readbackBytes += bytes;
      return result;
    },
    async readbackSummary() {
      const values = await read(
        summary,
        summaryLength * Uint32Array.BYTES_PER_ELEMENT,
        (buffer) => new Uint32Array(buffer),
      );
      summaryReadbackBytes += values.byteLength;
      return {
        groupTotals: values.slice(0, packed.groupsCount),
        stackedMaximum: values[packed.groupsCount],
        byteLength: values.byteLength,
      };
    },
    metrics() {
      return {
        inputUploadBytes,
        derivedAllocationBytes,
        dispatches,
        computePasses: dispatches * passesPerDispatch,
        readbackBytes,
        summaryReadbackBytes,
      };
    },
    destroy() {
      counts.destroy();
      barVertices.destroy();
      barColors?.destroy();
      palette?.destroy();
      tileVertices.destroy();
      summary.destroy();
      params.destroy();
      clearParams.destroy();
      summaryClearParams.destroy();
    },
  };
}
