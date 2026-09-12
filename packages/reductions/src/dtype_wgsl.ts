// Dtype adapter passes for the GPU loader tier (ADR 006, gggplot-vs7.9;
// 64-bit narrowing added by gggplot-vs7.14).
//
// These replace the CPU decode loop at products.ts::readValues for every dtype
// WGSL cannot bind directly. A storage buffer speaks f32/u32/i32; a model
// tensor speaks f16/bf16/i8/i16/u8/u16/bool/f64/i64/u64, so the range is
// uploaded as raw u32 WORDS and one pass reinterprets those words into a typed
// output buffer.
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
// The widen/unpack passes are pure BIT REINTERPRETATION -- exact, and
// checkable against the CPU decoder byte for byte. The narrow passes
// (f64/i64/u64) are lossy by design under the policy gggplot-vs7.14 states
// next to each one below, but still checkable against the CPU decoder under
// that same stated policy -- see `narrowF64ToF32` (model-inspect's
// products.ts) and `decodeValue`'s i64/u64 cases.

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
 * Shared body for every 64-bit narrowing (f64, i64, u64).
 *
 * The inverse packing ratio from widen/unpack: those take MULTIPLE elements
 * from one word, this takes TWO words per element (`getWord(2i)` is the
 * little-endian LOW word, `getWord(2i+1)` the high word). The preamble
 * supplies `convert(lo, hi)`, which is the only thing that differs between
 * the three dtypes.
 */
export const NARROW_BODY: string = `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= getSize().x) {
    return;
  }
  values[i] = convert(getWord(i * 2u), getWord(i * 2u + 1u));
}
`.trim();

/**
 * i64/u64 -> i32/u32: truncate to the low word. A pure bit-level narrowing
 * cast (the same one `(int32_t)`/`(uint32_t)` performs in C), not a
 * saturating clamp -- gggplot-vs7.14's decision, matching
 * `decodeValue`'s i64/u64 cases (products.ts) exactly. No sign handling is
 * needed for the unsigned case: the low word's BITS are the answer either
 * way, and `values` being declared `array<i32>` or `array<u32>` is what gives
 * them a sign.
 */
const NARROW_TRUNCATE = {
  i64: "fn convert(lo: u32, hi: u32) -> i32 {\n  return bitcast<i32>(lo);\n}",
  u64: "fn convert(lo: u32, hi: u32) -> u32 {\n  return lo;\n}",
} as const;

/**
 * f64 -> f32: round-to-nearest-even, overflow to +/-infinity, and underflow
 * (of a genuine f64 subnormal, OR a normal f64 too small for a NORMAL f32)
 * flushed to a signed zero rather than produced as an f32 subnormal.
 *
 * A hand-rolled IEEE-754 conversion because WGSL has no f64 to cast from.
 * Ported statement-for-statement from `narrowF64ToF32` (model-inspect's
 * products.ts), which is the parity reference `gpu_loader_device_test.ts`
 * checks this kernel against -- the two must stay in lockstep by inspection,
 * since nothing enforces it structurally the way sharing a body does for the
 * standalone/linked WGSL surfaces.
 *
 * Flush-to-zero (rather than gradual underflow into an f32 subnormal) is the
 * deliberately simpler half of gggplot-vs7.14's decision: it needs only the
 * fixed-width rounding already below, where a real subnormal OUTPUT would need
 * a variable mantissa shift depending on how far below the normal range the
 * value sits. The bead's own wording -- "underflow to subnormal OR ZERO" --
 * sanctions this choice. It is also why `Math.fround` was rejected as the CPU
 * reference: `Math.fround` performs full gradual underflow and would disagree
 * with this kernel in exactly that sliver.
 */
const NARROW_F64_CONVERT = `
fn convert(lo: u32, hi: u32) -> f32 {
  let sign = (hi >> 31u) & 1u;
  let exponent64 = (hi >> 20u) & 0x7ffu;
  let mantissaHigh20 = hi & 0xfffffu;
  let mantissaLow32 = lo;

  if (exponent64 == 0u) {
    return bitcast<f32>(sign << 31u);
  }
  if (exponent64 == 0x7ffu) {
    if (mantissaHigh20 == 0u && mantissaLow32 == 0u) {
      return bitcast<f32>((sign << 31u) | 0x7f800000u);
    }
    return bitcast<f32>((sign << 31u) | 0x7fc00000u);
  }

  var exponent32: i32 = i32(exponent64) - 896;
  var mantissa32: u32 = (mantissaHigh20 << 3u) | (mantissaLow32 >> 29u);
  let guardBit = (mantissaLow32 >> 28u) & 1u;
  let stickyBits = (mantissaLow32 & 0x0fffffffu) != 0u;

  if (exponent32 >= 255) {
    return bitcast<f32>((sign << 31u) | 0x7f800000u);
  }
  if (exponent32 <= 0) {
    return bitcast<f32>(sign << 31u);
  }

  if (guardBit == 1u && (stickyBits || (mantissa32 & 1u) == 1u)) {
    mantissa32 = mantissa32 + 1u;
    if (mantissa32 == 0x800000u) {
      mantissa32 = 0u;
      exponent32 = exponent32 + 1;
    }
  }
  if (exponent32 >= 255) {
    return bitcast<f32>((sign << 31u) | 0x7f800000u);
  }
  return bitcast<f32>((sign << 31u) | (u32(exponent32) << 23u) | mantissa32);
}
`.trim();

function narrowKernel(
  convert: string,
  outputFormat: "f32" | "u32" | "i32",
): DTypeAdapterKernel {
  return {
    body: NARROW_BODY,
    wgsl: `${rawPreamble(outputFormat, convert)}\n\n${NARROW_BODY}`,
    linkPrelude: convert.trim(),
    outputFormat,
    // Two words consumed per element, the inverse of widen/unpack's ratio.
    perWord: 0.5,
  };
}

/**
 * The adapter passes that actually EXIST, keyed by the `kernel` name
 * `TENSOR_UPLOAD_PLANS` gives each dtype.
 *
 * The plan table describes the intended path for every dtype; this registry is
 * the truth about which of those paths is built. A dtype whose plan names a
 * kernel absent from here falls back to the CPU `values` path.
 *
 * The 64-bit narrowings were held back until gggplot-vs7.14 stated a rounding
 * and overflow policy for each -- f64's hand-rolled IEEE-754 rebias needed one
 * before it needed code, and i64/u64 needed a decision between saturating and
 * truncating. Both are here now: truncate-to-low-word for the integers,
 * round-to-nearest-even with flush-to-zero underflow for f64. See
 * `NARROW_TRUNCATE`/`NARROW_F64_CONVERT` above and `narrowF64ToF32`
 * (model-inspect/src/products.ts) for the policy each implements.
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
  narrow_f64: narrowKernel(NARROW_F64_CONVERT, "f32"),
  narrow_i64: narrowKernel(NARROW_TRUNCATE.i64, "i32"),
  narrow_u64: narrowKernel(NARROW_TRUNCATE.u64, "u32"),
});
