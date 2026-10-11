// gggplot-euh: the generated `@link` sources link under Use.GPU exactly as the
// <Kernel>s in ProductKernels need, and run to the same answer as the headless
// executor's generated raw sources. The link-side counterpart of
// usegpu_kernel_link_test.ts.
import { assert, assertEquals } from "@std/assert";
import {
  bindBundle,
  bindingsToModules,
  bundleToAttributes,
  linkBundle,
  resolveBindings,
  wgsl,
} from "@use-gpu/shader/wgsl";
import * as CoreNamespace from "@use-gpu/core";
import {
  CLEAR_U32,
  COUNT_BAR_VERTICES,
  COUNT_GRID_PRODUCT,
  GRID_BAR_VERTEX_COLORS,
  GRID_SUMMARY,
  GROUPED_COUNT_1D,
  type KernelSpec,
  linkSource,
  runProduct,
} from "@gggplot/reductions";

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

const USAGE = { MAP_READ: 0x1, COPY_SRC: 0x4, COPY_DST: 0x8, STORAGE: 0x80 };
const SHADER_STAGE_COMPUTE = 0x4;
const LOCAL_DEFINES = {
  "@group(VIRTUAL)": "@group(0)",
  "@group(VOLATILE)": "@group(1)",
  "@group(CUSTOM)": "@group(2)",
  "@group(LOCAL)": "@group(3)",
};

const accessorName = (name: string) =>
  `get${name.charAt(0).toUpperCase()}${name.slice(1)}`;

Deno.test("every catalog kernel links in <Kernel>'s value order", () => {
  const kernels: KernelSpec[] = [
    CLEAR_U32,
    GROUPED_COUNT_1D,
    GRID_SUMMARY,
    COUNT_BAR_VERTICES,
    GRID_BAR_VERTEX_COLORS,
  ];
  for (const kernel of kernels) {
    const attributes: { name: string; args: string[] | null }[] = any(
      bundleToAttributes,
    )(wgsl`${linkSource(kernel)}`);
    // <Kernel> pairs [size, ...args, ...sources, target] positionally against
    // the attributes, so the attribute order IS the binding contract.
    assertEquals(attributes.map((a) => a.name), [
      "getSize",
      ...kernel.args.map((a) => accessorName(a.name)),
      ...kernel.reads.map((r) => accessorName(r.name)),
      kernel.write.name,
    ], kernel.id);
    // The target is a raw whole-buffer binding (args null), which is what lets
    // a body use atomicAdd on it; every read is an indexed accessor.
    assertEquals(attributes.at(-1)!.args, null, kernel.id);
    for (const read of kernel.reads) {
      const attribute = attributes.find((a) =>
        a.name === accessorName(read.name)
      )!;
      assertEquals(attribute.args, ["u32"], `${kernel.id} ${read.name}`);
    }
  }
});

async function readU32(device: GPUDevice, source: GPUBuffer, count: number) {
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

Deno.test("a linked kernel matches the headless executor's raw form", async () => {
  const device = await requestTestDevice();
  if (!device) return;
  const valueIds = Uint32Array.of(0, 1, 2, 1, 1, 0, 2, 2, 2, 1);
  const groupIds = Uint32Array.of(0, 0, 1, 1, 0, 1, 1, 0, 1, 1);
  const upload = (array: Uint32Array) => {
    const buffer = device.createBuffer({
      size: array.byteLength,
      usage: USAGE.STORAGE | USAGE.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, array);
    return buffer;
  };
  const values = upload(valueIds);
  const groups = upload(groupIds);
  const bins = 3, groupsCount = 2, rows = valueIds.length;
  const counts = device.createBuffer({
    size: bins * groupsCount * 4,
    usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
  });
  device.queue.writeBuffer(counts, 0, new Uint32Array(bins * groupsCount));

  // Values in <Kernel>'s order: [size, ...args, ...reads, target].
  const bundle = wgsl`${linkSource(GROUPED_COUNT_1D)}`;
  const attributes = any(bundleToAttributes)(bundle);
  const storage = (buffer: GPUBuffer, format: string, length: number) => ({
    buffer,
    format,
    length,
    size: [length],
    version: 1,
  });
  const bound = any(bindBundle)(
    bundle,
    any(bindingsToModules)(
      any(Core).makeShaderBindings(attributes, [
        () => [rows, 1],
        bins,
        groupsCount,
        1,
        storage(values, "u32", rows),
        storage(groups, "u32", rows),
        {
          ...storage(counts, "atomic<u32>", bins * groupsCount),
          readWrite: true,
        },
      ]),
    ),
    LOCAL_DEFINES,
  );
  const resolved = any(resolveBindings)([bound], LOCAL_DEFINES, false);
  const code: string = any(linkBundle)(resolved.modules[0], {}, LOCAL_DEFINES);
  const bindingEntries = any(Core).makeBindGroupLayoutEntries(
    resolved.bindings,
    resolved.bindingVisibilities,
  );
  const uniformEntry = any(Core).makeUniformLayoutEntry(
    resolved.fields,
    SHADER_STAGE_COMPUTE,
    bindingEntries.length,
  );
  const pipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [
        device.createBindGroupLayout({
          entries: uniformEntry
            ? [...bindingEntries, uniformEntry]
            : bindingEntries,
        }),
      ],
    }),
    compute: {
      module: device.createShaderModule({ code }),
      entryPoint: "main",
    },
  });
  const uniforms = any(Core).makeBoundUniforms(
    device,
    pipeline,
    resolved.fields,
    resolved.bindings,
    0,
    false,
  );
  if (uniforms.pipe && uniforms.buffer) {
    const constants: Record<string, unknown> = {};
    for (const field of resolved.fields) {
      constants[field.attribute.name] = field.constant;
    }
    uniforms.pipe.fill(constants);
    any(Core).uploadBuffer(device, uniforms.buffer, uniforms.pipe.data);
  }
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  if (uniforms.bindGroup) pass.setBindGroup(0, uniforms.bindGroup);
  pass.dispatchWorkgroups(Math.ceil(rows / 64));
  pass.end();
  device.queue.submit([encoder.finish()]);

  const headless = runProduct(device, COUNT_GRID_PRODUCT, {
    rows,
    bins,
    groups: groupsCount,
    hasGroups: 1,
    position: 1,
  }, { valueIds: upload(valueIds), groupIds: upload(groupIds) });
  assertEquals(
    [...await readU32(device, counts, bins * groupsCount)],
    [...await headless.readU32("counts")],
  );
  headless.destroy();
  device.destroy();
});
