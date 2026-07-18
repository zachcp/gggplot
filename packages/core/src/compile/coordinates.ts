import type { Aes, GGSpec, Layer, Theme } from "../ir/types.ts";
import { node, type RenderNode } from "./rendertree.ts";
import { expandRange, scalePosition, type TrainedScale } from "../scale/mod.ts";
import { valuesOf } from "./lowering.ts";

/**
 * The true y-extent of a stacked/filled bar layer is the summed height per x,
 * not any single row's y — widen [lo,hi] to cover it (uncapped for "stack",
 * fixed to [0,1] for "fill"). Dodge/identity bars don't sum, so are skipped.
 */
export function widenForStackedBars(
  [lo, hi]: [number, number],
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
): [number, number] {
  if (layer.geom !== "bar" && layer.geom !== "col") return [lo, hi];
  if (layer.position === "dodge" || layer.position === "identity") {
    return [Math.min(lo, 0), hi];
  }

  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  if (!xs || !ys) return [lo, hi];

  // Filled bars are always normalized to [0,1]; the raw (pre-normalization)
  // y domain doesn't describe the rendered positions at all.
  if (layer.position === "fill") return [0, 1];

  const totals = new Map<number, number>();
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    const xPos = scalePosition(xScale, xs[i]);
    const y = scalePosition(yScale, ys[i]);
    totals.set(xPos, (totals.get(xPos) ?? 0) + y);
  }
  const maxTotal = Math.max(0, ...totals.values());
  return [Math.min(lo, 0), Math.max(hi, maxTotal)];
}

/**
 * geom_tile cells extend half a cell beyond their center point on each axis —
 * widen [lo,hi] so edge cells aren't clipped by the trained (point-based) domain.
 */
export function widenForTileAxis(
  [lo, hi]: [number, number],
  centers: number[],
  cellSize: number,
): [number, number] {
  if (centers.length === 0) return [lo, hi];
  const half = cellSize / 2;
  return [
    Math.min(lo, Math.min(...centers) - half),
    Math.max(hi, Math.max(...centers) + half),
  ];
}

/** Numeric view range for a trained scale: level-index span for discrete, domain as-is otherwise. */
export function numericRange(
  scale: TrainedScale | undefined,
): [number, number] | undefined {
  if (!scale) return undefined;
  if (scale.kind === "discrete") {
    const levels = scale.domain as string[];
    const span: [number, number] = [0, Math.max(levels.length - 1, 0)];
    return scale.expand ? expandRange(span, scale.expand) : span;
  }
  return scale.domain as [number, number];
}

function isPoint(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length >= 2 && typeof v[0] === "number" &&
    typeof v[1] === "number";
}

function munchLoop(loop: [number, number][], detail = 16): [number, number][] {
  if (loop.length < 2) return loop;
  const out: [number, number][] = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    for (let step = 0; step < detail; step++) {
      const t = step / detail;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export function munchPolygonNode(n: RenderNode): RenderNode {
  if (n.component !== "Polygon") return n;
  const positions = n.props.positions;
  if (!Array.isArray(positions) || positions.length === 0) return n;

  const munched = isPoint(positions[0])
    ? munchLoop(positions as [number, number][])
    : (positions as [number, number][][]).map((loop) => munchLoop(loop));

  return node(n.component, { ...n.props, positions: munched }, n.children);
}

function mapPositionValue(
  value: unknown,
  axis: 0 | 1,
  map: (value: number) => number,
): unknown {
  if (!Array.isArray(value)) return value;
  if (
    value.length >= 2 && typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    const point = [...value] as number[];
    point[axis] = map(point[axis]);
    return point;
  }
  return value.map((entry) => mapPositionValue(entry, axis, map));
}

/** Convert the selected theta scale from trained data units into radians. */
export function polarizeNode(
  n: RenderNode,
  axis: 0 | 1,
  domain: [number, number],
  start: number,
  end: number,
): RenderNode {
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  const map = (value: number) => start + (value - lo) / span * (end - start);
  const props = "positions" in n.props
    ? { ...n.props, positions: mapPositionValue(n.props.positions, axis, map) }
    : n.props;
  return node(
    n.component,
    props,
    n.children.map((child) => polarizeNode(child, axis, domain, start, end)),
  );
}

export function linspace([lo, hi]: [number, number], n: number): number[] {
  if (n <= 1) return [lo];
  return Array.from({ length: n }, (_, i) => lo + (hi - lo) * (i / (n - 1)));
}

export function polarGridLines(
  xDomain: [number, number],
  yDomain: [number, number],
  theme: Theme,
): RenderNode {
  const ringYs = linspace(yDomain, 5).slice(1);
  const spokeXs = linspace(xDomain, 12);
  const ringXs = linspace(xDomain, 96);
  const radialYs = linspace(yDomain, 32);
  const positions = [
    ...ringYs.map((y) => ringXs.map((x): [number, number] => [x, y])),
    ...spokeXs.map((x) => radialYs.map((y): [number, number] => [x, y])),
  ];
  return node("Line", {
    positions,
    width: theme.gridWidth ?? 1,
    zBias: -1,
    ...(theme.gridColor ? { color: theme.gridColor } : {}),
  });
}
