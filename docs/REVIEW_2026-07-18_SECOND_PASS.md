# Second-Pass Global Review — 2026-07-18

Independent re-review of the whole workspace after the geom-registry /
resident-dataflow pipeline landed on master (`22301c9`). Themes, per the
project's standing goals: **simplicity of code organization**, **GPU-first
implementation on Use.GPU primitives**, **hierarchical lowering of the data
flow onto those primitives**, a **ggplot2-shaped DSL**, and **documentation
quality**. Deviations from GPU-first must carry an explicit, good reason.

Baseline at review time: `deno task check:core` clean; `deno test -A
packages/core/tests/` 216/216 green.

Each actionable finding is filed as a bead; ids are noted inline.

---

## 1. What the first pass fixed, verified

The prior refactor delivered what it promised, and it holds up on re-read:

- `compile/mod.ts` is down from 2,515 lines to 532; per-geom lowering lives in
  `geom/*` behind `GEOM_REGISTRY`, with `LayerContext` replacing the
  19-parameter `lowerLayer`. The registry doubles as the doc-metadata source
  and the DSL's default-stat/position source — one source of truth, used three
  ways. This is the right shape.
- `domainContribution` and `residentPlan` hooks removed the last geom-specific
  branches from `compile/mod.ts`. The generic `ResidentProduct` RenderTree
  node keeps the tree serializable; the runtime registry
  (`runtime/resident_registry.ts`) resolves plan-id strings to Live
  components. The comment justifying a plain map over `ExtensionRegistry` is a
  model "deviation with a documented reason."
- The reductions package's resident kernels (grouped histogram, grouped count,
  finite-domain, bar-vertex expansion with stack/fill prefix sums) match the
  GPU-native plan's contract: persistent buffers, ordered clear→count→vertex
  dispatch, bounded summary readback only, no row-shaped materialization.

## 2. GPU-first and hierarchical dataflow

### 2.1 The resident gate excludes the canonical ggplot bar chart (P1)

`barResidentPlan` (geom/bar.ts) rejects any layer with `mapping.color ||
mapping.fill`. But a fill-mapped, stacked bar chart is *the* motivating ggplot
example, and the GPU side already does the hard part: the count/histogram
kernels compute grouped stack/dodge/fill layouts on-device. The only missing
piece is per-group color — `ResidentHistogramBars` accepts a single `color`.
The plan (Phase 3) already prescribes the fix: a small factor-ID → palette
lookup buffer. Until then the most common GPU-worthy chart silently takes the
CPU path. Filed as the top GPU-first bead.

### 2.2 Resident tiles are unreachable from the DSL (P1)

`runtime/resident_tile.tsx` (`ResidentHistogramTiles`) and the kernels'
`tileVertices` output exist and are exported, but no geom registers a
`residentPlan` that reaches them and the resident registry has no tile entry —
only `bar` mark/view components. From a user's perspective the resident tile
path (bead `gggplot-1tt.12`) is dead code. Either wire `geom_tile`/2-D bins
into a resident product or document why it must wait.

### 2.3 The general mark path is still "rows into JSX props" (P2)

For everything that isn't an eligible bar layer, lowering materializes nested
`[x, y]` JS arrays (and per-row color/size arrays) into RenderTree props on
every compile, and `GlyphMeasuredPlot` recompiles the spec inside the Live
tree on every layout change. This is exactly the pattern the GPU-native plan's
Phase 2 ("persistent source-backed marks") exists to remove: pack final
attributes once into flat typed arrays, bind them as stable `RawData`
sources, and let rerenders reconcile handles. The deviation is documented in
ARCHITECTURE.md's design-debt list, so it passes the "good reason" bar — but
it is the single largest gap between the plan and the code, and it affects
every point/line/area plot. Filed as the Phase-2 bead.

### 2.4 One Live node per rectangle (P2)

`lowerBar` returns one `Polygon` node per bar; the inline comment explains the
real constraint (Plot's `Polygon` treats nested loops as one multi-loop
surface and bridges bar tops). But the codebase already contains the correct
answer: `resident_bar.tsx` draws N independent rectangles as **one** Face
layer via `useFaceSegmentsSource` chunks. The CPU rectangle family
(bar/col/tile/rect, and the boxplot/crossbar boxes) should lower to a single
chunked Face node. Fewer Live components, same visual result, and it moves the
CPU path onto the same topology contract as the resident path.

### 2.5 Deviations that are fine as-is

- 25 of 27 stats are CPU-only. The plan's phased order (bin/count first, then
  bin2d/density, smooth explicitly last because its output is tiny) is a good
  reason; no action beyond keeping the residency matrix honest (§4.2).
- Per-row CPU scale mapping (`scalePosition`) is plan Phase 3
  (shader-accessible scales). Sequenced behind Phase 2; fine.
- `runtime/streaming.ts` (`SourceAdapter`) has no consumer outside tests.
  Acceptable as a contract landed ahead of use, but it should be labeled
  experimental in `runtime/mod.ts` or gain a demo consumer.

### 2.6 Resident opt-out hides in Theme's index signature (P2)

`barResidentPlan` reads `spec.theme.resident === false`, an undeclared key
that only exists via `Theme`'s `[key: string]: unknown` escape hatch. An
execution-policy flag doesn't belong in the styling object, isn't in the
`Theme` type, and isn't documented. `CompileOptions.resident` already exists;
the spec-level opt-out should be a typed field there (or on `GGSpec`), not a
stringly theme key.

## 3. Code organization

### 3.1 The resident runtime layer repeats one workaround nine times (P1)

Nine `runtime/resident_*`/`live` files each re-derive typed views of
`@use-gpu/live`/`workbench` exports (`useAwait`, `useMemo`, `useResource`,
`createElement`, `Face`, …) through `as unknown as` casts — 54 casts total —
because Deno sees Workbench's CJS type surface while Vite resolves ESM. The
workaround is legitimate; duplicating it per file is not. One
`runtime/usegpu_compat.ts` shim exporting the typed hooks/components once
would delete ~150 lines of boilerplate and make each new resident product a
small file about its actual product.

Second-order duplication: the count and histogram triads
(`resident_count_{live,mark,view}.tsx` vs `resident_{live,mark,view}.tsx`)
are structurally parallel — same provider/product/mark/view pattern, differing
in kernel constructor and summary type. After the compat shim, a generic
"resident grid product" parameterization should collapse the triads; the next
resident product (tiles, bin2d) should not require three more files.

### 3.2 compile/mod.ts residual mixing (P3)

At 532 lines it is no longer urgent, but facet strip-label geometry and
per-panel guide-overlay bounds math (~120 lines) are facet-layout concerns
that belong beside `facet_layout.ts`, leaving `compile()` as pure stage
orchestration. Do this opportunistically, not as a dedicated pass.

### 3.3 Repo hygiene (P3)

- Untracked screenshots at the repo root (`flippedbars.png`,
  `flippedbars2.png`, `themed-bg-test.png`) — debug artifacts; gitignore or
  delete.
- `apps/site/public/fonts/SFNS.ttf` (7.9 MB, untracked): Apple's San
  Francisco system font, which may not be redistributed. Nothing in the site
  references it (the shipped Lato/Basic faces carry their OFL licenses).
  Remove it and gitignore it before it lands in a commit by accident.

## 4. DSL fidelity and documentation

### 4.1 DSL

The surface reads like ggplot2 and the mechanics are clean: `aes()` maps
columns, fixed params stay literal, every builder returns a tagged `SpecPart`,
`.add()` folds parts, and geom defaults come from the registry rather than
being restated. Aliases (`geomHistogram` → bar+bin, `geomRaster`,
`guideColourbar`/`guideColorbar`) follow ggplot idiom. No findings that rise
to a bead; the grammar-alignment matrix already tracks coverage gaps.

### 4.2 Documentation (P2)

The generated geom reference (registry doc metadata + coverage bijection
test) is genuinely good — docs that cannot go stale without a test failing.
Two gaps:

1. **No single residency answer.** "What runs on the GPU, what doesn't, and
   why" is currently spread across the plan doc, bead history, and
   eligibility code. Given the project's standing rule that CPU deviations
   need a good reason, there should be one `docs/RESIDENCY_MATRIX.md`: rows =
   stats/geoms/positions, columns = executor, gate conditions, and the reason
   + plan phase for CPU residency. Small, and it turns the guiding principle
   into a reviewable artifact.
2. **Stale audit doc.** `MODULE_BOUNDARY_AUDIT.md` (dated 2026-07-17) still
   describes the 2,515-line `compile/mod.ts` that the landed refactor
   removed. Mark it historical with a pointer to the current layout, or
   refresh its numbers. Same treatment for the completed spike docs
   (`WGPU_*`, `WEBGPU_EXPORT_SPIKE`) — a one-line status header
   (living/historical) per doc is enough.

## 5. Priority summary

| # | Finding | Theme | Priority |
|---|---------|-------|----------|
| 2.1 | Fill-mapped bars excluded from resident path; needs palette LUT | GPU-first | P1 |
| 2.2 | Resident tile product unreachable from DSL | GPU-first | P1 |
| 3.1 | Nine-file cast boilerplate; parallel count/histogram triads | Organization | P1 |
| 2.3 | Phase 2 source-backed marks for the general path | GPU-first | P2 |
| 2.4 | Rectangle-family CPU lowering → one chunked Face node | GPU-first | P2 |
| 2.6 | `theme.resident` escape-hatch flag → typed policy | Organization | P2 |
| 4.2 | Residency matrix doc; mark stale docs historical | Docs | P2 |
| 3.2 | Move facet math out of compile/mod.ts | Organization | P3 |
| 3.3 | Root PNGs; SFNS.ttf redistribution risk | Hygiene | P3 |
