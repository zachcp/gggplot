/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// Test harness only (gggplot-b7f): renders a doc example's spec through the
// component path, so scripts/example_frames.ts can compare it with the
// compile path frame for frame. Each spec layer becomes a <GeomLayer> and each
// plot-level part a <GGPart>. Doc examples themselves are being rewritten in
// JSX by hand (gggplot-vnh.10.1); this is not a public spec bridge.
import * as Jsx from "@gggplot/core/jsx";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import { FlatCamera, Pass } from "@use-gpu/workbench";
import {
  GeomLayer,
  GGPart,
  GGPlot,
  type GGSpec,
  type SpecPart,
} from "@gggplot/core";
import { withSiteChartTheme } from "./chart_theme.ts";
import { fontResources } from "./scene.tsx";

/** The non-layer grammar parts a spec carries. */
function specParts(spec: GGSpec): SpecPart[] {
  return [
    ...spec.scales.map((value): SpecPart => ({ tag: "scale", value })),
    { tag: "coord", value: spec.coord },
    { tag: "facet", value: spec.facet },
    ...(spec.camera ? [{ tag: "camera", value: spec.camera } as SpecPart] : []),
    ...(spec.execution
      ? [{ tag: "execution", value: spec.execution } as SpecPart]
      : []),
  ];
}

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
              {themed.layers.map((layer, i) => (
                <GeomLayer
                  key={`layer-${i}`}
                  {...layer.params}
                  geom={layer.geom}
                  stat={layer.stat}
                  position={layer.position}
                  {...(layer.mapping ? { mapping: layer.mapping } : {})}
                  {...(layer.data ? { data: layer.data } : {})}
                  {...(layer.inheritAes === false ? { inheritAes: false } : {})}
                />
              ))}
              {specParts(themed).map((part, i) => (
                <GGPart key={`part-${i}`} part={part} />
              ))}
            </GGPlot>
          </Pass>
        </FlatCamera>
      </AutoCanvas>
    </WebGPU>
  );
};
