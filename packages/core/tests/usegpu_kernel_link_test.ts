// gggplot-5fy spikes 1 and 2b: the two assumptions the pure-Use.GPU compute
// port (epic gggplot-vs7) rests on. Both are properties of @use-gpu 0.20 and of
// WebGPU itself rather than of our code, so they are pinned here as executable
// checks — if a version bump breaks either, the port's foundation is gone and
// this file says so directly instead of the failure surfacing as a wrong plot.
//
// Spike 1: reduction kernels accumulate with atomics. `<Kernel>` links a shader
//   bundle whose externals are declared with `@link`, and the linker normally
//   generates FUNCTION accessors (`fn getX(i) -> T`), which cannot express
//   `atomicAdd(&buf[i], 1u)`. The escape hatch is a link declared as a `var`
//   rather than a `fn`: shader/mjs/wgsl/gen.mjs's `makeStorageAccessor` emits a
//   raw whole-buffer binding when an attribute has `args === null`.
//
// Spike 2b: with one `<Compute>` per plot (decision on gggplot-vs7.1),
//   workbench's ComputePass batches every gathered dispatch into a SINGLE
//   `beginComputePass()`. The histogram's summary->bars dependency
//   (reductions/src/gpu/resident_histogram.ts:265) therefore stops resting on a
//   pass boundary and starts resting on intra-pass read-after-write visibility.
import { assert, assertEquals } from "@std/assert";
import {
  bindBundle,
  bindingsToModules,
  bundleToAttributes,
  linkBundle,
  resolveBindings,
  wgsl,
} from "@use-gpu/shader/wgsl";
// Deno resolves @use-gpu/core to its CommonJS surface, so the exports sit under
// `.default`; Vite resolves the documented ESM surface. Same interop split that
// runtime/usegpu_compat.ts centralizes for Live/Workbench/Plot.
import * as CoreNamespace from "@use-gpu/core";

// deno-lint-ignore no-explicit-any
const any = (value: unknown): any => value;
const Core = any(CoreNamespace).default ?? CoreNamespace;

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

const USAGE = {
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  STORAGE: 0x0080,
};

/** GPUShaderStage.COMPUTE. The WebGPU globals are not guaranteed to exist in
 * every Deno execution context, so this stays a literal for the same reason
 * reductions/src/gpu/plumbing.ts keeps its usage flags as literals. */
const SHADER_STAGE_COMPUTE = 0x4;

/** The bind-group defines a compute `<Kernel>` links under when it has no
 * globals (queue/dispatch.mjs's LOCAL_DEFINES). Group numbers are assigned by
 * the linker, never hand-written in the bundle. */
const LOCAL_DEFINES = {
  "@group(VIRTUAL)": "@group(0)",
  "@group(VOLATILE)": "@group(1)",
  "@group(CUSTOM)": "@group(2)",
  "@group(LOCAL)": "@group(3)",
};

async function readU32(
  device: GPUDevice,
  source: GPUBuffer,
  count: number,
): Promise<Uint32Array> {
  const staging = device.createBuffer({
    size: count * 4,
    usage: USAGE.COPY_DST | USAGE.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(source, 0, staging, 0, count * 4);
  device.queue.submit([encoder.finish()]);
  await staging.mapAsync(USAGE.MAP_READ);
  const values = new Uint32Array(staging.getMappedRange().slice(0));
  staging.unmap();
  staging.destroy();
  return values;
}

const ATOMIC_KERNEL = wgsl`
@link var<storage, read_write> counts: array<atomic<u32>>;
@link fn getValue(i: u32) -> f32;
@link fn getSize() -> vec2<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= getSize().x) { return; }
  let v = getValue(i);
  atomicAdd(&counts[u32(v)], 1u);
}
`;

Deno.test("spike 1a: an atomic storage @link resolves to a raw whole-buffer binding", () => {
  const attributes = any(bundleToAttributes)(ATOMIC_KERNEL);
  const counts = attributes.find((a: { name: string }) => a.name === "counts");
  const getValue = attributes.find((a: { name: string }) =>
    a.name === "getValue"
  );

  // `args === null` is the discriminator: gen.mjs's makeStorageAccessor emits a
  // raw `var<storage, read_write>` binding for it, and a `fn get..(i)` accessor
  // for anything with an argument list. An atomic buffer only works via the
  // former, so this assertion IS the escape hatch.
  assertEquals(counts.args, null);
  assertEquals(counts.format, "array<atomic<u32>>");
  assertEquals(counts.qual, "<storage, read_write>");

  // The contrast case: a normal value accessor keeps its argument list.
  assertEquals(getValue.args, ["u32"]);
});

Deno.test("spike 1b: the linked WGSL binds the atomic array directly and runs", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  const rows = 1000;
  const bins = 4;
  const values = Float32Array.from({ length: rows }, (_, i) => i % bins);

  const valueBuffer = device.createBuffer({
    size: values.byteLength,
    usage: USAGE.STORAGE | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(valueBuffer, 0, values);
  const countsBuffer = device.createBuffer({
    size: bins * 4,
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(countsBuffer, 0, new Uint32Array(bins));

  // Mirrors <Kernel>: values link positionally against the bundle's attributes,
  // and a plain function (getSize) becomes a uniform ref rather than a binding.
  const attributes = any(bundleToAttributes)(ATOMIC_KERNEL);
  const bound = any(bindBundle)(
    ATOMIC_KERNEL,
    any(bindingsToModules)(
      any(Core).makeShaderBindings(attributes, [
        {
          buffer: countsBuffer,
          format: "atomic<u32>",
          length: bins,
          size: [bins],
          version: 1,
          readWrite: true,
        },
        {
          buffer: valueBuffer,
          format: "f32",
          length: rows,
          size: [rows],
          version: 1,
        },
        () => [rows, 1],
      ]),
    ),
    LOCAL_DEFINES,
  );
  const resolved = any(resolveBindings)([bound], LOCAL_DEFINES, false);
  // useLinkedShader links resolved.modules[0], not the bound bundle itself.
  const linked: string = any(linkBundle)(
    resolved.modules[0],
    {},
    LOCAL_DEFINES,
  );

  // The generated declaration is a raw binding over the atomic array, so
  // atomicAdd is legal against it. An accessor function here would not compile.
  assert(
    /var<storage, read_write>\s+\w*counts\w*:\s*array<atomic<u32>>/.test(
      linked,
    ),
    `expected a raw atomic storage binding, got:\n${linked}`,
  );

  const bindingEntries = any(Core).makeBindGroupLayoutEntries(
    resolved.bindings,
    resolved.bindingVisibilities,
  );
  const uniformEntry = any(Core).makeUniformLayoutEntry(
    resolved.fields,
    SHADER_STAGE_COMPUTE,
    bindingEntries.length,
  );
  const entries = uniformEntry
    ? [...bindingEntries, uniformEntry]
    : bindingEntries;
  const pipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [device.createBindGroupLayout({ entries })],
    }),
    compute: {
      module: device.createShaderModule({ code: linked }),
      entryPoint: "main",
    },
  });

  // Bound storage + virtual uniform, exactly as queue/dispatch.mjs does it.
  const storage = any(Core).makeBoundUniforms(
    device,
    pipeline,
    resolved.fields,
    resolved.bindings,
    0,
    false,
  );
  if (storage.pipe && storage.buffer) {
    const constants: Record<string, unknown> = {};
    for (const field of resolved.fields) {
      constants[field.attribute.name] = field.constant;
    }
    storage.pipe.fill(constants);
    any(Core).uploadBuffer(device, storage.buffer, storage.pipe.data);
  }

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  if (storage.bindGroup) pass.setBindGroup(0, storage.bindGroup);
  pass.dispatchWorkgroups(Math.ceil(rows / 64));
  pass.end();
  device.queue.submit([encoder.finish()]);

  assertEquals(
    [...await readU32(device, countsBuffer, bins)],
    Array(bins).fill(rows / bins),
  );
  device.destroy();
});

Deno.test("spike 2b: one compute pass makes a dispatch's writes visible to the next", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  // Deliberately large: pass A performs two million atomic increments before
  // pass B reads the totals, so a missing barrier has room to show itself
  // rather than being hidden by a trivially short first dispatch.
  const rows = 2_000_000;
  const groups = 8;
  const perGroup = rows / groups;

  const accumulate = `
@group(0) @binding(0) var<storage, read> groupIds: array<u32>;
@group(0) @binding(1) var<storage, read_write> summary: array<atomic<u32>>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= ${rows}u) { return; }
  atomicAdd(&summary[groupIds[i]], 1u);
}`;

  // The dodge-slotting shape: a running offset over prior groups' totals, which
  // is only correct if pass A's accumulation is already visible.
  const consume = `
@group(0) @binding(0) var<storage, read> summary: array<u32>;
@group(0) @binding(1) var<storage, read_write> bars: array<u32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let g = gid.x;
  if (g >= ${groups}u) { return; }
  var acc: u32 = 0u;
  for (var k: u32 = 0u; k < g; k = k + 1u) { acc = acc + summary[k]; }
  bars[g] = acc + summary[g] * 1000u;
}`;

  const groupIds = Uint32Array.from({ length: rows }, (_, i) => i % groups);
  const groupBuffer = device.createBuffer({
    size: groupIds.byteLength,
    usage: USAGE.STORAGE | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(groupBuffer, 0, groupIds);
  const summaryBuffer = device.createBuffer({
    size: groups * 4,
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(summaryBuffer, 0, new Uint32Array(groups));
  const barsBuffer = device.createBuffer({
    size: groups * 4,
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(barsBuffer, 0, new Uint32Array(groups));

  const compile = (code: string) =>
    device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code }),
        entryPoint: "main",
      },
    });
  const producer = compile(accumulate);
  const consumer = compile(consume);
  const producerBind = device.createBindGroup({
    layout: producer.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: groupBuffer } },
      { binding: 1, resource: { buffer: summaryBuffer } },
    ],
  });
  const consumerBind = device.createBindGroup({
    layout: consumer.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: summaryBuffer } },
      { binding: 1, resource: { buffer: barsBuffer } },
    ],
  });

  // The load-bearing detail: ONE beginComputePass() for both dispatches, which
  // is what pass/compute-pass.mjs does with its gathered `compute` calls.
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(producer);
  pass.setBindGroup(0, producerBind);
  pass.dispatchWorkgroups(Math.ceil(rows / 64));
  pass.setPipeline(consumer);
  pass.setBindGroup(0, consumerBind);
  pass.dispatchWorkgroups(Math.ceil(groups / 64));
  pass.end();
  device.queue.submit([encoder.finish()]);

  assertEquals(
    [...await readU32(device, summaryBuffer, groups)],
    Array(groups).fill(perGroup),
  );
  assertEquals(
    [...await readU32(device, barsBuffer, groups)],
    Array.from({ length: groups }, (_, g) => g * perGroup + perGroup * 1000),
  );
  device.destroy();
});
