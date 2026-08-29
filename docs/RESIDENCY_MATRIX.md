# CPU/GPU Residency Matrix

**Status: living.** This file records, per computation, where it runs (CPU or
GPU) and — when it stays on the CPU — the eligibility gate and the reason. It is
the reviewable companion to the GPU-native execution model in `ARCHITECTURE.md`
§4: the project's standing rule is that a CPU deviation from the GPU-native
target needs a good, stated reason, and this table is where that reason lives.

Schema: rows = one computation each; columns = executor, eligibility gate, and
the documented reason (with the relevant trajectory phase) for staying on CPU.
Sections cover scales, mark-data upload, stats, geoms, and positions.

## Scales — x/y position

Trained by `scale/training.ts::trainScales`; per-row mapping is
`scale/mapping.ts::scalePosition`; Stage A pack-cache keys are built by
`compile/pack_cache.ts::scaleKeyFor`.

| Trained `scale.kind`        | Per-row executor                                      | Packed value                                             | Pack key includes domain?                                                                                 | Reason CPU / plan phase                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `continuous` (no transform) | **CPU pack, but domain-independent**                  | Raw data value (`Number(raw)`, identity)                 | **No** — key is just the literal string `"continuous"`                                                    | Phase-3 **starter**. The per-row op is a no-op identity, so there is nothing left to move to a shader for the _value_ — what Phase 3 proper (ARCHITECTURE §5, "shader-accessible scales and view updates") targets is the domain→pixel _mapping_, which already routes through the Cartesian view node's `range` prop (a use-gpu on-GPU projection), not through per-row CPU math. Result: a domain/limits change is view-only — zero re-pack, zero re-upload — without an actual shader uniform rewrite. Full Phase 3 (pan/zoom driving that same `range` prop from a live uniform rather than a recompiled spec) is still open. |
| `log`                       | CPU pack (excluded from "eligible" by the rule below) | `Math.log10(Number(raw))`                                | No — key is `"log"` (the transform tag), domain still excluded (the transform doesn't read domain either) | Phase 3 (ARCHITECTURE §5): "move continuous transforms into derived shader sources/uniforms" is future work; `log10` is not yet a shader-accessible op in this codebase, so it stays a CPU pre-transform. Domain independence (no domain in the key) is a byproduct of `scalePosition` never reading `scale.domain` for this kind either.                                                                                                                                                                                                                                                                                         |
| `sqrt`                      | CPU pack (excluded from "eligible")                   | `Math.sqrt(Number(raw))`                                 | No — key is `"sqrt"`                                                                                      | Same reasoning as `log`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `discrete`                  | CPU pack                                              | Factor-level index (`scale.domain.indexOf(String(raw))`) | **Yes** — key is `` `discrete:${JSON.stringify(scale.domain)}` `` (full level order)                      | Per the GPU-native model (ARCHITECTURE §4), discrete scales are two parts: a CPU-owned ordered dictionary for labels and a GPU `u32` code/lookup table for mapping. Only the CPU-owned dictionary half exists today — there is no GPU lookup buffer, so the index computation itself is CPU, and a level-order (domain) change genuinely changes every row's packed value (strings never enter shaders). Not eligible for the raw-value/domain-excluded treatment by design.                                                                                                                                                      |

**Eligibility rule:** an x/y axis is eligible for raw-value, domain-excluded
packing iff its trained scale has `kind === 'continuous'` (bare, no `log`/`sqrt`
transform). Eligibility is decided **per axis** —
`compile/pack_cache.ts::stageAKey` calls `scaleKeyFor` independently for `x` and
`y`, so e.g. a linear x against a log y packs x raw/domain-excluded and y
pre-transformed/kind-tagged in the same layer's Stage A key with no cross-talk.

**Where axis expansion/padding lives:** `scale.expand` (ggplot2's
`expansion(mult, add)`) is applied exactly once, in `scale/training.ts`, to the
_trained scale's_ `domain` field — never inside `scalePosition`. That `domain`
(already padded, already transform-applied for `log`/`sqrt`) is what flows to
the Cartesian/Polar view node's `range` prop via
`compile/coordinates.ts::numericRange` and `compile/mod.ts`'s
`xDomain`/`yDomain` threading (plus each geom's optional `domainContribution`
widening, e.g. stacked-bar totals, tile half-cells — confirmed by inspection to
run only through `domainContribution`, never inside any geom's `lower()`). This
is the "any non-identity must be in the DOMAIN, never in per-row packing" split
the eligibility rule enforces.

## Scales — other mapped aesthetics

Listed for completeness since `pack_cache.ts::scaleKeyFor` covers them too.

| Aesthetic                                              | Per-row executor                                            | Pack key                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
| `color` / `fill` (continuous)                          | CPU (`scaleColorValue` interpolates a ramp to a hex string) | Full `kind:domain:range` — no domain-independence attempted |
| `size` / `alpha` / `linewidth` / `stroke` (continuous) | CPU (`interpolateRange`/`scaleSizeValue`)                   | Full `kind:domain:range`                                    |
| `shape` / `linetype` (discrete)                        | CPU (palette index lookup)                                  | Full `kind:domain:range`                                    |

These all read the full domain (and range) per row by construction — e.g. color
interpolation needs `t = (raw - lo) / (hi - lo)` — so, unlike x/y position,
there is no analogous "identity, domain doesn't matter" case to exploit today. A
GPU ramp-sampling/lookup-buffer treatment for these is later plan-phase work
(Phase 3/4), not touched here.

## GPU mark-data upload residency

The live backend's GPU buffer creation/write calls are instrumented to prove —
not just assert — the "zero re-upload" claim the Phase-2/3 work depends on. Full
writeup, bench numbers, and both the deno-level and in-browser instrumentation
results are in `docs/PERF_BASELINE.md`; this entry is the
residency-matrix-shaped summary.

| Computation                         | Executor                                                                | Eligibility gate                                                                                                                                                                                                                       | Reason CPU stays authoritative / plan phase                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mark-data GPU buffer creation/write | GPU (via `@use-gpu/workbench`'s `useRawSource`, source-boundary-tagged) | A node's `positions`/`colors`/`widths`/`sizes` FlatTensor `array` reference (and `version`) is unchanged since the last mount/render — `PackCache`'s (`compile/pack_cache.ts`, `gggplot-tzc.5`) Stage A/B reference-identity guarantee | Not a CPU-residency row in the usual sense (nothing here runs on CPU per-frame) — listed because it's the terminal consumer of every other row in this table: a CPU deviation upstream (log/sqrt/discrete position packing, full-domain color/size packing) still produces a FRESH tensor only when ITS OWN cache key changes, so this row's "zero re-upload" property is conditional on every upstream row's packed VALUE being unchanged, not just the CPU/GPU executor choice being unchanged. |

**Operational gotcha (surfaced by the in-browser instrumentation probe,
`apps/site/src/InstrumentProbe.tsx`):** `PackCache`'s Stage A cache is rooted on
the MAPPED COLUMN OBJECT's own identity (a `WeakMap<Column, ...>` —
`compile/pack_cache.ts`'s `stageAPrimaryColumn`/`stageAStore`), not on data
VALUES. A host that calls `ggplot(rawJsObject, ...)` — passing an un-ingested
plain object — gets a FRESH `ingest()` call (and therefore fresh `Column`
wrapper objects) on every `.build()`, which makes Stage A miss on every
recompile regardless of whether anything eligible actually changed. Every
`PackCache` test in this repo (`pack_cache_test.ts`,
`raw_position_domain_test.ts`) already follows the correct pattern — `ingest()`
once, reuse the same typed frame across `.build()` calls — but this is easy for
a first-time embedder to get wrong silently: nothing errors, it just re-packs
and re-uploads every time. Candidate follow-up: either surface a dev-mode
warning when `PackCache` roots miss repeatedly for what looks like the same
logical data, or make `ggplot()`'s own data-ingestion path memoize by input
object identity so passing the same raw object twice is enough (not requiring
the caller to call `ingest()` explicitly).

---

## Stats

Registry: `stat/mod.ts` (27 stats). Grouped rows share one executor rationale.

| Stat(s)                                                                                                                                                                                                                             | Executor                                                                                                                                                                | Eligibility gate                                                                                                                                                                                                                                                                                                         | Reason CPU / plan phase                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bin` (histogram grid)                                                                                                                                                                                                              | **GPU-resident** via `@gggplot/reductions` `createResidentHistogram1DFromSources` (atomic count grid → on-GPU bar/tile vertex expansion; bounded summary readback only) | `barResidentPlan` (geom/bar.ts): cartesian, unfaceted, `bar` geom, no mapped y, no `weight`, position ∈ identity/stack/dodge/fill, fill/color only when it is the factor group column with a default scale (`gggplot-5ez`), explicit y domain or standalone auto-y, `spec.execution?.resident !== false` (`gggplot-4se`) | Ineligible layers fall back to CPU `groupedHistogram1d` (cpu.ts) — the kernels' bit-exactness reference. Weighted bin stays CPU by decision (`gggplot-1tt.8`).                                                                           |
| `bin` (tile strip)                                                                                                                                                                                                                  | **GPU-resident** dense [group, bin] tile grid (`gggplot-ysq`)                                                                                                           | `tileResidentPlan` (geom/tile.ts): standalone only, `tile` geom + explicit `stat: "bin"`, numeric x, unmapped y, factor fill/color/group rows, default scales                                                                                                                                                            | Standalone-only because the strip's y range ([0, groups]) is owned by its view; the CPU grammar has no tile-grid product (documented in the geom's residency hook).                                                                      |
| `count`                                                                                                                                                                                                                             | **GPU-resident** via `createResidentCount1DFromSources` (factor-id histogram)                                                                                           | Same `barResidentPlan` gate, categorical x branch                                                                                                                                                                                                                                                                        | CPU `groupedCount1d` is the reference and the fallback.                                                                                                                                                                                  |
| `bin2d` / `binhex`                                                                                                                                                                                                                  | CPU (`groupedHistogram2d` in reductions/cpu.ts)                                                                                                                         | —                                                                                                                                                                                                                                                                                                                        | `groupedHistogram2dGpu` EXISTS with a parity test, but `statBin2d` does not route to it and no resident 2-D product is registered — the next natural resident stat in the phased order (bin/count → bin2d/density; ARCHITECTURE §5).     |
| `smooth`, `summary`, `boxplot`, `density`, `ydensity`, `dotplot`, `summary2d/hex/bin`, `qq(line)`, `ellipse`, `function`, `contour(filled)`, `density2d(filled)`, `quantile`, `ecdf`, `unique`, `sum`, `connect`, `align`, `waffle` | CPU (stat/*.ts over reductions/cpu.ts reducers)                                                                                                                         | —                                                                                                                                                                                                                                                                                                                        | The plan's phased order: tiny/irregular outputs (smooth explicitly last — its output is small), quantile/median before a proven GPU selection, custom JS summaries inherently CPU. Each names its reducer in `REDUCTIONS_COMPONENTS.md`. |

## Geoms

| Geom family                                                                                                                    | Executor                                                                                                                                                 | Reason / plan phase                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bar`/`col` (eligible layers)                                                                                                  | GPU-resident bars: stack/dodge/fill layout AND per-group palette colors expanded on-device (`gggplot-5ez`; dodge slots by present groups, `gggplot-6h7`) | The canonical GPU-worthy chart; gate above.                                                                                                                                              |
| `tile` (eligible layers)                                                                                                       | GPU-resident tile strip (`gggplot-ysq`)                                                                                                                  | Gate above.                                                                                                                                                                              |
| point/line/path/step, area/ribbon, polygon, rect, hex, violin, boxplot, errorbar family, segment/curve/spoke, reflines, smooth | CPU pack → FlatTensor/MarkTopology → stable `RawData` sources; re-upload only on pack-cache miss (`gggplot-tzc`)                                         | Phase 2's "pack once, reconcile handles" is DONE for these; per-row shader accessors over raw columns are Phase 3 (`typedArrayForColumn`, `gggplot-c1x`, is Phase A of that data plane). |
| `text`/`label`/`rug`                                                                                                           | CPU, uncached every compile (`UNCACHEABLE_GEOMS`)                                                                                                        | Their packed output reads theme/panel pixels; text layout stays CPU until a deliberate GPU text project exists (ARCHITECTURE §4, CPU control plane).                                     |

## Positions

| Position                                            | Executor                                                                         | Reason / plan phase                                                                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| stack/dodge/fill inside resident bar/count products | GPU (prefix sums + present-group dodge slotting in the vertex-expansion kernels) | Ships with the resident products; CPU `stackBars`/`dodgeBars` are the semantic reference.                                                                                 |
| stack/dodge/dodge2/fill on the CPU mark path        | CPU (`position/mod.ts`)                                                          | Applies to already-CPU-packed marks; the "segmented scans over grouped bins" phase only pays once general marks are source-backed (Phase 2 mature form; ARCHITECTURE §5). |
| jitter/nudge/jitterdodge                            | CPU (in point lowering, in-place over planar xs/ys)                              | RNG-based and tiny; jitter is a derived-accessor candidate, low priority.                                                                                                 |
