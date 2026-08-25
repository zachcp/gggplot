/** @jsxRuntime classic */
/** @jsx createElement */
// Live realization for RenderTree's 'ChunkedLine' component (gggplot-tzc.3).
//
// SPIKE FINDING (recorded in bd notes): plot's own <Line> (traits.mjs's
// SegmentsTrait) only auto-detects chunk boundaries from a flat TensorArray
// 'positions' prop via its UNIFORM size=[chunkLen, chunkCount] shorthand
// (flatten.mjs's sizeToChunkCounts), or from VARIABLE-length chunks when
// 'positions' is a nested array (toChunkCounts' per-sub-array-length path).
// It has no declarative prop for an explicitly supplied, independently
// variable per-chunk length list over an already-flat tensor — the
// 'segments' prop on <Line> is a different, lower-level escape hatch (a
// precomputed GPU adjacency buffer, the same shape getLineSegments() itself
// returns), not a chunk-length list.
//
// geom_line/geom_path/geom_step/geom_smooth (line.ts's lowerLine and
// smooth.ts's fitted line) concatenate one variable-length polyline per
// group (geom/shared.ts's concatPacked), so ChunkedLine cannot go through
// plot's <Line> unmodified. Per the bead's default (not fallback) path, it
// is instead a thin wrapper over workbench's raw LineLayer +
// useLineSegmentsSource({chunks, loops}) — the same resident-mark pattern
// runtime/resident_bar.tsx uses for chunked Face geometry (FaceLayer +
// useFaceSegmentsSource), generalized here to CPU-packed (not GPU-resident)
// tensors via useRawTensorSource. The global REGISTRY 'Line' mapping (plot's
// own <Line>, delegated to for guides/annotations/reference lines) is
// untouched by this addition.
//
// gggplot-xc9: workbench's raw line primitive (primitives/raw-lines.mjs) has
// no dash/stroke-pattern support at all, and plot's own <Line> 'dash' trait
// (plot/mjs/traits.mjs's StrokeTrait) turned out to be a dead prop — traced
// end-to-end (InnerLine -> LINE_SCHEMA -> workbench's LineTraits/raw-lines
// primitive -> every real .wgsl module in @use-gpu/wgsl and @use-gpu/
// workbench) and found NO consumer of it anywhere; it is parsed and typed
// but never wired to a shader. So there is no existing dash module to reuse
// (bd note's checkpoint outcome (b)): this file instead authors a minimal
// dash fragment material via @use-gpu/shader's runtime `wgsl` tagged
// template (the same shader-linking machinery render/rotated_label.tsx
// already uses for a custom vertex shader), plugged into the exact
// 'getFragment' link point RawLines' solid renderer already exposes through
// useMaterialContext() (workbench/providers/material-provider.mjs's
// DEFAULT_MATERIAL_CONTEXT.solid.getFragment = getPassThruColor). See
// getDashColorSource below for the fragment-discard test and its
// screen-space-correctness reasoning. A 'dash' prop is still threaded
// through onto the emitted RenderNode (lowerLine still batches per dash
// pattern, satisfying the node-split rule); solid (no dash) lines never
// touch MaterialContext and render exactly as before.

import type { LiveElement } from "@use-gpu/live";
import { wgsl } from "@use-gpu/shader/wgsl";
import { getWorldScale } from "@use-gpu/wgsl/use/view.wgsl";
import type { FlatTensor, MarkTopology } from "../compile/rendertree.ts";
import { parseColorRGBA } from "../color/mod.ts";
import { withMarkAttribution } from "./gpu_instrument.ts";
import {
  createElement,
  LineLayer,
  MaterialContext,
  provide,
  useLineSegmentsSource,
  useMaterialContext,
  useMemo,
  useNoRawTensorSource,
  useRawTensorSource,
  useShader,
  useShaderRef,
} from "../runtime/usegpu_compat.ts";

const MAX_DASH_SEGMENTS = 4;

// Minimal custom dash fragment material (see the module header for how this
// was arrived at). 'st.x' is the per-vertex arc length ChunkedLine threads
// through as its 'sts' source (computeArcLengths, below) in DATA/world
// space. getWorldScale(1.0, 0.0) is the exact world-units-per-device-pixel
// factor RawLines' own line width already uses at the default (device-
// pixel-constant) depth -- reused here so the dash pattern's device-pixel
// units (see scale/mapping.ts's DEFAULT_LINETYPE_PALETTE doc comment) stay
// visually screen-space-correct under gggplot's orthographic FlatCamera host
// (render/GGPlot.tsx), including any future pan/zoom, since it reads the
// live view uniforms every frame rather than a value baked in at compile
// time. A single global evaluation of getWorldScale (rather than a true
// per-fragment one keyed on clip-space w) is exact, not an approximation,
// specifically because FlatCamera is orthographic: getWorldScale's only
// spatially-varying term is 'effectiveW', which its own select() collapses
// to a constant 1.0 whenever the projection matrix's perspective row is
// zero -- true by construction for an orthographic camera, so passing a
// literal 1.0 here is correct, not a stand-in for a per-vertex value this
// link point doesn't have access to.
const getDashColorSource = wgsl`
  @link fn getWorldScale(w: f32, f: f32) -> f32;
  @link fn getDashArray() -> vec4<f32>;
  @link fn getDashCount() -> f32;
  @link fn getDashTotal() -> f32;

  @export fn getDashColor(color: vec4<f32>, uv: vec4<f32>, st: vec4<f32>) -> vec4<f32> {
    let total = getDashTotal();
    if (total <= 0.0) {
      return color;
    }

    let pixelsPerWorldUnit = 1.0 / getWorldScale(1.0, 0.0);
    let arc = st.x * pixelsPerWorldUnit;
    var d = arc - floor(arc / total) * total;
    if (d < 0.0) {
      d = d + total;
    }

    let dash = getDashArray();
    let count = u32(getDashCount());

    var acc = 0.0;
    var on = true;
    for (var i = 0u; i < count; i = i + 1u) {
      let seg = dash[i];
      if (d < acc + seg) {
        if (!on) {
          discard;
        }
        return color;
      }
      acc = acc + seg;
      on = !on;
    }

    return color;
  };
`;

/**
 * Pack a dash pattern (device-pixel on/off lengths, see scale/mapping.ts's
 * DEFAULT_LINETYPE_PALETTE) into the fixed-size vec4 uniform the dash
 * fragment shader reads, plus its valid segment count and total cycle
 * length. Returns null for no dash (solid) -- callers must leave
 * MaterialContext untouched in that case, not plug in a total=0 shader, to
 * guarantee zero behavioral change for solid lines. All of gggplot's own
 * linetypes (solid/dashed/dotted/dotdash, see NAMED_LINETYPE) fit within
 * MAX_DASH_SEGMENTS; a longer scaleLinetype() range is truncated with a
 * console warning rather than silently mis-rendering the tail.
 */
export function packDashUniforms(
  dash: readonly number[] | undefined,
): { array: [number, number, number, number]; count: number; total: number } | null {
  if (!dash || dash.length === 0) return null;
  const segments = dash.slice(0, MAX_DASH_SEGMENTS);
  if (dash.length > MAX_DASH_SEGMENTS) {
    console.warn(
      `[gggplot] ChunkedLine: dash pattern of length ${dash.length} truncated to ${MAX_DASH_SEGMENTS} segments (gggplot-xc9)`,
    );
  }
  const array: [number, number, number, number] = [0, 0, 0, 0];
  let total = 0;
  for (let i = 0; i < segments.length; i++) {
    array[i] = segments[i];
    total += segments[i];
  }
  return { array, count: segments.length, total };
}

/**
 * Cumulative per-vertex arc length in DATA/world space, resetting to 0 at
 * each chunk's first vertex. Computed here in the live realization (from
 * tensors the RenderNode already carries), not in geom/line.ts, so
 * RenderTree/fixture output is unaffected -- dash is a MATERIAL concern, not
 * a geometry one (see the bead's verification note).
 */
export function computeArcLengths(
  positions: FlatTensor,
  chunks: Uint32Array,
): FlatTensor {
  const { array, dims, length, version } = positions;
  const out = new Float32Array(length);
  let vertex = 0;
  for (const chunkLength of chunks) {
    let acc = 0;
    for (let k = 0; k < chunkLength; k++, vertex++) {
      if (k > 0) {
        let sumSq = 0;
        for (let d = 0; d < dims; d++) {
          const delta = array[vertex * dims + d] - array[(vertex - 1) * dims + d];
          sumSq += delta * delta;
        }
        acc += Math.sqrt(sumSq);
      }
      out[vertex] = acc;
    }
  }
  return { array: out, format: "f32", dims: 1, length, size: [length], version };
}

/**
 * Uploads a FlatTensor as a raw GPU source, using workbench's paired no-op
 * hook to keep hook-call order stable across renders when the tensor prop is
 * absent (the same ternary-of-hook-and-no-op idiom @use-gpu/plot's own
 * InnerLine uses for its optional material hook).
 *
 * gggplot-tzc.8: the useRawTensorSource call is the SOURCE BOUNDARY where a
 * FlatTensor's array becomes a Use.GPU buffer — see gpu_instrument.ts's
 * module doc. withMarkAttribution brackets it so any GPUDevice.createBuffer/
 * GPUQueue.writeBuffer it triggers underneath (via useRawSource's
 * makeDataBuffer/uploadBuffer) is counted as mark-data when instrumentation
 * is installed; a no-op otherwise (installGpuInstrumentation is dev-only,
 * gated behind ?instrument).
 */
function useOptionalTensorSource(tensor: FlatTensor | undefined): unknown {
  if (tensor) {
    return withMarkAttribution(() =>
      useRawTensorSource({
        array: tensor.array,
        format: tensor.format,
        size: tensor.size,
        version: tensor.version,
      })
    );
  }
  useNoRawTensorSource();
  return undefined;
}

export interface ChunkedLineProps {
  positions: FlatTensor;
  topology: MarkTopology;
  colors?: FlatTensor;
  widths?: FlatTensor;
  width?: number;
  color?: string;
  opacity?: number;
  dash?: readonly number[];
  [key: string]: unknown;
}

/**
 * Renders one or more disjoint/variable-length polylines from a single
 * packed FlatTensor 'positions' + explicit MarkTopology 'chunks' (see
 * geom/shared.ts's concatPacked) — gggplot-tzc.3.
 */
export const ChunkedLine = (props: ChunkedLineProps): LiveElement => {
  const { positions, topology, colors, widths, width, color, opacity, dash, ...rest } =
    props;
  const chunks = topology.chunks ?? Uint32Array.of(positions.length);
  // gggplot-tzc.8: MarkTopology's chunks array is also mark data (integer
  // topology, not a per-row float attribute, but still a Use.GPU raw source
  // derived from this node's own tensors) — bracket it the same way.
  const { count, segments } = withMarkAttribution(() =>
    useLineSegmentsSource({
      chunks,
      groups: null,
      loops: topology.loops ?? false,
    })
  );
  const positionsSource = useOptionalTensorSource(positions);
  const colorsSource = useOptionalTensorSource(colors);
  const widthsSource = useOptionalTensorSource(widths);

  // gggplot-xc9: dash uniforms + arc-length source. Every hook below is
  // called unconditionally (regardless of whether 'dash' is set) so
  // @use-gpu/live's hook-call order stays stable across renders — only the
  // FINAL structural choice (whether to wrap in a MaterialContext override)
  // branches, which is safe: 'provide' is a plain element constructor, not a
  // stateful hook (same idiom useOptionalTensorSource already relies on
  // internally). packDashUniforms/computeArcLengths are cheap pure
  // CPU-only calls when dash is absent (no GPU buffer is created — the 'sts'
  // tensor source stays undefined via useOptionalTensorSource's own no-op
  // branch) so solid lines allocate nothing new and render exactly as
  // before.
  const dashUniforms = useMemo(() => packDashUniforms(dash), [dash]);
  const arcLengths = useMemo(
    () => dashUniforms ? computeArcLengths(positions, chunks) : undefined,
    [dashUniforms, positions, chunks],
  );
  const stsSource = useOptionalTensorSource(arcLengths);
  const getDashArray = useShaderRef(dashUniforms?.array ?? [0, 0, 0, 0]);
  const getDashCount = useShaderRef(dashUniforms?.count ?? 0);
  const getDashTotal = useShaderRef(dashUniforms?.total ?? 0);
  const getDashColor = useShader(getDashColorSource, [
    getWorldScale,
    getDashArray,
    getDashCount,
    getDashTotal,
  ]);
  const material = useMaterialContext();

  const lineElement = createElement(LineLayer, {
    positions: positionsSource,
    segments,
    count,
    sides: 2,
    // LineLayer is workbench's RAW primitive: it feeds props.color straight to
    // useShaderRef, which needs a numeric vec4. A CSS string reaches the shader
    // as zeroes and the line draws pure black on a dark scene — invisible, not
    // absent (gggplot-frg). plot's own <Line> parses via its color trait; the
    // raw layers do not, so parse here, exactly as runtime/resident_bar.tsx
    // does for FaceLayer. Opacity folds into alpha for the same reason: raw
    // primitives have no 'opacity' prop at all, and the colors-tensor branch
    // already carries per-row alpha baked in by packColorsRGBA.
    ...(colorsSource
      ? { colors: colorsSource }
      : { color: parseColorRGBA(color ?? "#3b82f6", opacity ?? 1) }),
    ...(widthsSource ? { widths: widthsSource } : { width: width ?? 2 }),
    ...(stsSource ? { sts: stsSource } : {}),
    ...rest,
  });

  if (!dashUniforms) return lineElement;

  return provide(
    MaterialContext,
    { ...material, solid: { ...material.solid, getFragment: getDashColor } },
    lineElement,
  );
};
