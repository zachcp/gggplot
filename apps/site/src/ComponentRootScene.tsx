/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// One canvas that renders scatterLine either through compile() or through the
// component-first <GGPlot> root (gggplot-2bj), so pixels and upload counters
// compare like for like. Layers are reported with the generic GGLayerPart until
// the named geom components land (gggplot-8hz).
import { createElement, type LiveElement, useOne } from "@use-gpu/live";
import * as Jsx from "@gggplot/core/jsx";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import { FlatCamera, Pass, useDeviceContext } from "@use-gpu/workbench";
import {
  type FontResources,
  geomLine,
  geomPoint,
  GGPlot,
  ggplot,
  type GGSpec,
  type Layer,
} from "@gggplot/core";
import { installGpuInstrumentation } from "../../../packages/core/src/render/gpu_instrument.ts";
import { GGLayerPart } from "../../../packages/core/src/components/parts.ts";
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
// Layer objects keep their identity while their inputs do, as the named geom
// components will (the root memoizes each layer's stat and lowering on it).
const THIRD_LAYER = geomPoint(THIRD).value as Layer;
const LINE_LAYER = geomLine(LINE).value as Layer;
const pointLayers = new Map<string, Layer>();
const pointLayer = (color: string) => {
  if (!pointLayers.has(color)) {
    pointLayers.set(color, geomPoint({ size: 6, color }).value as Layer);
  }
  return pointLayers.get(color)!;
};

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
    <GGPlot data={data} mapping={mapping} theme={theme} fontResources={fonts}>
      {state.third ? <GGLayerPart key="third" layer={THIRD_LAYER} /> : null}
      <GGLayerPart key="points" layer={pointLayer(state.pointColor)} />
      <GGLayerPart key="line" layer={LINE_LAYER} />
    </GGPlot>
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
