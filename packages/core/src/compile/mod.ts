// The transpiler core — lowers a GGSpec onto a RenderTree of UseGPU/plot nodes.
//
// Stages: stat transform → scale training → facet → coord → geom lowering →
// guides. Currently implements a single cartesian panel with point/line/path
// marks; facets and non-cartesian coords are stubbed (single panel, warn).

import type { Aes, GGSpec, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "./rendertree.ts";
import { applyStat } from "../stat/mod.ts";
import { trainScales } from "../scale/mod.ts";

/** Pull an [x,y] position array for a layer from its mapped columns. */
function positionsOf(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
): [number, number][] {
  const xs = mapping.x ? data[mapping.x] : undefined;
  const ys = mapping.y ? data[mapping.y] : undefined;
  if (!xs || !ys) return [];
  const n = Math.min(xs.length, ys.length);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push([Number(xs[i]), Number(ys[i])]);
  return out;
}

/** Map one geom layer to a RenderNode (or null if unsupported). */
function lowerLayer(
  layer: Layer,
  plotMapping: Aes,
  data: GGSpec["data"],
): RenderNode | null {
  const mapping = { ...plotMapping, ...layer.mapping };
  const positions = positionsOf(layer, mapping, data);
  if (positions.length === 0) return null;

  const color = (layer.params.color as string) ?? "#3b82f6";

  switch (layer.geom) {
    case "point":
      return node("Point", {
        positions,
        color,
        size: (layer.params.size as number) ?? 5,
      });
    case "line":
    case "path":
      return node("Line", {
        positions,
        color,
        width: (layer.params.width as number) ?? 2,
      });
    default:
      console.warn(`[gggplot] geom "${layer.geom}" not implemented yet`);
      return null;
  }
}

export function compile(spec: GGSpec): RenderNode {
  // ① stat transform per layer (resolving each layer's effective mapping/data)
  const perLayer = spec.layers.map((layer) => {
    const mapping = { ...spec.mapping, ...layer.mapping };
    const data = layer.data ?? spec.data;
    const res = applyStat(layer, mapping, data);
    return { layer, data: res.data, mapping: res.mapping };
  });

  // ② train scales across layers → x/y domains for the view range
  const scales = trainScales(spec, perLayer);
  const xDomain = (scales.get("x")?.domain as [number, number]) ?? [0, 1];
  const yDomain = (scales.get("y")?.domain as [number, number]) ?? [0, 1];

  // ③ facet → panels. TODO: real partitioning; single panel for now.
  if (spec.facet.kind !== "none") {
    console.warn(`[gggplot] facet "${spec.facet.kind}" not implemented; rendering single panel`);
  }

  // ④ coord → view component
  const view = spec.coord.kind === "polar" ? "Polar" : "Cartesian";
  if (spec.coord.kind !== "cartesian" && spec.coord.kind !== "polar") {
    console.warn(`[gggplot] coord "${spec.coord.kind}" not implemented; using cartesian`);
  }

  // ⑤ geoms → marks
  const marks = perLayer
    .map(({ layer, data }) => lowerLayer(layer, spec.mapping, data))
    .filter((n): n is RenderNode => n !== null);

  // ⑥ guides — axes + grid
  const guides: RenderNode[] = [
    node("Grid", { axes: "xy", width: 1 }),
    node("Axis", { axis: "x", width: 2 }),
    node("Axis", { axis: "y", width: 2 }),
  ];

  const panel = node(
    view,
    { range: [xDomain, yDomain], axes: "xy" },
    [...guides, ...marks],
  );

  return node("Plot", {}, [panel]);
}
