/**
 * gggplot-tzc.8's dedicated instrumented-route driver: mirrors
 * visual_smoke.ts's server-spawn/headless-Chromium-with-WebGPU pattern, but
 * drives apps/site/src/InstrumentProbe.tsx (mounted at /?instrument) instead
 * of the docs app, and asserts the epic's GPU mark-data upload acceptance
 * scenario instead of visual route health:
 *   (i)  N re-renders of an UNCHANGED spec -> zero NEW mark-data buffer
 *        creations/writes.
 *   (ii) a linear-scale x-domain change (gggplot-tzc.7) -> the SAME zeros,
 *        while total (unattributed) buffer activity is allowed to be
 *        nonzero (a uniform/view write for the changed Cartesian range is
 *        legitimate and must NOT be attributed to mark data).
 * Results are written to .artifacts/visual-smoke/gpu-instrument-report.json
 * alongside visual_smoke.ts's own artifacts.
 */
import { chromium } from "npm:playwright@^1.61.1";
import { browserArgs } from "./browser_args.ts";

const host = "127.0.0.1";
const port = 20_000 + Math.floor(Math.random() * 20_000);
const baseUrl = `http://${host}:${port}`;
const output = new URL("../.artifacts/visual-smoke/", import.meta.url);

await Deno.mkdir(output, { recursive: true });
const server = new Deno.Command(Deno.execPath(), {
  args: [
    "run",
    "-A",
    "npm:vite",
    "preview",
    "--host",
    host,
    "--port",
    String(port),
    "--strictPort",
  ],
  cwd: new URL("../", import.meta.url).pathname,
  stdout: "inherit",
  stderr: "inherit",
}).spawn();

interface Counters {
  markBufferCreations: number;
  markBufferWrites: number;
  totalBufferCreations: number;
  totalBufferWrites: number;
}

interface ProbeResult {
  rerenderCount: number;
  afterUnchangedRerenders: Counters;
  afterDomainChange: Counters;
}

try {
  await waitForServer();
  const browser = await chromium.launch({
    headless: true,
    args: browserArgs(),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 640, height: 480 },
    });
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (Deno.env.get("GGGPLOT_DEBUG_CONSOLE")) {
        console.log(`[page ${message.type()}] ${message.text()}`);
      }
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    try {
      await page.goto(`${baseUrl}/?instrument`, { waitUntil: "networkidle" });
      // Let the WebGPU device/canvas/GGPlot fully mount before invoking the
      // probe — the probe itself also polls for window.__gggplotGpuInstrument,
      // but a settled frame first keeps the FIRST measurement window clean of
      // initial-mount buffer activity.
      await page.waitForTimeout(1000);
      const result = await page.evaluate(async () => {
        const probe = (window as unknown as {
          __gggplotInstrumentProbe?: () => Promise<ProbeResult>;
        }).__gggplotInstrumentProbe;
        if (!probe) {
          throw new Error("__gggplotInstrumentProbe was not installed");
        }
        return await probe();
      }) as ProbeResult;

      await Deno.writeTextFile(
        new URL("gpu-instrument-report.json", output),
        JSON.stringify(
          {
            baseUrl,
            generatedAt: new Date().toISOString(),
            result,
            consoleErrors,
          },
          null,
          2,
        ),
      );

      const problems: string[] = [];
      const { afterUnchangedRerenders, afterDomainChange } = result;
      if (afterUnchangedRerenders.markBufferCreations !== 0) {
        problems.push(
          `unchanged re-renders created ${afterUnchangedRerenders.markBufferCreations} new mark buffer(s)`,
        );
      }
      if (afterUnchangedRerenders.markBufferWrites !== 0) {
        problems.push(
          `unchanged re-renders wrote to mark buffers ${afterUnchangedRerenders.markBufferWrites} time(s)`,
        );
      }
      if (afterDomainChange.markBufferCreations !== 0) {
        problems.push(
          `linear x-domain change created ${afterDomainChange.markBufferCreations} new mark buffer(s)`,
        );
      }
      if (afterDomainChange.markBufferWrites !== 0) {
        problems.push(
          `linear x-domain change wrote to mark buffers ${afterDomainChange.markBufferWrites} time(s)`,
        );
      }
      if (consoleErrors.length) {
        problems.push(`console errors: ${consoleErrors.join(" | ")}`);
      }

      console.log("GPU mark-data instrumentation result:");
      console.log(JSON.stringify(result, null, 2));

      if (problems.length) {
        throw new Error(
          `GPU mark-data upload gate FAILED:\n${problems.join("\n")}\nSee ${
            new URL("gpu-instrument-report.json", output).pathname
          }`,
        );
      }
      console.log(
        "\nGPU mark-data upload gate passed: zero mark-data buffer creations/writes on unchanged re-render AND on linear x-domain change.",
      );
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
} finally {
  try {
    server.kill("SIGTERM");
  } catch {
    // Startup failure already terminated the child.
  }
  await server.status;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Preview server still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for the Vite preview server.");
}
