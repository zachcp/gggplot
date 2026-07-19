import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { ggsave, type GgSaveOptions, pngDimensions } from "@gggplot/core";
import {
  ggsavePointCloud,
  POINT_CLOUD_EXTENSION_ID,
  type PointCloudSpec,
} from "@gggplot/3d";
import { scatterLine } from "./docs/examples.tsx";
import { InstrumentProbe } from "./InstrumentProbe.tsx";

declare global {
  interface Window {
    __gggplotExportProbe?: (
      width: number,
      height: number,
      physical?: boolean,
    ) => Promise<Record<string, unknown>>;
  }
}

const exportProbeMode = new URLSearchParams(location.search).get(
  "export-probe",
);
const pointCloudProbe: PointCloudSpec = {
  extension: POINT_CLOUD_EXTENSION_ID,
  data: {
    x: [-0.8, -0.3, 0.2, 0.7, 0],
    y: [-0.5, 0.55, -0.25, 0.4, 0],
    z: [0.4, -0.1, 0.8, -0.5, 0],
    color: ["#ef4444", "#22c55e", "#3b82f6", "#f59e0b", "#a855f7"],
    size: [18, 22, 26, 30, 34],
  },
  mapping: { x: "x", y: "y", z: "z", color: "color", size: "size" },
  camera: {
    projection: "perspective",
    position: [0, 0, 3],
    target: [0, 0, 0],
    aspect: 1.6,
  },
};
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
      ? await ggsavePointCloud(pointCloudProbe, options)
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
  window.__gggplotExportProbe = probe;
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
createRoot(root).render(
  new URLSearchParams(location.search).has("instrument")
    ? <InstrumentProbe />
    : <App />,
);
