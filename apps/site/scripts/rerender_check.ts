/**
 * "Does a chart survive being re-rendered?" gate (gggplot-cfe).
 *
 * The other browser gates mount a route once and inspect it. That is exactly
 * why the Grid null crash went unnoticed for so long: use.GPU memo comparators
 * only run on RE-RENDER, so a bug that throws on every re-render is invisible
 * to a gate that never triggers one. visual_smoke stayed green while every
 * grid-bearing chart threw an uncaught TypeError the moment a user touched a
 * control above it.
 *
 * So this gate re-renders on purpose: it drives the interactive controls on a
 * route and fails on any page error or console error that appears afterwards.
 *
 * Usage: deno task test:rerender   (add --route=model-inspection to narrow)
 */
import { chromium } from "npm:playwright@^1.61.1";

// Routes with a control that re-renders a chart subtree. model-inspection is
// gggplot-cfe's original repro (its tensor dropdown re-renders sibling charts).
const ROUTES = ["model-inspection"];

const requestedRoute = Deno.args.find((arg) => arg.startsWith("--route="))
  ?.slice("--route=".length);
const routes = requestedRoute ? [requestedRoute] : ROUTES;

const host = "127.0.0.1";
const port = 20_000 + Math.floor(Math.random() * 20_000);
const baseUrl = `http://${host}:${port}`;
const viewport = { width: 1400, height: 1000 };

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

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      await fetch(baseUrl);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`preview server never accepted a connection on ${baseUrl}`);
}

try {
  await waitForServer();
  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-unsafe-webgpu", "--enable-webgpu-developer-features"],
  });
  const failures: string[] = [];
  try {
    for (const route of routes) {
      const page = await browser.newPage({ viewport });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });

      await page.goto(`${baseUrl}/#${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(4000);

      // Errors present before any interaction belong to the mount path, which
      // visual_smoke already gates. Report them separately so a failure here
      // is unambiguously about re-rendering.
      const mountErrors = errors.splice(0, errors.length);

      let interactions = 0;
      for (const select of await page.locator("select").all()) {
        const options = await select.locator("option").all();
        // A handful of changes per control is enough: the comparator runs on
        // every one, so a re-render bug shows on the first.
        for (let index = 1; index < Math.min(options.length, 4); index++) {
          const value = await options[index].getAttribute("value");
          if (value === null) continue;
          await select.selectOption(value);
          await page.waitForTimeout(1200);
          interactions++;
        }
      }
      await page.waitForTimeout(2000);
      await page.close();

      if (!interactions) {
        failures.push(
          `#${route}: found no control to re-render with — this gate would ` +
            `pass vacuously, so wire one up or drop the route`,
        );
        continue;
      }
      if (mountErrors.length) {
        failures.push(
          `#${route}: ${mountErrors.length} error(s) on mount (before any ` +
            `interaction): ${mountErrors.slice(0, 3).join(" | ")}`,
        );
      }
      if (errors.length) {
        failures.push(
          `#${route}: ${errors.length} error(s) after ${interactions} ` +
            `re-render(s): ${errors.slice(0, 3).join(" | ")}`,
        );
      }
      if (!mountErrors.length && !errors.length) {
        console.log(`#${route}: clean across ${interactions} re-render(s)`);
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    throw new Error(
      `Re-render failures (${failures.length}).\n${failures.join("\n")}`,
    );
  }
  console.log(`Re-render gate passed for ${routes.length} route(s).`);
} finally {
  server.kill();
}
