# CPU/GPU Residency Matrix

**Status: living.** Created 2026-07-19 by `gggplot-tzc.7` (Phase-3 starter:
raw data-space positions for continuous linear scales), which needed to
document its own CPU-residency decisions somewhere reviewable. This file was
originally scoped to `gggplot-1a6` ("Add RESIDENCY_MATRIX.md; mark stale docs
historical" — see `docs/REVIEW_2026-07-18_SECOND_PASS.md` §4.2), which had not
landed yet when tzc.7 needed it, so tzc.7 created it early with **only the
scales section filled in**. The full matrix (stats/geoms/positions rows) is
still `gggplot-1a6`'s to complete — treat the schema below as the template,
and this doc's Scales section as the first populated slice.

Schema (per `docs/REVIEW_2026-07-18_SECOND_PASS.md` §4.2): rows = one
computation each; columns = executor, eligibility gate, and the documented
reason + plan phase for staying on CPU. The project's standing rule is that a
CPU deviation from the GPU-native target (`docs/GPU_NATIVE_ARCHITECTURE_PLAN.md`)
needs a good, stated reason — this table is where that reason lives.

## Scales — x/y position

Trained by `scale/training.ts::trainScales`; per-row mapping is
`scale/mapping.ts::scalePosition`; Stage A pack-cache keys are built by
`compile/pack_cache.ts::scaleKeyFor`.

| Trained `scale.kind` | Per-row executor | Packed value | Pack key includes domain? | Reason CPU / plan phase |
|---|---|---|---|---|
| `continuous` (no transform) | **CPU pack, but domain-independent** | Raw data value (`Number(raw)`, identity) | **No** — key is just the literal string `"continuous"` | Phase-3 **starter** (this bead). The per-row op is a no-op identity, so there is nothing left to move to a shader for the *value* — what Phase 3 proper (`GPU_NATIVE_ARCHITECTURE_PLAN.md`'s "shader-accessible scales and view updates") targets is the domain→pixel *mapping*, which this bead already routes through the Cartesian view node's `range` prop (a use-gpu on-GPU projection), not through per-row CPU math. Result: a domain/limits change is view-only — zero re-pack, zero re-upload — without needing an actual shader uniform rewrite. Full Phase 3 (pan/zoom driving that same `range` prop from a live uniform rather than a recompiled spec) is still open. |
| `log` | CPU pack (excluded from "eligible" by this bead's rule) | `Math.log10(Number(raw))` | No — key is `"log"` (the transform tag), domain still excluded (the transform doesn't read domain either) | `GPU_NATIVE_ARCHITECTURE_PLAN.md` Phase 3: "move continuous transforms ... into derived shader sources/uniforms" is explicitly future work; `log10` is not yet a shader-accessible op in this codebase, so it stays a CPU pre-transform. Domain independence (no domain in the key) is a byproduct of `scalePosition` never reading `scale.domain` for this kind either — not this bead's target, but not wrong. |
| `sqrt` | CPU pack (excluded from "eligible") | `Math.sqrt(Number(raw))` | No — key is `"sqrt"` | Same reasoning as `log`. |
| `discrete` | CPU pack | Factor-level index (`scale.domain.indexOf(String(raw))`) | **Yes** — key is `` `discrete:${JSON.stringify(scale.domain)}` `` (full level order) | `GPU_NATIVE_ARCHITECTURE_PLAN.md`'s "Scales, guides, and facets": "Discrete scales are two parts: a CPU-owned ordered dictionary for labels and a GPU `u32` code/lookup table for mapping." Only the CPU-owned dictionary half exists today — there is no GPU lookup buffer, so the index computation itself is CPU, and a level-order (domain) change genuinely changes every row's packed value (strings never enter shaders — see this bead's brief). Not eligible for the raw-value/domain-excluded treatment by design. |

**Eligibility rule (this bead):** an x/y axis is eligible for raw-value,
domain-excluded packing iff its trained scale has `kind === 'continuous'`
(bare, no `log`/`sqrt` transform). Eligibility is decided **per axis** —
`compile/pack_cache.ts::stageAKey` calls `scaleKeyFor` independently for `x`
and `y`, so e.g. a linear x against a log y packs x raw/domain-excluded and y
pre-transformed/kind-tagged in the same layer's Stage A key with no
cross-talk.

**Where axis expansion/padding lives:** `scale.expand` (ggplot2's
`expansion(mult, add)`) is applied exactly once, in `scale/training.ts`, to
the *trained scale's* `domain` field — never inside `scalePosition`. That
`domain` (already padded, already transform-applied for `log`/`sqrt`) is what
flows to the Cartesian/Polar view node's `range` prop via
`compile/coordinates.ts::numericRange` and `compile/mod.ts`'s
`xDomain`/`yDomain` threading (plus each geom's optional
`domainContribution` widening, e.g. stacked-bar totals, tile half-cells —
confirmed by inspection to run only through `domainContribution`, never
inside any geom's `lower()`). This is the "any non-identity must be in the
DOMAIN, never in per-row packing" split the bead required.

## Scales — other mapped aesthetics (context only; out of scope for tzc.7)

Listed for completeness since `pack_cache.ts::scaleKeyFor` covers them too,
but auditing/optimizing these is **not** this bead's scope — full treatment
is `gggplot-1a6`'s.

| Aesthetic | Per-row executor | Pack key |
|---|---|---|
| `color` / `fill` (continuous) | CPU (`scaleColorValue` interpolates a ramp to a hex string) | Full `kind:domain:range` — no domain-independence attempted |
| `size` / `alpha` / `linewidth` / `stroke` (continuous) | CPU (`interpolateRange`/`scaleSizeValue`) | Full `kind:domain:range` |
| `shape` / `linetype` (discrete) | CPU (palette index lookup) | Full `kind:domain:range` |

These all read the full domain (and range) per row by construction — e.g.
color interpolation needs `t = (raw - lo) / (hi - lo)` — so, unlike x/y
position, there is no analogous "identity, domain doesn't matter" case to
exploit today. A GPU ramp-sampling/lookup-buffer treatment for these is later
plan-phase work (Phase 3/4), not touched here.

## GPU mark-data upload residency — added by `gggplot-tzc.8`

`gggplot-tzc.8` (Perf and conformance gate, the epic-closing bead of
`gggplot-tzc`) instrumented the live backend's GPU buffer creation/write
calls to prove — not just assert — the "zero re-upload" claim this whole
epic's Phase-2/3 work depends on. Full writeup, real bench numbers, and both
the deno-level and real-in-browser instrumentation results are in
`docs/PERF_BASELINE.md`; this entry is the residency-matrix-shaped summary.

| Computation | Executor | Eligibility gate | Reason CPU stays authoritative / plan phase |
|---|---|---|---|
| Mark-data GPU buffer creation/write | GPU (via `@use-gpu/workbench`'s `useRawSource`, source-boundary-tagged) | A node's `positions`/`colors`/`widths`/`sizes` FlatTensor `array` reference (and `version`) is unchanged since the last mount/render — `PackCache`'s (`compile/pack_cache.ts`, `gggplot-tzc.5`) Stage A/B reference-identity guarantee | Not a CPU-residency row in the usual sense (nothing here runs on CPU per-frame) — listed because it's the terminal consumer of every other row in this table: a CPU deviation upstream (log/sqrt/discrete position packing, full-domain color/size packing) still produces a FRESH tensor only when ITS OWN cache key changes, so this row's "zero re-upload" property is conditional on every upstream row's packed VALUE being unchanged, not just the CPU/GPU executor choice being unchanged. |

**Operational gotcha found while building the in-browser instrumentation
probe (`apps/site/src/InstrumentProbe.tsx`), worth generalizing here for
`gggplot-1a6`'s eventual full matrix:** `PackCache`'s Stage A cache is rooted
on the MAPPED COLUMN OBJECT's own identity (a `WeakMap<Column, ...>` —
`compile/pack_cache.ts`'s `stageAPrimaryColumn`/`stageAStore`), not on data
VALUES. A host that calls `ggplot(rawJsObject, ...)` — passing an
un-ingested plain object — gets a FRESH `ingest()` call (and therefore fresh
`Column` wrapper objects) on every `.build()`, which makes Stage A miss on
every recompile regardless of whether anything eligible actually changed.
Every `PackCache` test in this repo (`pack_cache_test.ts`,
`raw_position_domain_test.ts`) already follows the correct pattern —
`ingest()` once, reuse the same typed frame across `.build()` calls — but
this is easy for a first-time embedder (or a probe/demo, as `tzc.8` found
out first-hand) to get wrong silently: nothing errors, it just re-packs and
re-uploads every time. Candidate follow-up for `gggplot-1a6`: either surface
a dev-mode warning when `PackCache` roots miss repeatedly for what looks
like the same logical data, or make `ggplot()`'s own data-ingestion path
memoize by input object identity so passing the same raw object twice is
itself enough (not requiring the caller to call `ingest()` explicitly).
