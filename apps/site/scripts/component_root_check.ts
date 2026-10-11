// The component-first <GGPlot> root (gggplot-2bj) against compile() on
// scatterLine, in a browser. Never silently skip a missing GPU.
//
// Checks: pixel parity in two plot states, then three measurements on the
// component path (resize, a fixed-color change on one layer, a third layer
// inserted before the first two). Work counters are asserted; GPU bytes are
// recorded for the bead notes, because <Plot>'s VirtualLayers aggregates
// same-type shapes into shared buffers and bytes cannot be split per layer.
import { chromium, type Page } from "playwright";
import { browserArgs } from "./browser_args.ts";
import { buildGate, previewArgs } from "./gate_output.ts";
import { SCALE_CAPTURE } from "./scale_binding_capture.ts";
import type { StepCost } from "../src/ComponentRootProbe.tsx";
import type { ComponentRootState } from "../src/ComponentRootScene.tsx";

type ProbeWindow = {
  __gggplotComponentRootProbe?: {
    step: (change: Partial<ComponentRootState>) => Promise<StepCost>;
  };
  __beginScaleCapture: () => void;
  __readScaleCapture: () => Promise<string>;
};

/** Per-channel difference glyph anti-aliasing alone produces (see atlasHistory). */
const MAX_TEXT_AA_DIFFERENCE = 32;

const host = "127.0.0.1";
const port = 20_000 + Math.floor(Math.random() * 20_000);
const baseUrl = `http://${host}:${port}`;
const output = new URL("../.artifacts/component-root/", import.meta.url);
await Deno.mkdir(output, { recursive: true });
await buildGate("component-root");
const server = new Deno.Command(Deno.execPath(), {
  args: previewArgs("component-root", host, port),
  cwd: new URL("../", import.meta.url).pathname,
  stdout: "inherit",
  stderr: "inherit",
}).spawn();

const step = (page: Page, change: Partial<ComponentRootState>) =>
  page.evaluate(
    (change) =>
      (globalThis as unknown as ProbeWindow).__gggplotComponentRootProbe!
        .step(change),
    change,
  );

/** Capture the frame a state change produces. Nothing redraws without one. */
const frameAfter = (page: Page, change: Partial<ComponentRootState>) =>
  page.evaluate(async (change) => {
    const w = globalThis as unknown as ProbeWindow;
    w.__beginScaleCapture();
    await w.__gggplotComponentRootProbe!.step(change);
    return await w.__readScaleCapture();
  }, change);

async function compare(page: Page, name: string, a: string, b: string) {
  for (const [mode, url] of [["compile", a], ["component", b]]) {
    await Deno.writeFile(
      new URL(`${name}-${mode}.png`, output),
      Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0)),
    );
  }
  const { mask, ...result } = await page.evaluate(async ([aUrl, bUrl]) => {
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
    const image = new Image();
    image.src = aUrl;
    await image.decode();
    const width = image.width;
    let changed = 0, maxDifference = 0, visible = 0;
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    const samples: { at: number[]; compile: number[]; component: number[] }[] =
      [];
    for (let i = 0; i < x.length; i += 4) {
      const diff = Math.max(
        ...[0, 1, 2].map((c) => Math.abs(x[i + c] - y[i + c])),
      );
      if (diff > 1) {
        changed++;
        const px = (i / 4) % width, py = Math.floor(i / 4 / width);
        box[0] = Math.min(box[0], px);
        box[1] = Math.min(box[1], py);
        box[2] = Math.max(box[2], px);
        box[3] = Math.max(box[3], py);
        if (samples.length < 8 && changed % 50 === 1) {
          samples.push({
            at: [px, py],
            compile: [x[i], x[i + 1], x[i + 2]],
            component: [y[i], y[i + 1], y[i + 2]],
          });
        }
      }
      // The scene clears to rgb(13,13,18); anything brighter is drawn.
      if (Math.max(x[i], x[i + 1], x[i + 2]) > 40) visible++;
      maxDifference = Math.max(maxDifference, diff);
    }
    // Changed pixels in red over a dimmed copy of the compile frame.
    const mask = document.createElement("canvas");
    mask.width = width;
    mask.height = x.length / 4 / width;
    const out = new ImageData(width, mask.height);
    for (let i = 0; i < x.length; i += 4) {
      const diff = Math.max(
        ...[0, 1, 2].map((c) => Math.abs(x[i + c] - y[i + c])),
      );
      out.data.set(
        diff > 1
          ? [255, 0, 0, 255]
          : [x[i] / 3, x[i + 1] / 3, x[i + 2] / 3, 255],
        i,
      );
    }
    mask.getContext("2d")!.putImageData(out, 0, 0);
    return {
      changed,
      maxDifference,
      visibleFraction: visible / (x.length / 4),
      pixels: x.length / 4,
      ...(changed ? { diffBox: box, samples } : {}),
      mask: mask.toDataURL("image/png"),
    };
  }, [a, b]);
  await Deno.writeFile(
    new URL(`${name}-diff.png`, output),
    Uint8Array.from(atob(mask.split(",")[1]), (c) => c.charCodeAt(0)),
  );
  return result;
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      ready = (await fetch(baseUrl)).ok;
    } catch { /* server starting */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("component-root preview never started");
  const browser = await chromium.launch({
    headless: true,
    args: browserArgs(),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 800, height: 600 },
      deviceScaleFactor: 1,
    });
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(SCALE_CAPTURE);
    await page.goto(`${baseUrl}/?component-root&instrument`, {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(() =>
      !!(globalThis as unknown as ProbeWindow).__gggplotComponentRootProbe
    );
    await step(page, {});

    // Parity, two-layer state: compile frame, then a fresh component mount.
    const twoCompile = await frameAfter(page, { mode: "compile" });
    const twoComponent = await frameAfter(page, { mode: "component" });
    const parityTwo = await compare(page, "two", twoCompile, twoComponent);

    // Measurements on the mounted component path.
    const idle = await step(page, {});
    const resize = await step(page, { width: 600 });
    const color = await step(page, { pointColor: "#22c55e" });
    const third = await step(page, { third: true });

    // Parity, three-layer state with the changed color and new width. The
    // compile path replays the same history first: glyph atlases pack in the
    // order glyphs first appear, so a resized plot and a freshly mounted one
    // anti-alias their labels slightly differently on EITHER path.
    const threeComponent = await frameAfter(page, { width: 601 });
    // Switching mode remounts, so the compile path starts its atlas at 520.
    await step(page, {
      mode: "compile",
      width: 520,
      pointColor: "#3b82f6",
      third: false,
    });
    const compileIdle = await step(page, {});
    const compileResize = await step(page, { width: 600 });
    const compileColor = await step(page, { pointColor: "#22c55e" });
    const compileThird = await step(page, { third: true });
    const threeCompile = await frameAfter(page, { width: 601 });
    const parityThree = await compare(
      page,
      "three",
      threeCompile,
      threeComponent,
    );
    // Recorded, not asserted: compile against itself, freshly mounted in the
    // final state vs resized into it.
    await step(page, { mode: "component" });
    const freshCompile = await frameAfter(page, { mode: "compile" });
    const atlasHistory = await compare(
      page,
      "atlas-history",
      freshCompile,
      threeCompile,
    );

    // Shared data (gggplot-0m6): two plots under one <GGData>. Mounting it
    // must upload each frame column exactly once across both plots.
    const shared = await step(page, { mode: "shared" });
    const sharedFrame = await frameAfter(page, { pointColor: "#3b82f6" });

    // GPU scale binding (gggplot-fbq): a color-domain change on a bound point
    // layer is a uniform write: no mark upload, no shader or pipeline build.
    await step(page, {
      mode: "component",
      scaled: true,
      colorDomain: [10, 30],
    });
    const domainChange = await step(page, { colorDomain: [5, 40] });
    const scaledComponent = await frameAfter(page, { colorDomain: [5, 41] });
    const scaledCompile = await frameAfter(page, { mode: "compile" });
    const parityScaled = await compare(
      page,
      "scaled",
      scaledCompile,
      scaledComponent,
    );

    const report = {
      generatedAt: new Date().toISOString(),
      scaled: { domainChange, parity: parityScaled },
      shared: { columnUploads: shared.columnUploads },
      parity: { two: parityTwo, three: parityThree },
      atlasHistory,
      steps: { idle, resize, color, third },
      // The same changes on the compile path, for GPU bytes only (its work
      // counters stay 0: compile() does not report through componentProbe).
      compileGpu: Object.fromEntries(
        Object.entries({
          idle: compileIdle,
          resize: compileResize,
          color: compileColor,
          third: compileThird,
        }).map(([k, v]) => [k, v.gpu]),
      ),
      errors,
    };
    await Deno.writeTextFile(
      new URL("report.json", output),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));

    const failures: string[] = [];
    if (errors.length) failures.push(`page errors: ${errors.join(" | ")}`);
    for (const [name, parity] of Object.entries(report.parity)) {
      if (parity.visibleFraction < 0.02) {
        failures.push(`${name}: canvas is blank`);
      }
      // Glyph anti-aliasing depends on atlas packing order, which depends on
      // mount history and async glyph timing: compile differs from ITSELF by
      // up to ~24 per channel (atlasHistory). Anything wrong in layout or
      // marks moves a pixel by far more than that.
      if (parity.maxDifference > MAX_TEXT_AA_DIFFERENCE) {
        failures.push(
          `${name}: ${parity.changed} pixels differ, max ${parity.maxDifference}`,
        );
      }
    }
    if (resize.work.statCalls || resize.work.lowerCalls) {
      failures.push(
        `resize ran ${resize.work.statCalls} stats, ${resize.work.lowerCalls} lowers`,
      );
    }
    if (color.work.statCalls !== 1 || color.work.lowerCalls !== 1) {
      failures.push(
        `color change ran ${color.work.statCalls} stats, ${color.work.lowerCalls} lowers (want 1, 1)`,
      );
    }
    if (third.work.layerMounts !== 1 || third.work.statCalls !== 1) {
      failures.push(
        `third layer mounted ${third.work.layerMounts} layers, ran ${third.work.statCalls} stats (want 1, 1)`,
      );
    }
    if (
      domainChange.gpu.markBufferCreations || domainChange.gpu.markBufferWrites
    ) {
      failures.push(
        `scaled: a domain change uploaded mark data (${domainChange.gpu.markBufferCreations} creations, ${domainChange.gpu.markBufferWrites} writes)`,
      );
    }
    if (domainChange.newShaderModules || domainChange.newPipelines) {
      failures.push(
        `scaled: a domain change built ${domainChange.newShaderModules} shader modules, ${domainChange.newPipelines} pipelines`,
      );
    }
    if (parityScaled.maxDifference > MAX_TEXT_AA_DIFFERENCE) {
      failures.push(
        `scaled: ${parityScaled.changed} pixels differ from compile, max ${parityScaled.maxDifference}`,
      );
    }
    const columnNames = Object.keys(shared.columnUploads);
    if (columnNames.length === 0) {
      failures.push("shared: no frame column was uploaded at all");
    }
    for (const [name, count] of Object.entries(shared.columnUploads)) {
      if (count !== 1) {
        failures.push(
          `shared: column ${name} uploaded ${count} times (want 1)`,
        );
      }
    }
    const sharedPixels = await compare(
      page,
      "shared",
      sharedFrame,
      sharedFrame,
    );
    if (sharedPixels.visibleFraction < 0.02) {
      failures.push("shared: the two plots drew nothing");
    }
    if (failures.length) throw new Error(failures.join("\n"));
    console.log("Component-root gate passed.");
  } finally {
    await browser.close();
  }
} finally {
  try {
    server.kill("SIGTERM");
  } catch { /* already stopped */ }
  await server.status;
}
