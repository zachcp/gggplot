// vnh.16 reproducible browser experiment. Never silently skip a missing GPU.
import { chromium } from "playwright";
import { browserArgs } from "./browser_args.ts";
import { buildGate, previewArgs } from "./gate_output.ts";
import { SCALE_CAPTURE } from "./scale_binding_capture.ts";

type ProbeWindow = {
  __gggplotScaleBindingProbe?: {
    measure: () => Promise<Record<string, unknown>>;
    drawMode: (cpu: boolean) => Promise<void>;
  };
};

const host = "127.0.0.1";
const port = 20_000 + Math.floor(Math.random() * 20_000);
const baseUrl = `http://${host}:${port}`;
const output = new URL("../.artifacts/scale-binding/", import.meta.url);
await Deno.mkdir(output, { recursive: true });
await buildGate("scale-binding");
const server = new Deno.Command(Deno.execPath(), {
  args: previewArgs("scale-binding", host, port),
  cwd: new URL("../", import.meta.url).pathname,
  stdout: "inherit",
  stderr: "inherit",
}).spawn();

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      ready = (await fetch(baseUrl)).ok;
    } catch { /* server starting */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("scale-binding preview never started");
  const browser = await chromium.launch({
    headless: true,
    args: browserArgs(),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 640, height: 480 },
      deviceScaleFactor: 1,
    });
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(SCALE_CAPTURE);
    await page.goto(`${baseUrl}/?scale-binding`, { waitUntil: "networkidle" });
    await page.waitForFunction(() =>
      !!(globalThis as unknown as ProbeWindow).__gggplotScaleBindingProbe
    );
    const result = await page.evaluate(() =>
      (globalThis as unknown as ProbeWindow).__gggplotScaleBindingProbe!
        .measure()
    );
    const capture = (cpu: boolean) =>
      page.evaluate(async (cpu) => {
        const hooks = globalThis as unknown as {
          __beginScaleCapture: () => void;
          __readScaleCapture: () => Promise<string>;
        };
        hooks.__beginScaleCapture();
        await (globalThis as unknown as ProbeWindow).__gggplotScaleBindingProbe!
          .drawMode(cpu);
        return await hooks.__readScaleCapture();
      }, cpu);
    const gpu = await capture(false);
    const cpu = await capture(true);
    for (const [name, url] of [["gpu", gpu], ["cpu", cpu]]) {
      await Deno.writeFile(
        new URL(`${name}.png`, output),
        Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0)),
      );
    }
    const pixels = await page.evaluate(async ([gpuUrl, cpuUrl]) => {
      const decode = async (url: string) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const [a, b] = await Promise.all([decode(gpuUrl), decode(cpuUrl)]);
      let changed = 0, visible = 0, maxDifference = 0, fixedGreen = 0;
      for (let i = 0; i < a.length; i += 4) {
        const diff = Math.max(
          ...[0, 1, 2].map((c) => Math.abs(a[i + c] - b[i + c])),
        );
        if (diff > 1) changed++;
        if (Math.min(a[i], a[i + 1], a[i + 2]) < 245) visible++;
        if (a[i + 1] > a[i] + 40 && a[i + 1] > a[i + 2] + 20) fixedGreen++;
        maxDifference = Math.max(maxDifference, diff);
      }
      return {
        changed,
        maxDifference,
        visibleFraction: visible / (a.length / 4),
        pixels: a.length / 4,
        fixedGreen,
      };
    }, [gpu, cpu]);
    const report = {
      generatedAt: new Date().toISOString(),
      result,
      pixels,
      errors,
    };
    await Deno.writeTextFile(
      new URL("report.json", output),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(
      {
        pixels,
        errors,
        phases: (result.phases as Record<string, unknown>[]).map((
          { cases: samples, ...phase },
        ) => ({
          ...phase,
          cases: Object.fromEntries(
            Object.entries(
              samples as Record<string, { revision: number; maxError: number }>,
            ).map((
              [name, sample],
            ) => [name, {
              revision: sample.revision,
              maxError: sample.maxError,
            }]),
          ),
        })),
      },
      null,
      2,
    ));
    const phases = result.phases as {
      revision: number;
      newMounts: number;
      newScaleBundles: number;
      newPipelines: number;
      newShaderModules: number;
      guideRenders: number;
      guideRevision: number;
      counters: { markBufferCreations: number; markBufferWrites: number };
      cases: Record<string, { maxError: number; revision: number }>;
    }[];
    for (const phase of phases) {
      if (
        phase.newMounts || phase.newScaleBundles || phase.newPipelines ||
        phase.newShaderModules ||
        phase.counters.markBufferCreations || phase.counters.markBufferWrites
      ) {
        throw new Error(
          `revision ${phase.revision} rebuilt bindings or uploaded mark data`,
        );
      }
      if (phase.guideRevision !== phase.revision || phase.guideRenders !== 1) {
        throw new Error(
          "CPU guide did not observe exactly one committed revision",
        );
      }
      for (const [name, sample] of Object.entries(phase.cases)) {
        if (
          sample.revision !== phase.revision ||
          !Number.isFinite(sample.maxError) || sample.maxError > 1e-5
        ) throw new Error(`${name}: CPU/GPU scale mismatch ${sample.maxError}`);
      }
    }
    if (pixels.visibleFraction < 0.03) {
      throw new Error("GPU marks are blank or unexpectedly sparse");
    }
    if (pixels.fixedGreen < 100) {
      throw new Error("fixed-color shader point did not render green");
    }
    if (pixels.changed !== 0) {
      throw new Error(
        `CPU/GPU rendering differs in ${pixels.changed} pixels by more than 1/255`,
      );
    }
    if (errors.length) {
      throw new Error(`browser GPU errors: ${errors.join(" | ")}`);
    }
    console.log(
      "Scale-binding spike passed: stable bundles, zero mark uploads, CPU/GPU value and pixel parity, CPU revision notification.",
    );
  } finally {
    await browser.close();
  }
} finally {
  try {
    server.kill("SIGTERM");
  } catch { /* already stopped */ }
  await server.status;
}
