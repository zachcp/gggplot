/**
 * Deploy-base gate: build the docs under a project subpath and prove nothing
 * still asks for an asset at the domain root.
 *
 * The visual gate (visual_smoke.ts) serves at `/`, where a root-absolute asset
 * URL resolves by accident. The docs ship to GitHub Pages under `/gggplot/`,
 * so those same URLs 404 there. That gap let gggplot-a0i ship: fonts, CSVs and
 * ONNX fixtures all 404'd, `@use-gpu/glyph`'s Rust TTF parser panicked on the
 * HTML error page it got instead of a font, and the panic unwound leaving its
 * wasm-bindgen RefCell borrowed — surfacing on every later call as "recursive
 * use of an object detected which would lead to unsafe aliasing in rust".
 * Whole sections rendered as "Chart renderer failed" behind a green gate.
 *
 * The check that would have caught it is cheap and does not need pixels: serve
 * under a non-root base and assert no 4xx and no chart error boundary. The base
 * used here only has to differ from `/`; it is not tied to the deployed name.
 */
import { chromium } from "playwright";
import { browserArgs } from "./browser_args.ts";
import { buildGate, previewArgs } from "./gate_output.ts";

const host = "127.0.0.1";
const port = 20_000 + Math.floor(Math.random() * 20_000);
/** Any non-root base exercises the same resolution path the deploy uses. */
const base = "/gggplot/";
const origin = `http://${host}:${port}`;
const baseUrl = `${origin}${base.replace(/\/$/, "")}`;
const viewport = { width: 1440, height: 1080 };

// Its own directory, like every other gate (gggplot-8au).
await buildGate("base-path", [`--base=${base}`]);

const server = new Deno.Command(Deno.execPath(), {
  args: previewArgs("base-path", host, port, [`--base=${base}`]),
  cwd: new URL("../", import.meta.url).pathname,
  stdout: "inherit",
  stderr: "inherit",
}).spawn();

interface Failure {
  route: string;
  kind: "request" | "chart";
  detail: string;
}

/**
 * Whether the browser runs on a software WebGPU adapter: CI sets
 * GGGPLOT_CHROMIUM_ARGS to SwiftShader flags (browser_args.ts), local runs use
 * the real GPU and leave it unset.
 */
const softwareAdapter = (Deno.env.get("GGGPLOT_CHROMIUM_ARGS") ?? "").includes(
  "swiftshader",
);

/**
 * A chart that failed because a WebGPU call itself failed, not because an
 * asset was missing (gggplot-4tq2).
 *
 * This gate is blocking because it is meant to be immune to SwiftShader: it
 * asserts on status codes and on the error boundary that a bad asset trips
 * (gggplot-a0i: a 404'd font panics glyph's Rust TTF parser, and every later
 * call reports "recursive use of an object"). But on some CI runs the
 * SwiftShader GPU process cannot back a buffer at all, and every chart's
 * boundary reads "Failed to execute 'createBuffer' on 'GPUDevice': ... too
 * large for the implementation when mappedAtCreation == true" for a 40-byte
 * buffer, on unchanged code. That is the adapter, so on a software adapter it
 * is reported, not failed. Anything else in a boundary still fails the gate,
 * and so does every 4xx: an asset under the wrong base is caught either way.
 */
function isGpuDeviceFailure(detail: string): boolean {
  return /Failed to execute '\w+' on 'GPU\w+'/.test(detail) ||
    /is invalid due to a previous error/.test(detail) ||
    /A valid external Instance reference no longer exists/.test(detail) ||
    /\bdevice (?:was )?lost\b/i.test(detail);
}

try {
  await waitForServer();
  const browser = await chromium.launch({
    headless: true,
    args: browserArgs(),
  });
  const failures: Failure[] = [];
  const gpuWarnings: Failure[] = [];
  try {
    const discoveryPage = await browser.newPage({ viewport });
    const routes = await discoverRoutes(discoveryPage);
    await discoveryPage.close();
    if (!routes.length) throw new Error("No documentation routes discovered.");

    // One page per route: a route that exhausts its WebGPU context must not
    // mask the next route's asset requests.
    for (const route of routes) {
      const page = await browser.newPage({ viewport });
      // Record failed responses at the network layer. A 404 that source code
      // swallows is still the defect, so this must not rely on app reporting.
      page.on("response", (response) => {
        const status = response.status();
        if (status >= 400) {
          failures.push({
            route,
            kind: "request",
            detail: `${status} ${response.url()}`,
          });
        }
      });
      page.on("requestfailed", (request) => {
        failures.push({
          route,
          kind: "request",
          detail: `failed ${request.url()}`,
        });
      });
      try {
        await page.goto(`${baseUrl}/#${route}`, { waitUntil: "networkidle" });
        // Fonts and datasets are fetched after mount; networkidle can settle
        // before the wasm panic has propagated to an error boundary.
        await page.waitForTimeout(1_500);
        const errors = await page.locator("[data-chart-error]").allInnerTexts();
        for (const text of errors) {
          const detail = text.replace(/\s+/g, " ").trim();
          if (softwareAdapter && isGpuDeviceFailure(detail)) {
            gpuWarnings.push({ route, kind: "chart", detail });
            continue;
          }
          failures.push({ route, kind: "chart", detail });
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  if (gpuWarnings.length) {
    console.warn(
      `Base-path gate: ${gpuWarnings.length} chart(s) failed on the software ` +
        `WebGPU adapter, not on an asset (gggplot-4tq2). Not counted:`,
    );
    for (const warning of gpuWarnings) {
      console.warn(`  [gpu] ${warning.route}: ${warning.detail}`);
    }
  }

  if (failures.length) {
    for (const failure of failures) {
      console.error(`  [${failure.kind}] ${failure.route}: ${failure.detail}`);
    }
    throw new Error(
      `Base-path gate failed under ${base}: ${failures.length} problem(s). ` +
        `Asset URLs must resolve through assetUrl() so they follow the ` +
        `deployment base rather than the domain root.`,
    );
  }
  console.log(`Base-path gate passed under ${base}.`);
} finally {
  server.kill("SIGTERM");
  await server.status;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(baseUrl + "/");
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for the Vite preview server.");
}

async function discoverRoutes(
  page: import("playwright").Page,
): Promise<string[]> {
  await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
  const slugs = await page.locator("[data-doc-route-link]").evaluateAll((
    buttons,
  ) =>
    buttons
      .map((button) => button.getAttribute("data-doc-route-link"))
      .filter((slug): slug is string => Boolean(slug))
  );
  return [...new Set(slugs)];
}
