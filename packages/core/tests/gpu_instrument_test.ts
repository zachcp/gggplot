// Tests for gggplot-tzc.8's GPU mark-data upload instrumentation
// (render/gpu_instrument.ts). Deno has no real WebGPU device, so these tests
// exercise the instrumentation logic itself — device patching, mark-boundary
// bracketing, and the optional write-side corroboration fallback — against a
// FAKE GPUDevice object (a "deno-level identity proxy", per this bead's
// instruction to implement what can't be driven against a real WebGPU
// context in this headless environment). This proves the counting/
// attribution mechanism is correct in isolation; it does NOT prove the real
// useRawSource/makeDataBuffer/uploadBuffer call sites in
// render/chunked_line.tsx / chunked_face.tsx / render/GGPlot.tsx actually
// trigger it end-to-end inside a mounted Live tree — that requires a real
// WebGPU context and is covered by apps/site's instrumented route instead
// (see the bd note on this bead for what ran in-browser vs what did not).
import { assertEquals } from "@std/assert";
import {
  getGpuMarkCounters,
  installGpuInstrumentation,
  isInstrumentFlagSet,
  registerKnownMarkArray,
  resetGpuMarkCounters,
  uninstallGpuInstrumentation,
  withMarkAttribution,
} from "../src/render/gpu_instrument.ts";

/** Minimal fake GPUDevice: createBuffer returns a distinguishable object
 * identity, queue.writeBuffer just records the call. Enough surface for
 * gpu_instrument.ts's patch (it only touches device.createBuffer and
 * device.queue.writeBuffer) without depending on a real WebGPU runtime. */
function fakeDevice() {
  let nextId = 0;
  const device = {
    createBuffer(_descriptor: unknown) {
      return { __id: nextId++ };
    },
    queue: {
      writeBuffer(
        _buffer: unknown,
        _offset: number,
        _data: unknown,
        _dataOffset?: number,
        _size?: number,
      ) {},
    },
  };
  // deno-lint-ignore no-explicit-any
  return device as any;
}

Deno.test("isInstrumentFlagSet reads ?instrument from a location-like object", () => {
  assertEquals(isInstrumentFlagSet({ search: "?instrument" }), true);
  assertEquals(isInstrumentFlagSet({ search: "?instrument=1" }), true);
  assertEquals(isInstrumentFlagSet({ search: "" }), false);
  assertEquals(isInstrumentFlagSet({ search: "?other=1" }), false);
  assertEquals(isInstrumentFlagSet(undefined), false);
});

Deno.test("gpu instrument: createBuffer/writeBuffer OUTSIDE a mark boundary count toward totals only", () => {
  const device = fakeDevice();
  installGpuInstrumentation(device);
  resetGpuMarkCounters();
  try {
    const buffer = device.createBuffer({ size: 16, usage: 0 });
    device.queue.writeBuffer(buffer, 0, new Float32Array(4));

    const counters = getGpuMarkCounters();
    assertEquals(counters.totalBufferCreations, 1);
    assertEquals(counters.totalBufferWrites, 1);
    assertEquals(counters.markBufferCreations, 0);
    assertEquals(counters.markBufferWrites, 0);
  } finally {
    uninstallGpuInstrumentation(device);
  }
});

Deno.test("gpu instrument: createBuffer/writeBuffer INSIDE withMarkAttribution are attributed to mark data", () => {
  const device = fakeDevice();
  installGpuInstrumentation(device);
  resetGpuMarkCounters();
  try {
    withMarkAttribution(() => {
      const buffer = device.createBuffer({ size: 16, usage: 0 });
      device.queue.writeBuffer(buffer, 0, new Float32Array(4));
    });

    const counters = getGpuMarkCounters();
    assertEquals(counters.totalBufferCreations, 1);
    assertEquals(counters.totalBufferWrites, 1);
    assertEquals(counters.markBufferCreations, 1);
    assertEquals(counters.markBufferWrites, 1);
  } finally {
    uninstallGpuInstrumentation(device);
  }
});

Deno.test("gpu instrument: a buffer created inside a mark boundary stays tagged for a LATER write outside any boundary", () => {
  // Mirrors useRawSource's live:true re-upload path: buffer creation and a
  // subsequent write can be two separate hook calls/renders, not one
  // bracketed call — the CREATE-time tag must survive to attribute the write.
  const device = fakeDevice();
  installGpuInstrumentation(device);
  resetGpuMarkCounters();
  try {
    const buffer = withMarkAttribution(() => device.createBuffer({ size: 16 }));
    // A later write, with no mark boundary open this time.
    device.queue.writeBuffer(buffer, 0, new Float32Array(4));

    const counters = getGpuMarkCounters();
    assertEquals(counters.markBufferCreations, 1);
    assertEquals(
      counters.markBufferWrites,
      1,
      "a write to a buffer TAGGED at creation time must still attribute, even outside a mark boundary",
    );
  } finally {
    uninstallGpuInstrumentation(device);
  }
});

Deno.test("gpu instrument: nested withMarkAttribution boundaries stay attributed (reentrant-safe)", () => {
  const device = fakeDevice();
  installGpuInstrumentation(device);
  resetGpuMarkCounters();
  try {
    withMarkAttribution(() => {
      withMarkAttribution(() => {
        device.createBuffer({ size: 16 });
      });
      // Still inside the OUTER boundary here.
      device.createBuffer({ size: 16 });
    });
    // Back outside every boundary.
    device.createBuffer({ size: 16 });

    const counters = getGpuMarkCounters();
    assertEquals(counters.totalBufferCreations, 3);
    assertEquals(counters.markBufferCreations, 2);
  } finally {
    uninstallGpuInstrumentation(device);
  }
});

Deno.test("gpu instrument: registerKnownMarkArray corroborates a write whose payload buffer matches, WITHOUT attributing its creation", () => {
  // This is the Point-family fallback path (render/GGPlot.tsx's
  // registerPointMarkArrays): a FlatTensor array is registered synchronously
  // before Live mounts anything, so a later writeBuffer call the mark
  // boundary could never reach (because it happens deep inside @use-gpu/
  // plot's own Point shape-reconciler pipeline, not our own useRawSource
  // call) is still corroborated as a mark-data WRITE — but the bead is
  // explicit that this NEVER attributes a create, since createBuffer only
  // ever receives a size/usage descriptor, never the payload.
  const device = fakeDevice();
  installGpuInstrumentation(device);
  resetGpuMarkCounters();
  try {
    const markArray = new Float32Array([1, 2, 3, 4]);
    registerKnownMarkArray(markArray);

    // Buffer created with NO mark boundary open (simulating a code path we
    // cannot bracket) ...
    const buffer = device.createBuffer({ size: 16 });
    // ... but later written with the KNOWN mark array's underlying buffer.
    device.queue.writeBuffer(buffer, 0, markArray);

    const counters = getGpuMarkCounters();
    assertEquals(
      counters.markBufferCreations,
      0,
      "payload/identity corroboration must NOT attribute a create",
    );
    assertEquals(
      counters.markBufferWrites,
      1,
      "a write whose payload buffer matches a registered known mark array must still corroborate",
    );
  } finally {
    uninstallGpuInstrumentation(device);
  }
});

Deno.test("gpu instrument: an unrelated write (different device buffer, unregistered payload) is never counted as mark data", () => {
  const device = fakeDevice();
  installGpuInstrumentation(device);
  resetGpuMarkCounters();
  try {
    const uniformBuffer = device.createBuffer({ size: 64 });
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array(16));

    const counters = getGpuMarkCounters();
    assertEquals(counters.totalBufferCreations, 1);
    assertEquals(counters.totalBufferWrites, 1);
    assertEquals(
      counters.markBufferCreations,
      0,
      "a guide/uniform buffer created outside any mark boundary must not be attributed",
    );
    assertEquals(
      counters.markBufferWrites,
      0,
      "a guide/uniform write outside any mark boundary, with an unregistered payload, must not be attributed",
    );
  } finally {
    uninstallGpuInstrumentation(device);
  }
});

Deno.test("gpu instrument: N re-renders with the SAME tensor identity produce zero additional mark creations/writes after the first", () => {
  // Simulates the acceptance scenario end to end at the instrumentation
  // layer: useRawSource's real behavior is "create once (memoized on
  // [device, alloc, flags]), upload once per DISTINCT array identity" — a
  // caller passing the SAME FlatTensor.array reference across N calls must
  // see the buffer created/uploaded exactly once, then nothing more.
  const device = fakeDevice();
  installGpuInstrumentation(device);
  resetGpuMarkCounters();
  try {
    const tensorArray = new Float32Array([0, 0, 1, 1]);
    const seenBuffers = new Map<Float32Array, unknown>();
    const uploadedOnce = new WeakSet<Float32Array>();

    // A tiny stand-in for useRawSource's own memoization (buffer keyed on
    // device/alloc/flags; upload keyed additionally on array identity) —
    // proves the INSTRUMENTATION correctly reports zero on a cache hit,
    // not that useRawSource itself is bug-free (that's chunked_line/
    // chunked_face's own contract, exercised via pack_cache_test.ts's
    // reference-identity assertions upstream of this layer).
    const simulateRawSourceCall = (array: Float32Array) => {
      withMarkAttribution(() => {
        let buffer = seenBuffers.get(array);
        if (!buffer) {
          buffer = device.createBuffer({ size: array.byteLength });
          seenBuffers.set(array, buffer);
        }
        if (!uploadedOnce.has(array)) {
          device.queue.writeBuffer(buffer, 0, array);
          uploadedOnce.add(array);
        }
      });
    };

    for (let i = 0; i < 5; i++) simulateRawSourceCall(tensorArray);

    const counters = getGpuMarkCounters();
    assertEquals(counters.markBufferCreations, 1);
    assertEquals(counters.markBufferWrites, 1);
  } finally {
    uninstallGpuInstrumentation(device);
  }
});

Deno.test("gpu instrument: installGpuInstrumentation is idempotent per device instance", () => {
  const device = fakeDevice();
  installGpuInstrumentation(device);
  const patchedCreateBuffer = device.createBuffer;
  installGpuInstrumentation(device);
  assertEquals(
    device.createBuffer,
    patchedCreateBuffer,
    "a second install on the same device must not double-wrap createBuffer",
  );
  uninstallGpuInstrumentation(device);
});
