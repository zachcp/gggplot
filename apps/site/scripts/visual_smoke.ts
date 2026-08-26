/**
 * Browser-level health gate for every documentation hash route.
 *
 * This deliberately tests the rendered chart surface rather than treating a
 * successful compiler pass as proof that WebGPU output is visible. Artifacts
 * are written below .artifacts/visual-smoke/ (which is gitignored) so a CI
 * failure has a route screenshot and machine-readable diagnostic beside it.
 */
import { chromium } from "npm:playwright@^1.61.1";
import { browserArgs } from "./browser_args.ts";

const host = "127.0.0.1";
// A fresh high port prevents a user's running dev server from becoming the
// target of the visual gate (or from preventing the gate from starting).
const port = 20_000 + Math.floor(Math.random() * 20_000);
const baseUrl = `http://${host}:${port}`;
const output = new URL("../.artifacts/visual-smoke/", import.meta.url);
const viewport = { width: 1440, height: 1080 };
const requestedRoute = Deno.args.find((arg) => arg.startsWith("--route="))
  ?.slice("--route=".length);

interface RouteResult {
  route: string;
  chartCount: number;
  accessibleLabels: number;
  surfaceBounds: Array<{ width: number; height: number }>;
  opaquePixels: number[];
  console: string[];
  screenshot: string | null;
}

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

try {
  await waitForServer();
  const browser = await chromium.launch({
    headless: true,
    args: browserArgs(),
  });
  try {
    if (!requestedRoute) {
      try {
        await verifyPngExport(browser);
      } catch (error) {
        // CI's software WebGPU path is expected to fail this probe today. Keep
        // that failure actionable by writing the report before rethrowing; the
        // workflow uploads this directory even when the gate exits non-zero.
        await Deno.writeTextFile(
          new URL("report.json", output),
          JSON.stringify(
            {
              baseUrl,
              viewport,
              generatedAt: new Date().toISOString(),
              results: [],
              probeError: error instanceof Error
                ? error.message
                : String(error),
            },
            null,
            2,
          ),
        );
        throw error;
      }
    }
    const discoveryPage = await browser.newPage({ viewport });
    const discovered = await discoverRoutes(discoveryPage);
    await discoveryPage.close();
    const routes = requestedRoute
      ? discovered.filter((route) => route === requestedRoute)
      : discovered;
    if (!routes.length) {
      throw new Error(`Unknown documentation route: ${requestedRoute}`);
    }
    const results: RouteResult[] = [];
    // A page owns a WebGPU canvas context. Isolating routes prevents a failed
    // mount from exhausting contexts and hiding later route-specific evidence.
    for (const route of routes) {
      results.push(await inspectRoute(browser, route));
    }
    await Deno.writeTextFile(
      new URL("report.json", output),
      JSON.stringify(
        { baseUrl, viewport, generatedAt: new Date().toISOString(), results },
        null,
        2,
      ),
    );
    if (!requestedRoute) {
      await verifyForcedFailure(browser);
      await verifyRouteLifecycle(browser);
    }
    const failures = results.flatMap((result) => {
      const problems: string[] = [];
      if (result.chartCount === 0) problems.push("no chart surfaces");
      if (result.accessibleLabels !== result.chartCount) {
        problems.push("chart surface is missing an accessible visual summary");
      }
      if (
        result.surfaceBounds.some(({ width, height }) =>
          width < 160 || height < 160
        )
      ) {
        problems.push("chart surface has an implausible layout bound");
      }
      if (result.opaquePixels.some((count) => count === 0)) {
        problems.push("chart canvas has no backing buffer");
      }
      if (!result.screenshot) {
        problems.push("could not capture route screenshot");
      }
      if (result.console.length) problems.push(result.console.join(" | "));
      return problems.length
        ? [`#${result.route}: ${problems.join("; ")}`]
        : [];
    });
    if (failures.length) {
      throw new Error(
        `Visual route-health failures (${failures.length}). See ${
          new URL("report.json", output).pathname
        }\n${failures.join("\n")}`,
      );
    }
    console.log(`Visual route-health gate passed for ${routes.length} routes.`);
  } finally {
    await browser.close();
  }
} finally {
  try {
    server.kill("SIGTERM");
  } catch {
    // A startup failure has already terminated the child; preserve its cause.
  }
  await server.status;
}

/** Exact-pixel export must leave every interactive canvas and temp host intact. */
async function verifyPngExport(browser: import("npm:playwright").Browser) {
  // Exercise the extension first, before the route-health pass has submitted
  // dozens of canvases to the shared browser GPU process.
  for (const mode of ["3d", "1"]) {
    const page = await browser.newPage({ viewport });
    try {
      await page.goto(`${baseUrl}/?export-probe=${mode}#faq`, {
        waitUntil: "networkidle",
      });
      const trigger = page.locator("#gggplot-export-probe");
      await trigger.click();
      await page.waitForFunction(
        () => {
          const node = document.querySelector("#gggplot-export-probe") as
            | HTMLElement
            | null;
          return Boolean(node?.dataset.result || node?.dataset.error);
        },
        null,
        { timeout: 35_000 },
      );
      const error = await trigger.getAttribute("data-error");
      if (error) throw new Error(`PNG export probe (${mode}) failed: ${error}`);
      const raw = await trigger.getAttribute("data-result");
      const result = JSON.parse(raw ?? "null") as {
        type: string;
        dimensions: [number, number];
        signature: number[];
        before: number[][];
        after: number[][];
        leakedHosts: number;
      } | null;
      if (
        !result || result.type !== "image/png" ||
        result.dimensions[0] !== 320 || result.dimensions[1] !== 200 ||
        result.signature.join(",") !== "137,80,78,71,13,10,26,10" ||
        JSON.stringify(result.before) !== JSON.stringify(result.after) ||
        result.leakedHosts !== 0
      ) {
        throw new Error(`Invalid PNG export probe (${mode}) result: ${raw}`);
      }
    } finally {
      await page.close();
    }
  }
}

/** A deliberately thrown chart error must not remove the surrounding docs UI. */
async function verifyForcedFailure(browser: import("npm:playwright").Browser) {
  const page = await browser.newPage({ viewport });
  try {
    await page.goto(`${baseUrl}/?forceChartFailure#start`, {
      waitUntil: "networkidle",
    });
    const [errors, examples, dslPanels] = await Promise.all([
      page.locator("[data-chart-error]").count(),
      page.locator("[data-doc-example]").count(),
      page.getByText("ggplot DSL", { exact: true }).count(),
    ]);
    if (errors !== examples || dslPanels !== examples) {
      throw new Error(
        `Forced chart failure escaped its panel (errors=${errors}, examples=${examples}, DSL=${dslPanels}).`,
      );
    }
  } finally {
    await page.close();
  }
}

/** Route changes must release old canvases instead of accumulating Live hosts. */
async function verifyRouteLifecycle(browser: import("npm:playwright").Browser) {
  const page = await browser.newPage({ viewport });
  const console: string[] = [];
  const onConsole = (message: import("npm:playwright").ConsoleMessage) => {
    if (message.type() === "error" || message.type() === "warning") {
      console.push(message.text());
    }
  };
  page.on("console", onConsole);
  try {
    for (const route of ["start", "stats", "internals", "faq", "start"]) {
      await page.goto(`${baseUrl}/#${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      const { surfaces, canvases } = await page.evaluate(() => ({
        surfaces: document.querySelectorAll("[data-chart-surface]").length,
        canvases:
          document.querySelectorAll("[data-chart-surface] canvas").length,
      }));
      if (!surfaces || canvases !== surfaces) {
        throw new Error(
          `Route ${route} leaked or lost chart canvases (surfaces=${surfaces}, canvases=${canvases}).`,
        );
      }
    }
    const fatal = console.filter((message) =>
      /Cannot get WebGPU Canvas context|device lost|createBuffer/i.test(message)
    );
    if (fatal.length) {
      throw new Error(`Route lifecycle WebGPU errors: ${fatal.join(" | ")}`);
    }
  } finally {
    page.off("console", onConsole);
    await page.close();
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for the Vite preview server.");
}

async function discoverRoutes(
  page: import("npm:playwright").Page,
): Promise<string[]> {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  // Hash slugs are declared by the app and represent every docs route. Read
  // them from its route-link contract instead of maintaining a second list.
  const slugs = await page.locator("[data-doc-route-link]").evaluateAll((
    buttons,
  ) =>
    buttons.map((button) => button.getAttribute("data-doc-route-link")).filter(
      Boolean,
    )
  ) as string[];
  if (!slugs.length || new Set(slugs).size !== slugs.length) {
    throw new Error("Could not enumerate unique documentation hash routes.");
  }
  return slugs;
}

async function inspectRoute(
  browser: import("npm:playwright").Browser,
  route: string,
): Promise<RouteResult> {
  const page = await browser.newPage({ viewport });
  const console: string[] = [];
  const onConsole = (message: import("npm:playwright").ConsoleMessage) => {
    if (message.type() === "error" || message.type() === "warning") {
      console.push(message.text());
    }
  };
  page.on("console", onConsole);
  try {
    await page.goto(`${baseUrl}/#${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(750);
    const surfaceState = await page.locator("[data-chart-surface]").evaluateAll(
      (surfaces) =>
        surfaces.map((surface) => {
          const box = surface.getBoundingClientRect();
          return {
            width: Math.round(box.width),
            height: Math.round(box.height),
            // A chart surface must be named, and must carry a role that
            // describes what it actually is. "img" suits a static 2D plot:
            // it is a leaf in the accessibility tree, which is correct when
            // there is nothing inside to reach. The 3D surface is NOT that —
            // it holds orbit/pan/zoom affordances and a real Reset camera
            // button — and role="img" would prune those from the tree
            // entirely. So "group" is the right role there, and this gate
            // accepts both rather than forcing an accessibility regression to
            // satisfy itself (gggplot-5xq).
            accessible: ["img", "group"].includes(
              surface.getAttribute("role") ?? "",
            ) && Boolean(surface.getAttribute("aria-label")?.trim()),
          };
        }),
    );
    const surfaceBounds = surfaceState.map(({ width, height }) => ({
      width,
      height,
    }));
    const accessibleLabels = surfaceState.filter(({ accessible }) =>
      accessible
    ).length;
    // A WebGPU canvas deliberately refuses a 2D context, so getImageData()
    // reports a false transparent surface. Its backing-buffer dimensions are
    // the portable route-health signal; screenshots remain the visual artifact.
    const opaquePixels = await page.locator("[data-chart-surface] canvas")
      .evaluateAll((canvases) =>
        canvases.map((node) => {
          const canvas = node as HTMLCanvasElement;
          return canvas.width * canvas.height;
        })
      );
    const screenshotPath = new URL(`${route}.png`, output).pathname;
    let screenshot: string | null = screenshotPath;
    let screenshotError: unknown;
    // Full-page captures of documentation routes with dozens of live canvases
    // can stall Chrome before the report is written. The gate's fixed viewport
    // is its deterministic visual contract. Chrome can also reject one capture
    // while it finishes a font/GPU submission, so retry the same fixed surface.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await page.screenshot({ path: screenshotPath, fullPage: false });
        screenshotError = undefined;
        break;
      } catch (error) {
        screenshotError = error;
        await page.waitForTimeout(250);
      }
    }
    if (screenshotError) {
      try {
        // Some Chrome/WebGPU combinations reject a page-sized capture after a
        // busy route has submitted several canvases. The first chart surface
        // is the gate's primary visual subject and remains a route artifact.
        await page.locator("[data-chart-surface]").first().screenshot({
          path: screenshotPath,
        });
        screenshotError = undefined;
      } catch (error) {
        screenshotError = error;
      }
    }
    if (screenshotError) {
      screenshot = null;
      console.push(
        `Screenshot capture failed after retry: ${String(screenshotError)}`,
      );
    }
    return {
      route,
      chartCount: surfaceBounds.length,
      accessibleLabels,
      surfaceBounds,
      opaquePixels,
      console,
      screenshot,
    };
  } finally {
    page.off("console", onConsole);
    await page.close();
  }
}
