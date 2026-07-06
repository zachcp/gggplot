/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
// UseGPU Live scene that hosts a gggplot spec on the WebGPU canvas.
// Camera/pass wiring for 2D plots still needs in-browser tuning — this is the
// surface to iterate on (see beads: apps/site live canvas).

import { createElement, Fragment } from "@use-gpu/live";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import { Pass } from "@use-gpu/workbench";
import { GGPlot } from "@gggplot/core";
import type { GGSpec } from "@gggplot/core";

interface Props {
  canvas: HTMLCanvasElement;
  spec: GGSpec;
}

export const Scene = ({ canvas, spec }: Props) => (
  <WebGPU fallback={null}>
    <AutoCanvas canvas={canvas} backgroundColor={[0.05, 0.05, 0.07, 1]}>
      <Pass>
        <GGPlot spec={spec} />
      </Pass>
    </AutoCanvas>
  </WebGPU>
);
