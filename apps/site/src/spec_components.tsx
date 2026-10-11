/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// Site-internal: a GGSpec's layers and plot-level parts as component-root
// children (<GeomLayer> per layer, <GGPart> per part). Hosts that still
// receive specs (the 3D/model-inspection scenes, the frame-parity harness)
// render through the component root with this until their callers build
// components directly (gggplot-vnh.10.1, -vnh.18). Not a public spec bridge.
import * as Jsx from "@gggplot/core/jsx";
import type { LiveElement } from "@use-gpu/live";
import { GeomLayer, GGPart, type GGSpec, type SpecPart } from "@gggplot/core";

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

/** The spec's layers and parts, as children of a component-form <GGPlot>. */
export function specChildren(spec: GGSpec): LiveElement[] {
  return [
    ...spec.layers.map((layer, i) => (
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
    )),
    ...specParts(spec).map((part, i) => (
      <GGPart
        key={`part-${i}`}
        part={part}
      />
    )),
  ];
}
