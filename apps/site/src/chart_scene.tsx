/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// UseGPU Live scene hosting a component-form doc example (DocExample.chart)
// on the WebGPU canvas, as scene.tsx hosts a spec.
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
        <Pass>{Jsx.createElement(chart, {})}</Pass>
      </FlatCamera>
    </AutoCanvas>
  </WebGPU>
);
