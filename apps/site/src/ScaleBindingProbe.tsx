import { useEffect, useState } from "react";
import { LiveCanvas } from "@use-gpu/react";
import { createElement as liveElement } from "../../../packages/core/src/runtime/usegpu_compat.ts";
import { ScaleBindingScene, scaleProbe } from "./ScaleBindingScene.tsx";
import {
  CASES,
  spikeScales,
} from "../../../packages/core/spikes/gpu_scale_binding.ts";

declare global {
  var __gggplotScaleBindingProbe: undefined | {
    measure: () => Promise<Record<string, unknown>>;
    drawMode: (cpu: boolean) => Promise<void>;
  };
}

const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function settled(revision: number) {
  const start = performance.now();
  while (
    scaleProbe.guideRevision !== revision ||
    CASES.some((f) => scaleProbe.results[f.name]?.revision !== revision)
  ) {
    if (performance.now() - start > 20_000) {
      throw new Error(
        `scale revision ${revision} never finished: ${
          JSON.stringify(scaleProbe)
        }`,
      );
    }
    await frame();
  }
  for (let i = 0; i < 5; i++) await frame();
}

export function ScaleBindingProbe() {
  const [state, setState] = useState({
    scales: spikeScales(),
    revision: 1,
    cpu: false,
  });
  useEffect(() => {
    globalThis.__gggplotScaleBindingProbe = {
      measure: async () => {
        await settled(1);
        const initial = {
          mounts: scaleProbe.mounts,
          bundleBuilds: scaleProbe.bundleBuilds,
          guideRenders: scaleProbe.guideRenders,
          pipelineBuilds: scaleProbe.pipelineBuilds,
          shaderModuleBuilds: scaleProbe.shaderModuleBuilds,
        };
        const phases = [];
        // Last update changes only the fixed color, with the domain held still.
        const changes = [
          { max: 13, kind: "grow-domain" },
          { max: 5, kind: "shrink-domain" },
          { max: 1, kind: "constant-domain" },
          { max: 7, kind: "restore-domain" },
          { max: 7, kind: "fixed-color-only" },
        ];
        for (const [index, { max, kind }] of changes.entries()) {
          const revision = index + 2;
          scaleProbe.reset();
          const before = {
            mounts: scaleProbe.mounts,
            bundleBuilds: scaleProbe.bundleBuilds,
            guideRenders: scaleProbe.guideRenders,
            pipelineBuilds: scaleProbe.pipelineBuilds,
            shaderModuleBuilds: scaleProbe.shaderModuleBuilds,
          };
          setState({
            scales: spikeScales(
              max,
              kind === "fixed-color-only" ? "#1baf7a" : "#e34948",
            ),
            revision,
            cpu: false,
          });
          await settled(revision);
          phases.push({
            revision,
            kind,
            domain: [1, max],
            counters: scaleProbe.getCounters(),
            newMounts: scaleProbe.mounts - before.mounts,
            newScaleBundles: scaleProbe.bundleBuilds - before.bundleBuilds,
            newPipelines: scaleProbe.pipelineBuilds - before.pipelineBuilds,
            newShaderModules: scaleProbe.shaderModuleBuilds -
              before.shaderModuleBuilds,
            guideRenders: scaleProbe.guideRenders - before.guideRenders,
            guideRevision: scaleProbe.guideRevision,
            cases: structuredClone(scaleProbe.results),
          });
        }
        return { initial, phases };
      },
      drawMode: async (cpu: boolean) => {
        const revision = scaleProbe.revision + 1;
        setState((s) => ({ ...s, revision, cpu }));
        await settled(revision);
      },
    };
    return () => {
      delete globalThis.__gggplotScaleBindingProbe;
    };
  }, []);
  return (
    <div>
      <p id="scale-guide">
        Revision {state.revision}; color domain{" "}
        {state.scales.color.domain.join("–")}
      </p>
      <div id="scale-binding-canvas" style={{ width: 440, height: 340 }}>
        <LiveCanvas
          render={(canvas: HTMLCanvasElement) =>
            liveElement(ScaleBindingScene, { canvas, ...state })}
        />
      </div>
    </div>
  );
}
