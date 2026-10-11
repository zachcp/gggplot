import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import {
  geomLine,
  geomPath,
  geomPoint,
  ggplot,
  ggsave,
  type GgSaveOptions,
  labels,
  pngDimensions,
} from "@gggplot/core";
import { scatterData } from "./docs/data/demo.ts";
import { helixData } from "./docs/example_3d.tsx";
import { InstrumentProbe } from "./InstrumentProbe.tsx";

// The export probe's charts (the ScatterLine and Helix3D examples). ggsave
// still takes a spec; it moves onto component trees with gggplot-vnh.18.
const SCATTER_SPEC = ggplot(scatterData, { x: "wt", y: "mpg" })
  .add(geomPoint({ size: 6, color: "#3b82f6" }), geomLine({ color: "#ef4444" }))
  .build();
const HELIX_SPEC = ggplot(helixData, { x: "x", y: "y", z: "z", color: "band" })
  .add(
    geomPath({ linewidth: 3, alpha: 0.7 }),
    geomPoint({ size: 24 }),
    labels({
      title: "Helix",
      subtitle: "x/z trace a circle while y climbs",
      x: "cos(t)",
      y: "height",
      z: "sin(t)",
      color: "band",
    }),
  )
  .build();

const PerformanceProbe = lazy(() =>
  import("./PerformanceProbe.tsx").then((module) => ({
    default: module.PerformanceProbe,
  }))
);

const CaptureProbe = lazy(() =>
  import("./CaptureProbe.tsx").then((module) => ({
    default: module.CaptureProbe,
  }))
);

const ComponentRootProbe = lazy(() =>
  import("./ComponentRootProbe.tsx").then((module) => ({
    default: module.ComponentRootProbe,
  }))
);

const ScaleBindingProbe = lazy(() =>
  import("./ScaleBindingProbe.tsx").then((module) => ({
    default: module.ScaleBindingProbe,
  }))
);

// Declared as a global `var` rather than on `interface Window`: the probe is
// reached through `globalThis`, and only a var declaration types that. An
// interface member types `window.` alone.
declare global {
  var __gggplotExportProbe:
    | ((
      width: number,
      height: number,
      physical?: boolean,
    ) => Promise<Record<string, unknown>>)
    | undefined;
}

const exportProbeMode = new URLSearchParams(location.search).get(
  "export-probe",
);
if (exportProbeMode) {
  const probe = async (width: number, height: number, physical = false) => {
    const before = [...document.querySelectorAll("canvas")].map((canvas) => [
      canvas.width,
      canvas.height,
    ]);
    const options: GgSaveOptions = {
      width,
      height,
      ...(physical ? { units: "in" as const, dpi: 100, scale: 2 } : {}),
      backgroundColor: [1, 1, 1, 1],
    };
    const blob = exportProbeMode === "3d"
      ? await ggsave(HELIX_SPEC, options)
      : await ggsave(SCATTER_SPEC, options);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return {
      type: blob.type,
      size: blob.size,
      dimensions: pngDimensions(bytes),
      signature: [...bytes.slice(0, 8)],
      before,
      after: [...document.querySelectorAll("canvas")].map((canvas) => [
        canvas.width,
        canvas.height,
      ]),
      leakedHosts: document.querySelectorAll('div[style*="-100000px"]').length,
    };
  };
  globalThis.__gggplotExportProbe = probe;
  const trigger = document.createElement("button");
  trigger.id = "gggplot-export-probe";
  trigger.textContent = "Run export probe";
  Object.assign(trigger.style, {
    position: "fixed",
    left: "0",
    top: "0",
    zIndex: "9999",
  });
  trigger.addEventListener("click", async () => {
    try {
      trigger.dataset.result = JSON.stringify(
        exportProbeMode === "physical"
          ? await probe(2, 1, true)
          : await probe(320, 200),
      );
    } catch (error) {
      trigger.dataset.error = error instanceof Error
        ? error.message
        : String(error);
    }
  });
  document.body.append(trigger);
}

// gggplot-tzc.8's dedicated instrumented route: ?instrument mounts ONLY the
// probe (not the full docs App), the same way ?export-probe above mounts a
// standalone trigger rather than touching App. render/GGPlot.tsx reads this
// SAME query flag (isInstrumentFlagSet) to install GPU mark-data upload
// instrumentation, so this route and the library's own gate agree on what
// "instrumented" means.
const root = document.getElementById("root")!;
const query = new URLSearchParams(location.search);
createRoot(root).render(
  query.has("capture")
    ? (
      <Suspense fallback={<p>Loading…</p>}>
        <CaptureProbe
          id={query.get("capture")!}
        />
      </Suspense>
    )
    : query.has("component-root")
    ? (
      <Suspense fallback={<p>Loading component-root spike…</p>}>
        <ComponentRootProbe />
      </Suspense>
    )
    : query.has("scale-binding")
    ? (
      <Suspense fallback={<p>Loading scale-binding spike…</p>}>
        <ScaleBindingProbe />
      </Suspense>
    )
    : query.has("instrument")
    ? <InstrumentProbe />
    : query.has("performance")
    ? (
      <Suspense fallback={<p>Loading performance route…</p>}>
        <PerformanceProbe />
      </Suspense>
    )
    : <App />,
);
