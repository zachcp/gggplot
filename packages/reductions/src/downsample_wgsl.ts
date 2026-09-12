// Nearest-sample downsample gather pass for the tensor overview
// representation (ADR 006 follow-on, gggplot-vs7.13).
//
// A bit-for-bit port of model-inspect's products.ts CPU overview loop: for
// each output cell, pick the source element at
// floor(outRow * rows / targetRows), floor(outColumn * columns / targetColumns),
// clamped to the last valid element. That is a raw WORD copy, not a value
// conversion -- nearest-sample never does arithmetic on the sampled value --
// so one kernel serves every already-adapted dtype. f32/u32/i32 are all
// 4-byte words by the time this runs; the dtype adapter passes next door
// (dtype_wgsl.ts) already did the conversion that mattered, and the loader
// runs this as a SECOND pass over their output (gpu_loader.ts).
//
// DUAL SURFACE, same rule as dtype_wgsl.ts: this module owns the pass body
// plus the hand-numbered preamble the standalone executor uses. A linked
// `@link` form belongs in core/src/render, matching dtype_adapter_kernels.ts,
// once a mark consumes `TensorContentProduct.source` for this representation
// -- nothing does yet, same as the `exact` representation's handle today.

/**
 * Bindings: `source` is the full [rows, columns] adapted buffer, `overview`
 * is the [targetRows, targetColumns] grid this pass allocates, and `params`
 * carries all four dimensions -- there is no implicit "count" here the way
 * the dtype adapters have one, because gather needs both the source grid and
 * the target grid to compute an index.
 *
 * The output binding is named `overview`, not `target`: `target` is a
 * reserved WGSL keyword (reserved for a future language feature), and using
 * it fails shader parsing with "name `target` is a reserved keyword" -- a
 * device-level error, not a type error, so it only surfaces by running the
 * kernel against a real device.
 */
const DOWNSAMPLE_PARAMS_STRUCT: string = `
struct DownsampleParams {
  rows: u32,
  columns: u32,
  targetRows: u32,
  targetColumns: u32,
}
`.trim();

function rawPreamble(): string {
  return `
${DOWNSAMPLE_PARAMS_STRUCT}

@group(0) @binding(0) var<storage, read> source: array<u32>;
@group(0) @binding(1) var<storage, read_write> overview: array<u32>;
@group(0) @binding(2) var<uniform> params: DownsampleParams;
`.trim();
}

/**
 * `rows * columns` is assumed to fit u32 (the caller's own content budgets --
 * `maxDownsampleReadBytes` and `maxResidentBytes` -- already bound the source
 * range well under 2^32 elements before this pass is ever dispatched), so the
 * integer arithmetic below matches `Math.floor` on the CPU reference exactly:
 * WGSL's `/` on unsigned integers is floor division for non-negative operands.
 */
export const DOWNSAMPLE_NEAREST_BODY: string = `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  let total = params.targetRows * params.targetColumns;
  if (i >= total) {
    return;
  }
  let outRow = i / params.targetColumns;
  let outColumn = i % params.targetColumns;
  let sourceRow = (outRow * params.rows) / params.targetRows;
  let sourceColumn = (outColumn * params.columns) / params.targetColumns;
  let last = params.rows * params.columns - 1u;
  overview[i] = source[min(last, sourceRow * params.columns + sourceColumn)];
}
`.trim();

/** One gather pass: the body, its raw-executor form, and its link extras. */
export interface DownsampleKernel {
  readonly body: string;
  /** Preamble + body, ready for `createShaderModule` in the standalone path. */
  readonly wgsl: string;
  /** Preamble-only extras the `@link` form must re-declare above the body. */
  readonly linkPrelude: string;
}

export const DOWNSAMPLE_NEAREST_KERNEL: DownsampleKernel = {
  body: DOWNSAMPLE_NEAREST_BODY,
  wgsl: `${rawPreamble()}\n\n${DOWNSAMPLE_NEAREST_BODY}`,
  linkPrelude: DOWNSAMPLE_PARAMS_STRUCT,
};
