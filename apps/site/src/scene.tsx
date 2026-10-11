/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
/** @jsxFrag Jsx.Fragment */
// UseGPU Live scene that hosts a programmatically built plot (the model
// inspection views and probes, which still describe their plots as specs) on
// the WebGPU canvas, through the component-form <GGPlot> root: the spec's
// layers and parts map to components (spec_components.tsx), so nothing in the
// site calls compile() (gggplot-tnxt). FlatCamera establishes the pixel-space
// 2D view (RenderContext -> LayoutContext + view/projection uniforms) that
// GGPlot's Cartesian panel renders into.

import * as Jsx from "@gggplot/core/jsx";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import { FlatCamera, Pass } from "@use-gpu/workbench";
import { GGPlot } from "@gggplot/core";
import type { GGSpec } from "@gggplot/core";
import { withSiteChartTheme } from "./chart_theme.ts";
import { specChildren } from "./spec_components.tsx";

interface Props {
  canvas: HTMLCanvasElement;
  spec: GGSpec;
}

export { fontResources } from "./site_fonts.ts";
import { fontResources } from "./site_fonts.ts";

export const Scene = ({ canvas, spec }: Props) => {
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
