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
import { chromium } from "playwright";
import { browserArgs } from "./browser_args.ts";
import { buildGate, previewArgs } from "./gate_output.ts";

// WebGPU globals exist in the page, not in Deno: every page.evaluate callback
// below is serialized and run by the browser. Declaring them keeps `deno check`
// honest about this file without pulling a DOM lib into a CLI script.
declare const GPUMapMode: { READ: number };

/** The Scene3D clear colour set in ChartCanvas3D, as 8-bit sRGB. */
const BACKGROUND: [number, number, number] = [13, 13, 18];
/** Anti-aliasing tolerance when matching a pixel against a target colour. */
const TOLERANCE = 24;
/** The least-covered showcase draws 5.3% of its canvas; 2% is a floor, not a target. */
const MIN_NON_BACKGROUND = 0.02;
/** A handful of stray black pixels would be noise; thousands are the bug. */
const MAX_BLACK = 50;
/**
 * Orbiting 60 degrees rewrites most of the frame; adjacent camera angles in
 * this scene differ far more than this. The floor only has to be high enough
 * that a camera ignoring the drag entirely cannot pass.
 */
const MIN_ORBIT_CHANGE = 0.05;
/**
 * Orientation guard (gggplot-8zx).
 *
 * Every other assertion here passed while the whole 3D scene was rendering
 * upside down, because presence, coverage, colour and orbit-response are all
 * orientation-blind. The helix showcase colours its points by height band, so
 * the band that maps to LOW must sit lower on screen (larger row index) than
 * the band that maps to HIGH. Anything that flips the y axis inverts this.
 */
const ORIENTATION = {
  match: "helix",
  // MEASURED FROM THE RENDERED TEXTURE, not the source palette: the renderer
  // colour-converts, so geom fill #22c55e arrives as rgb(27,175,122) and
  // #3b82f6 as rgb(42,120,214). A palette or colour-space change will need
  // these re-measured, and the guard says so by failing to find the bands
  // rather than passing silently.
  low: [27, 175, 122] as [number, number, number], // "low" height band, green
  high: [42, 120, 214] as [number, number, number], // "high" height band, blue
  // Measured separation is ~141px; this floor only has to exclude a flip.
  minSeparationPx: 40,
};

/**
 * Showcases whose geom is given a literal colour param, matched by a substring
 * of the surface's aria-label. Keep these in sync with docs/example_3d.ts.
 */
const MARK_COLORS: {
  match: string;
  color: [number, number, number];
  min: number;
}[] = [
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
  // While a read is in flight the stored buffer must stay alive and mappable,
  // so capture pauses rather than destroying the buffer out from under it.
  globalThis.__frozen = false;
  const slots = {};
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
      if (globalThis.__frozen) return out;
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
    /** Read the newest frame for one canvas into a named slot. */
    globalThis.__snapshot = async (label, slot) => {
      globalThis.__frozen = true;
      try {
        const shot = shots[label];
        if (!shot) return null;
        await shot.buffer.mapAsync(GPUMapMode.READ);
        const bytes = new Uint8Array(shot.buffer.getMappedRange().slice(0));
        shot.buffer.unmap();
        const bgra = (shot.format || "").startsWith("bgra");
        const packed = new Uint8Array(shot.width * shot.height * 3);
        for (let y = 0; y < shot.height; y++) {
          for (let x = 0; x < shot.width; x++) {
            const i = y * shot.bytesPerRow + x * 4;
            const o = (y * shot.width + x) * 3;
            packed[o] = bgra ? bytes[i + 2] : bytes[i];
            packed[o + 1] = bytes[i + 1];
            packed[o + 2] = bgra ? bytes[i] : bytes[i + 2];
          }
        }
        slots[slot] = { packed, width: shot.width, height: shot.height };
        return { width: shot.width, height: shot.height };
      } finally {
        globalThis.__frozen = false;
      }
    };

    /** Fraction of pixels differing by more than the threshold between two slots. */
    globalThis.__compare = (a, b, threshold) => {
      const x = slots[a], y = slots[b];
      if (!x || !y || x.packed.length !== y.packed.length) return null;
      let changed = 0;
      const total = x.width * x.height;
      for (let i = 0; i < x.packed.length; i += 3) {
        const d = Math.max(
          Math.abs(x.packed[i] - y.packed[i]),
          Math.abs(x.packed[i + 1] - y.packed[i + 1]),
          Math.abs(x.packed[i + 2] - y.packed[i + 2]),
        );
        if (d > threshold) changed++;
      }
      return changed / total;
    };
  } catch (e) {
    globalThis.__markShotInstallError = String(e);
  }
})();
`;

// Build this gate's OWN copy of the site. Gates used to share
// apps/site/dist, so two running at once clobbered each other
// mid-run (gggplot-8au).
await buildGate("pixels");
const server = new Deno.Command(Deno.execPath(), {
  args: previewArgs("pixels", host, port),
  cwd: new URL("../", import.meta.url).pathname,
  stdout: "null",
  stderr: "inherit",
}).spawn();

const failures: string[] = [];
try {
  await waitForServer();
  const browser = await chromium.launch({
    headless: true,
    args: browserArgs(),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 1000 },
    });
    await page.addInitScript(INSTRUMENT);
    await page.goto(`${baseUrl}/#three-d`, { waitUntil: "networkidle" });
    await page.waitForTimeout(9000);

    const installError = await page.evaluate(() =>
      (globalThis as unknown as { __markShotInstallError?: string })
        .__markShotInstallError
    );
    if (installError) {
      throw new Error(`instrumentation failed: ${installError}`);
    }

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
            marks: wanted.map((m, k) => ({
              match: m.match,
              count: hits[k],
              min: m.min,
            })),
          });
        }
        return out;
      },
      { background: BACKGROUND, tolerance: TOLERANCE, markColors: MARK_COLORS },
    );

    if (!stats.length) {
      failures.push(
        "no 3D canvas was captured at all — the probe never saw a frame.",
      );
    }
    const seen = new Set<string>();
    for (const shot of stats) {
      const short = shot.label.slice(0, 46);
      const coverage = shot.nonBackground / shot.pixels;
      console.log(
        `${short}: coverage=${
          (coverage * 100).toFixed(1)
        }% black=${shot.black}` +
          shot.marks.map((m) => ` ${m.match}=${m.count}`).join(""),
      );
      if (coverage < MIN_NON_BACKGROUND) {
        failures.push(
          `"${short}" is blank: only ${
            (coverage * 100).toFixed(2)
          }% of the canvas ` +
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
    // --- Interaction: does the orbit camera actually respond? (gggplot-lcy.7)
    // Everything above is a static frame, which a scene with a dead camera
    // would pass just as happily. Drag on a chart and require the image to
    // change: this is the only assertion here that exercises OrbitControls
    // end to end.
    const orbitTarget = stats[0]?.label;
    if (!orbitTarget) {
      failures.push("no showcase available to test orbit interaction against.");
    } else {
      const box = await page.evaluate((label: string) => {
        const surface = Array.from(
          document.querySelectorAll("[data-chart-surface]"),
        )
          .find((el) => el.getAttribute("aria-label") === label);
        if (!surface) return null;
        surface.scrollIntoView({ block: "center" });
        const rect = surface.getBoundingClientRect();
        return {
          cx: rect.left + rect.width / 2,
          cy: rect.top + rect.height / 2,
        };
      }, orbitTarget);
      const short = orbitTarget.slice(0, 46);
      if (!box) {
        failures.push(
          `could not locate the surface for "${short}" to orbit it.`,
        );
      } else {
        await page.waitForTimeout(1200);
        await page.evaluate(
          (label: string) =>
            (globalThis as unknown as {
              __snapshot(l: string, s: string): Promise<unknown>;
            }).__snapshot(label, "before"),
          orbitTarget,
        );
        await page.mouse.move(box.cx, box.cy);
        await page.mouse.down();
        // OrbitControls integrates pointer deltas, so a single jump to the end
        // point does not orbit — feed it a sequence of small moves.
        for (let i = 1; i <= 6; i++) {
          await page.mouse.move(box.cx + (60 * i) / 6, box.cy);
          await page.waitForTimeout(40);
        }
        await page.mouse.up();
        await page.waitForTimeout(1500);
        await page.evaluate(
          (label: string) =>
            (globalThis as unknown as {
              __snapshot(l: string, s: string): Promise<unknown>;
            }).__snapshot(label, "after"),
          orbitTarget,
        );
        const changed = await page.evaluate(() =>
          (globalThis as unknown as {
            __compare(a: string, b: string, t: number): number | null;
          }).__compare("before", "after", 32)
        );
        if (changed == null) {
          failures.push(`orbit check could not read frames for "${short}".`);
        } else {
          console.log(
            `orbit "${short}": ${
              (changed * 100).toFixed(1)
            }% of pixels changed`,
          );
          if (changed < MIN_ORBIT_CHANGE) {
            failures.push(
              `dragging "${short}" changed only ${
                (changed * 100).toFixed(2)
              }% of the ` +
                `canvas (floor ${
                  MIN_ORBIT_CHANGE * 100
                }%) — the orbit camera is not ` +
                `responding to pointer input.`,
            );
          }
        }
      }
    }

    // --- Orientation: is the scene the right way up? (gggplot-8zx)
    const oriented = stats.find((shot) =>
      shot.label.toLowerCase().includes(ORIENTATION.match)
    );
    if (!oriented) {
      failures.push(
        `no captured showcase matched "${ORIENTATION.match}" — the orientation ` +
          `guard is stale relative to docs/example_3d.ts.`,
      );
    } else {
      const centroids = await page.evaluate(
        ({ label, low, high, tolerance }) => {
          const shots = (globalThis as unknown as {
            __markShots: Record<string, {
              buffer: GPUBuffer;
              bytesPerRow: number;
              width: number;
              height: number;
              format: string;
            }>;
          }).__markShots;
          const shot = shots[label];
          if (!shot) return null;
          // The buffer was already read once for the stats pass and unmapped;
          // re-mapping it is what the freeze flag protects.
          return (async () => {
            await shot.buffer.mapAsync(GPUMapMode.READ);
            const bytes = new Uint8Array(shot.buffer.getMappedRange().slice(0));
            shot.buffer.unmap();
            const bgra = (shot.format || "").startsWith("bgra");
            const near = (r: number, g: number, b: number, c: number[]) =>
              Math.abs(r - c[0]) <= tolerance &&
              Math.abs(g - c[1]) <= tolerance &&
              Math.abs(b - c[2]) <= tolerance;
            let lowSum = 0, lowN = 0, highSum = 0, highN = 0;
            for (let y = 0; y < shot.height; y++) {
              for (let x = 0; x < shot.width; x++) {
                const i = y * shot.bytesPerRow + x * 4;
                const r = bgra ? bytes[i + 2] : bytes[i];
                const g = bytes[i + 1];
                const b = bgra ? bytes[i] : bytes[i + 2];
                if (near(r, g, b, low)) {
                  lowSum += y;
                  lowN++;
                } else if (near(r, g, b, high)) {
                  highSum += y;
                  highN++;
                }
              }
            }
            return {
              low: lowN ? lowSum / lowN : null,
              high: highN ? highSum / highN : null,
              lowN,
              highN,
            };
          })();
        },
        {
          label: oriented.label,
          low: ORIENTATION.low,
          high: ORIENTATION.high,
          tolerance: TOLERANCE,
        },
      );
      const short = oriented.label.slice(0, 46);
      if (!centroids || centroids.low == null || centroids.high == null) {
        failures.push(
          `could not find both height bands in "${short}" (low=${
            centroids?.lowN ?? 0
          }px, ` +
            `high=${
              centroids?.highN ?? 0
            }px) — the orientation guard cannot run.`,
        );
      } else {
        const separation = centroids.low - centroids.high;
        console.log(
          `orientation "${short}": low band centroid row ${
            centroids.low.toFixed(0)
          }, ` +
            `high band ${centroids.high.toFixed(0)}, separation ${
              separation.toFixed(0)
            }px`,
        );
        if (separation < ORIENTATION.minSeparationPx) {
          failures.push(
            `"${short}" is upside down: the LOW height band sits at row ` +
              `${centroids.low.toFixed(0)}, not below the HIGH band at row ` +
              `${centroids.high.toFixed(0)}. A y-axis flip inverts this.`,
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
