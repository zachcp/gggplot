import { useEffect, useState } from "react";
import { LiveCanvas } from "@use-gpu/react";
import { createFontResources } from "@gggplot/core";
import { createElement as liveElement } from "../../../packages/core/src/runtime/usegpu_compat.ts";
import {
  getGpuMarkCounters,
  resetGpuMarkCounters,
} from "../../../packages/core/src/render/gpu_instrument.ts";
import { componentProbe } from "../../../packages/core/src/components/probe.ts";
import {
  builds,
  columnUploads,
  ComponentRootScene,
  type ComponentRootState,
} from "./ComponentRootScene.tsx";
import { assetUrl } from "./asset_url.ts";

declare global {
  var __gggplotComponentRootProbe: undefined | {
    /** Apply a state change, wait for it to settle, return what it cost. */
    step: (change: Partial<ComponentRootState>) => Promise<StepCost>;
  };
}

export interface StepCost {
  state: ComponentRootState;
  work: {
    statCalls: number;
    lowerCalls: number;
    assembleCalls: number;
    viewRenders: number;
    layerMounts: number;
    boundRenders: number;
    scalesRevision: number;
  };
  gpu: ReturnType<typeof getGpuMarkCounters>;
  /** Uploads of each frame column's typed array during the step. */
  columnUploads: Record<string, number>;
  newShaderModules: number;
  newPipelines: number;
}

const fonts = createFontResources([
  {
    family: "Basic",
    weight: 400,
    style: "normal",
    src: assetUrl("/fonts/Basic-Regular.ttf"),
  },
  {
    family: "Lato",
    weight: 400,
    style: "normal",
    src: assetUrl("/fonts/Lato-Regular.ttf"),
  },
]);

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
  }
};

const INITIAL: ComponentRootState = {
  mode: "component",
  pointColor: "#3b82f6",
  third: false,
  width: 520,
};

export function ComponentRootProbe() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(INITIAL);
  useEffect(() => {
    fonts.ready().then(() => setReady(true));
  }, []);
  useEffect(() => {
    let current = INITIAL;
    globalThis.__gggplotComponentRootProbe = {
      step: async (change) => {
        // Let any earlier change finish before the counters start.
        await frames(10);
        componentProbe.reset();
        resetGpuMarkCounters();
        for (const name of Object.keys(columnUploads)) {
          delete columnUploads[name];
        }
        const before = { ...builds };
        current = { ...current, ...change };
        setState(current);
        await frames(30);
        return {
          state: current,
          work: {
            statCalls: componentProbe.statCalls,
            lowerCalls: componentProbe.lowerCalls,
            assembleCalls: componentProbe.assembleCalls,
            viewRenders: componentProbe.viewRenders,
            layerMounts: componentProbe.layerMounts,
            boundRenders: componentProbe.boundRenders,
            scalesRevision: componentProbe.scalesRevision,
          },
          gpu: getGpuMarkCounters(),
          columnUploads: { ...columnUploads },
          newShaderModules: builds.shaderModules - before.shaderModules,
          newPipelines: builds.pipelines - before.pipelines,
        };
      },
    };
    return () => {
      delete globalThis.__gggplotComponentRootProbe;
    };
  }, []);
  if (!ready) return <p>Loading fonts…</p>;
  return (
    <div
      id="component-root-canvas"
      style={{ width: state.width, height: 360 }}
    >
      <LiveCanvas
        render={(canvas: HTMLCanvasElement) =>
          liveElement(ComponentRootScene, { canvas, state, fonts })}
      />
    </div>
  );
}
