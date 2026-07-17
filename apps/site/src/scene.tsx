/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
// UseGPU Live scene that hosts a gggplot spec on the WebGPU canvas.
// FlatCamera establishes the pixel-space 2D view (RenderContext -> LayoutContext
// + view/projection uniforms) that GGPlot's Cartesian panel renders into.

import { createElement, Fragment } from "@use-gpu/live";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import { FlatCamera, Pass } from "@use-gpu/workbench";
import { GGPlot } from "@gggplot/core";
import type { GGSpec } from "@gggplot/core";
import { withSiteChartTheme } from "./chart_theme.ts";

interface Props {
  canvas: HTMLCanvasElement;
  spec: GGSpec;
}

const fonts = [
  {
    family: "sans-serif",
    weight: 400,
    style: "normal",
    src: "/fonts/SFNS.ttf",
  },
  { family: "Georgia", weight: 400, style: "normal", src: "/fonts/SFNS.ttf" },
];

export const Scene = ({ canvas, spec }: Props) => (
  <WebGPU fallback={null}>
    <AutoCanvas canvas={canvas} backgroundColor={[0.05, 0.05, 0.07, 1]}>
      <FlatCamera>
        <Pass>
          <GGPlot spec={withSiteChartTheme(spec)} fonts={fonts} />
        </Pass>
      </FlatCamera>
    </AutoCanvas>
  </WebGPU>
);
