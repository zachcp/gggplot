/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// The component-form GGPlot root realizes Scene3D's orbit and flat-overlay
// passes; callers still provide a GGSpec, mapped to components here. Extras
// (prism instances, the scene picker) draw in the scene's data space through
// <GGPanel> (gggplot-icxo).
import * as Jsx from "@gggplot/core/jsx";
import type { LiveElement } from "@use-gpu/live";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import {
  createFontResources,
  GGPanel,
  GGPlot,
  type GGSpec,
  type PrismInstance3D,
  PrismInstances3D,
  ScenePicker,
  type ScenePickPublish,
} from "@gggplot/core";
import { withSiteChartTheme3d } from "./chart_theme.ts";
import { assetUrl } from "./asset_url.ts";
import { specChildren } from "./spec_components.tsx";

interface Props {
  canvas: HTMLCanvasElement;
  /** A spec to map to components, or a component-form `chart` to render. */
  spec?: GGSpec;
  chart?: () => LiveElement;
  prismInstances?: readonly PrismInstance3D[];
  /** When present, receives the scene's pointer-to-ray function. */
  publishPick?: ScenePickPublish;
}

export const fontResources = createFontResources([
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

export const Scene3D = (
  { canvas, spec, chart, prismInstances, publishPick }: Props,
) => {
  if (chart) {
    // A component-form showcase (gggplot-vnh.10.1) is its own <GGPlot> tree.
    return (
      <WebGPU fallback={null}>
        <AutoCanvas canvas={canvas} backgroundColor={[0.05, 0.05, 0.07, 1]}>
          {Jsx.createElement(chart, {})}
        </AutoCanvas>
      </WebGPU>
    );
  }
  // Both extras sit inside the scene's Cartesian, where <GGPanel> content
  // draws: the prisms to share its transform, the picker to read the 3D
  // camera's ViewContext rather than the flat overlay's.
  const themed = withSiteChartTheme3d(spec!);
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
        <GGPlot
          data={themed.data}
          mapping={themed.mapping}
          theme={themed.theme}
          labels={themed.labels}
          fontResources={fontResources}
        >
          {specChildren(themed)}
          {extras.length ? <GGPanel>{extras}</GGPanel> : null}
        </GGPlot>
      </AutoCanvas>
    </WebGPU>
  );
};
