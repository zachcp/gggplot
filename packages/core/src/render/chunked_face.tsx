/** @jsxRuntime classic */
/** @jsx createElement */
// Live realization for RenderTree's 'ChunkedFace' component (gggplot-tzc.4).
//
// CONCAVITY SPIKE FINDING (recorded in bd notes on gggplot-tzc.4): @use-gpu/
// core's segments.mjs generateConcaveIndices (which workbench's
// getFaceSegmentsConcave/useFaceSegmentsConcaveSource wrap) delegates to the
// 'earcut' npm package for our 2D case. Running earcut directly on an
// L-shape, a violin-like bimodal outline, and a collinear-degeneracy
// rectangle all produced correct triangulations (triangle-area sums matched
// each polygon's shoelace area exactly, zero out-of-range indices). PREFERRED
// path taken per the bead: no custom ear-clipping triangulator. ChunkedFace
// uses FaceLayer + useFaceSegmentsConcaveSource for concave-capable families
// (area/ribbon bands, arbitrary geom_polygon, violin outlines, smooth's SE
// ribbon) and plain useFaceSegmentsSource (fan) for families with
// guaranteed-convex loops (bar/col, tile, rect, hex, boxplot/crossbar boxes —
// literal axis-aligned rectangles). A bar's loop stays convex in the flat
// (pre-bend) parameter space that triangulation runs in even after polar
// munching (coxcomb): polarizeNode's theta remap is a pointwise coordinate
// LABEL applied before the GPU's Polar reconciler bends vertices into actual
// circular screen positions, so a munched bar loop is still a simple
// rectangle/trapezoid in the space fan triangulation sees — the curved wedge
// only appears once each already-triangulated vertex is bent downstream.
//
// The 'concave' RenderNode prop is decided once per family at LOWERING time
// (see geom/bar.ts, geom/tile.ts, geom/rect.ts, geom/hex.ts, geom/boxplot.ts,
// geom/errorbar.ts for concave:false; geom/area.ts, geom/polygon.ts,
// geom/violin.ts, geom/smooth.ts for concave:true) — never re-decided here.
//
// Mirrors render/chunked_line.tsx's structural-adapter and optional-hook-pair
// conventions (ternary-of-hook-and-no-op idiom for symmetric hook-call order
// across renders — see @use-gpu/live's rules of hooks) and
// runtime/resident_bar.tsx's FaceLayer usage (the in-repo precedent for a
// direct Use.GPU Face mark, generalized here to CPU-packed, not GPU-resident,
// tensors via useRawTensorSource — same generalization ChunkedLine already
// made for LineLayer).
//
// useFaceSegmentsConcaveSource triangulates on the CPU at hook-call time, so
// (unlike positions/colors, which go through useRawTensorSource to become an
// opaque GPU source) it needs the actual Float32Array of vertex positions,
// not a GPU source handle — this is why 'positions.array' is passed to it
// directly alongside the separately-uploaded GPU positions source.

import type { LiveElement } from "@use-gpu/live";
import type { FlatTensor, MarkTopology } from "../compile/rendertree.ts";
import { parseColorRGBA } from "../color/mod.ts";
import { withMarkAttribution } from "./gpu_instrument.ts";
import {
  createElement,
  FaceLayer,
  useFaceSegmentsConcaveSource,
  useFaceSegmentsSource,
  useNoFaceSegmentsConcaveSource,
  useNoFaceSegmentsSource,
  useNoRawTensorSource,
  useRawTensorSource,
} from "../runtime/usegpu_compat.ts";

/** Our compiler-internal FlatTensor.format to the WGSL-style format string useRawTensorSource expects. */
function toWgslFormat(format: FlatTensor["format"]): string {
  if (format === "vec2") return "vec2<f32>";
  if (format === "vec4") return "vec4<f32>";
  return "f32";
}

/**
 * Uploads a FlatTensor as a raw GPU source, using workbench's paired no-op
 * hook to keep hook-call order stable across renders when the tensor prop is
 * absent (same idiom as chunked_line.tsx's useOptionalTensorSource).
 *
 * gggplot-tzc.8: source-boundary tagging (see gpu_instrument.ts's module
 * doc) — withMarkAttribution brackets the point where this FlatTensor's
 * array becomes a Use.GPU buffer.
 */
function useOptionalTensorSource(tensor: FlatTensor | undefined): unknown {
  if (tensor) {
    return withMarkAttribution(() =>
      useRawTensorSource({
        array: tensor.array,
        format: toWgslFormat(tensor.format),
        size: tensor.size,
        version: tensor.version,
      })
    );
  }
  useNoRawTensorSource();
  return undefined;
}

export interface ChunkedFaceProps {
  positions: FlatTensor;
  topology: MarkTopology;
  colors?: FlatTensor;
  /** Picks fan (false, guaranteed-convex families) vs upstream earcut-backed concave (true) triangulation — decided once at lowering time, see file header. */
  concave?: boolean;
  color?: string;
  opacity?: number;
  [key: string]: unknown;
}

/**
 * Renders one or more disjoint closed-loop faces from a single packed
 * FlatTensor 'positions' + explicit MarkTopology 'chunks' (see
 * geom/shared.ts's packFaceLoops) — gggplot-tzc.4.
 */
export const ChunkedFace = (props: ChunkedFaceProps): LiveElement => {
  const {
    positions,
    topology,
    colors,
    concave,
    color,
    opacity,
    ...rest
  } = props;
  const chunks = topology.chunks ?? Uint32Array.of(positions.length);

  // Ternary-of-hook-and-no-op: exactly one of the fan/concave segment
  // sources is live per node (an node's 'concave' prop is fixed at lowering
  // time, never toggled across re-renders of the same mounted instance), but
  // both hooks must still be CALLED every render in the same order — the
  // inactive branch's paired no-op keeps @use-gpu/live's hook bookkeeping
  // stable, same idiom chunked_line.tsx's useOptionalTensorSource documents.
  // gggplot-tzc.8: these topology/index sources are also mark data derived
  // from this node's own tensors — bracket them the same as the tensor
  // sources below (see gpu_instrument.ts's module doc).
  const fan = concave
    ? (useNoFaceSegmentsSource(), undefined)
    : withMarkAttribution(() => useFaceSegmentsSource(chunks));
  const indexed = concave
    ? withMarkAttribution(() =>
      useFaceSegmentsConcaveSource(chunks, null, positions.array, 2)
    )
    : (useNoFaceSegmentsConcaveSource(), undefined);

  const positionsSource = useOptionalTensorSource(positions);
  const colorsSource = useOptionalTensorSource(colors);

  // FaceLayer's own `count` prop means "raw vertex/index count", not
  // "triangle count" (see raw-faces.mjs's instanceCount: c-2 for a segments
  // fan, c/3 for indices) — mirror resident_bar.tsx's proven convention of
  // passing useFaceSegmentsSource's own 'count' unmodified for the fan path;
  // the indexed/concave path omits 'count' entirely and lets FaceLayer
  // self-derive it from indices.length (which useFaceSegmentsConcaveSource
  // already sets), avoiding an easy off-by-a-factor-of-3 mistake here.
  return createElement(FaceLayer, {
    positions: positionsSource,
    side: "both",
    ...(concave
      ? { indices: indexed!.indices }
      : { segments: fan!.segments, count: fan!.count }),
    // Same raw-primitive contract as chunked_line.tsx (gggplot-frg): FaceLayer
    // takes a numeric vec4, never a CSS string, and has no 'opacity' prop —
    // fold it into alpha here rather than passing a prop nothing reads.
    ...(colorsSource
      ? { colors: colorsSource, ...(opacity != null ? { opacity } : {}) }
      : { color: parseColorRGBA(color ?? "#3b82f6", opacity ?? 1) }),
    ...rest,
  });
};
