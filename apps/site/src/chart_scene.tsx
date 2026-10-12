/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// UseGPU Live scene hosting a component-form doc example (DocExample.chart)
// on the WebGPU canvas.
import * as Jsx from "@gggplot/core/jsx";
import type { LiveElement } from "@use-gpu/live";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import { FlatCamera, Pass } from "@use-gpu/workbench";

export const ChartScene = (
  { canvas, chart }: {
    canvas: HTMLCanvasElement;
    chart: () => LiveElement;
  },
): LiveElement => (
  <WebGPU fallback={null}>
    <AutoCanvas canvas={canvas} backgroundColor={[0.05, 0.05, 0.07, 1]}>
      <FlatCamera>
        {
          /* Called, not mounted as a component: a chart is a builder, and a new
            builder per render (a probe's changing domain) must reconcile its
            <GGPlot> in place rather than remount the plot as a new type. */
        }
        <Pass>{chart()}</Pass>
      </FlatCamera>
    </AutoCanvas>
  </WebGPU>
);
