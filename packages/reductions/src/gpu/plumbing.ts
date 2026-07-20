// Shared low-level GPU buffer plumbing for the resident reduction kernels
// (resident_count.ts, resident_histogram.ts, resident_domain.ts). Each of those
// files previously re-declared these usage-flag constants, the uniform()/
// storage() buffer helpers, and the staging-buffer readback loop; they are
// centralized here with no behavioral change (identical buffer sizes, usage
// flags, and copy/map semantics).
//
// GPUBufferUsage (the WebGPU global) is not guaranteed to exist in every Deno
// execution context, so the usage flags stay plain numeric literals in a shared
// const object rather than referencing the global.

export const USAGE = {
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
} as const;

/** A UNIFORM buffer sized to `data`, written once at creation. */
export function uniform(device: GPUDevice, data: ArrayBuffer): GPUBuffer {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: USAGE.UNIFORM | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

/** A read/write STORAGE buffer (min 4 bytes) seeded with `array`. */
export function storage(
  device: GPUDevice,
  array: Float32Array | Uint32Array,
): GPUBuffer {
  const buffer = device.createBuffer({
    size: Math.max(4, array.byteLength),
    usage: USAGE.STORAGE | USAGE.COPY_DST | USAGE.COPY_SRC,
  });
  if (array.byteLength) device.queue.writeBuffer(buffer, 0, array);
  return buffer;
}

/**
 * Copies `bytes` out of `source` through a transient MAP_READ staging buffer
 * and materializes them via `create`. The staging buffer is never smaller than
 * four bytes (a zero-length map is invalid), and the copy spans the full
 * staging buffer while `create` sees only the requested `bytes`.
 */
export async function readBuffer<T extends Uint32Array | Float32Array>(
  device: GPUDevice,
  source: GPUBuffer,
  bytes: number,
  create: (buffer: ArrayBuffer) => T,
): Promise<T> {
  const staging = device.createBuffer({
    size: Math.max(4, bytes),
    usage: USAGE.COPY_DST | USAGE.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(source, 0, staging, 0, staging.size);
  device.queue.submit([encoder.finish()]);
  await staging.mapAsync(USAGE.MAP_READ);
  const result = create(staging.getMappedRange().slice(0, bytes));
  staging.unmap();
  staging.destroy();
  return result;
}
