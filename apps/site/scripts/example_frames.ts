// Capture doc examples' swap-chain frames, or compare two captured sets.
//
//   deno run -A scripts/example_frames.ts capture <outDir> <ExampleId>...
//   deno run -A scripts/example_frames.ts capture-component <outDir> <ExampleId>...
//   deno run -A scripts/example_frames.ts capture-chart <outDir> <ExampleId>...
//   deno run -A scripts/example_frames.ts compare <dirA> <dirB>
//   deno run -A scripts/example_frames.ts check-goldens <goldenDir>
//
// For refactors that must not change output: capture before, capture after,
// compare. Each example mounts alone on a 640x400 canvas (?capture=<id>), and a
// frame is taken once the canvas has stopped redrawing.
import { chromium, type Page } from "playwright";
import { browserArgs } from "./browser_args.ts";
import { buildGate, previewArgs } from "./gate_output.ts";
import { SCALE_CAPTURE } from "./scale_binding_capture.ts";

type CaptureWindow = {
  __beginScaleCapture: () => void;
  __readScaleCapture: () => Promise<string>;
};

const [mode, ...rest] = Deno.args;

async function withBrowser<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({
    headless: true,
    args: browserArgs(),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 800, height: 600 },
      deviceScaleFactor: 1,
    });
    await page.addInitScript(SCALE_CAPTURE);
    // Capture from the very first frame: rendering is on-demand, so a chart
    // that has settled by the time the page is idle draws nothing more.
    await page.addInitScript(() =>
      (globalThis as unknown as CaptureWindow).__beginScaleCapture()
    );
    return await fn(page);
  } finally {
    await browser.close();
  }
}

const decodePixels = (page: Page, a: string, b: string) =>
  page.evaluate(async ([aUrl, bUrl]) => {
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
    const [x, y] = await Promise.all([decode(aUrl), decode(bUrl)]);
    if (x.length !== y.length) return { changed: -1, maxDifference: -1 };
    let changed = 0, maxDifference = 0;
    for (let i = 0; i < x.length; i += 4) {
      const d = Math.max(
        ...[0, 1, 2].map((c) => Math.abs(x[i + c] - y[i + c])),
      );
      if (d > 1) changed++;
      maxDifference = Math.max(maxDifference, d);
    }
    return { changed, maxDifference };
  }, [a, b]);

const dataUrl = (bytes: Uint8Array) =>
  "data:image/png;base64," +
  btoa(Array.from(bytes, (c) => String.fromCharCode(c)).join(""));

/** Captures each example's settled frame into `outDir`; returns the ids missed. */
async function captureFrames(
  ids: readonly string[],
  outDir: string,
  pathQuery: string,
): Promise<string[]> {
  const missed: string[] = [];
  await Deno.mkdir(outDir, { recursive: true });
  await buildGate("frames");
  const host = "127.0.0.1";
  const port = 20_000 + Math.floor(Math.random() * 20_000);
  const server = new Deno.Command(Deno.execPath(), {
    args: previewArgs("frames", host, port),
    cwd: new URL("../", import.meta.url).pathname,
    stdout: "null",
    stderr: "null",
  }).spawn();
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`http://${host}:${port}`)).ok) break;
      } catch { /* starting */ }
      await new Promise((r) => setTimeout(r, 100));
    }
    await withBrowser(async (page) => {
      for (const id of ids) {
        await page.goto(`http://${host}:${port}/?capture=${id}${pathQuery}`, {
          waitUntil: "networkidle",
        });
        // The newest frame is kept; once the chart settles it is final.
        await page.waitForTimeout(6000);
        let url: string;
        try {
          url = await page.evaluate(() =>
            (globalThis as unknown as CaptureWindow).__readScaleCapture()
          );
        } catch (error) {
          console.log(`NO FRAME ${id}: ${(error as Error).message}`);
          missed.push(id);
          continue;
        }
        await Deno.writeFile(
          `${outDir}/${id}.png`,
          Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0)),
        );
        console.log(`captured ${id}`);
      }
    });
  } finally {
    server.kill("SIGTERM");
    await server.status;
  }
  return missed;
}

/**
 * Glyph anti-aliasing depends on atlas packing order, which depends on mount
 * history: the same chart can differ from itself by up to ~24 per channel in
 * text pixels. Marks and grids that move or recolor differ by far more.
 */
const MAX_AA_DIFFERENCE = 32;

/** Every doc example id in the example sources (2D examples, 3D showcases). */
async function exampleIds(): Promise<string[]> {
  const docs = new URL("../src/docs/", import.meta.url);
  const ids = new Set<string>();
  for (const entry of Deno.readDirSync(docs)) {
    if (
      !/^(examples_|geom_examples_|example_3d|compose_example)/.test(entry.name)
    ) {
      continue;
    }
    const text = await Deno.readTextFile(new URL(entry.name, docs));
    for (const m of text.matchAll(/^\s+id: "([A-Z]\w*)"/gm)) ids.add(m[1]);
    for (const m of text.matchAll(/(?:Example|showcase)\("([A-Z]\w*)"/g)) {
      ids.add(m[1]);
    }
  }
  return [...ids].sort();
}

if (
  mode === "capture" || mode === "capture-component" || mode === "capture-chart"
) {
  // capture-component renders each example through the component root
  // (?capture=<id>&path=component) instead of compile().
  // capture-chart renders each example's hand-written JSX (DocExample.chart).
  const pathQuery = mode === "capture-component"
    ? "&path=component"
    : mode === "capture-chart"
    ? "&path=chart"
    : "";
  const [outDir, ...ids] = rest;
  await captureFrames(ids, outDir, pathQuery);
} else if (mode === "check-goldens") {
  // gggplot-w8zq: every doc example's JSX against the compile-path golden
  // committed before compile() was retired.
  const [goldenDir] = rest;
  const ids = await exampleIds();
  const goldens = new Set(
    [...Deno.readDirSync(goldenDir)].map((e) => e.name.replace(/\.png$/, "")),
  );
  const failures: string[] = ids.filter((id) => !goldens.has(id)).map((id) =>
    `${id}: no golden (capture one with \`capture-chart\` once it is right)`
  );
  const outDir = await Deno.makeTempDir({ prefix: "gggplot-goldens-" });
  const missed = await captureFrames(
    ids.filter((id) => goldens.has(id)),
    outDir,
    "&path=chart",
  );
  failures.push(...missed.map((id) => `${id}: no frame captured`));
  await withBrowser(async (page) => {
    for (const id of ids) {
      if (!goldens.has(id) || missed.includes(id)) continue;
      const result = await decodePixels(
        page,
        dataUrl(Deno.readFileSync(`${goldenDir}/${id}.png`)),
        dataUrl(Deno.readFileSync(`${outDir}/${id}.png`)),
      );
      console.log(`${id}: ${JSON.stringify(result)}`);
      if (result.changed < 0) failures.push(`${id}: frame size changed`);
      else if (result.maxDifference > MAX_AA_DIFFERENCE) {
        failures.push(
          `${id}: ${result.changed} pixels differ, max ${result.maxDifference} (> ${MAX_AA_DIFFERENCE})`,
        );
      }
    }
  });
  if (failures.length) {
    console.error(failures.join("\n"));
    Deno.exit(1);
  }
  console.log(`Golden-frame gate passed for ${ids.length} examples.`);
} else if (mode === "compare") {
  const [dirA, dirB] = rest;
  const names = [...Deno.readDirSync(dirA)].map((e) => e.name).filter((n) =>
    n.endsWith(".png")
  ).sort();
  let differing = 0;
  await withBrowser(async (page) => {
    for (const name of names) {
      const result = await decodePixels(
        page,
        dataUrl(Deno.readFileSync(`${dirA}/${name}`)),
        dataUrl(Deno.readFileSync(`${dirB}/${name}`)),
      );
      if (result.changed !== 0) differing++;
      console.log(`${name}: ${JSON.stringify(result)}`);
    }
  });
  console.log(`${differing} of ${names.length} frames differ`);
} else {
  console.error(
    "usage: example_frames.ts capture <dir> <id>... | compare <a> <b>",
  );
  Deno.exit(2);
}
