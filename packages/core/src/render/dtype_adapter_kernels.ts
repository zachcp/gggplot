// <Kernel>-linkable forms of the dtype adapter passes (gggplot-vs7.9).
//
// Same dual-surface rule as render/resident_grid_kernels.ts: @gggplot/reductions
// owns the pass BODIES and the hand-numbered preamble the standalone loader in
// @gggplot/model-inspect uses (reductions/src/dtype_wgsl.ts), and this module
// adds the `@link` preamble over the same body text. The bodies are shared by reference, not copied, so
// the two surfaces cannot drift.
//
// DECLARATION ORDER IS THE BINDING ORDER. <Kernel> builds its value list as
//   [dataSize, ...args, ...sources, source, ...targets, ...history]
// and pairs it positionally, so each bundle declares getSize first, then its
// source accessor, then its storage TARGET last. Every adapter has the same
// shape -- one source, one target, no args -- so the value list is always
//   [() => [elementCount, 1], wordSource, valuesTarget]
import { TENSOR_ADAPTER_KERNELS } from "@gggplot/reductions";
import { wgsl } from "@use-gpu/shader/wgsl";

/**
 * `words` is bound as a plain u32 accessor rather than a typed one because the
 * whole point of the tier is that the range arrives UNINTERPRETED -- the pass
 * is what gives the bytes a type. The output element type is the only thing
 * that varies across the seven adapters.
 */
function linkedAdapter(name: string) {
  const kernel = TENSOR_ADAPTER_KERNELS[name];
  return wgsl`
@link fn getSize() -> vec2<u32>;
@link fn getWord(i: u32) -> u32;
@link var<storage, read_write> values: array<${kernel.outputFormat}>;

${kernel.linkPrelude}

${kernel.body}
`;
}

/** f16 -> f32 via the core `unpack2x16float` builtin; no `shader-f16` needed. */
export const WIDEN_F16_KERNEL = linkedAdapter("widen_f16");
/** bf16 -> f32 by shifting the truncated mantissa back up. Exact. */
export const WIDEN_BF16_KERNEL = linkedAdapter("widen_bf16");
/** Packed i8 -> i32, sign-extended. */
export const UNPACK_I8_KERNEL = linkedAdapter("unpack_i8");
/** Packed i16 -> i32, sign-extended. */
export const UNPACK_I16_KERNEL = linkedAdapter("unpack_i16");
/** Packed u8 -> u32. */
export const UNPACK_U8_KERNEL = linkedAdapter("unpack_u8");
/** Packed u16 -> u32. */
export const UNPACK_U16_KERNEL = linkedAdapter("unpack_u16");
/** Packed bool bytes -> u32, matching decodeValue's plain getUint8. */
export const UNPACK_BOOL_KERNEL = linkedAdapter("unpack_bool");

/** Keyed by the same names `TENSOR_UPLOAD_PLANS` gives each dtype. */
export const DTYPE_ADAPTER_KERNELS: Readonly<Record<string, unknown>> = Object
  .freeze({
    widen_f16: WIDEN_F16_KERNEL,
    widen_bf16: WIDEN_BF16_KERNEL,
    unpack_i8: UNPACK_I8_KERNEL,
    unpack_i16: UNPACK_I16_KERNEL,
    unpack_u8: UNPACK_U8_KERNEL,
    unpack_u16: UNPACK_U16_KERNEL,
    unpack_bool: UNPACK_BOOL_KERNEL,
  });
