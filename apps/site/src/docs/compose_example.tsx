/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// gggplot-ajvb: a doc example composing a raw Use.GPU primitive with gggplot
// geoms. Three clusters of points are drawn by <GeomPoint>; each cluster's
// center is drawn by workbench's own PointLayer as a hollow halo, inside a
// <GGLayer> whose rows train the same scales. The halos take their colors from
// useGGColors, so a halo and its cluster agree with the legend by
// construction, and the centers widen the axes like any layer's rows.
import * as Jsx from "@gggplot/core/jsx";
import type { LiveElement } from "@use-gpu/live";
import { PointLayer, useRawSource } from "@use-gpu/workbench";
import { GeomPoint, GGLayer, Labs, useGGColors } from "@gggplot/core";
import { SitePlot } from "../site_plot.tsx";
import type { DocExample } from "./types.ts";

// Deterministic clusters: a small LCG instead of Math.random, so the frame is
// stable across loads.
let seed = 7;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const CENTERS = [
  { x: 2, y: 3, value: 10 },
  { x: 5, y: 7, value: 22 },
  { x: 8, y: 4, value: 34 },
];
const points = CENTERS.flatMap((c) =>
  Array.from({ length: 40 }, () => ({
    x: c.x + (random() - 0.5) * 2.4,
    y: c.y + (random() - 0.5) * 2.4,
    value: c.value + (random() - 0.5) * 8,
  }))
);
const clusters = {
  x: points.map((p) => p.x),
  y: points.map((p) => p.y),
  value: points.map((p) => p.value),
};
const centers = {
  x: CENTERS.map((c) => c.x),
  y: CENTERS.map((c) => c.y),
  value: CENTERS.map((c) => c.value),
};
const CENTER_POSITIONS = Float32Array.from(
  CENTERS.flatMap((c) => [c.x, c.y]),
);
const CENTER_VALUES = Float32Array.from(CENTERS.map((c) => c.value));

/** A raw workbench primitive, colored by the plot's own color scale. */
function Halos(): LiveElement {
  const positions = useRawSource(CENTER_POSITIONS, "vec2<f32>");
  const colors = useGGColors(CENTER_VALUES);
  return (
    <PointLayer
      positions={positions}
      colors={colors}
      count={CENTERS.length}
      size={64}
      hollow
      outline={3}
    />
  );
}

function ComposeChart(): LiveElement {
  return (
    <SitePlot data={clusters} mapping={{ x: "x", y: "y", color: "value" }}>
      <GeomPoint size={4} />
      <GGLayer data={centers}>
        <Halos />
      </GGLayer>
      <Labs title="Clusters with halo centers" color="value" />
    </SitePlot>
  );
}

export const composeWithUseGpu: DocExample = {
  id: "ComposeWithUseGpu",
  title: "Compose with Use.GPU",
  description:
    "gggplot points beside a raw Use.GPU PointLayer that draws a halo around each cluster center, both colored by one shared scale.",
  visualSummary:
    "Three colored point clusters, each ringed by a hollow halo in its cluster's color, with a continuous color legend.",
  whatChanged:
    "<GGLayer> declares the halo rows, so they train the axes and the color scale like a geom's. The halo primitive itself is workbench's PointLayer, colored by useGGColors with the plot's own GPU color function, so halos, points and legend always agree.",
  jsxSource: `function Halos() {
  const positions = useRawSource(CENTER_POSITIONS, "vec2<f32>");
  const colors = useGGColors(CENTER_VALUES);
  return (
    <PointLayer positions={positions} colors={colors}
      count={3} size={64} hollow outline={3} />
  );
}

<GGPlot data={clusters} mapping={{ x: "x", y: "y", color: "value" }}>
  <GeomPoint size={4} />
  <GGLayer data={centers}>
    <Halos />
  </GGLayer>
  <Labs title="Clusters with halo centers" color="value" />
</GGPlot>`,
  dataPreview: centers,
  chart: ComposeChart,
};
