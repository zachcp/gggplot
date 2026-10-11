// Headless Live + WebGPU harness for component tests. Mounts a tree under the
// QueueReconciler root and DeviceContext a real <WebGPU> host would provide,
// and records every queue write so a test can count uploads.
import { assert } from "@std/assert";
import * as Live from "@use-gpu/live";
import {
  DeviceContext,
  provide,
  QueueReconciler,
} from "../../src/runtime/usegpu_compat.ts";

const requireWebGpu = Deno.env.get("GGGPLOT_REQUIRE_WEBGPU") === "1";

/** A WebGPU device, or null when none exists and the run does not require one. */
export async function requestTestDevice(): Promise<GPUDevice | null> {
  const gpu = globalThis.navigator?.gpu;
  if (!gpu) {
    assert(!requireWebGpu, "navigator.gpu is required");
    return null;
  }
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    assert(!requireWebGpu, "WebGPU adapter is required");
    return null;
  }
  return await adapter.requestDevice();
}

// Same CJS/ESM interop as runtime/usegpu_compat.ts.
const live = ((Live as unknown as { default?: { render?: unknown } }).default
    ?.render
  ? (Live as unknown as { default: unknown }).default
  : Live) as unknown as {
    render: (element: unknown, fiber?: unknown) => unknown;
  };

export interface LiveGpuHarness {
  /** Payload buffers of every writeBuffer since the last reset. */
  writes: ArrayBufferLike[];
  /** Render (first call) or re-render the tree. */
  render: (tree: unknown) => void;
}

/** Wraps `device` so every queue write is recorded, and returns a renderer. */
export function liveGpuHarness(device: GPUDevice): LiveGpuHarness {
  const writes: ArrayBufferLike[] = [];
  const write = device.queue.writeBuffer.bind(device.queue);
  device.queue.writeBuffer = ((buffer, offset, data, ...rest) => {
    writes.push(ArrayBuffer.isView(data) ? data.buffer : data);
    return write(buffer, offset, data, ...rest);
  }) as GPUQueue["writeBuffer"];
  const queue = QueueReconciler as unknown as {
    reconcile: (calls: unknown) => unknown;
  };
  let root: unknown;
  return {
    writes,
    render: (tree) => {
      const element = queue.reconcile(
        provide(DeviceContext, device, tree as never),
      );
      root = root ? live.render(element, root) : live.render(element);
    },
  };
}
