import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { ggsave, type GgSaveOptions, pngDimensions } from "@gggplot/core";
import { scatterLine } from "./docs/examples.tsx";
import { helix3dSpec } from "./docs/example_3d.ts";
import { InstrumentProbe } from "./InstrumentProbe.tsx";

const PerformanceProbe = lazy(() =>
  import("./PerformanceProbe.tsx").then((module) => ({
    default: module.PerformanceProbe,
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
      ? await ggsave(helix3dSpec, options)
      : await ggsave(scatterLine.spec!, options);
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
  query.has("instrument")
    ? <InstrumentProbe />
    : query.has("performance")
    ? (
      <Suspense fallback={<p>Loading performance route…</p>}>
        <PerformanceProbe />
      </Suspense>
    )
    : <App />,
);
