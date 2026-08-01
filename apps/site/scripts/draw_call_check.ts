/**
 * "Did the mark actually draw?" gate (gggplot-4q2.9).
 *
 * visual_smoke.ts checks route health — canvas mounted, right size, no console
 * errors — and that is exactly the shape of failure the early 3D preview hit: every one of
 * those signals stayed green while the 3D layer drew nothing at all. Pixels
 * can't close the gap either: headless Chromium composites a WebGPU canvas as
 * blank even for charts that demonstrably render.
 *
 * So this gate asks the GPU instead. It patches the WebGPU API in-page and
 * counts draw calls per route: a route that mounts a chart and issues zero
 * draws is a failure, no matter how healthy it looks.
 *
 * Usage: deno task test:draw-calls   (add --route=three-d to narrow)
 */
import { chromium } from "npm:playwright@^1.61.1";

// Routes whose charts must reach the GPU. Keep 2D and 3D here so neither
// pipeline can regress into a silent blank canvas.
const ROUTES = ["start", "three-d"];

const requestedRoute = Deno.args.find((arg) => arg.startsWith("--route="))
  ?.slice("--route=".length);
const routes = requestedRoute ? [requestedRoute] : ROUTES;

const host = "127.0.0.1";
const port = 20_000 + Math.floor(Math.random() * 20_000);
const baseUrl = `http://${host}:${port}`;

const INSTRUMENT = `
(() => {
  const stats = { draws: 0, instances: 0, pipelines: 0, passes: 0 };
  globalThis.__gggplotDrawStats = stats;
  const wrap = (proto, name, fn) => {
    if (!proto || !proto[name]) return;
    const original = proto[name];
    proto[name] = function (...args) {
      try { fn(args); } catch { /* counting must never break the page */ }
      return original.apply(this, args);
    };
  };
  const countDraw = (args) => {
    stats.draws++;
    stats.instances += Number(args[1]) || 0;
  };
  const DRAWS = ["draw", "drawIndexed", "drawIndirect", "drawIndexedIndirect"];
  if (globalThis.GPURenderPassEncoder) {
    for (const m of DRAWS) wrap(GPURenderPassEncoder.prototype, m, countDraw);
  }
  if (globalThis.GPURenderBundleEncoder) {
    for (const m of DRAWS) wrap(GPURenderBundleEncoder.prototype, m, countDraw);
  }
  if (globalThis.GPUDevice) {
    wrap(GPUDevice.prototype, "createRenderPipeline", () => stats.pipelines++);
    wrap(GPUDevice.prototype, "createRenderPipelineAsync", () => stats.pipelines++);
  }
  if (globalThis.GPUCommandEncoder) {
    wrap(GPUCommandEncoder.prototype, "beginRenderPass", () => stats.passes++);
  }
})();
`;

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
  stdout: "null",
  stderr: "inherit",
}).spawn();

const failures: string[] = [];
try {
  await waitForServer();
  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-unsafe-webgpu", "--enable-webgpu-developer-features"],
  });
  try {
    for (const route of routes) {
      // One page per route: a route's draw counts must not inherit another's.
      const page = await browser.newPage({
        viewport: { width: 1200, height: 900 },
      });
      await page.addInitScript(INSTRUMENT);
      try {
        await page.goto(`${baseUrl}/#${route}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(3000);
        const surfaces = await page.locator("[data-chart-surface]").count();
        const stats = await page.evaluate(() =>
          (globalThis as unknown as {
            __gggplotDrawStats: {
              draws: number;
              instances: number;
              pipelines: number;
              passes: number;
            };
          }).__gggplotDrawStats
        );
        console.log(
          `#${route}: surfaces=${surfaces} draws=${stats.draws} instances=${stats.instances} pipelines=${stats.pipelines} passes=${stats.passes}`,
        );
        if (surfaces && !stats.draws) {
          failures.push(
            `#${route} mounted ${surfaces} chart surface(s) but issued ZERO draw calls — the marks never reached the GPU.`,
          );
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
  await server.status;
}

if (failures.length) {
  console.error(`\nDraw-call gate failures:\n- ${failures.join("\n- ")}`);
  Deno.exit(1);
}
console.log(`\nDraw-call gate passed for ${routes.length} route(s).`);

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const response = await fetch(baseUrl, { method: "HEAD" });
      await response.body?.cancel();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("preview server never came up");
}
