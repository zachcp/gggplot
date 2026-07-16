import type {
  ResidentHistogram1D,
  ResidentHistogramMetrics,
} from "./resident_histogram.ts";

/**
 * The kind of frame update being measured.  Keeping this explicit prevents a
 * resident draw from being compared to a CPU round-trip under the same label.
 */
export type GPUDataflowUpdatePath = "static" | "view" | "data";

/**
 * Portable instrumentation for a resident reducer plus the mark draw it
 * feeds.  `drawCount` is supplied by the renderer: reducers deliberately do
 * not know how many mark draws a backend uses.
 */
export interface GPUDataflowBenchmarkReport extends ResidentHistogramMetrics {
  readonly compileAllocationBytes: number;
  readonly dispatchMs: number;
  readonly drawCount: number;
  readonly updatePath: GPUDataflowUpdatePath;
}

export interface ResidentHistogramBenchmarkOptions {
  /** The renderer's expected number of mark draw calls for this update. */
  readonly drawCount?: number;
  /** Whether the measurement represents a static, view, or data update. */
  readonly updatePath?: GPUDataflowUpdatePath;
}

/**
 * Normalizes instrumentation into a stable report shape.  Allocation is
 * duplicated under a compile-oriented name so callers need not infer it from
 * the executor's implementation-specific metric vocabulary.
 */
export function residentHistogramBenchmarkReport(
  metrics: ResidentHistogramMetrics,
  dispatchMs: number,
  options: ResidentHistogramBenchmarkOptions = {},
): GPUDataflowBenchmarkReport {
  return {
    ...metrics,
    compileAllocationBytes: metrics.derivedAllocationBytes,
    dispatchMs,
    drawCount: options.drawCount ?? 1,
    updatePath: options.updatePath ?? "data",
  };
}

/**
 * Dispatches a resident histogram and waits only for GPU completion.  It does
 * not map any result buffers, so its readback metrics stay at zero unless the
 * caller explicitly reads a summary or output after this measurement.
 */
export async function benchmarkResidentHistogram(
  device: GPUDevice,
  histogram: ResidentHistogram1D,
  options: ResidentHistogramBenchmarkOptions = {},
): Promise<GPUDataflowBenchmarkReport> {
  const start = performance.now();
  histogram.dispatch();
  await device.queue.onSubmittedWorkDone();
  return residentHistogramBenchmarkReport(
    histogram.metrics(),
    performance.now() - start,
    options,
  );
}
