// geom_line / geom_path / geom_step — connected marks, one ChunkedLine node
// per dash batch per layer (gggplot-tzc.3: flat-tensor conversion + explicit
// chunked topology; see render/chunked_line.tsx for the live realization and
// the bd note on gggplot-tzc.3 for the SPIKE finding behind this choice).
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import type { FlatTensor } from "../compile/rendertree.ts";
import { splitByEffectiveGroup } from "../group/mod.ts";
import { scalePosition } from "../scale/mod.ts";
import type { DepthPolicy, LayerContext } from "./types.ts";
import {
  alphasOf,
  colorsOf,
  concatFlatTensors,
  concatPacked,
  dashOf,
  linewidthsOf,
  type PackedGeometry,
  packMarkRows,
  positionsOf,
  sortByX,
  stepPositions,
  valuesOf,
  depthProps,
} from "./shared.ts";
import { packPoints3d, packScalar } from "./packing.ts";

/**
 * Polylines fade with alpha exactly as points do; the shared policy keeps the
 * two from re-deriving `depthWrite: !transparent` separately.
 */
export const LINE_3D_DEPTH: DepthPolicy = "alphaAware";

/** One effective group's already-scaled/ordered row data, ready to pack. */
export interface LineGroupRows {
  xs: number[];
  ys: number[];
  /** Present for the shared 3D realization; omitted for stable 2D lowering. */
  zs?: number[];
  colors: string[];
  widths: number[];
  alphas?: number[];
  dash: readonly number[] | undefined;
}

/**
 * Pack per-group row data into one ChunkedLine RenderNode per distinct dash
 * pattern present across the groups (gggplot-tzc.3's sanctioned per-dash-
 * pattern Line split). Shared by lowerLine and lowerSmooth's fitted-line
 * part, both of which connect one variable-length polyline per effective
 * group — geom_smooth's SE ribbon (a Polygon) is tzc.4's, not this.
 */
export function packChunkedLineNodes(
  groups: LineGroupRows[],
  opacity: number | undefined,
  threeD = false,
): RenderNode[] {
  const buckets = new Map<string, {
    dash: readonly number[] | undefined;
    positionGeoms: PackedGeometry[];
    colorTensors: FlatTensor[];
    widthTensors: FlatTensor[];
    transparent: boolean;
  }>();

  for (const group of groups) {
    const packed = group.zs
      ? (() => {
        const point = packPoints3d({
          xs: group.xs,
          ys: group.ys,
          zs: group.zs,
          colors: group.colors,
          ...(group.alphas ? { alphas: group.alphas } : {}),
        });
        return {
          positions: point.positions,
          colors: point.colors,
          widths: packScalar(group.widths, point.mask),
        };
      })()
      : packMarkRows({
        xs: group.xs,
        ys: group.ys,
        colors: group.colors,
        widths: group.widths,
        ...(group.alphas ? { alphas: group.alphas } : {}),
      });
    if (packed.positions.length === 0) continue;
    const key = group.dash ? group.dash.join(",") : "\\0solid";
    const bucket = buckets.get(key) ?? {
      dash: group.dash,
      positionGeoms: [],
      colorTensors: [],
      widthTensors: [],
      transparent: false,
    };
    bucket.positionGeoms.push({
      positions: packed.positions,
      topology: { kind: "polyline", loops: false },
    });
    bucket.colorTensors.push(packed.colors!);
    bucket.widthTensors.push(packed.widths!);
    bucket.transparent ||= group.alphas?.some((alpha) => alpha < 1) === true;
    buckets.set(key, bucket);
  }

  // tzc.3: sanctioned per-dash-pattern Line split — one ChunkedLine node per
  // distinct dash pattern in the layer (tzc.8's node-budget test enumerates
  // exactly this split, plus Point's per-shape split).
  return [...buckets.values()].map((bucket) => {
    const combined = concatPacked(bucket.positionGeoms);
    return node("ChunkedLine", {
      positions: combined.positions,
      topology: combined.topology,
      colors: concatFlatTensors(bucket.colorTensors),
      widths: concatFlatTensors(bucket.widthTensors),
      ...(bucket.dash ? { dash: bucket.dash } : {}),
      ...(opacity != null ? { opacity } : {}),
      ...(threeD ? depthProps(LINE_3D_DEPTH, bucket.transparent) : {}),
    });
  });
}

/**
 * Lower geom_line (x-sorted), geom_path (row order), or geom_step (staircase)
 * to ChunkedLine node(s), one per dash batch. stat="ecdf" clamps the
 * ±Infinity sentinel x-values that stat_ecdf emits to the panel's x domain
 * edges.
 */
export function lowerLine(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;
  const zScale = ctx.scales.z;
  const threeD = mapping.z != null;
  const opacity = layer.params.alpha as number | undefined;
  const xDomain = ctx.xDomain;
  const color = (layer.params.color as string) ?? "#3b82f6";
  const defaultWidth = (layer.params.linewidth as number) ??
    (layer.params.width as number) ??
    (layer.params.strokeWidth as number) ?? 2;

  const groups: LineGroupRows[] = [];
  for (
    const { mapping: m, data: d } of splitByEffectiveGroup(mapping, data)
  ) {
    const ordered = layer.geom === "path" ? d : sortByX(m, d);
    let positions = layer.stat === "ecdf"
      ? (() => {
        const xs = valuesOf(ordered, m.x) ?? [];
        const ys = valuesOf(ordered, m.y) ?? [];
        return xs.slice(0, Math.min(xs.length, ys.length)).map((
          value,
          index,
        ): [number, number] => [
          value === Number.NEGATIVE_INFINITY
            ? xDomain[0]
            : value === Number.POSITIVE_INFINITY
            ? xDomain[1]
            : scalePosition(xScale, value),
          scalePosition(yScale, ys[index]),
        ]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
      })()
      : positionsOf(m, ordered, xScale, yScale);
    if (layer.geom === "step") {
      positions = stepPositions(positions, layer.params.direction ?? "hv");
    }
    if (positions.length === 0) continue;

    const xs = positions.map(([x]) => x);
    const ys = positions.map(([, y]) => y);
    const rawZ = threeD ? valuesOf(ordered, m.z) ?? [] : [];
    const zs = threeD
      ? rawZ.slice(0, Math.min(rawZ.length, xs.length)).map((value) =>
        scalePosition(zScale, value)
      )
      : undefined;
    if (threeD && zs!.length !== xs.length) {
      throw new Error(
        "[gggplot] 3D geom_line/path columns must have equal length",
      );
    }
    const mappedColors = colorsOf(
      m,
      ordered,
      ctx.scales.color,
      ctx.scales.fill,
      "colorOrFill",
    );
    // splitByEffectiveGroup isolates one color level per group, so a group's
    // color is UNIFORM — repeat it per VERTEX (not per source row). This also
    // keeps colors aligned with a vertex count that differs from the row
    // count when geom_step expands or geom_ecdf filters positions (a per-row
    // color array would be too short/long against the packed vertex tensor).
    const groupColor = mappedColors?.[0] ?? color;
    const colors = xs.map(() => groupColor);
    const mappedWidths = linewidthsOf(m, ordered, ctx.scales.linewidth);
    // Per-vertex widths only when they already align 1:1 with vertices (plain
    // geom_line/path — no step expansion); otherwise repeat the group width.
    const widths = mappedWidths && mappedWidths.length === xs.length
      ? mappedWidths
      : xs.map(() => mappedWidths?.[0] ?? defaultWidth);
    const dash = dashOf(layer, m, ordered, ctx.scales.linetype);
    const mappedAlphas = threeD
      ? alphasOf(m, ordered, ctx.scales.alpha)
      : undefined;
    groups.push({
      xs,
      ys,
      ...(zs ? { zs } : {}),
      colors,
      widths,
      dash,
      ...(mappedAlphas
        ? { alphas: mappedAlphas }
        : opacity != null
        ? { alphas: xs.map(() => opacity) }
        : {}),
    });
  }

  return packChunkedLineNodes(groups, opacity, threeD);
}
