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
        // Fixed color changes only in the green phases; the domain is held
        // still by the phase after each change.
        const red = "#e34948";
        const green = "#1baf7a";
        // The last phase is the pixel capture. It sits at [1,13], not the
        // initial [1,7], so pixels also prove domain updates reach the draw.
        const changes = [
          { min: 1, max: 13, fixed: red, kind: "grow-domain" },
          { min: 1, max: 5, fixed: red, kind: "shrink-domain" },
          { min: 1, max: 1, fixed: red, kind: "constant-domain" },
          { min: 1, max: 7, fixed: red, kind: "restore-domain" },
          { min: 1, max: 7, fixed: green, kind: "fixed-color-only" },
          // Reversed domain: CPU and GPU must both map every value to t=0.
          { min: 13, max: 1, fixed: green, kind: "reversed-domain" },
          { min: 1, max: 13, fixed: green, kind: "pixel-domain" },
        ];
        for (const [index, { min, max, fixed, kind }] of changes.entries()) {
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
            scales: spikeScales(max, fixed, min),
            revision,
            cpu: false,
          });
          await settled(revision);
          phases.push({
            revision,
            kind,
            domain: [min, max],
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
