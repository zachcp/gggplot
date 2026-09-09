// Dtype adapter passes for the GPU loader tier (ADR 006, gggplot-vs7.9).
//
// These replace the CPU decode loop at products.ts::readValues for every dtype
// WGSL cannot bind directly. A storage buffer speaks f32/u32/i32; a model
// tensor speaks f16/bf16/i8/i16/u8/u16/bool, so the range is uploaded as raw
// u32 WORDS and one pass reinterprets those words into a typed output buffer.
//
// DUAL SURFACE, same rule as wgsl.ts next door: this module owns the pass
// BODIES plus the hand-numbered preamble the standalone executor uses, and
// packages/core/src/render/dtype_adapter_kernels.ts adds the `@link` preamble
// over the same body text. The bodies must therefore stay binding-agnostic:
// reach the input through getWord()/getSize(), and write only through `values`.
//
// These live in @gggplot/reductions rather than in @gggplot/model-inspect, which
// is the package that consumes them, for one structural reason: core owns the
// `@link` forms, so whichever package owns the bodies is imported BY core. core
// already depends on reductions and model-inspect already depends on core/plan,
// so putting them in model-inspect would close a package cycle. Putting them
// here also makes the dtype adapters the same shape as every other pass in the
// epic -- bodies in reductions, link preamble in core/src/render.
//
// Everything here is a pure BIT REINTERPRETATION, which is why it is exact and
// why it is testable against the CPU decoder byte for byte. The lossy 64-bit
// narrowings are deliberately NOT here; see TENSOR_ADAPTER_KERNELS below.

/**
 * Shared body for the half-width float widenings (f16, bf16).
 *
 * Two elements per 32-bit word, low half first: WebGPU and SafeTensors are both
 * little-endian, so element 2k is the low 16 bits of word k. The preamble
 * supplies `widen`, which is the only thing that differs between the two.
 */
export const WIDEN_BODY: string = `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= getSize().x) {
    return;
  }
  values[i] = widen(getWord(i / 2u), (i & 1u) == 1u);
}
`.trim();

/**
 * Shared body for every sub-word integer unpack (i8, i16, u8, u16, bool).
 *
 * The preamble supplies ELEMENT_BITS and `convert`, so this one body covers
 * both widths and both signednesses and both output types. `perWord` and the
 * mask are derived rather than passed, which keeps the preambles down to the
 * two things that genuinely differ.
 */
export const UNPACK_BODY: string = `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= getSize().x) {
    return;
  }
  let perWord = 32u / ELEMENT_BITS;
  let shift = (i % perWord) * ELEMENT_BITS;
  let mask = (1u << ELEMENT_BITS) - 1u;
  values[i] = convert((getWord(i / perWord) >> shift) & mask);
}
`.trim();

/**
 * Hand-numbered preamble for the standalone executor.
 *
 * `count` is the ELEMENT count, not the word count: it bounds the output, and
 * the input is addressed relative to it. In the linked form the same value
 * arrives as <Kernel>'s dispatch size, which is why the body asks getSize() for
 * it rather than reading a binding.
 */
function rawPreamble(outType: string, extra: string): string {
  return `
@group(0) @binding(0) var<storage, read> words: array<u32>;
@group(0) @binding(1) var<storage, read_write> values: array<${outType}>;
@group(0) @binding(2) var<uniform> count: u32;

fn getSize() -> vec2<u32> {
  return vec2<u32>(count, 1u);
}

fn getWord(i: u32) -> u32 {
  return words[i];
}

${extra.trim()}
`.trim();
}

/**
 * f16 is decoded with the CORE `unpack2x16float` builtin, not with the
 * `shader-f16` feature. The feature would let us bind f16 storage directly and
 * skip this pass, but ADR 006 declines the resulting `format` fork; this builtin
 * needs no feature at all and is exact in the same way.
 */
export const WIDEN_F16_CONVERT: string = `
fn widen(word: u32, high: bool) -> f32 {
  let pair = unpack2x16float(word);
  return select(pair.x, pair.y, high);
}
`;

/**
 * bf16 is a TRUNCATED f32: its 16 bits are that f32's high 16 bits. Shifting
 * them back up reconstructs the value exactly, with no rounding mode to choose
 * and no special case for inf/NaN, which keep their f32 bit patterns.
 */
export const WIDEN_BF16_CONVERT: string = `
fn widen(word: u32, high: bool) -> f32 {
  let half = select(word & 0xffffu, word >> 16u, high);
  return bitcast<f32>(half << 16u);
}
`;

// Signed unpacks sign-extend by shifting the element up to the top of a u32 and
// back down ARITHMETICALLY -- bitcast to i32 first, because `>>` on a u32 is a
// logical shift and would zero-fill the sign.
const CONVERT = {
  i8:
    "fn convert(raw: u32) -> i32 {\n  return bitcast<i32>(raw << 24u) >> 24u;\n}",
  i16:
    "fn convert(raw: u32) -> i32 {\n  return bitcast<i32>(raw << 16u) >> 16u;\n}",
  u8: "fn convert(raw: u32) -> u32 {\n  return raw;\n}",
  u16: "fn convert(raw: u32) -> u32 {\n  return raw;\n}",
  // Identical to u8, deliberately. Normalizing any non-zero byte to 1 would be
  // defensible on its own, but decodeValue's `bool` case is a plain getUint8,
  // and the dual-surface rule is that the two forms produce the SAME output for
  // the same input -- a divergence here would make the parity test lie about
  // every other dtype. If bool should normalize, it should normalize on both
  // sides, in its own change.
  bool: "fn convert(raw: u32) -> u32 {\n  return raw;\n}",
} as const;

const bits = (value: number) => `const ELEMENT_BITS: u32 = ${value}u;`;

/** One adapter pass: the body, its raw-executor form, and its output type. */
export interface DTypeAdapterKernel {
  readonly body: string;
  /** Preamble + body, ready for `createShaderModule` in the standalone path. */
  readonly wgsl: string;
  /** Preamble-only extras the `@link` form must re-declare above the body. */
  readonly linkPrelude: string;
  readonly outputFormat: "f32" | "u32" | "i32";
  /** Source elements packed into each 32-bit word. */
  readonly perWord: number;
}

function widenKernel(convert: string): DTypeAdapterKernel {
  return {
    body: WIDEN_BODY,
    wgsl: `${rawPreamble("f32", convert)}\n\n${WIDEN_BODY}`,
    linkPrelude: convert.trim(),
    outputFormat: "f32",
    perWord: 2,
  };
}

function unpackKernel(
  elementBits: 8 | 16,
  convert: string,
  outputFormat: "u32" | "i32",
): DTypeAdapterKernel {
  const prelude = `${bits(elementBits)}\n\n${convert}`;
  return {
    body: UNPACK_BODY,
    wgsl: `${rawPreamble(outputFormat, prelude)}\n\n${UNPACK_BODY}`,
    linkPrelude: prelude,
    outputFormat,
    perWord: 32 / elementBits,
  };
}

/**
 * The adapter passes that actually EXIST, keyed by the `kernel` name
 * `TENSOR_UPLOAD_PLANS` gives each dtype.
 *
 * The plan table describes the intended path for every dtype; this registry is
 * the truth about which of those paths is built. A dtype whose plan names a
 * kernel absent from here falls back to the CPU `values` path — which is why
 * `narrow_f64` / `narrow_i64` / `narrow_u64` are missing and not stubbed.
 *
 * The 64-bit narrowings are held back deliberately, and the line is principled
 * rather than budgetary: everything here is a bit reinterpretation, exact and
 * checkable against the CPU decoder byte for byte. f64 -> f32 is not — WGSL has
 * no f64, so it means hand-rolling IEEE-754 exponent rebiasing, mantissa
 * rounding, and overflow/subnormal behavior out of two u32 words, and that
 * needs a stated rounding policy before it needs code.
 */
export const TENSOR_ADAPTER_KERNELS: Readonly<
  Record<string, DTypeAdapterKernel>
> = Object.freeze({
  widen_f16: widenKernel(WIDEN_F16_CONVERT),
  widen_bf16: widenKernel(WIDEN_BF16_CONVERT),
  unpack_i8: unpackKernel(8, CONVERT.i8, "i32"),
  unpack_i16: unpackKernel(16, CONVERT.i16, "i32"),
  unpack_u8: unpackKernel(8, CONVERT.u8, "u32"),
  unpack_u16: unpackKernel(16, CONVERT.u16, "u32"),
  unpack_bool: unpackKernel(8, CONVERT.bool, "u32"),
});
