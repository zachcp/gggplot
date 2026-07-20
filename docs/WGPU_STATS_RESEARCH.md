# WGPU/WGSL Stats Research

**Status: historical (research note, spike complete).** Findings were folded into `GPU_NATIVE_ARCHITECTURE_PLAN.md` and realized by the `@gggplot/reductions` package; see `RESIDENCY_MATRIX.md` for what runs where today.

This note records the findings for `gggplot-619`: whether gggplot stats can
eventually use WGPU/WGSL compute shaders for high-row-count work without turning
the grammar pipeline into a GPU-first data engine.

## Bottom Line

UseGPU gives us enough low-level pieces to prototype GPU-accelerated stats, but
not a ready statistical aggregation layer. The right architecture is still:

```
raw data -> typed DataFrame -> stat/scale/group semantics -> optional GPU kernels -> RenderTree
```

The first credible prototype is a grouped histogram/bin-count kernel over
already-lowered typed buffers:

- `x: Float32Array`
- optional `groupId: Uint32Array` from factor-coded effective groups
- fixed `lo`, `binwidth`, `nBins`, `nGroups`
- output `counts: Uint32Array` shaped `[nGroups, nBins]`

That prototype would exercise the hard boundary questions (upload, atomics,
readback, and conversion back to stat output rows) without entangling every stat
with WebGPU.

## UseGPU Primitives

Installed `@use-gpu/workbench` v0.19.0 exposes the building blocks:

- `useRawSource(array, format, { readWrite, flags })` and
  `useRawTensorSource(...)` turn typed arrays into storage sources.
- `Compute`, `Kernel`, `Dispatch`, and `ComputePass` run WGSL compute modules
  against storage buffers.
- `Readback` copies storage/texture sources back to CPU typed arrays.
- scratch/derived source helpers support read-write intermediate buffers.

The local `ArcLabelLayer` is the best concrete pattern. It computes per-segment
arc lengths into a scratch buffer, runs repeated prefix-sum dispatches over the
same buffer, then uses the derived result for rendering. That proves UseGPU can
host multi-dispatch compute pipelines around derived buffers. It does not give
us a general group-by/stat reducer.

The shipped WGSL snippets include useful idioms:

- `instance/compute/arc-prefix-sum.wgsl`: staged prefix sum over a buffer.
- `contour/scan.wgsl`: atomics (`atomicAdd`, `atomicMax`) to append active
  contour cells/vertices and update indirect dispatch metadata.
- `pmrem/pmrem-diffuse-sh.wgsl`: workgroup-local accumulation with
  `workgroupBarrier()`.

Those are reusable patterns, not reusable stats.

## What Each Stat Needs

### `stat_count`

CPU today is simple and fast for ordinary documentation/gallery sizes. A GPU
version only makes sense after typed ingestion gives us factor-coded group IDs.

Useful GPU shape:

1. Lower x factor levels to `xId: Uint32Array`.
2. Lower effective group to `groupId: Uint32Array`.
3. Dispatch one thread per row.
4. Compute `offset = groupId * nX + xId`.
5. `atomicAdd(&counts[offset], 1u)`.
6. Read back `counts`, expand non-zero cells into rows.

This is a very close cousin of histogram binning.

### `stat_bin`

This is the best first prototype because it uses numeric x and fixed bins:

```wgsl
let bin = clamp(u32(floor((x[i] - lo) / binwidth)), 0u, nBins - 1u);
let offset = groupId[i] * nBins + bin;
atomicAdd(&counts[offset], 1u);
```

For normal histogram counts, one kernel plus readback is enough. Density can be
computed on CPU from counts, or in a second normalization kernel if we later
keep the result on-GPU.

### `stat_summary`

Mean/sum/min/max are plausible but need multiple accumulators:

- `sum[group, x]` using atomic add
- `count[group, x]` using atomic add
- min/max using atomic min/max on integer encodings, or separate support for
  float atomics if the target stack exposes them safely

Median is not a reduction in the same sense. It needs sorting, selection, or a
histogram/quantile approximation. Keep median CPU-side unless we have a real
large-n use case.

### `stat_density`

GPU density is plausible but different from group-by aggregation:

- For 1D density, dispatch a grid of evaluation points and sum kernel
  contributions across rows, likely with staged reductions.
- For 2D density/contour, first compute a scalar grid, then reuse
  `@use-gpu/plot`'s `ImplicitSurface` / `DualContourLayer` for isoline
  extraction.

This is a good future target after histogram, especially because contour
rendering already has native help.

### `stat_smooth`

Linear regression can be reduced to per-group sums:

- `n`, `sumX`, `sumY`, `sumXX`, `sumXY`

But the existing CPU implementation is cheap at current target sizes, and the
fit output is tiny. GPU smooth is lower priority than bin/count/density.

## CubeCL / CubeK Findings

Sources:

- <https://github.com/tracel-ai/cubecl>
- <https://github.com/tracel-ai/cubek>

CubeCL is a Rust kernel language/JIT that can compile one `#[cube]` function to
multiple backends, including WGSL/WebGPU. Its model maps CUDA/WebGPU/Metal
concepts onto portable axes: vector lanes, planes/subgroups, cube/workgroup
dimensions, and cube/grid counts. Two lessons matter for gggplot:

1. Portable GPU reductions should adapt to device topology instead of assuming a
   CUDA warp size or one fixed workgroup shape.
2. Compilation/autotuning/caching are part of performance, not a garnish. A
   browser-side gggplot kernel path has to consider shader compilation and
   dispatch overhead, not just kernel runtime.

CubeK is the kernel-library layer built on CubeCL. Its README lists a reduction
crate with `mean`, `sum`, `prod`, `max`, `min`, `argmax`/`argmin`, `per-cube`,
and `per-plane` variants, and the `cubek-reduce` README describes running tests
with the WGSL runtime. That confirms reductions are a real GPU kernel-library
concern in this ecosystem.

However, CubeK is not a direct drop-in for gggplot:

- It is Rust/CubeCL-oriented, while gggplot is TypeScript/UseGPU/WGSL.
- It targets tensor reductions, not dataframe group-by semantics with factor
  levels, guide preservation, and row-shaped stat outputs.
- It still points us toward staged reductions and topology-aware kernels rather
  than a single atomic-everything implementation.

## Recommended Prototype

Create a narrow spike after `gggplot-3yl` typed ingestion is underway:

**Prototype:** `stat_bin` GPU count kernel for numeric x, optional effective
group IDs.

Inputs:

- `Float32Array x`
- `Uint32Array groupId` (or a synthetic zero group)
- constants: `lo`, `binwidth`, `nBins`, `nGroups`

Output:

- `Uint32Array counts`, length `nBins * nGroups`

Run path:

1. Build CPU reference with current `statBin`.
2. Upload typed buffers through `useRawSource` / storage sources.
3. Zero a read-write counts buffer.
4. Dispatch a WGSL kernel with one invocation per row.
5. Read back counts with `Readback`.
6. Convert counts into normal post-stat `DataFrame` rows.
7. Compare correctness and timing against CPU for:
   - small examples (`n < 1_000`)
   - medium docs data (`mpg`, `txhousing`)
   - large docs data (`diamonds`, around 54k rows)

Decision criteria:

- For small/medium data, CPU should remain the default.
- GPU only earns its keep if upload + dispatch + readback beats CPU at realistic
  large-n thresholds or lets us keep a later density/contour pipeline on-GPU.
- The public stat API must not change.

## Open Questions

- Browser WebGPU feature support for atomics and subgroup operations varies;
  avoid subgroup-dependent kernels in the first prototype.
- We need a reliable way to zero output buffers before dispatch.
- Readback may dominate for stats that immediately become CPU `DataFrame` rows.
  GPU pays off more when the result can stay in a GPU tensor/grid.
- For grouped stats, factor coding and level ordering must come from gggplot's
  typed ingestion layer, not from shader-side string handling.
