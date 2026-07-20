# Third-Pass Hierarchical Review — 2026-07-19

Full-workspace review (bead `gggplot-55n`), one day after the second pass
(`docs/REVIEW_2026-07-18_SECOND_PASS.md`), following the flat-array pipeline
epic (`gggplot-tzc`) landing on master (`677b903`). Standing goals, in the
order this review weighs them: **movement toward a pure-GPU representation**
(lazy data → GPU buffers, stats/geoms lowered as low-level as possible through
to the canvas), **duplication removal**, and **simplicity**.

Method: hierarchical, high to low — architecture docs → package boundaries →
pipeline stages (data → stat → scale → compile → geom → runtime/emit) →
GPU kernels. Every actionable finding is a bead; ids inline.

**Baseline:** `deno task check` clean (core, 3d, mark, site). Tests: core
216/216 green, but the combined suite is **348/349 — one reductions GPU test
fails on master** (§2.1). The second pass ran only `packages/core/tests/`,
which is how this was missed.

---

## 1. What landed since the second pass, verified

The flat-array epic delivered what the second pass asked for, and it holds up
under re-read:

- **Phase-2 "rows into JSX props" is gone for the converted families.**
  Point/line lower through `packMarkRows` into interleaved `FlatTensor`
  positions with companion color/size/alpha tensors; the rectangle family
  (bar/col/tile/rect, boxplot/crossbar boxes, hex, violin, area/polygon)
  lowers through `packFaceLoops` into **one ChunkedFace node per layer** —
  second-pass findings 2.3 and 2.4, both closed with the topology contract
  (`MarkTopology`, owners stripped before RenderTree) enforced by tests.
- **The pack cache (`compile/pack_cache.ts`) is the right invalidation
  design.** Revision-counter WeakMaps keyed per column, key strings folding in
  exactly the scale parameters that affect packed values, Stage B rooted on
  Stage A's own output identity. The tzc.7 starter means a continuous-linear
  domain change is view-only: zero re-pack, zero re-upload. The design
  rationale is written down in the module, at length, and it is correct.
- **`docs/RESIDENCY_MATRIX.md` exists** (scales section only; `gggplot-1a6`
  remains open for the stats/geoms/positions rows and the stale-doc headers —
  commented on the bead).
- The geom registry remains the single source of truth for lowering, DSL
  defaults, and doc metadata; `compile()` is stage orchestration plus a
  facet-math residue (§4.3).

## 2. GPU-first and the lowering hierarchy

### 2.1 A resident-kernel correctness bug is failing on master (P1 — `gggplot-6h7`)

`packages/reductions/tests/gpu_test.ts` — "resident histogram positions
remain GPU-native for identity, dodge, and fill" — fails: the **dodge** slot
width. `HISTOGRAM_BAR_VERTICES_WGSL` computes `width = binwidth /
params.groups` using the *declared* `groupsCount` (3), while the test expects
division by the number of groups *present in the data* (2), which is also
ggplot2's dodge semantic. Either the kernel or the test expectation is wrong;
they must be reconciled (present-group count is derivable on-GPU from the
summary buffer's group totals). The count-plan bar-vertex shader has the same
`f32(params.values)`-shaped division and should be checked in the same pass.
This is exactly the class of bug the CPU-reference-parity rule exists for —
and the gate only works if the reductions suite runs in the default loop.

### 2.2 The data plane still enters boxed (P2 — `gggplot-c1x`)

The single largest remaining gap between the plan and the code, now that the
flat mark pipeline exists, is at the *entry*: `data/mod.ts` columns hold
`Array<number | null>` / `Array<string | null>`. The GPU-native plan's own
`GPUDataFrame` table prescribes `Float32Array` + validity and `Uint32Array`
factor codes at ingestion. Today:

- `rawArrayForColumn` converts boxed→typed per column at mount (cached, but a
  full conversion pass per column);
- **every stat call** re-crosses the boxed→typed boundary — the reductions
  package is already fully typed-array in its input contracts
  (`GroupedCount1DInput.valueIds: Uint32Array`, …), so core pays the
  conversion on each `applyStat`;
- geom lowering iterates boxed values per row per compile
  (`positionsOf` → tuples → `xs`/`ys` maps → `indices.map` copies →
  `packMarkRows` — four intermediate materializations in `geom/point.ts`
  before the Float32Array exists).

Making `ingest()` materialize typed columns once — keeping Column object
identity as the cache key, exactly as today — collapses all three: raw upload
becomes a field read, stats consume columns directly, and packing loops run
over typed arrays. This is the "lazy load our data directly into GPU buffers"
work item, phase A.

### 2.3 Resident coverage: unchanged since yesterday, still the right next targets

- Fill/color-mapped bars still take the CPU path for want of a factor-ID →
  palette lookup buffer (`gggplot-5ez`, P1 — still the top GPU-first item;
  the kernels already compute grouped stack/dodge/fill layouts on-device).
- The resident tile product (`ResidentHistogramTiles`, kernel `tileVertices`
  output) is still unreachable from the DSL (`gggplot-ysq`, P1).
- 25 of 27 stats remain CPU-only, per the plan's phased order — acceptable,
  with the residency matrix (`gggplot-1a6`) as the honesty mechanism.
- The resident opt-out still hides in `theme.resident` via the Theme index
  signature (`gggplot-4se`, P2).

### 2.4 The mounted-runtime story has three overlapping mechanisms (P3 — `gggplot-btd`)

The render path that actually runs is: `PackCache` (tensor identity) +
`rawArrayForColumn` (column→typed identity) + `GPUDataProvider`/`RawData`
(upload) inside the resident components. In parallel, two lifecycle
abstractions exist with **no consumer outside tests**: `GPUPlotRuntime`
(runtime/runtime.ts — source versioning, device-loss rehydration) and
`SourceAdapter` (runtime/streaming.ts — streaming buffer ownership). The
second pass flagged only SourceAdapter; GPUPlotRuntime is in the same state.
Contracts landed ahead of use are defensible, but two parallel unused
resource managers next to the one real mechanism obscures which is
authoritative. Wire in, mark `@experimental`, or delete until Phase 2 needs
them.

## 3. Duplication

### 3.1 The emit backend re-implements the live helpers as string templates (P2 — `gggplot-q24`)

`emit/mod.ts` carries `FACET_GRID_SOURCE` / `PANEL_VIEWPORT_SOURCE` /
`RADIAL_VIEWPORT_SOURCE` / `FACET_PANEL_SOURCE` — inline JS-in-a-string
re-implementations of the Live components in `render/GGPlot.tsx`. The
emitted FacetGrid **does not share `facetCellLayouts`** and has already
drifted from the live implementation (inline cell math vs. the shared layout
module). This is the exact drift the RenderTree-in-the-middle design exists
to prevent, one level down. Generate both from one source: stringify the
shared pure layout functions into the emitted module, or emit an import from
`@gggplot/core`.

### 3.2 Resident boilerplate, both sides of the package boundary (P1 — `gggplot-rjg`, extended)

The core-side finding stands: 54 `as unknown as` casts across 13
runtime/render files re-deriving the same Workbench/Live typed views, and the
count/histogram triads structurally parallel. New this pass: the
**reductions side mirrors it** — `resident_count.ts` / `resident_histogram.ts`
/ `resident_domain.ts` each redefine a `USAGE` magic-number map, a
`uniform()` helper, and the staging-buffer readback loop (tests hard-code
`0x0080 | 0x0008` as well). Noted on the bead: extract shared GPU plumbing in
`packages/reductions/src/gpu/` in the same pass, so the next kernel is only
its WGSL and bind layout.

### 3.3 Guides: copy-pasted legends and a 7-scale positional signature (P3 — `gggplot-z6g`)

`legendNodes` (~300 lines of `compile/guides.ts`) duplicates the discrete
color and fill legend blocks verbatim and repeats the title/swatch/label
layout per aesthetic. Its signature — seven positional `TrainedScale`
parameters, echoed by `guideLayout` and ten destructured scale variables in
`compile()` — predates `LayerContext.scales`, which already models this as a
record. Pass the record; extract `discreteLegend`/`continuousLegend`.
Related, smaller: `geom/shared.ts` has six near-identical `*Of` aesthetic
extractors that could share one helper.

## 4. Simplicity and organization

### 4.1 What is genuinely simple now

The pipeline reads the way the README draws it. DSL → IR is thin and pure;
`applyStat` is an 85-line registry dispatch; the geom registry is declarative
and doubles as documentation; the reductions package has a clean typed-array
contract with CPU reference implementations beside each GPU kernel. The site
app is a modest ~1.1k lines. The extension boundary (ADR-002) is exercised by
two real packages (`3d` consumed by the site; `mark` a deliberate
boundary-validation demo consumed only by its tests — fine, but it still
emits nested `[x,y][]` Polygon props, so extension packages lag the flat
contract; note for whenever the extension ABI is next touched).

### 4.2 Comment density as a maintenance surface

`pack_cache.ts` spends 130 lines of module comment for 100 lines of code;
`shared.ts`, `point.ts`, and the compile module carry long bead-numbered
narrations. The contracts are good and several encode real invariants
(owners stripping, munch-before-triangulate). But comments that narrate
*which bead did what* duplicate `bd`/git history and will rot; the invariant
is the part worth keeping. No bead — a style rule for future passes: keep
the contract, drop the changelog.

### 4.3 Residual items, unchanged

- `compile/mod.ts` is back up to 593 lines (532 at second pass); the facet
  strip/overlay math remains the residue (`gggplot-ark`, P3, commented).
- Repo hygiene unchanged: three debug PNGs at root, `SFNS.ttf` (7.9 MB,
  redistribution risk) still untracked in `apps/site/public/fonts/`
  (`gggplot-8mj`, P3).

## 5. Priority summary

| # | Finding | Theme | Bead | Priority |
|---|---------|-------|------|----------|
| 2.1 | GPU dodge-width kernel/test disagreement; failing on master | Correctness | `gggplot-6h7` | **P1** |
| 2.3 | Fill-mapped resident bars need palette LUT | GPU-first | `gggplot-5ez` | P1 |
| 2.3 | Resident tiles unreachable from DSL | GPU-first | `gggplot-ysq` | P1 |
| 3.2 | Compat-shim + triad dedup, now incl. reductions-side plumbing | Duplication | `gggplot-rjg` | P1 |
| 2.2 | Typed-array columns at ingest (lazy-GPU phase A) | GPU-first | `gggplot-c1x` | P2 |
| 3.1 | Emit-vs-live facet/viewport template drift | Duplication | `gggplot-q24` | P2 |
| 2.3 | `theme.resident` → typed policy | Organization | `gggplot-4se` | P2 |
| §1 | Finish residency matrix; historical doc headers | Docs | `gggplot-1a6` | P2 |
| 3.3 | Legend dedup; scales record signature | Simplicity | `gggplot-z6g` | P3 |
| 2.4 | Test-only runtime abstractions: wire, mark, or delete | Simplicity | `gggplot-btd` | P3 |
| 4.3 | Facet math out of compile() | Organization | `gggplot-ark` | P3 |
| 4.3 | Root PNGs; SFNS.ttf | Hygiene | `gggplot-8mj` | P3 |

**Suggested sequencing.** Fix `gggplot-6h7` first (green master is the
precondition for every kernel change), then `gggplot-rjg` (the shim shrinks
every subsequent resident change), then `gggplot-5ez`/`gggplot-ysq` (GPU
coverage), with `gggplot-c1x` as the next structural step toward the pure-GPU
representation. Also: add the reductions suite to the default test loop so
2.1's class of miss cannot recur.
