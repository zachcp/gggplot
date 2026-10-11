/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// One canvas that renders scatterLine either through compile() or through the
// component-first <GGPlot> root (gggplot-2bj), so pixels and upload counters
// compare like for like. Layers are reported with the generic GGLayerPart until
// the named geom components land (gggplot-8hz).
import { createElement, type LiveElement, useOne } from "@use-gpu/live";
import * as Jsx from "@gggplot/core/jsx";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import {
  FlatCamera,
  Pass,
  PointLayer,
  useDeviceContext,
  useRawSource,
} from "@use-gpu/workbench";
import {
  type FontResources,
  geomBar,
  geomBlank,
  geomLine,
  geomPoint,
  GGData,
  GGPanel,
  GGPart,
  GGPlot,
  ggplot,
  type GGSpec,
  ingest,
  type Layer,
  scaleColor,
  type SpecPart,
  touchColumn,
  typedArrayForColumn,
  useGGColors,
  useGGSizes,
} from "@gggplot/core";
import { installGpuInstrumentation } from "../../../packages/core/src/render/gpu_instrument.ts";
import { GGLayerPart } from "../../../packages/core/src/components/parts.ts";
import { withSiteChartTheme } from "./chart_theme.ts";
import { scatterLine } from "./docs/examples.tsx";

export interface ComponentRootState {
  /**
   * "shared": two component plots (points, line) under one <GGData>, to count
   * column uploads across plots (gggplot-0m6).
   */
  /**
   * "loaded": the component plot with its frame from <GGData load>
   * (gggplot-y43). "resident": a resident stat_count plot under <GGData>,
   * whose product must read the data tier's column, not upload its own.
   */
  mode: "compile" | "component" | "shared" | "loaded" | "resident" | "bump";
  pointColor: string;
  /** Adds a third layer BEFORE the first two, the harder case for keyed reconciliation. */
  third: boolean;
  width: number;
  /**
   * A point layer with color and size mapped to continuous columns, its color
   * domain declared (gggplot-fbq): the GPU-bound path against compile().
   */
  scaled?: boolean;
  colorDomain?: [number, number];
  /**
   * A point layer colored by a factor (gggplot-81r): its level codes bind
   * through a lookup, so a palette swap or level reorder writes the lookup
   * and no mark data.
   */
  discrete?: boolean;
  palette?: string[];
  levels?: string[];
  /**
   * With `scaled`: the point layer becomes geom_blank (same scales, no
   * marks) and a custom PointLayer inside <GGPanel> draws the points instead,
   * colored and sized through useGGColors/useGGSizes (gggplot-7j9). If those
   * match the layer's own mapping, no pixel changes.
   */
  custom?: boolean;
  /** Shifts the custom points in y: the check that they render at all. */
  customOffset?: number;
  /**
   * With `scaled`: drop the size mapping and draw at this fixed size, beside
   * the GPU-bound color (gggplot-bv0's fixed-aesthetic invariant).
   */
  fixedSize?: number;
  /** In "bump" mode: each increment touches one column in place. */
  bump?: number;
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

const SCALED_MAPPING = { x: "wt", y: "mpg", color: "mpg", size: "wt" };
const SCALED_LAYER = geomPoint().value as Layer;
// Trains the same scales and draws nothing: the custom points draw instead.
const BLANK_LAYER = geomBlank().value as Layer;
const colorParts = new Map<string, SpecPart>();
const colorPart = (domain: [number, number]) => {
  const key = domain.join(",");
  if (!colorParts.has(key)) colorParts.set(key, scaleColor({ domain }));
  return colorParts.get(key)!;
};

// mtcars weight bands as a factor column beside the frame's own columns.
const DISCRETE_DATA = {
  ...data,
  band: ingest({
    band: (data.wt.values as number[]).map((wt) =>
      wt < 2.5 ? "light" : wt < 3.5 ? "mid" : "heavy"
    ),
  }).band,
};
const DISCRETE_MAPPING = { x: "wt", y: "mpg", color: "band" };
const DISCRETE_LAYER = geomPoint({ size: 6 }).value as Layer;
const DEFAULT_PALETTE = ["#2a78d6", "#1baf7a", "#eda100"];
const DEFAULT_LEVELS = ["light", "mid", "heavy"];
const discreteParts = new Map<string, SpecPart>();
const discretePart = (state: ComponentRootState) => {
  const range = state.palette ?? DEFAULT_PALETTE;
  const domain = state.levels ?? DEFAULT_LEVELS;
  const key = JSON.stringify([range, domain]);
  if (!discreteParts.has(key)) {
    discreteParts.set(key, scaleColor({ range, domain }));
  }
  return discreteParts.get(key)!;
};

const WT = Float32Array.from(data.wt.values as number[]);
const MPG = Float32Array.from(data.mpg.values as number[]);
const POSITIONS = Float32Array.from(
  Array.from(WT, (wt, i) => [wt, MPG[i]]).flat(),
);

/** The scaled layer's points again, bound through the public scale hooks. */
function CustomPoints({ offset = 0 }: { offset?: number }): LiveElement {
  const shifted = useOne(
    () =>
      offset
        ? POSITIONS.map((v, i) => (i % 2 === 1 ? v + offset : v))
        : POSITIONS,
    offset,
  );
  const positions = useRawSource(shifted, "vec2<f32>");
  const colors = useGGColors(MPG, "color");
  const sizes = useGGSizes(WT);
  return createElement(PointLayer, {
    positions,
    colors,
    sizes,
    count: WT.length,
  });
}

/** The same plot as a spec, for the compile path. */
export function compiledSpec(state: ComponentRootState): GGSpec {
  if (state.discrete) {
    return withSiteChartTheme(
      ggplot(DISCRETE_DATA, DISCRETE_MAPPING)
        .add(geomPoint({ size: 6 }), discretePart(state))
        .build(),
    );
  }
  if (state.scaled) {
    return withSiteChartTheme(
      ggplot(data, SCALED_MAPPING)
        .add(geomPoint(), colorPart(state.colorDomain ?? [10, 30]))
        .build(),
    );
  }
  const plot = ggplot(data, mapping);
  if (state.third) plot.add(geomPoint(THIRD));
  plot.add(geomPoint({ size: 6, color: state.pointColor }), geomLine(LINE));
  return withSiteChartTheme(plot.build());
}

/** Shader modules and render pipelines built (vnh.16's rebuild counters). */
export const builds = { shaderModules: 0, pipelines: 0 };

/** Uploads whose payload is a frame column's typed array, by column name. */
export const columnUploads: Record<string, number> = {};
// A frame stat_count keeps resident: 20k factor ids, as the doc example has.
const RESIDENT_DATA = ingest({
  category: Array.from(
    { length: 20_000 },
    (_, i) => ["alpha", "beta", "gamma", "delta"][i % 4],
  ),
});
const RESIDENT_LAYER = geomBar({ fill: "#2563eb" }).value as Layer;
// Its own column objects, so touching one never disturbs the other modes.
const BUMP_DATA = ingest(
  Object.fromEntries(
    Object.entries(data).map(([name, column]) => [
      name,
      [...(column.values as unknown[])],
    ]),
  ),
);
const BUMP_LAYER = geomPoint({ size: 6 }).value as Layer;
const fixedSizeLayers = new Map<number, Layer>();
const fixedSizeLayer = (size: number) => {
  if (!fixedSizeLayers.has(size)) {
    fixedSizeLayers.set(size, geomPoint({ size }).value as Layer);
  }
  return fixedSizeLayers.get(size)!;
};
const COLOR_ONLY_MAPPING = { x: "wt", y: "mpg", color: "mpg" };

/** A stable producer: a new function would be a new load. */
const LOAD = () => Promise.resolve(data);

const columnBuffers = new Map<ArrayBufferLike, string>(
  [...Object.entries(data), ...Object.entries(RESIDENT_DATA)].map((
    [name, column],
  ) => [typedArrayForColumn(column).buffer, name]),
);

function Instrumented({ children }: { children: LiveElement }): LiveElement {
  const device = useDeviceContext();
  useOne(() => {
    installGpuInstrumentation(device);
    const module = device.createShaderModule.bind(device);
    device.createShaderModule = (descriptor) => {
      builds.shaderModules++;
      return module(descriptor);
    };
    const render = device.createRenderPipelineAsync.bind(device);
    device.createRenderPipelineAsync = (descriptor) => {
      builds.pipelines++;
      return render(descriptor);
    };
    const renderSync = device.createRenderPipeline.bind(device);
    device.createRenderPipeline = (descriptor) => {
      builds.pipelines++;
      return renderSync(descriptor);
    };
    const write = device.queue.writeBuffer.bind(device.queue);
    device.queue.writeBuffer = ((buffer, offset, payload, ...rest) => {
      const bytes = ArrayBuffer.isView(payload) ? payload.buffer : payload;
      // A touched column lowers to a NEW typed array, so the bump frame is
      // matched against its columns' current arrays at write time.
      const name = columnBuffers.get(bytes) ??
        Object.entries(BUMP_DATA).find(([, column]) =>
          typedArrayForColumn(column).buffer === bytes
        )?.[0];
      if (name) columnUploads[name] = (columnUploads[name] ?? 0) + 1;
      return write(buffer, offset, payload, ...rest);
    }) as GPUQueue["writeBuffer"];
  });
  return children;
}

function Plot(
  { state, fonts }: { state: ComponentRootState; fonts: FontResources },
): LiveElement {
  if (state.mode === "shared") {
    return (
      <GGData data={data}>
        <GGPlot mapping={mapping} theme={theme} fontResources={fonts}>
          <GGLayerPart layer={pointLayer(state.pointColor)} />
        </GGPlot>
        <GGPlot mapping={mapping} theme={theme} fontResources={fonts}>
          <GGLayerPart layer={LINE_LAYER} />
        </GGPlot>
      </GGData>
    );
  }
  if (state.mode === "bump") {
    return <BumpPlot bump={state.bump ?? 0} fonts={fonts} />;
  }
  if (state.mode === "loaded") {
    return (
      <GGData load={LOAD}>
        <GGPlot mapping={mapping} theme={theme} fontResources={fonts}>
          <GGLayerPart key="points" layer={pointLayer(state.pointColor)} />
          <GGLayerPart key="line" layer={LINE_LAYER} />
        </GGPlot>
      </GGData>
    );
  }
  if (state.mode === "resident") {
    return (
      <GGData data={RESIDENT_DATA}>
        <GGPlot mapping={{ x: "category" }} theme={theme} fontResources={fonts}>
          <GGLayerPart layer={RESIDENT_LAYER} />
        </GGPlot>
      </GGData>
    );
  }
  if (state.mode === "component" && state.discrete) {
    return (
      <GGPlot
        data={DISCRETE_DATA}
        mapping={DISCRETE_MAPPING}
        theme={theme}
        fontResources={fonts}
      >
        <GGLayerPart layer={DISCRETE_LAYER} />
        <GGPart part={discretePart(state)} />
      </GGPlot>
    );
  }
  if (state.mode === "component" && state.scaled && state.fixedSize) {
    return (
      <GGPlot
        data={data}
        mapping={COLOR_ONLY_MAPPING}
        theme={theme}
        fontResources={fonts}
      >
        <GGLayerPart layer={fixedSizeLayer(state.fixedSize)} />
        <GGPart part={colorPart(state.colorDomain ?? [10, 30])} />
      </GGPlot>
    );
  }
  if (state.mode === "component" && state.scaled) {
    return (
      <GGPlot
        data={data}
        mapping={SCALED_MAPPING}
        theme={theme}
        fontResources={fonts}
      >
        <GGLayerPart layer={state.custom ? BLANK_LAYER : SCALED_LAYER} />
        <GGPart part={colorPart(state.colorDomain ?? [10, 30])} />
        {state.custom
          ? (
            <GGPanel>
              <CustomPoints offset={state.customOffset ?? 0} />
            </GGPanel>
          )
          : null}
      </GGPlot>
    );
  }
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

/** Touches BUMP_DATA.mpg once per increment, then plots the shared frame. */
function BumpPlot(
  { bump, fonts }: { bump: number; fonts: FontResources },
): LiveElement {
  useOne(() => {
    if (bump) touchColumn(BUMP_DATA.mpg);
  }, bump);
  return (
    <GGData data={BUMP_DATA}>
      <GGPlot mapping={mapping} theme={theme} fontResources={fonts}>
        <GGLayerPart layer={BUMP_LAYER} />
      </GGPlot>
    </GGData>
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
