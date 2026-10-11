// Binding the trained scales from custom primitives (gggplot-7j9).
//
// Inside <GGPanel>, any Use.GPU primitive draws in the panel's data
// coordinates. These hooks hand it the plot's own GPU scale functions, the
// ones gggplot's bound points use (render/scale_bindings.ts): a value per
// item in, a lambda source of colors or sizes out, reading the root's stable
// refs, so a retrain updates the primitive by uniform write with no relink.
// For CPU work, useGGScales() gives the immutable trained scales and their
// revision.
import { wgsl } from "@use-gpu/shader/wgsl";
import {
  COLOR_BINDING,
  type ScaleBindingRefs,
  SIZE_BINDING,
} from "../render/scale_bindings.ts";
import {
  useLambdaSource,
  useMemo,
  useOne,
  useRawSource,
  useShader,
} from "../runtime/usegpu_compat.ts";
import { useGGScales } from "./gg_scales.ts";

/** Item i reads value i: a primitive's items are its rows. */
const IDENTITY_OWNER = wgsl`
@export fn getOwner(i: u32) -> u32 { return i; }
`;

const ONE = { current: 1 };

function useRefs(): ScaleBindingRefs {
  const scales = useGGScales();
  if (!scales) {
    throw new Error("[gggplot] scale hooks need a <GGPlot> root above them");
  }
  return scales.gpu;
}

/**
 * Colors for `values` through the plot's continuous color (or fill) scale,
 * exactly as a gggplot point layer maps them, missing values included.
 * Returns a lambda source of vec4<f32>, one per value: pass it as `colors`.
 */
export function useGGColors(
  values: Float32Array,
  aes: "color" | "fill" = "color",
): unknown {
  const refs = useRefs()[aes];
  const valueSource = useRawSource(values, "f32");
  const palette = useRawSource(refs.palette, "vec4<f32>");
  const paletteLength = useMemo(
    () => ({ current: refs.palette.length / 4 }),
    [refs.palette],
  );
  const bound = useShader(COLOR_BINDING, [
    valueSource,
    IDENTITY_OWNER,
    refs.domain,
    palette,
    paletteLength,
    ONE,
    refs.naColor,
  ]);
  const props = useOne(() => ({ length: values.length }), values.length);
  return useLambdaSource(bound, props);
}

/**
 * Point radii for `values` through the plot's continuous size scale (area
 * semantics, as gggplot's points). Returns a lambda source of f32, one per
 * value: pass it as `sizes`.
 */
export function useGGSizes(values: Float32Array): unknown {
  const refs = useRefs().size;
  const valueSource = useRawSource(values, "f32");
  const bound = useShader(SIZE_BINDING, [
    valueSource,
    IDENTITY_OWNER,
    refs.domain,
    refs.range,
  ]);
  const props = useOne(() => ({ length: values.length }), values.length);
  return useLambdaSource(bound, props);
}
