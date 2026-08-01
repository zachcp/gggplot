import type { Aes, Coord, GGSpec, Layer, Theme } from "../ir/types.ts";
import {
  type FlatTensor,
  type MarkTopology,
  node,
  type RenderNode,
} from "./rendertree.ts";
import { expandRange, scalePosition, type TrainedScale } from "../scale/mod.ts";
import { expandByOwners, valuesOf } from "../geom/shared.ts";

export type Axes2D = "xy" | "yx";

/** Validate a 2D coord's use.gpu-style output swizzle. */
export function resolveAxes2d(coord: Coord): Axes2D {
  const input = (coord.axes ?? "xy").toLowerCase();
  const axes = input.length === 4 && input.endsWith("zw")
    ? input.slice(0, 2)
    : input;
  if (axes !== "xy" && axes !== "yx") {
    throw new Error(
      `[gggplot] 2D coord axes "${coord.axes}" must be "xy", "yx", "xyzw", or "yxzw"`,
    );
  }
  return axes;
}

/** Resolve a 3D coord swizzle to use.gpu's full form with homogeneous w last. */
export function resolveAxes3d(coord?: Pick<Coord, "axes">): string {
  const input = coord?.axes ?? "xyz";
  const lower = input.toLowerCase();
  const xyz = lower.length === 4 && lower.endsWith("w")
    ? lower.slice(0, 3)
    : lower;
  if (lower.length === 4 && !lower.endsWith("w")) {
    throw new Error(
      `[gggplot] coord axes "${input}" must end in the homogeneous "w" axis`,
    );
  }
  if (xyz.length !== 3 || [...xyz].sort().join("") !== "xyz") {
    throw new Error(
      `[gggplot] coord axes "${input}" must be a permutation of "xyz"`,
    );
  }
  return `${xyz}w`;
}

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

// ---------------------------------------------------------------------------
// Flat-tensor munching (gggplot-tzc.2). Subdivides each polygon edge into
// MUNCH_DETAIL points (fixed) over an interleaved Float32Array + MarkTopology,
// dispatched on that shape rather than on component name. This is the sole
// munch path: every mark packs a FlatTensor (point/line/face families), and
// stageBTransformedMark only ever runs on marks — the nested-array
// munchPolygonNode oracle it used to mirror was retired in gggplot-79f once
// no mark produced a nested Polygon. (Guide Polygon nodes — theme background,
// legend swatches — are never munched: they render through the plot's native
// Polygon/Polar view, so they keep their nested positions.)
// ---------------------------------------------------------------------------

/** Fixed number of subdivision points emitted per polygon edge. */
const MUNCH_DETAIL = 16;

/**
 * Munch one closed-loop chunk (vertices [start, start+len) of a shared
 * position array), INCLUDING its closing edge (len-1 back to 0). Emits
 * MUNCH_DETAIL points per edge (t = 0/MUNCH_DETAIL .. (MUNCH_DETAIL-1)/MUNCH_DETAIL,
 * so each edge's own start vertex is reproduced exactly and the edge's end
 * vertex is picked up as the next edge's start). Degenerate chunks (len < 2)
 * pass through unchanged.
 * Appends emitted vertex components to outXY and each emitted vertex's
 * ORIGINATING (segment-start) source index to outSource, for companion
 * expansion via expandByOwners. Returns the emitted vertex count.
 */
function munchLoopChunk(
  array: Float32Array,
  dims: number,
  start: number,
  len: number,
  outXY: number[],
  outSource: number[],
): number {
  if (len < 2) {
    for (let i = 0; i < len; i++) {
      for (let d = 0; d < dims; d++) outXY.push(array[(start + i) * dims + d]);
      outSource.push(start + i);
    }
    return len;
  }
  let emitted = 0;
  for (let i = 0; i < len; i++) {
    const aIdx = start + i;
    const bIdx = start + ((i + 1) % len);
    for (let step = 0; step < MUNCH_DETAIL; step++) {
      const t = step / MUNCH_DETAIL;
      for (let d = 0; d < dims; d++) {
        const a = array[aIdx * dims + d];
        const b = array[bIdx * dims + d];
        outXY.push(a + (b - a) * t);
      }
      outSource.push(aIdx);
      emitted++;
    }
  }
  return emitted;
}

/**
 * Munch one open-polyline chunk, subdividing only its INTERIOR segments
 * (i - i+1 for i in [0, len-2]) at the same per-edge density as
 * munchLoopChunk — NO closing edge, since an open path is not a loop.
 * Because interior-segment subdivision alone stops just short of t=1 on the
 * final segment, the chunk's true final vertex is appended explicitly so an
 * open path still reaches its real endpoint. Degenerate chunks (len < 2)
 * pass through unchanged.
 */
function munchPolylineChunk(
  array: Float32Array,
  dims: number,
  start: number,
  len: number,
  outXY: number[],
  outSource: number[],
): number {
  if (len < 2) {
    for (let i = 0; i < len; i++) {
      for (let d = 0; d < dims; d++) outXY.push(array[(start + i) * dims + d]);
      outSource.push(start + i);
    }
    return len;
  }
  let emitted = 0;
  for (let i = 0; i < len - 1; i++) {
    const aIdx = start + i;
    const bIdx = start + i + 1;
    for (let step = 0; step < MUNCH_DETAIL; step++) {
      const t = step / MUNCH_DETAIL;
      for (let d = 0; d < dims; d++) {
        const a = array[aIdx * dims + d];
        const b = array[bIdx * dims + d];
        outXY.push(a + (b - a) * t);
      }
      outSource.push(aIdx);
      emitted++;
    }
  }
  const lastIdx = start + len - 1;
  for (let d = 0; d < dims; d++) outXY.push(array[lastIdx * dims + d]);
  outSource.push(lastIdx);
  emitted++;
  return emitted;
}

/**
 * Munch a flat-tensor node's positions (plus any per-vertex companion
 * tensors) under nonlinear (polar) coordinates. Dispatches on
 * topology.kind, NOT component name, so a chunked Face node carrying 'loops'
 * topology is munched the same as any other loop mark.
 *
 * - kind='loops': each chunk (topology.chunks, or the whole tensor as one
 *   chunk when 'chunks' is absent) is munched INCLUDING its closing edge
 *   (see munchLoopChunk).
 * - kind='polyline': each chunk's interior segments are munched with NO
 *   closing edge (see munchPolylineChunk) — ggplot2 coord_munch() line/path
 *   coverage.
 * - kind='points': nothing to munch (no segments); returned unchanged.
 *
 * COMPANION EXPANSION: any other prop on the node that is itself a
 * FlatTensor with the same vertex count as 'positions' (colors/sizes/
 * alphas/...) is expanded alongside positions via expandByOwners, using
 * each emitted vertex's originating segment-start source index — i.e. the
 * companion value is REPEATED across all vertices munched from one edge
 * (piecewise-constant, no interpolation), matching the legacy nested
 * behavior. Interpolating companions across a munched edge is a possible
 * later enhancement, not implemented here.
 *
 * THROWS if topology.indices is present. Triangulation happens strictly
 * after coordinate transforms (see the lowering-order contract documented
 * at compile/mod.ts's polarMarks): munching a node whose topology already
 * carries triangulated indices would silently desync those indices from
 * the newly-inserted vertices, so this is a loud ordering violation rather
 * than a silent corruption.
 */
export function munchFlatNode(n: RenderNode): RenderNode {
  const positions = n.props.positions;
  const topology = n.props.topology;
  if (!isFlatTensor(positions) || !isMarkTopology(topology)) {
    return node(
      n.component,
      n.props,
      n.children.map((child) => munchFlatNode(child)),
    );
  }
  if (topology.indices) {
    throw new Error(
      "munchFlatNode: topology.indices is already present. Munching must " +
        "run before triangulation — see the lowering-order contract at " +
        "compile/mod.ts's polarMarks (coordinate transforms first, " +
        "indices attached afterward).",
    );
  }
  if (topology.kind === "points") {
    return node(
      n.component,
      n.props,
      n.children.map((child) => munchFlatNode(child)),
    );
  }

  const { array, dims } = positions;
  const vertexCount = positions.length;
  const chunkLens = topology.chunks ? Array.from(topology.chunks) : [
    vertexCount,
  ];

  const outXY: number[] = [];
  const outSource: number[] = [];
  const newChunkLens: number[] = [];
  let cursor = 0;
  for (const len of chunkLens) {
    const emitted = topology.kind === "loops"
      ? munchLoopChunk(array, dims, cursor, len, outXY, outSource)
      : munchPolylineChunk(array, dims, cursor, len, outXY, outSource);
    newChunkLens.push(emitted);
    cursor += len;
  }

  const newArray = Float32Array.from(outXY);
  const newPositions: FlatTensor = {
    array: newArray,
    format: positions.format,
    dims,
    length: newArray.length / dims,
    size: [newArray.length / dims],
    version: positions.version,
  };
  const sourceIndex = Uint32Array.from(outSource);

  const newProps: Record<string, unknown> = {
    ...n.props,
    positions: newPositions,
  };
  for (const [key, value] of Object.entries(n.props)) {
    if (key === "positions" || key === "topology") continue;
    if (isFlatTensor(value) && value.length === vertexCount) {
      newProps[key] = expandByOwners(value, sourceIndex);
    }
  }
  const newTopology: MarkTopology = { kind: topology.kind };
  if (topology.chunks) newTopology.chunks = Uint32Array.from(newChunkLens);
  if (topology.loops !== undefined) newTopology.loops = topology.loops;
  newProps.topology = newTopology;

  return node(
    n.component,
    newProps,
    n.children.map((child) => munchFlatNode(child)),
  );
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

/**
 * Structural check for a compile/rendertree.ts FlatTensor prop value: a
 * plain object (not an array) carrying a Float32Array 'array' and numeric
 * 'dims'. Used to dispatch flat-tensor coordinate transforms on SHAPE, not
 * on component name (see polarizeNode / munchFlatNode below).
 */
export function isFlatTensor(v: unknown): v is FlatTensor {
  return !!v && typeof v === "object" && !Array.isArray(v) &&
    (v as FlatTensor).array instanceof Float32Array &&
    typeof (v as FlatTensor).dims === "number";
}

/** Structural check for a compile/rendertree.ts MarkTopology prop value. */
function isMarkTopology(v: unknown): v is MarkTopology {
  return !!v && typeof v === "object" && !Array.isArray(v) &&
    typeof (v as MarkTopology).kind === "string";
}

/**
 * Pointwise polar remap of one axis component of an interleaved FlatTensor
 * position array, into a brand-NEW Float32Array — 'array' is documented as
 * never-mutate-after-construction (compile/rendertree.ts) and may be shared
 * with a cached upstream pack, so this never writes through the input.
 * Output tensor keeps the input's version (pointwise remap doesn't change
 * vertex identity/count, only a component's value).
 */
function polarizeFlatPositions(
  positions: FlatTensor,
  axis: 0 | 1,
  map: (value: number) => number,
): FlatTensor {
  const { array, dims } = positions;
  const out = new Float32Array(array.length);
  for (let i = 0; i < array.length; i++) {
    out[i] = i % dims === axis ? map(array[i]) : array[i];
  }
  return { ...positions, array: out };
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

  const rawPositions = n.props.positions;
  let props = n.props;
  if (isFlatTensor(rawPositions) && isMarkTopology(n.props.topology)) {
    // Flat-aware path (gggplot-tzc.2): any node carrying a FlatTensor
    // 'positions' plus a MarkTopology 'topology' prop is transformed,
    // regardless of component name. The legacy nested-array branch below
    // stays keyed on "positions" in n.props, untouched, for geoms that
    // haven't converted to FlatTensor yet.
    props = {
      ...n.props,
      positions: polarizeFlatPositions(rawPositions, axis, map),
    };
  } else if ("positions" in n.props) {
    props = {
      ...n.props,
      positions: mapPositionValue(n.props.positions, axis, map),
    };
  }
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
