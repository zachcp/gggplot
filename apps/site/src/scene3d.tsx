/** @jsxRuntime classic */
/** @jsx createElement */
// The shared GGPlot host compiles dimensionality and realizes Scene3D's orbit
// and flat-overlay passes. Callers provide only GGSpec, exactly as in 2D.
import { createElement } from "@use-gpu/live";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import {
  createFontResources,
  GGPlot,
  type GGSpec,
  type PrismInstance3D,
  PrismInstances3D,
  ScenePicker,
  type ScenePickPublish,
} from "@gggplot/core";
import { withSiteChartTheme3d } from "./chart_theme.ts";

interface Props {
  canvas: HTMLCanvasElement;
  spec: GGSpec;
  prismInstances?: readonly PrismInstance3D[];
  /** When present, receives the scene's pointer-to-ray function. */
  publishPick?: ScenePickPublish;
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

export const Scene3D = ({ canvas, spec, prismInstances, publishPick }: Props) => {
  // Both extras must sit inside the panel's Cartesian node: the prisms to share
  // its transform, the picker to read the 3D camera's ViewContext rather than
  // the flat overlay's.
  const extras = [
    ...(prismInstances?.length
      ? [createElement(PrismInstances3D, { instances: prismInstances })]
      : []),
    ...(publishPick ? [createElement(ScenePicker, { publish: publishPick })] : []),
  ];
  return (
    <WebGPU fallback={null}>
      <AutoCanvas canvas={canvas} backgroundColor={[0.05, 0.05, 0.07, 1]}>
        <GGPlot
          spec={withSiteChartTheme3d(spec)}
          fontResources={fontResources}
          sceneExtras={extras.length ? extras : undefined}
        />
      </AutoCanvas>
    </WebGPU>
  );
};
