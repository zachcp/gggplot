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
  };
  gpu: ReturnType<typeof getGpuMarkCounters>;
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
          },
          gpu: getGpuMarkCounters(),
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
