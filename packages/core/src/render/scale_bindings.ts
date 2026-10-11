// GPU scale bindings over the existing TrainedScale semantics (gggplot-fbq,
// ADR-007 decision 7.1; measured by the vnh.16 spike).
//
// A mapped aesthetic is a function on the GPU: value -> scale -> visual,
// linked over the column's values and the mark's per-vertex owners
// (gggplot-8e1). Domains and ranges are STABLE refs, so a retrain is a uniform
// write: no mark upload, no relink, no pipeline rebuild. Never pass fresh
// literals or arrays to useShader for these; that silently turns a uniform
// write into a relink every frame.
//
// Each function matches scale/mapping.ts exactly, including the missing-value
// contract (gggplot-5qi): a non-finite value maps color to NA_COLOR and
// size/alpha to "not drawn" (zero), tested on the exponent bits because WGSL
// may fold `v != v`.
import { wgsl } from "@use-gpu/shader/wgsl";
import { parseColorRGBA } from "../color/mod.ts";
import { NA_COLOR } from "../scale/mapping.ts";
import { SEQUENTIAL_RAMP } from "../scale/palette.ts";
import type { TrainedScale } from "../scale/types.ts";

const IS_MISSING = `
fn isMissing(v: f32) -> bool {
  return (bitcast<u32>(v) & 0x7f800000u) == 0x7f800000u;
}`;

/** Continuous color: value through the domain onto the palette ramp. */
export const COLOR_BINDING = wgsl`
@link fn getValue(i: u32) -> f32;
@link fn getOwner(i: u32) -> u32;
@link fn getDomain() -> vec2<f32>;
@link fn getPalette(i: u32) -> vec4<f32>;
@link fn getPaletteLength() -> u32;
@link fn getAlpha(i: u32) -> f32;
@link fn getNaColor() -> vec4<f32>;
${IS_MISSING}
@export fn getColor(i: u32) -> vec4<f32> {
  let domain = getDomain();
  let value = getValue(getOwner(i));
  let alpha = clamp(getAlpha(i), 0.0, 1.0);
  if (isMissing(value)) { return vec4<f32>(getNaColor().rgb, alpha); }
  var t = 0.0;
  if (domain.y > domain.x) { t = (value - domain.x) / (domain.y - domain.x); }
  let last = getPaletteLength() - 1u;
  let x = clamp(t, 0.0, 1.0) * f32(last);
  let low = u32(floor(x));
  let rgb = mix(getPalette(low).rgb, getPalette(min(low + 1u, last)).rgb, fract(x));
  // The CPU mapping quantizes interpolated RGB to an 8-bit hex color.
  return vec4<f32>(floor(rgb * 255.0 + 0.5) / 255.0, alpha);
}`;

/** Continuous size: area semantics, radius proportional to sqrt(t). */
export const SIZE_BINDING = wgsl`
@link fn getValue(i: u32) -> f32;
@link fn getOwner(i: u32) -> u32;
@link fn getDomain() -> vec2<f32>;
@link fn getRange() -> vec2<f32>;
${IS_MISSING}
@export fn getRadius(i: u32) -> f32 {
  let domain = getDomain();
  let range = getRange();
  let value = getValue(getOwner(i));
  // A missing size means the row is not drawn.
  if (isMissing(value)) { return 0.0; }
  var t = 0.0;
  if (domain.y > domain.x) { t = clamp((value - domain.x) / (domain.y - domain.x), 0.0, 1.0); }
  return range.x + sqrt(t) * (range.y - range.x);
}`;

/** Continuous alpha: linear over the range. */
export const ALPHA_BINDING = wgsl`
@link fn getValue(i: u32) -> f32;
@link fn getOwner(i: u32) -> u32;
@link fn getDomain() -> vec2<f32>;
@link fn getRange() -> vec2<f32>;
${IS_MISSING}
@export fn getAlpha(i: u32) -> f32 {
  let domain = getDomain();
  let range = getRange();
  let value = getValue(getOwner(i));
  // A missing alpha means the row is not drawn.
  if (isMissing(value)) { return 0.0; }
  var t = 0.0;
  if (domain.y > domain.x) { t = (value - domain.x) / (domain.y - domain.x); }
  return range.x + t * (range.y - range.x);
}`;

/** A uniform the GPU re-reads on every draw. Mutate `current`; keep the object. */
export interface Ref<T> {
  current: T;
}

export interface ColorBindingRefs {
  domain: Ref<[number, number]>;
  naColor: Ref<[number, number, number, number]>;
  /**
   * The ramp's stops as RGBA. Its identity is the palette's identity: a
   * different ramp needs a new palette source (gggplot-81r), so a consumer
   * keys on `paletteKey` and remounts rather than mutating this.
   */
  palette: Float32Array;
  paletteKey: string;
}

export interface RangeBindingRefs {
  domain: Ref<[number, number]>;
  range: Ref<[number, number]>;
}

/** Stable per-aesthetic refs one <GGPlot> root owns and updates in place. */
export interface ScaleBindingRefs {
  color: ColorBindingRefs;
  fill: ColorBindingRefs;
  size: RangeBindingRefs;
  alpha: RangeBindingRefs;
}

const DEFAULT_SIZE_RANGE: [number, number] = [1, 6];
const DEFAULT_ALPHA_RANGE: [number, number] = [0.1, 1];

/** Whether a trained scale can be bound on the GPU instead of CPU-packed. */
export function isGpuBindable(scale: TrainedScale | undefined): boolean {
  // A continuous color scale trains as kind "color" (gradient, viridis,
  // gradient2 ramps), a continuous size/alpha as "continuous". Both map a
  // numeric domain linearly, which is what the bindings implement. log/sqrt
  // transforms are not bindable yet.
  return !!scale && (scale.kind === "continuous" || scale.kind === "color") &&
    typeof scale.domain[0] === "number" && typeof scale.domain[1] === "number";
}

function rampOf(scale: TrainedScale | undefined): string[] {
  return (scale?.range as string[] | undefined) ?? [...SEQUENTIAL_RAMP];
}

function colorRefs(): ColorBindingRefs {
  const ramp = [...SEQUENTIAL_RAMP];
  return {
    domain: { current: [0, 1] },
    naColor: {
      current: parseColorRGBA(NA_COLOR) as [number, number, number, number],
    },
    palette: Float32Array.from(ramp.flatMap((c) => parseColorRGBA(c))),
    paletteKey: ramp.join(","),
  };
}

export function createScaleBindingRefs(): ScaleBindingRefs {
  return {
    color: colorRefs(),
    fill: colorRefs(),
    size: {
      domain: { current: [0, 1] },
      range: { current: DEFAULT_SIZE_RANGE },
    },
    alpha: {
      domain: { current: [0, 1] },
      range: { current: DEFAULT_ALPHA_RANGE },
    },
  };
}

function updateColor(refs: ColorBindingRefs, scale: TrainedScale | undefined) {
  if (!isGpuBindable(scale)) return;
  refs.domain.current = scale!.domain as [number, number];
  const ramp = rampOf(scale);
  const key = ramp.join(",");
  if (key !== refs.paletteKey) {
    refs.palette = Float32Array.from(ramp.flatMap((c) => parseColorRGBA(c)));
    refs.paletteKey = key;
  }
}

function updateRange(
  refs: RangeBindingRefs,
  scale: TrainedScale | undefined,
  fallback: [number, number],
) {
  if (!isGpuBindable(scale)) return;
  refs.domain.current = scale!.domain as [number, number];
  refs.range.current = (scale!.range as [number, number] | undefined) ??
    fallback;
}

/**
 * Write the trained scales into the stable refs, in place. Every ref object
 * keeps its identity, so bound shaders see the new domain on their next draw
 * with no relink.
 */
export function updateScaleBindingRefs(
  refs: ScaleBindingRefs,
  scales: Partial<Record<string, TrainedScale>>,
): void {
  updateColor(refs.color, scales.color);
  updateColor(refs.fill, scales.fill);
  updateRange(refs.size, scales.size, DEFAULT_SIZE_RANGE);
  updateRange(refs.alpha, scales.alpha, DEFAULT_ALPHA_RANGE);
}
