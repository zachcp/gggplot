// Storage sources and targets for the mounted grid kernels (gggplot-vs7.7/vs7.8).
//
// Both grid ports bind buffers their reductions kernel already owns, so neither
// needs a <ComputeBuffer>: a <Stage> takes any object `makeShaderBinding`
// accepts as a storage source, and `readWrite` is what makes the linker emit
// `var<storage, read_write>` instead of a read-only binding.
//
// The same buffer can legitimately be described two ways — a `u32` target for
// its clear pass and an `atomic<u32>` target for its accumulation. That is not
// a contradiction: the emitted WGSL type comes from the bundle's own `@link`
// declaration, not from `format`, and core's checkStorageType strips
// `array<atomic<..>>` before comparing (and only warns anyway).

import type { GPUStorageSource } from "./types.ts";

/** A buffer bound for a kernel to write. */
export interface StorageTarget extends GPUStorageSource {
  readonly readWrite: true;
}

/**
 * The version stamped on every binding built here.
 *
 * Deliberately constant. A plain storage binding never reads it — the buffer is
 * baked into the bind group when the shader links — and these objects must stay
 * IDENTITY-STABLE across data versions, because <Kernel> memoizes its linked
 * shader on `[shader, targets, source, sources, size, ...]` by identity. Making
 * it track the data version would relink and recompile on every update, which
 * is the opposite of what a version bump should do: re-dispatch, not rebuild.
 */
const STATIC_BINDING_VERSION = 1;

/** A read-only storage source over `buffer`. */
export function storageSource(
  buffer: GPUBuffer,
  format: string,
  length: number,
): GPUStorageSource {
  return {
    buffer,
    format,
    length,
    size: [length],
    version: STATIC_BINDING_VERSION,
  };
}

/** A read-write storage target over `buffer`. */
export function storageTarget(
  buffer: GPUBuffer,
  format: string,
  length: number,
): StorageTarget {
  return { ...storageSource(buffer, format, length), readWrite: true };
}
