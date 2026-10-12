/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// Hosts a component-form 3D chart (a <GGPlot> tree mapping z) on the WebGPU
// canvas. Extras (prism instances, the scene picker) draw in the scene's data
// space through <GGPanel> (gggplot-icxo); the chart places that panel inside
// its own plot.
import * as Jsx from "@gggplot/core/jsx";
import type { LiveElement } from "@use-gpu/live";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import {
  GGPanel,
  type PrismInstance3D,
  PrismInstances3D,
  ScenePicker,
  type ScenePickPublish,
} from "@gggplot/core";

/**
 * A 3D chart. `panel`, when given, is a <GGPanel> of host extras to render
 * inside the chart's <GGPlot>; charts without extras ignore it.
 */
export type Chart3D = (panel?: LiveElement) => LiveElement;

interface Props {
  canvas: HTMLCanvasElement;
  chart: Chart3D;
  prismInstances?: readonly PrismInstance3D[];
  /** When present, receives the scene's pointer-to-ray function. */
  publishPick?: ScenePickPublish;
}

export const Scene3D = (
  { canvas, chart, prismInstances, publishPick }: Props,
) => {
  // Both extras sit inside the scene's Cartesian, where <GGPanel> content
  // draws: the prisms to share its transform, the picker to read the 3D
  // camera's ViewContext rather than the flat overlay's.
  const extras = [
    ...(prismInstances?.length
      ? [Jsx.createElement(PrismInstances3D, { instances: prismInstances })]
      : []),
    ...(publishPick
      ? [Jsx.createElement(ScenePicker, { publish: publishPick })]
      : []),
  ];
  return (
    <WebGPU fallback={null}>
      <AutoCanvas canvas={canvas} backgroundColor={[0.05, 0.05, 0.07, 1]}>
        {chart(extras.length ? <GGPanel>{extras}</GGPanel> : undefined)}
      </AutoCanvas>
    </WebGPU>
  );
};
