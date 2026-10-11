/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// Test harness only (gggplot-b7f): renders a doc example's spec through the
// component path, so scripts/example_frames.ts can compare it with the
// compile path frame for frame (spec_components.tsx maps the spec). Doc
// examples themselves are being rewritten in JSX by hand (gggplot-vnh.10.1).
import * as Jsx from "@gggplot/core/jsx";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import { FlatCamera, Pass } from "@use-gpu/workbench";
import { GGPlot, type GGSpec } from "@gggplot/core";
import { withSiteChartTheme } from "./chart_theme.ts";
import { fontResources } from "./scene.tsx";
import { specChildren } from "./spec_components.tsx";

export const ComponentScene = (
  { canvas, spec }: { canvas: HTMLCanvasElement; spec: GGSpec },
) => {
  const themed = withSiteChartTheme(spec);
  return (
    <WebGPU fallback={null}>
      <AutoCanvas canvas={canvas} backgroundColor={[0.05, 0.05, 0.07, 1]}>
        <FlatCamera>
          <Pass>
            <GGPlot
              data={themed.data}
              mapping={themed.mapping}
              theme={themed.theme}
              labels={themed.labels}
              fontResources={fontResources}
            >
              {specChildren(themed)}
            </GGPlot>
          </Pass>
        </FlatCamera>
      </AutoCanvas>
    </WebGPU>
  );
};
