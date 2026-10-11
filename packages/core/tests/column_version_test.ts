// gggplot-67c: a column's version is the one "this changed" signal. Mutating a
// column in place and calling touchColumn re-uploads exactly that column, and
// nothing else, through the mounted GPUDataProvider. Runs a real headless Live
// tree on a WebGPU device when one is available.
import { assert, assertEquals } from "@std/assert";
import * as Live from "@use-gpu/live";
import {
  columnVersion,
  ingest,
  touchColumn,
  typedArrayForColumn,
} from "../src/data/mod.ts";
import { GPUDataProvider } from "../src/runtime/live.tsx";
import {
  createElement,
  DeviceContext,
  provide,
  QueueReconciler,
} from "../src/runtime/usegpu_compat.ts";
import type { FieldSpec } from "../src/plan/mod.ts";
import type { GPUStorageSource } from "../src/runtime/types.ts";

const requireWebGpu = Deno.env.get("GGGPLOT_REQUIRE_WEBGPU") === "1";

async function requestTestDevice(): Promise<GPUDevice | null> {
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

Deno.test("touchColumn bumps the version and refreshes the typed view", () => {
  const frame = ingest({ x: [1, 2, 3] });
  const before = typedArrayForColumn(frame.x);
  assertEquals(columnVersion(frame.x), 0);
  assert(typedArrayForColumn(frame.x) === before, "cached by identity");
  frame.x.values[0] = 10;
  assertEquals(touchColumn(frame.x), 1);
  const after = typedArrayForColumn(frame.x);
  assert(after !== before, "a touched column gets a fresh typed array");
  assertEquals(after[0], 10);
});

Deno.test("a touched column re-uploads once, and no other column does", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const writes: ArrayBufferLike[] = [];
  const write = device.queue.writeBuffer.bind(device.queue);
  device.queue.writeBuffer = ((buffer, offset, data, ...rest) => {
    writes.push(ArrayBuffer.isView(data) ? data.buffer : data);
    return write(buffer, offset, data, ...rest);
  }) as GPUQueue["writeBuffer"];

  const frame = ingest({ x: [1, 2, 3], y: [4, 5, 6] });
  const fields = [
    { name: "x", dtype: "f32" },
    { name: "y", dtype: "f32" },
  ] as FieldSpec[];
  let sources: Record<string, GPUStorageSource> = {};
  // The data mount signals the frame queue, so it needs the queue reconciler
  // root a real <WebGPU> host would provide.
  const queue = QueueReconciler as unknown as {
    reconcile: (calls: unknown) => unknown;
  };
  const tree = () =>
    queue.reconcile(provide(
      DeviceContext,
      device,
      createElement(GPUDataProvider, {
        data: frame,
        fields,
        children: (mounted: Record<string, GPUStorageSource>) => {
          sources = mounted;
          return null;
        },
      }),
    ));

  const root = live.render(tree());
  assertEquals(writes.length, 2, "x and y each upload once at mount");
  const xVersion = sources.x.version;
  const yVersion = sources.y.version;

  // A re-render with nothing touched uploads nothing.
  writes.length = 0;
  live.render(tree(), root);
  assertEquals(writes.length, 0);

  // Mutate x in place and declare it.
  frame.x.values[1] = 20;
  touchColumn(frame.x);
  live.render(tree(), root);
  assertEquals(writes.length, 1, "exactly one re-upload");
  assertEquals(writes[0], typedArrayForColumn(frame.x).buffer);
  assert(sources.x.version > xVersion, "x's source version moved");
  assertEquals(sources.y.version, yVersion, "y's source did not");
  device.destroy();
});
