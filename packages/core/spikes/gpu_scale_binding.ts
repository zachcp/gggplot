// vnh.16: isolated experiment, deliberately absent from the public exports.
// Current TrainedScale semantics + runtime bindings, without an expression AST.
import { wgsl } from "@use-gpu/shader/wgsl";
import type { TrainedScale } from "../src/scale/types.ts";
import { parseColorRGBA } from "../src/color/mod.ts";
import {
  scaleAlphaValue,
  scaleColorValue,
  scaleSizeValue,
} from "../src/scale/mapping.ts";
import { SEQUENTIAL_RAMP } from "../src/scale/palette.ts";

export interface SpikeScales {
  color: TrainedScale;
  size: TrainedScale;
  alpha: TrainedScale;
  fixed: string;
}

export function spikeScales(max = 7, fixed = "#e34948"): SpikeScales {
  return {
    color: {
      aes: "color",
      kind: "continuous",
      domain: [1, max],
      range: [...SEQUENTIAL_RAMP],
    },
    size: { aes: "size", kind: "continuous", domain: [1, max], range: [8, 24] },
    alpha: {
      aes: "alpha",
      kind: "continuous",
      domain: [1, max],
      range: [0.4, 1],
    },
    fixed,
  };
}

export function scaleParameters(scales: SpikeScales) {
  // Scope is continuous scales only. Reject unsupported contracts explicitly.
  for (const scale of [scales.color, scales.size, scales.alpha]) {
    if (scale.kind !== "continuous" || typeof scale.domain[0] !== "number") {
      throw new Error("scale-binding spike supports continuous scales only");
    }
  }
  return {
    colorDomain: { current: scales.color.domain },
    sizeDomain: { current: scales.size.domain },
    alphaDomain: { current: scales.alpha.domain },
    sizeRange: { current: scales.size.range },
    alphaRange: { current: scales.alpha.range },
    fixed: { current: parseColorRGBA(scales.fixed) },
  };
}

export function updateParameters(
  refs: ReturnType<typeof scaleParameters>,
  scales: SpikeScales,
) {
  const values = scaleParameters(scales);
  // Updating values preserves every ShaderRef identity.
  for (const key of Object.keys(refs) as (keyof typeof refs)[]) {
    Object.assign(refs[key], { current: values[key].current });
  }
}

export const COLOR_BINDING = wgsl`
@link fn getValue(i: u32) -> f32;
@link fn getOwner(i: u32) -> u32;
@link fn getDomain() -> vec2<f32>;
@link fn getPalette(i: u32) -> vec4<f32>;
@link fn getPaletteLength() -> u32;
@link fn getAlpha(i: u32) -> f32;
@export fn getColor(i: u32) -> vec4<f32> {
  let domain = getDomain();
  let value = getValue(getOwner(i));
  var t = 0.0;
  if (domain.y > domain.x) { t = (value - domain.x) / (domain.y - domain.x); }
  let last = getPaletteLength() - 1u;
  let x = clamp(t, 0.0, 1.0) * f32(last);
  let low = u32(floor(x));
  let rgb = mix(getPalette(low).rgb, getPalette(min(low + 1u, last)).rgb, fract(x));
  // Existing CPU mapping quantizes interpolated RGB to an 8-bit hex color.
  return vec4<f32>(floor(rgb * 255.0 + 0.5) / 255.0, clamp(getAlpha(i), 0.0, 1.0));
}`;

export const SIZE_BINDING = wgsl`
@link fn getValue(i: u32) -> f32;
@link fn getOwner(i: u32) -> u32;
@link fn getDomain() -> vec2<f32>;
@link fn getRange() -> vec2<f32>;
@export fn getRadius(i: u32) -> f32 {
  let domain = getDomain();
  let range = getRange();
  var t = 0.0;
  if (domain.y > domain.x) { t = clamp((getValue(getOwner(i)) - domain.x) / (domain.y - domain.x), 0.0, 1.0); }
  return range.x + sqrt(t) * (range.y - range.x);
}`;

export const ALPHA_BINDING = wgsl`
@link fn getValue(i: u32) -> f32;
@link fn getOwner(i: u32) -> u32;
@link fn getDomain() -> vec2<f32>;
@link fn getRange() -> vec2<f32>;
@export fn getAlpha(i: u32) -> f32 {
  let domain = getDomain();
  let range = getRange();
  var t = 0.0;
  if (domain.y > domain.x) { t = (getValue(getOwner(i)) - domain.x) / (domain.y - domain.x); }
  return range.x + t * (range.y - range.x);
}`;

export const FIXED_BINDING = wgsl`
@link fn getFixed() -> vec4<f32>;
@export fn getFixedColor(i: u32) -> vec4<f32> { return getFixed(); }
`;

// Diagnostic only: evaluate the SAME linked functions used by the draw calls.
// These output buffers are never bound as mark colors, sizes, or alpha.
export const AUDIT_KERNEL = wgsl`
@link fn getSize() -> vec2<u32>;
@link fn getRevision() -> u32;
@link fn getColor(i: u32) -> vec4<f32>;
@link fn getRadius(i: u32) -> f32;
@link fn getAlpha(i: u32) -> f32;
@link fn getFixedColor(i: u32) -> vec4<f32>;
@link var<storage, read_write> output: array<vec4<f32>>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= getSize().x) { return; }
  output[i * 3u] = getColor(i);
  output[i * 3u + 1u] = vec4<f32>(getRadius(i), getAlpha(i), f32(getRevision()), 0.0);
  output[i * 3u + 2u] = getFixedColor(i);
}`;

// Raw rows include a missing row and unsorted x values. Indices preserve raw
// row identity after filtering/sorting and one-row-to-many-vertices expansion.
export const VALUES = Float32Array.of(7, Number.NaN, 1, 5, 3);
export const CASES = [
  {
    name: "filtered-sorted-points",
    kind: "points",
    owners: Uint32Array.of(2, 4, 3, 0),
    positions: Float32Array.of(60, 60, 140, 60, 220, 60, 300, 60),
  },
  {
    name: "expanded-step-line",
    kind: "line",
    owners: Uint32Array.of(2, 2, 4, 4, 3, 3, 0),
    positions: Float32Array.of(
      60,
      140,
      140,
      140,
      140,
      120,
      220,
      120,
      220,
      160,
      300,
      160,
      300,
      110,
    ),
  },
  {
    name: "four-vertices-per-bar",
    kind: "bars",
    owners: Uint32Array.of(2, 2, 2, 2, 4, 4, 4, 4, 3, 3, 3, 3, 0, 0, 0, 0),
    positions: Float32Array.of(
      40,
      290,
      40,
      250,
      80,
      250,
      80,
      290,
      120,
      290,
      120,
      220,
      160,
      220,
      160,
      290,
      200,
      290,
      200,
      190,
      240,
      190,
      240,
      290,
      280,
      290,
      280,
      170,
      320,
      170,
      320,
      290,
    ),
  },
] as const;

export function cpuAudit(
  scales: SpikeScales,
  owners: Uint32Array,
  revision: number,
): Float32Array {
  return Float32Array.from([...owners].flatMap((owner) => {
    const value = VALUES[owner];
    const alpha = scaleAlphaValue(scales.alpha, value);
    return [
      ...parseColorRGBA(scaleColorValue(scales.color, value), alpha),
      scaleSizeValue(scales.size, value),
      alpha,
      revision,
      0,
      ...parseColorRGBA(scales.fixed),
    ];
  }));
}
