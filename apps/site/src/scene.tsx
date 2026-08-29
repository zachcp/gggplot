/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
// UseGPU Live scene that hosts a gggplot spec on the WebGPU canvas.
// FlatCamera establishes the pixel-space 2D view (RenderContext -> LayoutContext
// + view/projection uniforms) that GGPlot's Cartesian panel renders into.

import { createElement, Fragment } from "@use-gpu/live";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import { FlatCamera, Pass } from "@use-gpu/workbench";
import { createFontResources, GGPlot } from "@gggplot/core";
import type { GGSpec } from "@gggplot/core";
import { withSiteChartTheme } from "./chart_theme.ts";
import { assetUrl } from "./asset_url.ts";

interface Props {
  canvas: HTMLCanvasElement;
  spec: GGSpec;
}

const fontResources = createFontResources([
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

export const Scene = ({ canvas, spec }: Props) => (
  <WebGPU fallback={null}>
    <AutoCanvas canvas={canvas} backgroundColor={[0.05, 0.05, 0.07, 1]}>
      <FlatCamera>
        <Pass>
          <GGPlot
            spec={withSiteChartTheme(spec)}
            fontResources={fontResources}
          />
        </Pass>
      </FlatCamera>
    </AutoCanvas>
  </WebGPU>
);
