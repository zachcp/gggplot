// The column half of the GPU loader tier (ADR 006, gggplot-vs7.10).
//
// typedArrayForColumn is the CPU lowering every column passes through before
// <RawData> uploads it. For boxed input that lowering is unavoidable -- something
// has to turn Array<number | null> into a Float32Array. For a caller who ALREADY
// owns typed data (Arrow, a fetched blob, a kernel's output) it is a pure copy,
// and this is the path that skips it.
//
// Deliberately raw WebGPU and deliberately NOT a Live component: like
// ByteArrayGPUTensorSource, a loader must not require a mounted tree (ADR 006
// decision 2). The caller uploads once, when it has a device, and hands the
// result to GPUDataProvider as many times as it likes.

import type { Column } from "../data/mod.ts";
import { typedArrayForColumn } from "../data/mod.ts";
import type { GPUStorageSource, ResidentColumn } from "./types.ts";

const USAGE = {
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  STORAGE: 0x0080,
} as const;

export interface ResidentColumnOptions {
  /** Ordered level dictionary. Required for a factor column, rejected otherwise. */
  levels?: readonly string[];
  /** Bumped by the caller when the buffer's contents change. Defaults to 1. */
  version?: number;
  label?: string;
}

/**
 * Uploads a typed array once and returns a column that mounts with no further
 * upload.
 *
 * The array's element type picks the format, which is the same f32/u32 split
 * `formatFor` enforces on the CPU path: a Float32Array is a numeric column, a
 * Uint32Array is a factor's level codes.
 */
export function createResidentColumn(
  device: GPUDevice,
  values: Float32Array | Uint32Array,
  options: ResidentColumnOptions = {},
): ResidentColumn {
  const type = values instanceof Float32Array ? "numeric" : "factor";
  if (type === "factor" && !options.levels) {
    throw new Error(
      "A resident factor column requires `levels`: the level dictionary is CPU-owned and never enters a shader",
    );
  }
  if (type === "numeric" && options.levels) {
    throw new Error("A resident numeric column must not carry `levels`");
  }
  const buffer = device.createBuffer({
    label: options.label ?? `gggplot-column-${type}`,
    size: Math.max(4, values.byteLength),
    usage: USAGE.STORAGE | USAGE.COPY_DST | USAGE.COPY_SRC,
  });
  // The one copy. Nothing is lowered, boxed, or re-packed on the way.
  if (values.byteLength) device.queue.writeBuffer(buffer, 0, values);
  return {
    kind: "resident",
    type,
    levels: options.levels,
    source: {
      buffer,
      format: type === "numeric" ? "f32" : "u32",
      length: values.length,
      size: [values.length],
      version: options.version ?? 1,
    } satisfies GPUStorageSource,
  };
}

/**
 * Lowers a CPU column and uploads it, producing the same handle.
 *
 * This is a CONVENIENCE, not the fast path: it still pays `typedArrayForColumn`.
 * It exists so a host can make an entire frame resident up front and get the
 * mount-time zero-upload property uniformly, rather than having half its columns
 * re-upload on every remount because they happened to arrive boxed.
 */
export function residentColumnFromColumn(
  device: GPUDevice,
  column: Column,
  options: Omit<ResidentColumnOptions, "levels"> = {},
): ResidentColumn {
  return createResidentColumn(device, typedArrayForColumn(column), {
    ...options,
    levels: column.type === "factor" ? column.levels : undefined,
  });
}

/** Releases every buffer in a resident frame. */
export function destroyResidentColumns(
  columns: Iterable<ResidentColumn>,
): void {
  for (const column of columns) column.source.buffer.destroy();
}
