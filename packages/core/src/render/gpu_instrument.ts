// GPU mark-data upload instrumentation (gggplot-tzc.8: perf/conformance gate).
//
// WHY SOURCE-BOUNDARY TAGGING (the required attribution mechanism, per this
// bead's third-pass design review): GPUDevice.createBuffer receives only a
// {size, usage, mappedAtCreation} DESCRIPTOR, never the payload, so comparing
// bytes at creation time cannot tell a mark-data buffer apart from a guide/
// uniform/canvas buffer. Instead, this module brackets every place the live
// backend hands a FlatTensor's `array` to Use.GPU's raw-source primitives with
// a synchronous "mark attribution" flag (withMarkAttribution). Because
// @use-gpu/live component bodies and the hooks they call execute synchronously
// (no microtask boundary between our useRawTensorSource call and the
// device.createBuffer/queue.writeBuffer calls it triggers underneath), any
// buffer creation/write that happens while the flag is open is attributable
// to mark data with certainty. ArrayBuffer identity/payload matching
// (registerKnownMarkArray + the writeBuffer corroboration check below) is
// available as OPTIONAL corroboration for code paths this module cannot
// bracket (see the Point-family caveat in render/GGPlot.tsx), but per this
// bead's contract it is NEVER the mechanism used to attribute a CREATE.
//
// SPIKED RAW-SOURCE ENTRY POINTS (documented once here + in the bd note on
// this bead, per the bead's "find once, document" instruction):
//   - node_modules/.deno/@use-gpu+workbench@0.19.0/node_modules/@use-gpu/
//     workbench/mjs/hooks/useRawSource.mjs — useRawSource/useRawTensorSource,
//     the hook chunked_line.tsx/chunked_face.tsx call directly. It (a)
//     useMemo-creates a GPUBuffer via @use-gpu/core's makeDataBuffer (keyed on
//     [device, byteLength-rounded alloc, flags] — NOT on the tensor identity,
//     so a same-size re-pack reuses the buffer object and only the paired (b)
//     useMemo re-runs), and (b) useMemo-calls uploadBuffer (keyed on
//     [device, format, source, array, buffer, version, ...size] — array
//     IDENTITY is a dependency, so an unchanged tensor.array reference across
//     re-renders skips this useMemo entirely: zero re-upload by construction,
//     which is exactly what PackCache's reference-identity guarantee (tzc.5)
//     is for).
//   - node_modules/.deno/@use-gpu+core@0.19.0/node_modules/@use-gpu/core/mjs/
//     buffer.mjs — makeDataBuffer -> makeTypedBuffer -> device.createBuffer;
//     uploadBuffer -> device.queue.writeBuffer. These two calls are the
//     ultimate primitives this module patches.
//   - Point does NOT go through useRawTensorSource: @use-gpu/plot's own
//     <Point> (shape/point.mjs's useTraits/schemaToAttributes/
//     schemaToArchetype, feeding a LayerReconciler quote/yeet batch) builds
//     its own raw sources deep inside a deferred shape-reconciler pipeline
//     that is not synchronously reachable from our REGISTRY wrapping point —
//     see render/GGPlot.tsx's registerMarkArrayBuffers for how Point's
//     CREATE-side attribution is consequently a documented, narrower,
//     WRITE-only corroboration rather than full source-boundary tagging.

/** Depth counter so nested mark boundaries (e.g. a ChunkedFace rendered while
 * another mark boundary is already open) stay attributed; only the outermost
 * withMarkAttribution call needs to matter for correctness. */
let markDepth = 0;
let installed = false;

export interface GpuMarkCounters {
  /** Buffer creations attributed to mark data via an open mark boundary. */
  markBufferCreations: number;
  /** Buffer writes attributed to mark data (open boundary OR a tagged buffer / known-array corroboration match). */
  markBufferWrites: number;
  /** All buffer creations seen by the patched device, mark or not. */
  totalBufferCreations: number;
  /** All buffer writes seen by the patched device, mark or not. */
  totalBufferWrites: number;
}

function freshCounters(): GpuMarkCounters {
  return {
    markBufferCreations: 0,
    markBufferWrites: 0,
    totalBufferCreations: 0,
    totalBufferWrites: 0,
  };
}

let counters: GpuMarkCounters = freshCounters();

/** GPUBuffer objects created while a mark boundary was open — tagged for the
 * rest of their lifetime, so a later write with no intervening create (e.g. a
 * `live:true` raw-source re-upload) still attributes correctly. */
const taggedBuffers = new WeakSet<object>();

/** Known mark-data ArrayBuffers registered via registerKnownMarkArray, for
 * OPTIONAL write-side corroboration on code paths withMarkAttribution cannot
 * bracket (see render/GGPlot.tsx's Point handling). Never consulted for
 * create attribution — see module doc. */
const knownMarkArrayBuffers = new WeakSet<object>();

/** Dev-only gate: instrumentation must never install itself outside an
 * explicit opt-in. Accepts an injectable location for testability. */
export function isInstrumentFlagSet(
  loc: { search: string } | undefined =
    (typeof location !== "undefined" ? location : undefined),
): boolean {
  if (!loc) return false;
  try {
    return new URLSearchParams(loc.search).has("instrument");
  } catch {
    return false;
  }
}

export function isGpuInstrumentationInstalled(): boolean {
  return installed;
}

/** Test/dev-only escape hatch: undo installGpuInstrumentation's instance
 * patch and clear all bookkeeping, so repeated test runs (or route
 * remounts behind ?instrument) start clean. */
export function uninstallGpuInstrumentation(
  device: { createBuffer?: unknown; queue?: { writeBuffer?: unknown } },
): void {
  installed = false;
  counters = freshCounters();
  // deno-lint-ignore no-explicit-any
  const anyDevice = device as any;
  if (anyDevice.__gggplotOriginalCreateBuffer) {
    anyDevice.createBuffer = anyDevice.__gggplotOriginalCreateBuffer;
    delete anyDevice.__gggplotOriginalCreateBuffer;
  }
  if (anyDevice.queue?.__gggplotOriginalWriteBuffer) {
    anyDevice.queue.writeBuffer = anyDevice.queue.__gggplotOriginalWriteBuffer;
    delete anyDevice.queue.__gggplotOriginalWriteBuffer;
  }
}

export function resetGpuMarkCounters(): void {
  counters = freshCounters();
}

export function getGpuMarkCounters(): GpuMarkCounters {
  return { ...counters };
}

/**
 * Register a FlatTensor's underlying ArrayBuffer as "known mark data" for
 * OPTIONAL write-side corroboration (see module doc). Call this at a point
 * that runs synchronously before the render pass that might upload it —
 * render/GGPlot.tsx's renderTree does this for Point-family nodes.
 */
export function registerKnownMarkArray(array: ArrayBufferView): void {
  knownMarkArrayBuffers.add(array.buffer);
}

/**
 * Run `fn` with the mark-attribution boundary open: any buffer creation/
 * write that happens synchronously during `fn` (directly or via nested hook
 * calls it triggers) is counted as mark data. This is the REQUIRED
 * attribution mechanism (source-boundary tagging) — see module doc.
 */
export function withMarkAttribution<T>(fn: () => T): T {
  markDepth++;
  try {
    return fn();
  } finally {
    markDepth--;
  }
}

function inMarkBoundary(): boolean {
  return markDepth > 0;
}

// deno-lint-ignore no-explicit-any
type AnyDevice = any;

/**
 * Patch this device's createBuffer/queue.writeBuffer to count total vs
 * mark-attributed buffer creations/writes. Idempotent per device instance.
 * Callers MUST gate this behind isInstrumentFlagSet() — it is dev-only.
 */
export function installGpuInstrumentation(device: GPUDevice): void {
  const anyDevice = device as AnyDevice;
  if (anyDevice.__gggplotOriginalCreateBuffer) return; // already installed on this device
  installed = true;

  const originalCreateBuffer = device.createBuffer.bind(device);
  anyDevice.__gggplotOriginalCreateBuffer = originalCreateBuffer;
  anyDevice.createBuffer = (descriptor: GPUBufferDescriptor): GPUBuffer => {
    const buffer = originalCreateBuffer(descriptor);
    counters.totalBufferCreations++;
    if (inMarkBoundary()) {
      counters.markBufferCreations++;
      taggedBuffers.add(buffer);
    }
    return buffer;
  };

  const queue = device.queue as AnyDevice;
  const originalWriteBuffer = device.queue.writeBuffer.bind(device.queue);
  queue.__gggplotOriginalWriteBuffer = originalWriteBuffer;
  queue.writeBuffer = (
    buffer: GPUBuffer,
    bufferOffset: number,
    data: BufferSource,
    dataOffset?: number,
    size?: number,
  ): void => {
    originalWriteBuffer(buffer, bufferOffset, data, dataOffset, size);
    counters.totalBufferWrites++;
    const payloadBuffer = data instanceof ArrayBuffer
      ? data
      : (data as ArrayBufferView).buffer;
    if (
      inMarkBoundary() || taggedBuffers.has(buffer) ||
      knownMarkArrayBuffers.has(payloadBuffer)
    ) {
      counters.markBufferWrites++;
    }
  };
}
