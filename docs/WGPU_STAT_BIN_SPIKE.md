# WGPU `stat_bin` Spike

**Status: historical (spike complete).** The proven grouped stat_bin kernel shipped as `packages/reductions/src/gpu/resident_histogram.ts`; see `RESIDENCY_MATRIX.md` for the live eligibility gates.

This closes the narrow spike tracked by `gggplot-vmv`: prove the grouped
histogram kernel shape for `stat_bin` without changing the public stat API.

## Implemented Prototype

The prototype lives in `packages/reductions` rather than directly inside
`packages/core`.

Relevant package components:

- `src/wgsl.ts`
  - `GROUPED_HISTOGRAM_1D_WGSL`
  - `createGroupedHistogram1dPlan`
- `src/gpu.ts`
  - `packHistogram1dParams`
  - `groupedHistogram1dGpu(device, input)`
- `tests/gpu_test.ts`
  - uniform packing tests
  - optional WebGPU parity test against CPU `groupedHistogram1d`
- `bench/gpu_bench.ts`
  - `deno task bench:gpu`

The input shape is the one from the research note:

```ts
{
  values: Float32Array;
  lo: number;
  hi: number;
  bins?: number;
  binwidth?: number;
  groupIds?: Uint32Array;
  groupsCount?: number;
}
```

The output includes `counts: Uint32Array` shaped `[groupsCount, bins]`, plus
centers, totals, density, and GPU timing metadata.

## Kernel Shape

The grouped histogram kernel dispatches one invocation per row:

1. Read `x = values[row]`.
2. Compute `bin = clamp(floor((x - lo) / binwidth), 0, bins - 1)`.
3. Read `group = groupIds[row]` or use group `0`.
4. Compute `offset = group * bins + bin`.
5. `atomicAdd(&counts[offset], 1u)`.

The executor runs:

1. Upload typed buffers.
2. Clear the output `counts` buffer with `CLEAR_U32_WGSL`.
3. Dispatch the histogram kernel.
4. Read counts back.
5. Reconstruct the same result metadata as the CPU reducer.

## Correctness Status

The CPU reducer remains the oracle. The GPU test compares counts and totals
against `groupedHistogram1d` when a WebGPU adapter is available.

Run:

```bash
cd packages/reductions
deno test -A tests/gpu_test.ts
```

For GPU-capable CI, make adapter absence a failure:

```bash
GGGPLOT_REQUIRE_WEBGPU=1 deno test -A tests/gpu_test.ts
```

## Timing Status

The package now has timing instrumentation around:

- upload
- clear + dispatch
- readback
- total GPU wall time

Run:

```bash
cd packages/reductions
deno task bench:gpu
```

On this local Deno runtime the benchmark command currently exits with:

```text
No WebGPU adapter available.
```

So the blocker is no adapter being exposed to the benchmark runtime, not a
missing package implementation. The CPU baselines are available through:

```bash
cd packages/reductions
deno task bench
```

Recent 100k-row CPU baselines were approximately:

| Reducer                     |         Time |
| --------------------------- | -----------: |
| grouped count               |      0.33 ms |
| grouped 1D histogram        |      0.41 ms |
| streaming summary           |      0.49 ms |
| linear regression summaries | 0.52-0.57 ms |
| grouped 2D histogram        |      0.53 ms |
| exact median summary        |      16.8 ms |

## Why Core Still Uses CPU

`packages/core` still calls the synchronous CPU reducer from `compile()` because
GPU execution is async and requires a `GPUDevice`. The GPU reducer is therefore
a package-level primitive for a future browser-side or async stat path, not a
public API change.

This preserves the current grammar contract while proving the low-level WGPU
boundary.
