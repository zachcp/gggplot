import React, { useEffect, useMemo, useState } from "react";
import { LiveCanvas } from "@use-gpu/react";
import {
  aes,
  geomLine,
  geomPoint,
  ggplot,
  ingest,
  scaleXContinuous,
} from "@gggplot/core";
import { Scene } from "./scene.tsx";

/**
 * gggplot-tzc.8's dedicated instrumented route (?instrument): drives the
 * SAME `window.__gggplotGpuInstrument` surface render/GGPlot.tsx installs
 * (behind the SAME ?instrument flag) through the two acceptance scenarios
 * a browser-level driver (apps/site/scripts/gpu_instrument_check.ts) reads
 * back via `window.__gggplotInstrumentProbe()`:
 *   (i)  N re-renders of an UNCHANGED spec -> expect zero NEW mark-data
 *        buffer creations/writes (the mounted PackCache + useRawSource's
 *        own array/version-keyed memoization should both hit).
 *   (ii) a linear-scale x-domain change (gggplot-tzc.7) -> expect the SAME
 *        zeros for mark data while the frame still redraws (the Cartesian
 *        view's `range` prop is the only thing that changes — a genuine
 *        GPU uniform/view write, which this counts separately and does NOT
 *        attribute to mark data).
 */
// Pre-ingested ONCE at module scope (not per-build): compile/pack_cache.ts's
// PackCache roots Stage A cache entries on the MAPPED COLUMN OBJECT's own
// identity (a WeakMap<Column, ...>), not on data VALUES — calling ggplot()
// on a raw (un-ingested) object re-ingests fresh Column wrappers on every
// .build() call, which would make Stage A miss on every spec rebuild
// regardless of whether the domain actually changed anything eligible. This
// is the exact same "reuse the same underlying data columns across builds"
// discipline pack_cache_test.ts/raw_position_domain_test.ts already use.
const DATA = ingest({
  x: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  y: [1, 3, 2, 5, 4, 6, 3, 7, 5, 8],
});

// Declared as global `var`s rather than on `interface Window`: both are
// reached through `globalThis`, and only a var declaration types that.
declare global {
  var __gggplotGpuInstrument:
    | {
      getCounters: () => {
        markBufferCreations: number;
        markBufferWrites: number;
        totalBufferCreations: number;
        totalBufferWrites: number;
      };
      reset: () => void;
    }
    | undefined;
  var __gggplotInstrumentProbe:
    | (() => Promise<Record<string, unknown>>)
    | undefined;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitForInstrument(timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!globalThis.__gggplotGpuInstrument) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("window.__gggplotGpuInstrument never installed");
    }
    await nextFrame();
  }
}

export function InstrumentProbe(): React.ReactElement {
  const [, setRerenderTick] = useState(0);
  const [xDomainMax, setXDomainMax] = useState(9);

  // The rerender tick is READ nowhere in the spec — bumping it forces this
  // component (and GGPlot beneath it) to re-render with an UNCHANGED spec
  // object, exercising scenario (i). xDomainMax IS read (via
  // scaleXContinuous's domain), so bumping it forces a genuinely different
  // spec/RenderTree recompile — exercising scenario (ii), gggplot-tzc.7's
  // domain-only-change path.
  const spec = useMemo(
    () =>
      ggplot(DATA, aes({ x: "x", y: "y" }))
        .add(geomPoint({ size: 4 }))
        .add(geomLine())
        .add(scaleXContinuous({ domain: [0, xDomainMax] }))
        .build(),
    [xDomainMax],
  );

  useEffect(() => {
    globalThis.__gggplotInstrumentProbe = async () => {
      await waitForInstrument();
      const instrument = globalThis.__gggplotGpuInstrument!;
      instrument.reset();

      const rerenderCount = 5;
      for (let i = 0; i < rerenderCount; i++) {
        setRerenderTick((t) => t + 1);
        await nextFrame();
      }
      // A couple of extra frames so any queued GPU work actually submits
      // before we read counters back.
      await nextFrame();
      await nextFrame();
      const afterUnchangedRerenders = instrument.getCounters();

      instrument.reset();
      setXDomainMax((m) => m + 3);
      await nextFrame();
      await nextFrame();
      await nextFrame();
      const afterDomainChange = instrument.getCounters();

      return {
        rerenderCount,
        afterUnchangedRerenders,
        afterDomainChange,
      };
    };
    return () => {
      delete globalThis.__gggplotInstrumentProbe;
    };
  }, []);

  return (
    <div
      id="gggplot-instrument-probe"
      data-chart-surface="webgpu"
      role="img"
      aria-label="GPU mark-data upload instrumentation probe"
      style={{ width: 480, height: 360 }}
    >
      <LiveCanvas>
        {(canvas: HTMLCanvasElement) => <Scene canvas={canvas} spec={spec} />}
      </LiveCanvas>
    </div>
  );
}
