# Perf & GPU Upload Baseline

**Status: living.** Created 2026-07-19 by `gggplot-tzc.8` (Perf and conformance
gate for the flat pipeline, the epic-closing bead of `gggplot-tzc`: flat-array
GPU-centric mark pipeline). Records (1) staged CPU bench numbers for the
flat-tensor pipeline at 10k/100k/1M rows, and (2) GPU mark-data upload
instrumentation results, both from a real run on the hardware below. Re-run
`deno bench -A packages/core/bench/flat_pipeline_bench.ts` and
`deno task --cwd apps/site test:gpu-instrument` to refresh.

> **2026-10-12:** section 1 was re-run after ADR-007 retired `compile()` and
> `emitSource()` (gggplot-vnh.11, -vnh.14). Stage (c) now measures the component
> root's assembly, and stage (d), the literal emitter, is gone: the JSX printer
> passes data by reference. The 2026-07-19 numbers, including `compile()` and
> the emitter, are in this file's git history (gggplot-mhtd).

## Hardware / software

|                                    |                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Date                               | 2026-10-12 (section 1); 2026-07-19 (section 2)                                                               |
| Machine                            | MacBook Air, Apple M1, 8 GB RAM                                                                              |
| OS                                 | macOS 27.0 (section 1); macOS 26.5.2, build 25F84 (section 2)                                                |
| Deno                               | 2.9.7 (section 1); 2.9.3, V8 14.9.207.2 (section 2)                                                          |
| Browser (GPU instrumentation only) | Chromium via `npm:playwright@^1.61.1`, headless, `--enable-unsafe-webgpu --enable-webgpu-developer-features` |

## 1. Staged CPU bench

Source: `packages/core/bench/flat_pipeline_bench.ts` (`deno bench` — same
convention as `packages/reductions/bench/reductions_bench.ts`).
`deno task check` type-checks every bench, so they cannot silently rot. Three
stages, kept separate:

- **(a) packing** — `geom/shared.ts`'s `packMarkRows`/`packFaceLoops`/
  `concatPacked`+`concatFlatTensors`, called directly (no RenderNode wrapping).
- **(b) coordinate transform/munch, polar variant** — `compile/coordinates.ts`'s
  `polarizeMark` (`polarizeNode`, then `munchFlatNode`), which is what the
  component root runs on each mark in a polar panel. Cartesian marks are never
  polarized or munched, so there is no analogous Cartesian number to report.
- **(c) plot assembly** — the component root's prepare, train and layout
  (`components/root_assembly.ts`, driven through `tests/support/assemble.ts`) on
  a spec built with the internal DSL: stat → scale training → geom lowering,
  including its own packing → guides. Not a clean isolate of (a): it repeats
  packing inside each geom's `lower()`. Each call uses fresh caches, so this is
  a first mount, not a cached re-render (a resize re-runs layout only, and an
  unchanged layer is not re-lowered).

Point / grouped line (8 groups) / stacked bar (50 x-categories × 5 fill levels)
— matching the epic's three named scenarios.

### 10k / 100k rows (`deno bench`'s own adaptive repeat-to-~1s harness)

| Stage               | Family       | 10,000 rows | 100,000 rows | 10k→100k scaling |
| ------------------- | ------------ | ----------: | -----------: | ---------------: |
| (a) pack            | point        |      1.7 ms |      16.9 ms |             9.9x |
| (a) pack            | grouped line |      1.6 ms |      15.2 ms |             9.5x |
| (a) pack            | stacked bar  |      8.8 ms |     123.7 ms |            14.1x |
| (b) polar transform | point        |      1.7 ms |      17.7 ms |            10.4x |
| (b) polar transform | grouped line |      4.2 ms |      46.8 ms |            11.1x |
| (b) polar transform | stacked bar  |     21.7 ms |     408.9 ms |            18.8x |
| (c) assemble plot   | point        |      1.3 ms |      14.0 ms |            10.8x |
| (c) assemble plot   | grouped line |      7.2 ms |      70.9 ms |             9.8x |
| (c) assemble plot   | stacked bar  |      3.9 ms |      38.5 ms |             9.9x |

Scaling is close to linear. The super-linear tail on `pack`/`transform` stacked
bar is GC/allocation pressure from `Array<[number,number][]>` intermediate loop
construction before `packFaceLoops` flattens it, not an algorithmic complexity
issue — `packFaceLoops`/`concatPacked` themselves are single linear passes. The
100k polar-bar case is also the noisiest (263–889 ms across iterations).

Plot assembly at 100k rows is 14.0 / 70.9 / 38.5 ms (point / line / bar),
against 20.5 / 82.1 / 51.8 ms for `compile()` on 2026-07-19.

### 1,000,000 rows — BOUNDED (fixed 1 warmup + 1 measured run, hard budget)

Per the bead's requirement, the 1M case does NOT use `deno bench`'s own adaptive
repeat harness (which would otherwise re-run a multi-second operation an
unbounded number of times). Instead each stage runs exactly 1 discarded warmup
call + 1 measured call at module load, asserted against a hard millisecond
budget (the bench file throws — failing the whole `deno bench` run — if any
stage exceeds its budget). All nine stages passed under budget on this hardware:

| Stage               | Family       |   Measured |    Budget | Within budget |
| ------------------- | ------------ | ---------: | --------: | ------------- |
| (a) pack            | point        |   173.4 ms |  4,000 ms | yes           |
| (a) pack            | grouped line |   155.2 ms |  4,000 ms | yes           |
| (a) pack            | stacked bar  | 1,170.4 ms |  6,000 ms | yes           |
| (b) polar transform | point        |   202.4 ms |  4,000 ms | yes           |
| (b) polar transform | grouped line |   921.8 ms |  8,000 ms | yes           |
| (b) polar transform | stacked bar  | 7,115.7 ms | 10,000 ms | yes           |
| (c) assemble plot   | point        |   172.5 ms |  6,000 ms | yes           |
| (c) assemble plot   | grouped line |   873.5 ms |  8,000 ms | yes           |
| (c) assemble plot   | stacked bar  |   418.1 ms | 12,000 ms | yes           |

Notable: 1M-row **stacked bar** under (b) polar transform (~7.1s) is still the
heaviest case. `packFaceLoops` allocates 4 vertices per bar (4M vertices total)
plus a full `expandByOwners` color-expansion pass, and polar munching then
subdivides every one of those loop edges 16x (`MUNCH_DETAIL`), so the polar-bar
path emits on the order of 4M × 16 ≈ 64M vertices for 1M input rows — the budget
(10s) reflects that real multiplier, not slack. Point and grouped line stay
under a second at every stage even at 1M rows, including their polar/munch
variants (points never munch at all — `munchFlatNode`'s `kind: 'points'` branch
is a structural no-op pass-through — see `compile/coordinates.ts`).

Run-to-run variance on the polar-bar and pack-bar cases has been up to ~2x on
this laptop (GC/thermal noise, not a regression); the budgets leave headroom for
that.

## 2. GPU mark-data upload instrumentation

Mechanism: **source-boundary tagging**
(`packages/core/src/render/gpu_instrument.ts`) — see that file's module doc and
the bd note on this bead for the full writeup of the spiked Use.GPU raw-source
entry points (`@use-gpu/workbench`'s `useRawSource`/`useRawTensorSource` →
`@use-gpu/core`'s `makeDataBuffer`/`uploadBuffer` → `device.createBuffer`/
`device.queue.writeBuffer`). `withMarkAttribution` brackets every place
`render/chunked_line.tsx` and `render/chunked_face.tsx` hand a FlatTensor's
`array`/topology to a raw-source hook; any `createBuffer`/`writeBuffer` call
triggered synchronously inside that bracket is counted as mark data. Point
(which delegates to `@use-gpu/plot`'s own `<Point>`, not our
`useRawTensorSource` wrapper) uses a narrower, explicitly-documented fallback —
`registerKnownMarkArray` — for WRITE-side corroboration only, never CREATE
attribution (see `render/GGPlot.tsx`'s `registerPointMarkArrays` and the bd note
for why Point's create-path isn't reachable by the bracket).

### (a) Deno-level identity-proxy unit tests — RAN, all passing

`packages/core/tests/gpu_instrument_test.ts` (9 tests) exercises the
counting/attribution logic itself against a fake `GPUDevice` object (deno has no
real WebGPU device), proving: totals-only counting outside a boundary, correct
attribution inside `withMarkAttribution`, tag persistence across a later
out-of-boundary write, reentrant nested boundaries, the `registerKnownMarkArray`
write-only corroboration path (and that it never attributes a create),
idempotent installation, and the exact "N re-renders, same tensor identity → 1
create + 1 upload, then zero more" shape of the acceptance scenario. Run:
`deno test -A packages/core/tests/gpu_instrument_test.ts` — **9 passed, 0
failed**.

### (b) Real in-browser run — RAN, both acceptance scenarios pass

Driver: `apps/site/scripts/gpu_instrument_check.ts` (mirrors `visual_smoke.ts`'s
headless-Chromium-with-WebGPU-flags pattern), driving the dedicated instrumented
route `apps/site/src/InstrumentProbe.tsx` mounted at `/?instrument`
(`deno task --cwd apps/site test:gpu-instrument`). This DID run against real
WebGPU in headless Chromium in this environment (the same environment
`test:visual` already proves has working headless WebGPU —
`--enable-unsafe-webgpu --enable-webgpu-developer-features`).

Scenario (i) — 5 re-renders of an unchanged spec:

```json
{
  "markBufferCreations": 0,
  "markBufferWrites": 0,
  "totalBufferCreations": 5,
  "totalBufferWrites": 85
}
```

Scenario (ii) — one linear-scale x-domain change (`gggplot-tzc.7`'s raw
data-space positions), frame still redraws (`totalBufferCreations`/
`totalBufferWrites` nonzero — legitimate uniform/view writes, uncounted):

```json
{
  "markBufferCreations": 0,
  "markBufferWrites": 0,
  "totalBufferCreations": 2,
  "totalBufferWrites": 18
}
```

**Result: PASS on both scenarios** — zero mark-data buffer creations and zero
mark-data writes in either case, while total (unattributed) GPU buffer activity
stays nonzero, confirming the frame genuinely redraws and the instrumentation
isn't just reporting a dead/idle canvas.

Debugging note kept for posterity (not a caveat about the pipeline itself): the
FIRST attempt at this probe showed 5 spurious mark-data writes on scenario (ii).
Root-caused (via temporary Stage-A-key logging, since removed) to the PROBE
re-ingesting its raw JS data object on every spec rebuild
(`ggplot(rawObject, ...)` ingests fresh `Column` objects each call), which made
`PackCache`'s column-identity-rooted Stage A cache miss on every domain change —
exactly the documented "reuse the same underlying data columns across builds"
precondition every existing `pack_cache_test.ts`/ `raw_position_domain_test.ts`
test already relies on (`ingest()` once, reuse the typed frame). Fixed by
pre-ingesting the probe's data once at module scope. This was a probe bug, not a
compiler or instrumentation bug — flagged here because it's exactly the kind of
mistake a real embedding app could make too, and the RESIDENCY_MATRIX/PackCache
docs could be more explicit about it (a note has been added to
`docs/RESIDENCY_MATRIX.md`'s "unresolved / adjacent" section below to that
effect for `gggplot-1a6`).

### What did NOT run (honest accounting)

- The narrower Point-family CREATE-side attribution (as opposed to the broader
  zero-mark-buffer-activity result above, which Point's writes still contribute
  to via corroboration) has no independent in-browser assertion isolating Point
  specifically from Line/Face — the probe spec mixes `geom_point` + `geom_line`
  in one chart and the counters are pipeline-wide, not per-mark-family. The
  deno-level unit test suite's `registerKnownMarkArray` tests cover the
  mechanism in isolation instead (see (a) above).
- No WebGPU device-loss / context-recreation scenario was exercised (out of this
  bead's scope — `runtime_test.ts` already covers device-loss rehydration for
  the GPU-resident path).

## 3. Model inspection

**Gate:** `deno task model:perf:check` (measure with `deno task model:perf`,
re-baseline with `--write`). Baseline lives in
`docs/model_inspect_baseline.json` and runs in CI after the site build. Added by
`gggplot-i5m.7`.

### What is and is not measurable here

The docs route inspects ONNX **statically** through `inspectOnnx` and never
imports `onnxruntime-web`. `gggplot-i5m.14` verified that and gated the WASM
asset copy on it, which is what keeps `dist` at ~2.4MB instead of ~26MB. There
is no inference on the shipping path, so model load, inference, output capture,
readback bytes, and device compatibility are **not measurable** and are not
gated. Runtime-shared GPU tensors belong to `gggplot-i5m.22`. Interaction
responsiveness needs a real GPU and a human (`gggplot-i5m.24`) and is
deliberately out of scope for a headless gate.

Transformers.js is not a measurement target: `gggplot-i5m.10` did not adopt it.

### Measured (from the five bundled fixtures)

| fixture                   |  bytes | nodes | ports | edges | tensors | read B | parse |
| ------------------------- | -----: | ----: | ----: | ----: | ------: | -----: | ----: |
| `dense-chain.onnx`        |  1,544 |     9 |    16 |     8 |       8 |  1,128 | ~6 ms |
| `residual-merge.onnx`     |  3,323 |    13 |    25 |    13 |      12 |  2,720 | <1 ms |
| `multi-head.onnx`         |  3,261 |    17 |    34 |    18 |      16 |  2,416 | <1 ms |
| `mnist-12.onnx`           | 26,143 |    22 |    42 |    21 |      21 |     40 | <1 ms |
| `tiny-encoder-stack.onnx` | 71,866 |    50 |   106 |    57 |      49 | 67,328 | <1 ms |

Parse time is machine-dependent, so it is **not** pinned to the baseline — only
bounded at 250 ms per fixture. A gate that fails on a noisy runner gets ignored.
Counts and byte totals are deterministic and are compared exactly.

`mnist-12.onnx` reads only 40 bytes across 21 tensors because its convolution
initializers are rank > 2, above `maxExactRank`, so they resolve to
metadata-only products. That is the bounding behaviour working, not a defect.

### Documented limits

| limit                    |                      value | source                          |
| ------------------------ | -------------------------: | ------------------------------- |
| `maxResidentBytes`       |                      16 MB | `DEFAULT_CONTENT_BUDGET`        |
| `maxExactBytes`          |                       4 MB | "                               |
| `maxTileBytes`           |                       4 MB | "                               |
| `maxDownsampleReadBytes` |                       8 MB | "                               |
| `maxOverviewCells`       |                    512x512 | "                               |
| `maxSummarySamples`      |                      2,048 | "                               |
| `maxExactRank`           |                          2 | "                               |
| `maxSliceRank`           |                          4 | "                               |
| parse ceiling            |             250 ms/fixture | `scripts/model_inspect_perf.ts` |
| `dist` ceiling           | 4,096 KB (currently 2,454) | "                               |

**Graceful degradation** is the content-policy ladder: a tensor too large for
`exact` falls to `tile`, then `downsample`, then `summary`, then `metadata`,
which reads zero bytes. The gate probes all five explicitly on a rank-2 tensor
per fixture, because an `auto` request on fixtures this small only ever selects
`exact` or `metadata` and would leave the bounding paths ungated. On these
fixtures the first four converge (every probe is under every budget); the
bounding behaviour itself is covered by `products_test.ts` with synthetic
tensors above the thresholds.

**Residency cache reuse** is asserted directly: re-selecting every tensor a
second time must touch no new byte range. The gate fails if the range set for a
given selection is not stable.
