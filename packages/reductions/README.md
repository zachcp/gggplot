# @gggplot/reductions

Low-level typed-array reducers for gggplot stats.

This package owns reducer semantics over numeric buffers. It intentionally does
not know about DataFrames, aes mappings, factor labels, scales, geoms, or
RenderTree output. `packages/core` lowers grammar data into numeric ids and
typed arrays before calling this package.

The synchronous core compiler currently uses the CPU reducers as its stat
backend. WebGPU executors are exposed as lower-level async primitives for
histogram workloads and future browser/GPU-local pipelines.

## Modules

| Module         | Purpose                                                       |
| -------------- | ------------------------------------------------------------- |
| `src/cpu.ts`   | CPU reference reducers used by the synchronous core pipeline. |
| `src/wgsl.ts`  | WGSL shader source and dispatch/count planning helpers.       |
| `src/gpu.ts`   | Raw WebGPU execution/readback for grouped histogram reducers. |
| `src/types.ts` | Typed input/result contracts shared by CPU and GPU paths.     |

## Reducers

| Reducer                     | Used by core today              | GPU executor                 |
| --------------------------- | ------------------------------- | ---------------------------- |
| `groupedCount1d`            | `stat_count`                    | Planned atomic-id kernel     |
| `groupedHistogram1d`        | `stat_bin`                      | `groupedHistogram1dGpu`      |
| `groupedSummary1d`          | `stat_summary` built-ins        | Planned staged sums/counts   |
| `groupedLinearRegression1d` | `stat_smooth({ method: "lm" })` | Planned cross-product kernel |
| `groupedBoxplot1d`          | Future `stat_boxplot`           | CPU exact quantiles for now  |
| `groupedDensity1d`          | Future density/violin stats     | Planned grid kernel          |
| `groupedHistogram2d`        | Future 2D bins/contours         | `groupedHistogram2dGpu`      |

CPU reducers are the correctness oracle. GPU reducers must preserve the same
shape, binning, grouping, and dense output layout.

See `docs/REDUCTIONS_COMPONENTS.md` for the core/package boundary.

## Tests

```bash
deno task test
```

`tests/gpu_test.ts` always validates GPU parameter packing. It also runs real
WebGPU parity checks when `navigator.gpu.requestAdapter()` returns an adapter;
otherwise those checks skip without failing ordinary CI.

To require a WebGPU adapter in a GPU-capable environment:

```bash
GGGPLOT_REQUIRE_WEBGPU=1 deno test -A tests/gpu_test.ts
```

## Benchmarks

CPU baseline:

```bash
deno task bench
```

GPU timing split:

```bash
deno task bench:gpu
```

The GPU benchmark reports CPU time, total GPU time, upload, dispatch, readback,
and count parity. On runtimes without a WebGPU adapter it exits cleanly with a
message.
