// vnh.16: isolated experiment, deliberately absent from the public exports.
// Current TrainedScale semantics + runtime bindings, without an expression AST.
import { wgsl } from "@use-gpu/shader/wgsl";
import type { TrainedScale } from "../src/scale/types.ts";
import { parseColorRGBA } from "../src/color/mod.ts";
import {
  NA_COLOR,
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

// `min` above `max` builds a reversed domain; CPU and GPU must both map every
// value to t=0 there.
export function spikeScales(max = 7, fixed = "#e34948", min = 1): SpikeScales {
  const domain: [number, number] = [min, max];
  return {
    color: {
      aes: "color",
      kind: "continuous",
      domain,
      range: [...SEQUENTIAL_RAMP],
    },
    size: { aes: "size", kind: "continuous", domain, range: [8, 24] },
    alpha: {
      aes: "alpha",
      kind: "continuous",
      domain,
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
    naColor: { current: parseColorRGBA(NA_COLOR) },
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

// The bindings are the production ones (render/scale_bindings.ts), so the
// probe's CPU/GPU audit measures exactly what marks use.
export {
  ALPHA_BINDING,
  COLOR_BINDING,
  SIZE_BINDING,
} from "../src/render/scale_bindings.ts";

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
// The points case binds the missing row (owner 1) so NaN reaches the shader.
export const VALUES = Float32Array.of(7, Number.NaN, 1, 5, 3);
export const CASES = [
  {
    name: "filtered-sorted-points",
    kind: "points",
    owners: Uint32Array.of(2, 4, 3, 0, 1),
    positions: Float32Array.of(60, 60, 140, 60, 220, 60, 300, 60, 380, 60),
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
  // The CPU's missing size/alpha is NaN ("not drawn"); the drawn encoding of
  // that is zero, which is what the GPU writes.
  const drawn = (v: number) => Number.isNaN(v) ? 0 : v;
  return Float32Array.from([...owners].flatMap((owner) => {
    const value = VALUES[owner];
    const alpha = drawn(scaleAlphaValue(scales.alpha, value));
    return [
      ...parseColorRGBA(scaleColorValue(scales.color, value), alpha),
      drawn(scaleSizeValue(scales.size, value)),
      alpha,
      revision,
      0,
      ...parseColorRGBA(scales.fixed),
    ];
  }));
}
