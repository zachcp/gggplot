// Dual-surface parity for the finite-domain reduction (gggplot-vs7.5/vs7.6).
//
// One pass body in @gggplot/reductions is compiled two ways: under the
// hand-numbered preamble the standalone Deno executor uses, and under the
// `@link` preamble Use.GPU's <Kernel> links. This asserts the two produce the
// SAME bounds for the same input on a real device.
//
// Binding layouts deliberately differ — the raw form passes the row count in a
// uniform buffer, the linked form takes it as a <Kernel> arg ref — so layout
// equality is NOT the invariant and asserting it would be wrong.
import { assert, assertEquals } from "@std/assert";
import { createResidentDomain1D } from "@gggplot/reductions";
import {
  bindBundle,
  bindingsToModules,
  bundleToAttributes,
  linkBundle,
  resolveBindings,
} from "@use-gpu/shader/wgsl";
import * as CoreNamespace from "@use-gpu/core";
import {
  DOMAIN_CLEAR_KERNEL,
  FINITE_DOMAIN_1D_KERNEL,
} from "../src/render/resident_domain_kernel.ts";

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
/** GPUShaderStage.COMPUTE; the WebGPU globals are not reliable under Deno. */
const SHADER_STAGE_COMPUTE = 0x4;
/** queue/dispatch.mjs's LOCAL_DEFINES — a compute kernel with no globals. */
const LOCAL_DEFINES = {
  "@group(VIRTUAL)": "@group(0)",
  "@group(VOLATILE)": "@group(1)",
  "@group(CUSTOM)": "@group(2)",
  "@group(LOCAL)": "@group(3)",
};

/** Links one bundle against positional values and runs it, as <Kernel> does. */
function runLinked(
  device: GPUDevice,
  bundle: unknown,
  values: unknown[],
  workgroups: number,
): void {
  const attributes = any(bundleToAttributes)(bundle);
  const bound = any(bindBundle)(
    bundle,
    any(bindingsToModules)(Core.makeShaderBindings(attributes, values)),
    LOCAL_DEFINES,
  );
  const resolved = any(resolveBindings)([bound], LOCAL_DEFINES, false);
  const linked: string = any(linkBundle)(
    resolved.modules[0],
    {},
    LOCAL_DEFINES,
  );
  const bindingEntries = Core.makeBindGroupLayoutEntries(
    resolved.bindings,
    resolved.bindingVisibilities,
  );
  const uniformEntry = Core.makeUniformLayoutEntry(
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
  const storage = Core.makeBoundUniforms(
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
    Core.uploadBuffer(device, storage.buffer, storage.pipe.data);
  }
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  if (storage.bindGroup) pass.setBindGroup(0, storage.bindGroup);
  pass.dispatchWorkgroups(workgroups);
  pass.end();
  device.queue.submit([encoder.finish()]);
}

/** Decodes the ordered-bit accumulator the shared body writes. */
function decodeDomain(words: Uint32Array): { min: number; max: number } {
  const fromOrdered = (bits: number) => {
    const raw = (bits & 0x80000000) !== 0 ? bits ^ 0x80000000 : ~bits >>> 0;
    return new Float32Array(new Uint32Array([raw >>> 0]).buffer)[0];
  };
  return { min: fromOrdered(words[0]), max: fromOrdered(words[1]) };
}

Deno.test("linked and raw domain kernels agree on the same input", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  // Deliberately includes non-finite values: the shared body's isFiniteValue
  // guard is part of what both surfaces must agree on, not just the min/max.
  const values = Float32Array.from([
    3.5,
    -12.25,
    Number.NaN,
    0,
    Number.POSITIVE_INFINITY,
    7.75,
    -0.5,
    Number.NEGATIVE_INFINITY,
    42,
  ]);

  // --- raw surface, through the standalone executor
  const valueBuffer = device.createBuffer({
    size: values.byteLength,
    usage: USAGE.STORAGE | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(valueBuffer, 0, values);
  const raw = createResidentDomain1D(device, valueBuffer, values.length);
  raw.dispatch();
  const rawBounds = await raw.readback();

  // --- linked surface, through Use.GPU's bind/link chain
  const domain = device.createBuffer({
    size: 8,
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  const domainTarget = {
    buffer: domain,
    format: "atomic<u32>",
    length: 2,
    size: [2],
    version: 1,
    readWrite: true,
  };
  const valueSource = {
    buffer: valueBuffer,
    format: "f32",
    length: values.length,
    size: [values.length],
    version: 1,
  };
  // Value order mirrors <Kernel> EXACTLY: it always passes dataSize first, then
  // args/sources/targets. A bundle that declares no getSize would bind its
  // first real link to that lambda, which is why both kernels take one.
  runLinked(device, DOMAIN_CLEAR_KERNEL, [() => [2, 1], domainTarget], 1);
  runLinked(
    device,
    FINITE_DOMAIN_1D_KERNEL,
    [() => [values.length, 1], domainTarget, valueSource],
    Math.ceil(values.length / 64),
  );

  const staging = device.createBuffer({
    size: 8,
    usage: USAGE.COPY_DST | USAGE.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(domain, 0, staging, 0, 8);
  device.queue.submit([encoder.finish()]);
  await staging.mapAsync(USAGE.MAP_READ);
  const linkedWords = new Uint32Array(staging.getMappedRange().slice(0));
  staging.unmap();
  const linkedBounds = decodeDomain(linkedWords);

  // The finite values are -12.25 .. 42; NaN and both infinities are excluded.
  assertEquals(rawBounds.min, -12.25);
  assertEquals(rawBounds.max, 42);
  assertEquals(linkedBounds.min, rawBounds.min);
  assertEquals(linkedBounds.max, rawBounds.max);

  raw.destroy();
  domain.destroy();
  valueBuffer.destroy();
  staging.destroy();
  device.destroy();
});
