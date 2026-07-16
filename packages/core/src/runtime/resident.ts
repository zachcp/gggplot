import {
  createResidentDomain1D,
  createResidentHistogram1DFromSources,
  type ResidentDomain1D,
  type ResidentHistogram1D,
  type ResidentHistogram1DSourceInput,
} from "@gggplot/reductions";
import type { GPUStorageSource } from "./types.ts";

export interface MountedHistogramSourceOptions {
  lo: number;
  hi: number;
  bins?: number;
  binwidth?: number;
  /** Declared GPU bar-grid layout; no CPU count-row materialization. */
  position?: "identity" | "stack" | "dodge" | "fill";
  groupsCount?: number;
}

function requireStorage(
  source: GPUStorageSource,
  field: string,
  format: "f32" | "u32",
): void {
  if (source.addressSpace === "uniform" || source.format !== format) {
    throw new Error(`${field} must be a storage ${format} source`);
  }
}

/**
 * Converts mounted RawData sources into a resident executor input. This has no
 * upload or readback side effect; it retains the sources' existing buffers.
 */
export function histogramSourceInput(
  x: GPUStorageSource,
  group: GPUStorageSource | undefined,
  options: MountedHistogramSourceOptions,
): ResidentHistogram1DSourceInput {
  requireStorage(x, "x", "f32");
  if (group) {
    requireStorage(group, "group", "u32");
    if (group.length !== x.length) {
      throw new Error("group source length must match x source length");
    }
    if (options.groupsCount == null) {
      throw new Error(
        "grouped histogram sources require an explicit groupsCount",
      );
    }
  }

  return {
    values: x.buffer,
    rows: x.length,
    groupIds: group?.buffer,
    lo: options.lo,
    hi: options.hi,
    bins: options.bins,
    binwidth: options.binwidth,
    groupsCount: options.groupsCount ?? 1,
    position: options.position,
  };
}

/**
 * Allocates only derived histogram targets against the mounted device. The
 * input columns remain owned by `RawData`, while this result owns counts,
 * vertices, and uniforms until its `destroy()` lifecycle runs.
 */
export function createMountedResidentHistogram1D(
  device: GPUDevice,
  x: GPUStorageSource,
  group: GPUStorageSource | undefined,
  options: MountedHistogramSourceOptions,
): ResidentHistogram1D {
  return createResidentHistogram1DFromSources(
    device,
    histogramSourceInput(x, group, options),
  );
}

/** Creates an eight-byte finite-domain reduction against mounted x storage. */
export function createMountedDomain1D(
  device: GPUDevice,
  x: GPUStorageSource,
): ResidentDomain1D {
  requireStorage(x, "x", "f32");
  return createResidentDomain1D(device, x.buffer, x.length);
}
