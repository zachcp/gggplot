# Reductions Package Plan

`packages/reductions` is the low-level statistics layer for gggplot. Its job is
to operate on typed arrays and small scalar parameters, not on the full grammar
objects. Core remains responsible for aesthetic mappings, factor/group encoding,
scale training, and expanding reduced matrices back into row-shaped stat output.

The performance target is GPU where it pays off, but every reducer needs a CPU
reference implementation first. That gives tests a stable oracle and lets the
current synchronous `compile()` pipeline use the package while WebGPU execution
remains optional and async.

## Package Shape

- Inputs are typed buffers: `Float32Array`, `Float64Array` where needed,
  `Uint32Array` ids, and explicit dimensions.
- Grouping is numeric: core lowers effective ggplot groups to `groupIds`.
- Categorical x values are numeric: core lowers factor/level ids to `valueIds`.
- Outputs are dense matrices or vectors with shape metadata.
- WGSL modules live beside CPU reducers and are tested for plan invariants.
- GPU execution lives in `src/gpu.ts`, is optional and workload-dependent, and
  is not part of the public grammar API.

## Current Reducers

| Reducer                     | Core stat                | CPU status  | WebGPU status                                     | Notes                                                    |
| --------------------------- | ------------------------ | ----------- | ------------------------------------------------- | -------------------------------------------------------- |
| `groupedCount1d`            | `stat_count`             | Implemented | Same atomic pattern as histogram, no executor yet | Counts `[group, value]` cells from `valueIds`.           |
| `groupedHistogram1d`        | `stat_bin`               | Implemented | `groupedHistogram1dGpu` implemented               | Counts `[group, bin]`, plus totals, centers, density.    |
| `groupedSummary1d`          | `stat_summary` built-ins | Implemented | Future streaming sum/count kernel                 | Computes count/sum/mean/min/max and CPU exact median.    |
| `groupedLinearRegression1d` | `stat_smooth(method=lm)` | Implemented | Future sum/cross-product kernel                   | Emits sufficient stats and fitted coefficients by group. |
| `groupedBoxplot1d`          | Future `stat_boxplot`    | Implemented | CPU exact quantiles for now                       | Computes quartiles, whiskers, and outliers by group.     |
| `groupedDensity1d`          | Future density/violin    | Implemented | Future grid-evaluation kernel                     | Evaluates normalized gaussian density grids by group.    |
| `groupedHistogram2d`        | Future 2D bins/contours  | Implemented | `groupedHistogram2dGpu` implemented               | Counts `[group, yBin, xBin]` grids.                      |

## Core Integration

`packages/core/src/stat/mod.ts` is the bridge between grammar semantics and
reducers:

- `stat_count` encodes x values and effective groups, then calls
  `groupedCount1d`.
- `stat_bin` filters finite numeric x values, resolves bins/binwidth, encodes
  effective groups, then calls `groupedHistogram1d`.
- `stat_summary` encodes x/group cells and calls `groupedSummary1d` for built-in
  aggregators. Custom JS aggregators remain in core because reductions cannot
  execute arbitrary user functions.
- `stat_smooth({ method: "lm" })` calls `groupedLinearRegression1d` and keeps
  fitted point/ribbon expansion in core.

This keeps reducers small and stable: they know about ids, numeric buffers, and
dense result matrices, not ggplot mappings or RenderTree rows.

## Future GPU Work

### Count And Summary Kernels

`groupedCount1d`, `groupedSummary1d`, and linear-regression sufficient stats all
map to reductions over small numeric outputs.

GPU path:

- Count can reuse the histogram atomic pattern with value ids instead of bins.
- Summary/regression can use staged sums/counts/cross-products.
- `min`/`max` need careful float atomic support or encoded integer ordering.
- Exact median/quantile should stay CPU until there is a strong large-n use
  case; approximate quantiles can be a later histogram-based reducer.
- Output is tiny, so CPU often wins unless the input is already GPU-local or the
  row count is very large.

### Boxplot Summaries

`groupedBoxplot1d` exists as a CPU reducer for future raw-y `stat_boxplot`.

Inputs:

- `xIds` or group ids
- `y`
- optional `groupIds`

Outputs:

- lower whisker
- q1
- median
- q3
- upper whisker
- outlier indices or outlier values
- group counts

GPU path:

- Exact quartiles are sorting/selection work and should be CPU-reference-first.
- Approximate quantile summaries can be revisited after histogram/selection
  benchmarks exist.

### 1D Density Grid

`groupedDensity1d` exists as a CPU reducer for future `stat_density`,
`stat_ydensity`, and `geom_violin`.

Inputs:

- `x: Float32Array`
- optional `groupIds`
- evaluation grid bounds and size
- bandwidth and kernel choice

Outputs:

- grid centers
- density matrix `[group, grid]`
- optional scaled density variants

GPU path:

- Good candidate once an async WGPU stat path exists.
- Dispatch one output grid cell per invocation and reduce contributions across
  rows, or use tiled/workgroup accumulation for large inputs.

### 2D Bin/Grid Reductions

`groupedHistogram2d` and `groupedHistogram2dGpu` exist for future `stat_bin_2d`,
heatmaps, `stat_contour`, and `density_2d`.

Inputs:

- `x: Float32Array`
- `y: Float32Array`
- optional `groupIds`
- rectangular grid bounds and dimensions

Outputs:

- counts or scalar values shaped `[group, yBin, xBin]`
- grid metadata for lowering to tiles or contour primitives

GPU path:

- Implemented for rectangular grouped histograms. It is the same atomic binning
  model as 1D histogram with a 2D offset.
- Contour extraction can reuse UseGPU-style grid/contour primitives after the
  scalar grid exists.

### QQ, Ellipse, And Function Stats

Owner bead: `gggplot-aei.8` for grammar coverage; reductions work should be
created only when those stats enter implementation.

- QQ needs sorting/quantiles, so CPU first.
- Ellipse needs covariance summaries by group; that can reuse grouped sums and
  cross-products.
- Function stats mostly generate rows from formulas and do not need a reducer.

## Test Strategy

Standalone reductions tests cover:

- dense matrix shape and offset order
- inferred versus explicit group counts
- out-of-range ids ignored rather than corrupting output
- empty inputs
- histogram `bins` versus `binwidth` resolution
- density normalization from counts and totals
- WGSL plan invariants such as dispatch size, output length, and atomic usage
- optional real WebGPU parity when `navigator.gpu` exposes an adapter

Core tests should only assert grammar semantics. If a reducer edge case can be
tested without `packages/core`, it belongs under `packages/reductions/tests`.

## Execution Roadmap

1. Keep CPU reducers as the always-available reference path.
2. Use the existing benchmarks for count/bin/summary/regression/density/grid
   workloads to establish threshold decisions.
3. Expand the WGPU execution harness beyond grouped histograms when benchmark
   evidence says the total cost wins.
4. Choose CPU or GPU per reducer based on upload + clear + dispatch + readback
   cost, not just kernel time.
5. Prefer GPU paths whose outputs can stay as buffers for rendering or contour
   extraction; readback-heavy stats need higher row-count thresholds.

## Validation Commands

From the package:

```bash
cd packages/reductions
deno task test
deno task bench
deno task bench:gpu
```

From the repo root:

```bash
deno test -A
deno task check
```
