// What WebGPU the gate browser actually gets, independent of gggplot.
//
//   deno run -A scripts/webgpu_probe.ts [--rounds N]
//
// Launches Chromium with the same flags as every browser gate (browser_args.ts)
// and, in a plain page, logs the adapter (vendor, architecture, fallback flag,
// limits), then runs a render pass into a canvas, a readback of that canvas
// texture, a mappedAtCreation buffer and a compute pass, round after round, watching device.lost and the
// page/GPU process for a crash. It exits non-zero if any of that fails.
//
// Why it exists (gggplot-w760): on GitHub's GPU-less runners every gate failed
// with "A valid external Instance reference no longer exists" and
// "createBuffer failed, size (40) is too large ... mappedAtCreation". Both are
// what Dawn's wire client reports once its connection to the GPU process is
// gone, so they say nothing about gggplot. This probe separates "the browser
// has no working WebGPU" from "gggplot broke", and the CI job runs it first so
// a failed gate can be read against it.
import { chromium } from "playwright";
import { browserArgs } from "./browser_args.ts";

const roundsFlag = Deno.args.indexOf("--rounds");
const rounds = roundsFlag >= 0 ? Number(Deno.args[roundsFlag + 1]) : 5;

// navigator.gpu needs a secure context, which a data: URL is not.
const server = Deno.serve(
  { hostname: "127.0.0.1", port: 0, onListen: () => {} },
  () =>
    new Response("<!doctype html><title>probe</title>", {
      headers: { "content-type": "text/html" },
    }),
);
const url = `http://127.0.0.1:${server.addr.port}/`;

type RoundResult = { round: number; ok: boolean; detail: string };
type ProbeResult = {
  adapter: Record<string, unknown> | null;
  error?: string;
  rounds: RoundResult[];
  lost: string | null;
};

const failures: string[] = [];
const args = browserArgs();
console.log(
  `WebGPU probe: args=${args.join(" ")}`,
);
const browser = await chromium.launch({ headless: true, args });
let closing = false;
browser.on("disconnected", () => {
  if (!closing) failures.push("browser disconnected");
});
try {
  console.log(`Browser ${browser.version()}`);
  const page = await browser.newPage();
  page.on("crash", () => failures.push("page crashed"));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      console.log(`  [console.${message.type()}] ${message.text()}`);
    }
  });
  await page.goto(url);
  const result: ProbeResult = await page.evaluate(async (rounds) => {
    const out: ProbeResult = { adapter: null, rounds: [], lost: null };
    // Deno's lib has the WebGPU types but not these flag namespaces.
    const flags = globalThis as unknown as Record<
      "GPUBufferUsage" | "GPUTextureUsage" | "GPUMapMode",
      Record<string, number>
    >;
    const BUF = flags.GPUBufferUsage, TEX = flags.GPUTextureUsage;
    const MAP = flags.GPUMapMode;
    const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
    if (!gpu) return { ...out, error: "navigator.gpu is undefined" };
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { ...out, error: "requestAdapter() returned null" };
    const info = adapter.info;
    const limits = adapter.limits;
    out.adapter = {
      vendor: info.vendor,
      architecture: info.architecture,
      device: info.device,
      description: info.description,
      isFallbackAdapter:
        (info as GPUAdapterInfo & { isFallbackAdapter?: boolean })
          .isFallbackAdapter,
      features: [...adapter.features].sort().join(","),
      maxBufferSize: limits.maxBufferSize,
      maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
      maxTextureDimension2D: limits.maxTextureDimension2D,
      maxComputeWorkgroupSizeX: limits.maxComputeWorkgroupSizeX,
    };
    const device = await adapter.requestDevice();
    device.lost.then((l) => {
      out.lost = `${l.reason}: ${l.message}`;
    });
    const errors: string[] = [];
    device.addEventListener("uncapturederror", (e) => {
      errors.push((e as GPUUncapturedErrorEvent).error.message);
    });

    const size = 64;
    const shader = device.createShaderModule({
      code: `
        @vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
          let p = array(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
          return vec4f(p[i], 0, 1);
        }
        @fragment fn fs() -> @location(0) vec4f { return vec4f(1, 0.5, 0, 1); }
        @group(0) @binding(0) var<storage, read_write> data: array<u32>;
        @compute @workgroup_size(64) fn cs(@builtin(global_invocation_id) id: vec3u) {
          data[id.x] = id.x * 3u;
        }`,
    });
    const render = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: shader, entryPoint: "vs" },
      fragment: {
        module: shader,
        entryPoint: "fs",
        targets: [{ format: "rgba8unorm" }],
      },
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    document.body.append(canvas);
    const context = canvas.getContext("webgpu") as GPUCanvasContext;
    context.configure({
      device,
      format: "rgba8unorm",
      usage: TEX.RENDER_ATTACHMENT | TEX.COPY_SRC,
      alphaMode: "premultiplied",
    });
    const compute = device.createComputePipeline({
      layout: "auto",
      compute: { module: shader, entryPoint: "cs" },
    });

    for (let round = 0; round < rounds; round++) {
      try {
        // The exact call that failed in CI: a tiny mappedAtCreation buffer.
        const uniform = device.createBuffer({
          size: 40,
          usage: BUF.UNIFORM,
          mappedAtCreation: true,
        });
        uniform.unmap();

        // A canvas swap-chain texture, not an offscreen one: in CI the
        // adapter and offscreen passes worked while every chart died, because
        // the swap chain needs a shared image the GL-less GPU process could
        // not make.
        const texture = context.getCurrentTexture();
        const pixels = device.createBuffer({
          size: size * size * 4,
          usage: BUF.COPY_DST | BUF.MAP_READ,
        });
        const storage = device.createBuffer({
          size: 256 * 4,
          usage: BUF.STORAGE | BUF.COPY_SRC,
        });
        const readback = device.createBuffer({
          size: 256 * 4,
          usage: BUF.COPY_DST | BUF.MAP_READ,
        });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: texture.createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: [0, 0, 0, 0],
          }],
        });
        pass.setPipeline(render);
        pass.draw(3);
        pass.end();
        encoder.copyTextureToBuffer({ texture }, {
          buffer: pixels,
          bytesPerRow: size * 4,
        }, [size, size]);
        const cpass = encoder.beginComputePass();
        cpass.setPipeline(compute);
        cpass.setBindGroup(
          0,
          device.createBindGroup({
            layout: compute.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: storage } }],
          }),
        );
        cpass.dispatchWorkgroups(4);
        cpass.end();
        encoder.copyBufferToBuffer(storage, 0, readback, 0, 256 * 4);
        device.queue.submit([encoder.finish()]);

        await Promise.all([
          pixels.mapAsync(MAP.READ),
          readback.mapAsync(MAP.READ),
        ]);
        const px = new Uint8Array(pixels.getMappedRange());
        const words = new Uint32Array(readback.getMappedRange());
        const pixelOk = px[0] === 255 && px[1] >= 127 && px[1] <= 128 &&
          px[2] === 0 && px[3] === 255;
        const computeOk = words[255] === 765;
        const detail = `pixel=${px.slice(0, 4).join(",")} compute[255]=${
          words[255]
        }${errors.length ? ` errors=${errors.join(" | ")}` : ""}`;
        out.rounds.push({ round, ok: pixelOk && computeOk, detail });
        for (const b of [pixels, readback, storage, uniform]) b.destroy();
      } catch (error) {
        out.rounds.push({
          round,
          ok: false,
          detail: error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error),
        });
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return out;
  }, rounds);

  if (result.adapter) {
    for (const [key, value] of Object.entries(result.adapter)) {
      console.log(`  ${key}: ${value}`);
    }
  }
  if (result.error) failures.push(result.error);
  for (const r of result.rounds) {
    console.log(`  round ${r.round}: ${r.ok ? "ok" : "FAIL"} ${r.detail}`);
    if (!r.ok) failures.push(`round ${r.round}: ${r.detail}`);
  }
  if (result.lost) failures.push(`device lost: ${result.lost}`);
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  closing = true;
  await browser.close().catch(() => {});
  await server.shutdown();
}

if (failures.length) {
  console.error(`WebGPU probe FAILED:\n  ${failures.join("\n  ")}`);
  Deno.exit(1);
}
console.log(`WebGPU probe passed (${rounds} rounds).`);
