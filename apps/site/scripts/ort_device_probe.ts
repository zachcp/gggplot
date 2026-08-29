/**
 * "Can ORT and useGPU share a WebGPU device?" probe (gggplot-i5m.22).
 *
 * runtime-shared tensor ownership is only reachable if an ONNX Runtime Web
 * output buffer lives on the SAME GPUDevice as the useGPU renderer — WebGPU
 * buffers cannot cross devices. The negotiation rules in
 * packages/model-inspect/src/runtime.ts are exercised headlessly against a
 * fixture adapter, but no unit test can answer this question: it needs a real
 * device, a real session, and a real output buffer.
 *
 * The direction is forced. useGPU's WebGPU component always creates its own
 * device and offers no injection prop, so ORT is the side that must adopt.
 * ORT documents `env.webgpu.device` as settable before the first session.
 *
 * MEASURED 2026-08-25 against onnxruntime-web 1.27.0: the setter registers and
 * is then silently discarded during session initialization. Nothing throws;
 * the only objection comes from WebGPU when another device touches the buffer.
 * See docs/MODEL_INSPECTION_PLAN.md.
 *
 * Re-run this on an ORT upgrade rather than re-deriving the result. It exits
 * non-zero only if it cannot complete the probe — a DIFFERENT device is the
 * currently expected outcome, and is reported, not failed.
 *
 * Runs against the DEV server: vite.config.ts serves ORT's wasm helpers under
 * /ort/ in dev unconditionally, while the production copy is skipped unless the
 * bundle references ORT.
 *
 * Usage: deno task test:ort-device
 */
import { chromium } from "playwright";
import { browserArgs } from "./browser_args.ts";

const host = "127.0.0.1";
const port = 20_000 + Math.floor(Math.random() * 20_000);
const baseUrl = `http://${host}:${port}`;

const server = new Deno.Command(Deno.execPath(), {
  args: [
    "run",
    "-A",
    "npm:vite",
    "--host",
    host,
    "--port",
    String(port),
    "--strictPort",
  ],
  cwd: new URL("../", import.meta.url).pathname,
  stdout: "null",
  stderr: "inherit",
}).spawn();

async function waitForServer() {
  for (let attempt = 0; attempt < 180; attempt++) {
    try {
      const response = await fetch(baseUrl);
      if (response.status < 500) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`dev server never accepted a connection on ${baseUrl}`);
}

/** Runs in the page: WebGPU and ORT live there, not in Deno. */
const PROBE = `
async () => {
  const out = { steps: [] };
  const log = (k, v) => out.steps.push(k + ": " + v);
  try {
    if (!navigator.gpu) return { fatal: "navigator.gpu missing" };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { fatal: "no WebGPU adapter" };
    const ourDevice = await adapter.requestDevice();
    log("ourDevice", "created");

    const ort = await import("/@id/onnxruntime-web/webgpu");
    log("ort", "imported, common " + (ort.env?.versions?.common ?? "?"));

    ort.env.wasm.wasmPaths = "/ort/";
    ort.env.webgpu.device = ourDevice;
    log("device injected", "assigned before any session exists");

    // Distinguishes "setter ignored" from "backend replaced it later".
    const readBack = await ort.env.webgpu.device;
    log("readback before session", readBack === ourDevice ? "SAME" : "DIFFERENT");

    const session = await ort.InferenceSession.create("/models/mnist-12.onnx", {
      executionProviders: ["webgpu"],
      preferredOutputLocation: "gpu-buffer",
    });
    log("session", "created, outputs=" + JSON.stringify(session.outputNames));

    const after = await ort.env.webgpu.device;
    log("device after session", after === ourDevice ? "SAME" : "DIFFERENT");

    const input = new ort.Tensor("float32", new Float32Array(1 * 1 * 28 * 28), [1, 1, 28, 28]);
    const feeds = {};
    feeds[session.inputNames[0]] = input;
    const result = await session.run(feeds);
    const tensor = result[session.outputNames[0]];
    log("output location", String(tensor.location));

    const buffer = tensor.gpuBuffer ?? (tensor.getGpuBuffer ? tensor.getGpuBuffer() : undefined);
    if (!buffer) {
      log("gpuBuffer", "none");
      out.error = "ORT returned no accessible GPU buffer; device sharing was not tested";
      return out;
    }
    log("gpuBuffer", "size=" + buffer.size + " usage=0x" + buffer.usage.toString(16));

    // The decisive test. Identity comparison can be fooled by module
    // duplication; WebGPU validation cannot.
    ourDevice.pushErrorScope("validation");
    const dst = ourDevice.createBuffer({ size: buffer.size, usage: 0x0008 | 0x0001 });
    const encoder = ourDevice.createCommandEncoder();
    let copyFailure;
    try {
      encoder.copyBufferToBuffer(buffer, 0, dst, 0, buffer.size);
      ourDevice.queue.submit([encoder.finish()]);
    } catch (e) {
      copyFailure = String(e).slice(0, 140);
      log("cross-device copy", "threw " + copyFailure);
    }
    const error = await ourDevice.popErrorScope();
    if (copyFailure) {
      out.error = "device-sharing copy threw before validation completed: " + copyFailure;
      return out;
    }
    log(
      "shared path",
      error
        ? "UNAVAILABLE — " + error.message.split("\\n")[0]
        : "AVAILABLE — our device accepted ORT's buffer",
    );
    out.shared = !error;
    out.ok = true;
    return out;
  } catch (e) {
    out.error = String(e && e.stack ? e.stack.split("\\n").slice(0, 4).join(" | ") : e);
    return out;
  }
}
`;

try {
  await waitForServer();
  const browser = await chromium.launch({
    headless: true,
    args: browserArgs(),
  });
  try {
    const page = await browser.newPage();
    // ORT's wasm is large; give the SPA time to settle before evaluating.
    await page.goto(`${baseUrl}/#faq`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    const result = await page.evaluate(`(${PROBE})()`) as {
      steps?: string[];
      error?: string;
      fatal?: string;
      shared?: boolean;
      ok?: boolean;
    };
    for (const step of result.steps ?? []) console.log("  " + step);
    if (result.fatal) throw new Error(`probe could not start: ${result.fatal}`);
    if (result.error) throw new Error(`probe failed: ${result.error}`);
    if (!result.ok || typeof result.shared !== "boolean") {
      throw new Error("probe completed without a device-sharing verdict");
    }
    console.log(
      result.shared
        ? "\nruntime-shared IS reachable — update MODEL_INSPECTION_PLAN.md."
        : "\nruntime-shared is NOT reachable; runtime-copy-on-demand stands. " +
          "This is the expected result as of onnxruntime-web 1.27.0.",
    );
  } finally {
    await browser.close();
  }
} finally {
  try {
    server.kill("SIGTERM");
  } catch {
    // Preserve an earlier startup/runtime failure if Vite already exited.
  }
  await server.status;
}
