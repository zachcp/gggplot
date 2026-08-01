/** @jsxRuntime classic */
/** @jsx createElement */
// The shared GGPlot host compiles dimensionality and realizes Scene3D's orbit
// and flat-overlay passes. Callers provide only GGSpec, exactly as in 2D.
import { createElement } from "@use-gpu/live";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import { createFontResources, GGPlot, type GGSpec } from "@gggplot/core";
import { withSiteChartTheme3d } from "./chart_theme.ts";

interface Props {
  canvas: HTMLCanvasElement;
  spec: GGSpec;
}

const fontResources = createFontResources([
  {
    family: "Basic",
    weight: 400,
    style: "normal",
    src: "/fonts/Basic-Regular.ttf",
  },
  {
    family: "Lato",
    weight: 400,
    style: "normal",
    src: "/fonts/Lato-Regular.ttf",
  },
]);

export const Scene3D = ({ canvas, spec }: Props) => (
  <WebGPU fallback={null}>
    <AutoCanvas canvas={canvas} backgroundColor={[0.05, 0.05, 0.07, 1]}>
      <GGPlot
        spec={withSiteChartTheme3d(spec)}
        fontResources={fontResources}
      />
    </AutoCanvas>
  </WebGPU>
);
