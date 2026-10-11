/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// vnh.3: one canvas that renders scatterLine either through compile() or
// through the Capture root, so pixels and upload counters compare like for like.
import { createElement, type LiveElement, useOne } from "@use-gpu/live";
import * as Jsx from "@gggplot/core/jsx";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import {
  FlatCamera,
  FontLoader,
  Pass,
  useDeviceContext,
} from "@use-gpu/workbench";
import {
  type FontResources,
  geomLine,
  geomPoint,
  GGPlot,
  ggplot,
  type GGSpec,
} from "@gggplot/core";
import { installGpuInstrumentation } from "../../../packages/core/src/render/gpu_instrument.ts";
import {
  GeomLineX,
  GeomPointX,
  GGPlotX,
} from "../../../packages/core/spikes/ggplot_capture.ts";
import { withSiteChartTheme } from "./chart_theme.ts";
import { scatterLine } from "./docs/examples.tsx";

export interface ComponentRootState {
  mode: "compile" | "component";
  pointColor: string;
  /** Adds a third layer BEFORE the first two, the harder case for keyed reconciliation. */
  third: boolean;
  width: number;
}

const data = scatterLine.spec!.data;
const mapping = { x: "wt", y: "mpg" };
const theme = withSiteChartTheme(scatterLine.spec!).theme;
const THIRD = { size: 3, color: "#f59e0b" };
const LINE = { color: "#ef4444" };

/** The same plot as a spec, for the compile path. */
export function compiledSpec(state: ComponentRootState): GGSpec {
  const plot = ggplot(data, mapping);
  if (state.third) plot.add(geomPoint(THIRD));
  plot.add(geomPoint({ size: 6, color: state.pointColor }), geomLine(LINE));
  return withSiteChartTheme(plot.build());
}

function Instrumented({ children }: { children: LiveElement }): LiveElement {
  const device = useDeviceContext();
  useOne(() => installGpuInstrumentation(device));
  return children;
}

function Plot(
  { state, fonts }: { state: ComponentRootState; fonts: FontResources },
): LiveElement {
  if (state.mode === "compile") {
    return createElement(GGPlot, {
      spec: compiledSpec(state),
      fontResources: fonts,
    });
  }
  return (
    // FontFaceResource types `lazy` as unknown; GGPlot passes faces through
    // to FontLoader the same way, untyped.
    <FontLoader fonts={fonts.faces as never}>
      <GGPlotX data={data} mapping={mapping} theme={theme}>
        {state.third ? <GeomPointX key="third" {...THIRD} /> : null}
        <GeomPointX key="points" size={6} color={state.pointColor} />
        <GeomLineX key="line" {...LINE} />
      </GGPlotX>
    </FontLoader>
  );
}

export function ComponentRootScene(
  { canvas, state, fonts }: {
    canvas: HTMLCanvasElement;
    state: ComponentRootState;
    fonts: FontResources;
  },
): LiveElement {
  return (
    <WebGPU fallback={null}>
      <AutoCanvas canvas={canvas} backgroundColor={[0.05, 0.05, 0.07, 1]}>
        <FlatCamera>
          <Pass>
            <Instrumented>
              <Plot state={state} fonts={fonts} />
            </Instrumented>
          </Pass>
        </FlatCamera>
      </AutoCanvas>
    </WebGPU>
  );
}
