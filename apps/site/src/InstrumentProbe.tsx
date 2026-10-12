import React, { useEffect, useMemo, useState } from "react";
import { LiveCanvas } from "@use-gpu/react";
// Live elements are built with the typed factory, not React JSX: a Live
// scene returns a LiveElement, which React's JSX namespace rejects.
import { createElement as liveElement } from "@gggplot/core/jsx";
import {
  GeomLine,
  GeomPoint,
  ingest,
  ScaleXContinuous,
  ThemeOverrides,
} from "@gggplot/core";
import type { LiveElement } from "@use-gpu/live";
import { ChartScene } from "./chart_scene.tsx";
import { SitePlot } from "./site_plot.tsx";

/**
 * gggplot-tzc.8's dedicated instrumented route (?instrument): drives the
 * SAME `window.__gggplotGpuInstrument` surface render/GGPlot.tsx installs
 * (behind the SAME ?instrument flag) through the two acceptance scenarios
 * a browser-level driver (apps/site/scripts/gpu_instrument_check.ts) reads
 * back via `window.__gggplotInstrumentProbe()`:
 *   (i)  N re-renders of an UNCHANGED chart -> expect zero NEW mark-data
 *        buffer creations/writes (the root's per-layer lowering memo and
 *        useRawSource's array/version-keyed memoization should both hit).
 *   (ii) a linear-scale x-domain change (gggplot-tzc.7) -> expect the SAME
 *        zeros for mark data while the frame still redraws (the Cartesian
 *        view's `range` prop is the only thing that changes — a genuine
 *        GPU uniform/view write, which this counts separately and does NOT
 *        attribute to mark data).
 */
// Pre-ingested ONCE at module scope (not per render): the root's caches key
// on the column objects' identity, not their values, so a raw object
// re-ingested on every render would miss them whether or not anything
// changed. Reusing the same columns is what scenario (i) measures.
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

  // The rerender tick is READ nowhere in the chart — bumping it forces this
  // component (and GGPlot beneath it) to re-render with an UNCHANGED chart,
  // exercising scenario (i). xDomainMax IS read (via <ScaleXContinuous>'s
  // domain), so bumping it retrains the plot — scenario (ii), gggplot-tzc.7's
  // domain-only-change path.
  const chart = useMemo(
    () => (): LiveElement =>
      liveElement(
        SitePlot,
        { data: DATA, mapping: { x: "x", y: "y" } },
        liveElement(GeomPoint, { size: 4 }),
        liveElement(GeomLine, {}),
        liveElement(ScaleXContinuous, { domain: [0, xDomainMax] }),
        // This probe measures mark-data uploads, so exclude guide/font vertex
        // buffers from the surface rather than mixing unrelated allocations
        // into the browser gate.
        liveElement(ThemeOverrides, {
          axes: false,
          axisTitles: false,
          grid: false,
        }),
      ),
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
        {(canvas: HTMLCanvasElement) =>
          liveElement(ChartScene, { canvas, chart })}
      </LiveCanvas>
    </div>
  );
}
