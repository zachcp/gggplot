// geom_errorbar / geom_linerange / geom_pointrange / geom_crossbar — interval
// geoms sharing one lowering with a per-group dodge offset.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { splitByEffectiveGroup } from "../group/mod.ts";
import { scalePosition, type TrainedScale } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import {
  alphasOf,
  colorsOf,
  colorWithAlpha,
  dashOf,
  type FaceLoop,
  linewidthsOf,
  packFaceLoops,
  packMarkRows,
  packUniformChunks,
  resolutionOf,
  sizesOf,
  valuesOf,
} from "./shared.ts";

/**
 * Lower a geom_errorbar layer (x, ymin, ymax) to a single Line of disjoint
 * segments: a vertical stem plus a horizontal cap at each end. `params.width`
 * sets the cap width (default: 0.9 * x resolution, ggplot2's bar-style default).
 */
function lowerErrorbarLayer(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
  sizeScale: TrainedScale | undefined,
  alphaScale: TrainedScale | undefined,
  linetypeScale: TrainedScale | undefined,
  linewidthScale: TrainedScale | undefined,
  centerOffset = 0,
): RenderNode[] {
  const vertical = Boolean(mapping.x && mapping.ymin && mapping.ymax);
  const horizontal = Boolean(mapping.y && mapping.xmin && mapping.xmax);
  const requested = layer.params.orientation;
  if (requested !== undefined && requested !== "x" && requested !== "y") {
    throw new TypeError('interval orientation must be "x" or "y"');
  }
  const orientation = requested ??
    (vertical !== horizontal ? (vertical ? "x" : "y") : undefined);
  if (
    !orientation || (orientation === "x" && !vertical) ||
    (orientation === "y" && !horizontal)
  ) {
    throw new TypeError("interval geom mappings are incomplete or ambiguous");
  }
  const centers = valuesOf(data, orientation === "x" ? mapping.x : mapping.y)!;
  const mins = valuesOf(
    data,
    orientation === "x" ? mapping.ymin : mapping.xmin,
  )!;
  const maxs = valuesOf(
    data,
    orientation === "x" ? mapping.ymax : mapping.xmax,
  )!;
  const middles = valuesOf(data, orientation === "x" ? mapping.y : mapping.x);
  if ((layer.geom === "pointrange" || layer.geom === "crossbar") && !middles) {
    throw new TypeError(
      `${layer.geom} requires a mapped middle ${
        orientation === "x" ? "y" : "x"
      } aesthetic`,
    );
  }
  const n = Math.min(
    centers.length,
    mins.length,
    maxs.length,
    middles?.length ?? centers.length,
  );
  const scaledCenters = centers.map((value) =>
    scalePosition(orientation === "x" ? xScale : yScale, value)
  );
  const width = (layer.params.width as number) ??
    resolutionOf(orientation === "x" ? xScale : yScale, scaledCenters) * 0.5;
  const half = width / 2;
  const segments: [number, number][][] = [];
  const boxes: [number, number][][] = [];
  const points: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    if (centers[i] == null || mins[i] == null || maxs[i] == null) continue;
    const center = scaledCenters[i] + centerOffset;
    const min = scalePosition(orientation === "x" ? yScale : xScale, mins[i]);
    const max = scalePosition(orientation === "x" ? yScale : xScale, maxs[i]);
    if (![center, min, max].every(Number.isFinite)) continue;
    const middle = middles
      ? scalePosition(orientation === "x" ? yScale : xScale, middles[i])
      : undefined;
    if (middles && (middles[i] == null || !Number.isFinite(middle))) continue;
    const point = (a: number, b: number): [number, number] =>
      orientation === "x" ? [a, b] : [b, a];
    if (layer.geom === "errorbar") {
      segments.push([point(center - half, max), point(center + half, max)]);
      segments.push([point(center, max), point(center, min)]);
      segments.push([point(center - half, min), point(center + half, min)]);
    } else if (layer.geom === "pointrange" && middle !== undefined) {
      segments.push([point(center, min), point(center, max)]);
      points.push(point(center, middle));
    } else if (layer.geom === "crossbar" && middle !== undefined) {
      boxes.push([
        point(center - half, min),
        point(center - half, max),
        point(center + half, max),
        point(center + half, min),
      ]);
      segments.push([
        point(center - half, middle),
        point(center + half, middle),
      ]);
    } else {
      segments.push([point(center, min), point(center, max)]);
    }
  }
  if (!segments.length && !boxes.length && !points.length) return [];
  const mappedColor = colorsOf(mapping, data, colorScale, fillScale, "color")
    ?.[0];
  const mappedAlpha = alphasOf(mapping, data, alphaScale)?.[0];
  const baseColor = (layer.params.color as string) ?? mappedColor ?? "#3b82f6";
  const color = mappedAlpha == null
    ? baseColor
    : colorWithAlpha(baseColor, mappedAlpha);
  const dash = dashOf(layer, mapping, data, linetypeScale);
  const mappedWidth = linewidthsOf(mapping, data, linewidthScale)?.[0];
  // gggplot-tzc.3: stems pack into one FlatTensor + MarkTopology
  // (packUniformChunks — every stem segment here is a fixed 2-point pair);
  // component stays 'Line' (row-disjoint, not geom_line's per-group
  // ChunkedLine). Boxes (ChunkedFace, gggplot-tzc.4) are axis-aligned
  // rectangles (guaranteed convex), so this uses fan triangulation
  // (concave: false).
  const packedStems = packUniformChunks(segments);
  const nodes = [
    node("Line", {
      positions: packedStems.positions,
      topology: packedStems.topology,
      color,
      width: (layer.params.linewidth as number) ?? mappedWidth ?? 2,
      ...(dash ? { dash } : {}),
    }),
  ];
  if (boxes.length) {
    const boxFill = (layer.params.fill as string) ??
      colorsOf(mapping, data, colorScale, fillScale, "fill")?.[0] ??
      "#00000000";
    const boxLoops: FaceLoop[] = boxes.map((positions) => ({
      positions,
      fill: boxFill,
    }));
    const packedBoxes = packFaceLoops(boxLoops);
    nodes.unshift(
      node("ChunkedFace", {
        positions: packedBoxes.positions,
        topology: packedBoxes.topology,
        colors: packedBoxes.colors,
        concave: false,
      }),
    );
  }
  if (points.length) {
    const packedPoints = packMarkRows({
      xs: points.map(([x]) => x),
      ys: points.map(([, y]) => y),
    });
    nodes.push(
      node("Point", {
        positions: packedPoints.positions,
        topology: { kind: "points" },
        color,
        size: (layer.params.size as number) ??
          sizesOf(mapping, data, sizeScale)?.[0] ?? 5,
      }),
    );
  }
  return nodes;
}

/** Split into effective groups, apply a per-group dodge offset, and lower each. */
export function lowerInterval(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const groups = splitByEffectiveGroup(mapping, data);
  const dodge = layer.position === "dodge" || layer.position === "dodge2";
  const dodgeWidth = (layer.params.dodgeWidth as number) ?? 0.9;
  return groups.flatMap(
    ({ mapping: groupMapping, data: groupData }, index) => {
      const offset = dodge && groups.length > 1
        ? (index - (groups.length - 1) / 2) * dodgeWidth / groups.length
        : 0;
      return lowerErrorbarLayer(
        layer,
        groupMapping,
        groupData,
        ctx.scales.x,
        ctx.scales.y,
        ctx.scales.color,
        ctx.scales.fill,
        ctx.scales.size,
        ctx.scales.alpha,
        ctx.scales.linetype,
        ctx.scales.linewidth,
        offset,
      );
    },
  );
}
