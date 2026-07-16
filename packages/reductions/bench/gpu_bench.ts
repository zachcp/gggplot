import {
  groupedHistogram1d,
  groupedHistogram1dGpu,
  groupedHistogram2d,
  groupedHistogram2dGpu,
} from "../src/mod.ts";

function values(length: number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = Math.sin(i * 0.013) * 50 + 50;
  return out;
}

function ids(length: number, modulo: number): Uint32Array {
  const out = new Uint32Array(length);
  for (let i = 0; i < length; i++) out[i] = i % modulo;
  return out;
}

function time<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}

const gpu = globalThis.navigator?.gpu;
if (!gpu) {
  console.log("WebGPU is not available in this runtime.");
  Deno.exit(0);
}

const adapter = await gpu.requestAdapter();
if (!adapter) {
  console.log("No WebGPU adapter available.");
  Deno.exit(0);
}

const device = await adapter.requestDevice();
const rows = 100_000;
const groups = 8;
const x = values(rows);
const y = values(rows);
const groupIds = ids(rows, groups);

const histogram1dInput = {
  values: x,
  lo: 0,
  hi: 100,
  bins: 80,
  groupIds,
  groupsCount: groups,
};
const cpu1d = time(() => groupedHistogram1d(histogram1dInput));
const gpu1d = await groupedHistogram1dGpu(device, histogram1dInput);

const histogram2dInput = {
  x,
  y,
  xLo: 0,
  xHi: 100,
  yLo: 0,
  yHi: 100,
  xBins: 64,
  yBins: 64,
  groupIds,
  groupsCount: groups,
};
const cpu2d = time(() => groupedHistogram2d(histogram2dInput));
const gpu2d = await groupedHistogram2dGpu(device, histogram2dInput);

console.table([
  {
    reducer: "groupedHistogram1d",
    rows,
    cpuMs: cpu1d.ms.toFixed(3),
    gpuTotalMs: gpu1d.timings.totalMs.toFixed(3),
    uploadMs: gpu1d.timings.uploadMs.toFixed(3),
    dispatchMs: gpu1d.timings.dispatchMs.toFixed(3),
    readbackMs: gpu1d.timings.readbackMs.toFixed(3),
    sameCounts: String(
      cpu1d.value.counts.every((count, i) => count === gpu1d.counts[i]),
    ),
  },
  {
    reducer: "groupedHistogram2d",
    rows,
    cpuMs: cpu2d.ms.toFixed(3),
    gpuTotalMs: gpu2d.timings.totalMs.toFixed(3),
    uploadMs: gpu2d.timings.uploadMs.toFixed(3),
    dispatchMs: gpu2d.timings.dispatchMs.toFixed(3),
    readbackMs: gpu2d.timings.readbackMs.toFixed(3),
    sameCounts: String(
      cpu2d.value.counts.every((count, i) => count === gpu2d.counts[i]),
    ),
  },
]);

device.destroy();
