/**
 * "Is the mark actually VISIBLE?" gate (gggplot-frg).
 *
 * draw_call_check.ts asks whether marks reached the GPU. That is a strictly
 * weaker question than whether anyone can see them, and the gap between the two
 * is where geom_segment's 3D mode lived for a while: it packed the right
 * geometry, issued the right draw, and painted all 75 segments pure black on a
 * near-black scene. Every existing signal stayed green.
 *
 * Pixels are the only witness that closes that gap, and headless Chromium will
 * not hand them over the easy way — createImageBitmap on a WebGPU canvas
 * returns fully transparent even for charts that demonstrably render. So this
 * gate asks the GPU for the swap-chain texture directly: it adds COPY_SRC to
 * each canvas configuration, keeps the texture of the most recent frame, and
 * copies it into a mappable buffer before presentation.
 *
 * Three assertions run per 3D showcase:
 *   1. NOT BLANK      — enough of the canvas differs from the scene background.
 *   2. NO DEAD COLOR  — pure #000000 never appears. Nothing in these scenes is
 *                       authored black, and both the raw-layer string-colour
 *                       bug and color/mod.ts's parseColorRGBA failure path
 *                       produce exactly black, so it is a reliable sentinel.
 *   3. MARK COLOUR    — a showcase whose geom names a literal colour must show
 *                       that colour in quantity.
 *
 * Usage: deno task test:pixels
 */
import { chromium } from "npm:playwright@^1.61.1";

/** The Scene3D clear colour set in ChartCanvas3D, as 8-bit sRGB. */
const BACKGROUND: [number, number, number] = [13, 13, 18];
/** Anti-aliasing tolerance when matching a pixel against a target colour. */
const TOLERANCE = 24;
/** The least-covered showcase draws 5.3% of its canvas; 2% is a floor, not a target. */
const MIN_NON_BACKGROUND = 0.02;
/** A handful of stray black pixels would be noise; thousands are the bug. */
const MAX_BLACK = 50;

/**
 * Showcases whose geom is given a literal colour param, matched by a substring
 * of the surface's aria-label. Keep these in sync with docs/example_3d.ts.
 */
const MARK_COLORS: { match: string; color: [number, number, number]; min: number }[] = [
  // geom_segment({ color: "#38bdf8" }) — the original gggplot-frg regression.
  { match: "swirl field", color: [56, 189, 248], min: 1000 },
];

const host = "127.0.0.1";
const port = 20_000 + Math.floor(Math.random() * 20_000);
const baseUrl = `http://${host}:${port}`;

const INSTRUMENT = `
(() => {
  const shots = {};
  globalThis.__markShots = shots;
  const errors = [];
  globalThis.__markShotErrors = errors;
  const ctxCanvas = new WeakMap();
  const queueDevice = new WeakMap();
  const canvasIds = new WeakMap();
  const latest = new Map();
  let seq = 0;

  const idFor = (canvas) => {
    let id = canvasIds.get(canvas);
    if (!id) {
      const host = canvas.closest("[data-chart-surface]");
      canvasIds.set(canvas, (host && host.getAttribute("aria-label")) || ("canvas#" + (++seq)));
    }
    return canvasIds.get(canvas);
  };

  try {
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      const ctx = origGetContext.call(this, type, ...rest);
      if (type === "webgpu" && ctx) ctxCanvas.set(ctx, this);
      return ctx;
    };

    const origRequestDevice = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = function (...args) {
      return origRequestDevice.apply(this, args).then((device) => {
        if (device) queueDevice.set(device.queue, device);
        return device;
      });
    };

    // COPY_SRC is what makes the swap-chain texture readable at all; without it
    // copyTextureToBuffer is a validation error.
    const origConfigure = GPUCanvasContext.prototype.configure;
    GPUCanvasContext.prototype.configure = function (config) {
      const canvas = ctxCanvas.get(this) || this.canvas;
      if (canvas) {
        const entry = latest.get(idFor(canvas)) || {};
        entry.format = config.format;
        latest.set(idFor(canvas), entry);
      }
      return origConfigure.call(this, Object.assign({}, config, {
        usage: (config.usage || GPUTextureUsage.RENDER_ATTACHMENT) | GPUTextureUsage.COPY_SRC,
      }));
    };

    const origGetCurrentTexture = GPUCanvasContext.prototype.getCurrentTexture;
    GPUCanvasContext.prototype.getCurrentTexture = function () {
      const texture = origGetCurrentTexture.call(this);
      const canvas = ctxCanvas.get(this) || this.canvas;
      if (canvas && texture) {
        const entry = latest.get(idFor(canvas)) || {};
        entry.texture = texture;
        entry.width = texture.width;
        entry.height = texture.height;
        latest.set(idFor(canvas), entry);
      }
      return texture;
    };

    const origSubmit = GPUQueue.prototype.submit;
    GPUQueue.prototype.submit = function (buffers) {
      const out = origSubmit.call(this, buffers);
      const device = queueDevice.get(this);
      if (!device) return out;
      for (const [id, entry] of latest) {
        if (!entry.texture) continue;
        try {
          const bytesPerRow = Math.ceil(entry.width * 4 / 256) * 256;
          const buffer = device.createBuffer({
            size: bytesPerRow * entry.height,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
          });
          const encoder = device.createCommandEncoder();
          encoder.copyTextureToBuffer(
            { texture: entry.texture },
            { buffer, bytesPerRow },
            { width: entry.width, height: entry.height },
          );
          origSubmit.call(this, [encoder.finish()]);
          // Keep only the newest frame: early frames are legitimately empty
          // while fonts and layout are still resolving.
          if (shots[id]) shots[id].buffer.destroy();
          shots[id] = { buffer, bytesPerRow, width: entry.width, height: entry.height, format: entry.format };
          entry.texture = null;
        } catch (e) {
          errors.push(id + ": " + String(e));
        }
      }
      return out;
    };
  } catch (e) {
    globalThis.__markShotInstallError = String(e);
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
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.addInitScript(INSTRUMENT);
    await page.goto(`${baseUrl}/#three-d`, { waitUntil: "networkidle" });
    await page.waitForTimeout(9000);

    const installError = await page.evaluate(() =>
      (globalThis as unknown as { __markShotInstallError?: string }).__markShotInstallError
    );
    if (installError) throw new Error(`instrumentation failed: ${installError}`);

    const stats = await page.evaluate(
      async ({ background, tolerance, markColors }) => {
        const shots = (globalThis as unknown as {
          __markShots: Record<string, {
            buffer: GPUBuffer;
            bytesPerRow: number;
            width: number;
            height: number;
            format: string;
          }>;
        }).__markShots;
        const out: {
          label: string;
          pixels: number;
          nonBackground: number;
          black: number;
          marks: { match: string; count: number; min: number }[];
        }[] = [];
        for (const [label, shot] of Object.entries(shots)) {
          await shot.buffer.mapAsync(GPUMapMode.READ);
          const bytes = new Uint8Array(shot.buffer.getMappedRange().slice(0));
          shot.buffer.unmap();
          const bgra = (shot.format || "").startsWith("bgra");
          const wanted = markColors.filter((m) => label.includes(m.match));
          const hits = wanted.map(() => 0);
          let nonBackground = 0;
          let black = 0;
          for (let y = 0; y < shot.height; y++) {
            for (let x = 0; x < shot.width; x++) {
              const i = y * shot.bytesPerRow + x * 4;
              const r = bgra ? bytes[i + 2] : bytes[i];
              const g = bytes[i + 1];
              const b = bgra ? bytes[i] : bytes[i + 2];
              if (r === 0 && g === 0 && b === 0) black++;
              if (
                Math.abs(r - background[0]) > 6 ||
                Math.abs(g - background[1]) > 6 ||
                Math.abs(b - background[2]) > 6
              ) nonBackground++;
              for (let k = 0; k < wanted.length; k++) {
                const c = wanted[k].color;
                if (
                  Math.abs(r - c[0]) <= tolerance &&
                  Math.abs(g - c[1]) <= tolerance &&
                  Math.abs(b - c[2]) <= tolerance
                ) hits[k]++;
              }
            }
          }
          out.push({
            label,
            pixels: shot.width * shot.height,
            nonBackground,
            black,
            marks: wanted.map((m, k) => ({ match: m.match, count: hits[k], min: m.min })),
          });
        }
        return out;
      },
      { background: BACKGROUND, tolerance: TOLERANCE, markColors: MARK_COLORS },
    );

    if (!stats.length) {
      failures.push("no 3D canvas was captured at all — the probe never saw a frame.");
    }
    const seen = new Set<string>();
    for (const shot of stats) {
      const short = shot.label.slice(0, 46);
      const coverage = shot.nonBackground / shot.pixels;
      console.log(
        `${short}: coverage=${(coverage * 100).toFixed(1)}% black=${shot.black}` +
          shot.marks.map((m) => ` ${m.match}=${m.count}`).join(""),
      );
      if (coverage < MIN_NON_BACKGROUND) {
        failures.push(
          `"${short}" is blank: only ${(coverage * 100).toFixed(2)}% of the canvas ` +
            `differs from the background (floor ${MIN_NON_BACKGROUND * 100}%).`,
        );
      }
      if (shot.black > MAX_BLACK) {
        failures.push(
          `"${short}" painted ${shot.black} pure-black pixels. Nothing in a 3D scene ` +
            `is authored black — this is the signature of a colour that never parsed ` +
            `(gggplot-frg: a CSS string handed to a raw workbench layer).`,
        );
      }
      for (const mark of shot.marks) {
        seen.add(mark.match);
        if (mark.count < mark.min) {
          failures.push(
            `"${short}" shows only ${mark.count} pixels of its declared mark colour ` +
              `(expected at least ${mark.min}) — the mark drew, but not visibly.`,
          );
        }
      }
    }
    for (const mark of MARK_COLORS) {
      if (!seen.has(mark.match)) {
        failures.push(
          `no captured showcase matched "${mark.match}" — MARK_COLORS is stale ` +
            `relative to docs/example_3d.ts.`,
        );
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
  console.error(`\nMark-visibility gate FAILED:\n- ${failures.join("\n- ")}`);
  Deno.exit(1);
}
console.log("\nMark-visibility gate passed.");

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(baseUrl);
      await res.body?.cancel();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("preview server never came up");
}
