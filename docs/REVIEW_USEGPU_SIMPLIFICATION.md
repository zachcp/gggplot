# Counter-review: delete in favor of Use.GPU primitives

**Status: draft.** This is the third review in epic `gggplot-vnh`, after
`DESIGN_COMPONENT_DATAFLOW.md` and its counter-review in `gggplot-vnh.15`. The
measured part runs as spike `gggplot-vnh.17`. Its numbers go in that bead and
are summarized in §6 once they land.

**Question asked:** given what we now know, how much of gggplot can be deleted
by using Use.GPU 0.20's own primitives? In particular, how much of the data
loading/update system and the transformations?

**Method:** every subsystem below is checked against the installed
`node_modules/@use-gpu/*` 0.20 sources, not docs. Each claim that something is a
"Use.GPU gap" cites the bead or file where it was established. LOC figures are
current file sizes. They are upper bounds on deletion, not measured deletions.
The spike measures three of them.

## 0. The deletion rule, and its limit

**Rule:** gggplot owns code only for one of three reasons.

1. **ggplot semantics** that Use.GPU has no opinion on: stats, scale training,
   break selection, grouping, position adjustments, legends, the DSL and IR.
2. **A documented Use.GPU gap**, with evidence: a dead trait, a missing trait,
   an array-of-structs-only API.
3. **The headless parity harness**: CPU references and the Deno-side GPU
   executor that keep CPU and GPU semantically equal.

Anything else is plumbing, and plumbing should be a Use.GPU primitive.

**Limit (the counter to this counter-review):** Use.GPU is a 0.x library
maintained by one person.

- Some of its surface is not load-bearing upstream. The `dash` trait is parsed
  but no shader consumes it (`render/chunked_line.tsx` header, gggplot-xc9).
  `<Data>` is array-of-structs, not columnar (`runtime/live.tsx` comment).
- Its CJS/ESM type surface already costs us a 233-line shim
  (`runtime/usegpu_compat.ts`).
- Its wasm imports already broke under Vite 8/Rolldown (gggplot-6dm.6).

So the rule is refined: **depend on primitives that Use.GPU itself depends on.**
Those are `RawData`/`useRawTensorSource`, the
`PointLayer`/`LineLayer`/`FaceLayer` layers, `Transform`/`Cartesian`/`Polar`,
`Grid`/`Axis`, and `Kernel`/`Stage`/`Compute`/`Readback`. Where we hit a gap,
the right deletion route is often **upstreaming** (a working `dash`, a label
`angle` trait), not another local workaround.

---

## 1. Data loading and update

### 1.1 Five versioning mechanisms for one concept

"This column changed" is currently tracked by:

| Mechanism                                   | Where                         | Notes                                                         |
| ------------------------------------------- | ----------------------------- | ------------------------------------------------------------- |
| Column object identity                      | `data/mod.ts` (`ingest`)      | in-place mutation unsupported; identity is the signal         |
| `revisions` WeakMap + `invalidate(column)`  | `compile/pack_cache.ts`       | explicit escape hatch for mutation                            |
| `FlatTensor.version`                        | `compile/rendertree.ts`       | documented as "stays 0 always"                                |
| `GPUPlotRuntime.#versions`                  | `runtime/runtime.ts`          | `@experimental`, no production consumer                       |
| `StorageSource.version` / product `version` | Use.GPU, `runtime/resident_*` | **Use.GPU's own mechanism**: drives re-upload and re-dispatch |

**Proposal:** one mechanism, Use.GPU's.

- A column carries a `version`. The data tier passes it to
  `useRawSource(array, format, opts, size, version)` /
  `useRawTensorSource({…, version})`, which re-upload exactly when it changes.
- Kernels key on `source.version`, which our `<Kernel version initial>` usage
  already does.
- The pack cache's revision machinery and `GPUPlotRuntime` disappear.
- In-place mutation becomes supported via "bump the version" instead of "call
  `packCache.invalidate`".

**Deletes:** `GPUPlotRuntime` (82 + its test), the revision half of
`pack_cache.ts`, and the dead `FlatTensor.version`. The spike measures the
first.

### 1.2 The mount chain

`GPUDataProvider` nests one `<RawData>` per field through children-as-function,
plus `HoldLevel` to pin depth so that a missing column cannot remount everything
below it. The scale-binding spike (`ScaleBindingScene.tsx`) mounts with flat
`useRawTensorSource` hooks instead. Flat hooks need a fixed call count, but that
is the same invariant `HoldLevel` enforces, with no nesting.
`useNoRawTensorSource()` fills an absent slot.

**Replace:** most of `runtime/live.tsx` (112), and its render-prop callers in
`resident_host.tsx` get flatter. **Spike change 1.**

### 1.3 The pack cache

`compile/pack_cache.ts` (342, plus a 389-line test) exists to make
**recompiles** idempotent at the tensor level: Stage A for packing, Stage B for
polar/munch. In the component path nothing recompiles. Each layer memoizes its
own packed tensors on its inputs, and the source `version` decides uploads.

**Delete** once vnh.7 lands (it is not deletable in the current architecture).

### 1.4 What stays

- `data/` ingestion (333): typed columns and factor dictionaries are semantics.
- `runtime/column_loader.ts` (ADR-006 GPU-native loaders).

`<Data>`/`<StructData>` are array-of-structs aggregators and remain the wrong
primitive for a columnar frame (`runtime/live.tsx` comment, verified against
workbench `data.mjs`).

---

## 2. Transformations

| Transform                             | Today                                                                                                                                                                        | Use.GPU primitive                                           | Verdict                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| panel / facet-cell / radial placement | hand-built `mat4` + `useCombinedMatrixTransform` in `PanelViewport`, `FacetPanel`, `RadialViewport` (≈150 in `GGPlot.tsx`), **duplicated as strings** in `emit/mod.ts` (≈60) | `@use-gpu/plot` `<Transform position scale matrix>`         | **Replace.** Keep the deliberate negative-y flip (gggplot-8zx). **Spike change 2.**                                            |
| data → clip (linear)                  | `<Cartesian range>`                                                                                                                                                          | same                                                        | already a primitive                                                                                                            |
| `coord_flip`, `theta = "y"`           | `axes` swizzle                                                                                                                                                               | same                                                        | already a primitive                                                                                                            |
| `coord_cartesian` zoom                | `range` + `<ScissorBox>`                                                                                                                                                     | same                                                        | already a primitive; becomes a ref in the component path                                                                       |
| polar view                            | `<Polar>`                                                                                                                                                                    | same                                                        | already a primitive                                                                                                            |
| polar **grid** rings/spokes           | CPU `<Line>` geometry in `polarGridLines`                                                                                                                                    | `<Grid detail>` / `<Axis detail>` subdivide on the GPU      | **Replace** if break placement can be reproduced. **Spike change 3.**                                                          |
| polar **mark** bending                | CPU munch + polarize (`compile/coordinates.ts`, ≈250)                                                                                                                        | none: `FaceLayer`/`LineLayer` do not subdivide              | **Keep (gap).** Possible future: a subdividing vertex stage upstream.                                                          |
| log / sqrt **position** scales        | CPU pre-transform                                                                                                                                                            | none: no log view                                           | **Keep (semantics).** ggplot2 bins on transformed data, so this precedes stats and is not a view transform (vnh.15 finding 3). |
| color / size / alpha scale mapping    | CPU per-vertex packing (`packColorsRGBA`, `colorsOf`, `sizesOf`, `alphasOf`, `scaleKeyFor`)                                                                                  | linked shader functions via `useShader` + `useLambdaSource` | **Replace** (vnh.16 measured it: zero mark uploads per domain change). Owner indices are the remaining work (vnh.7).           |
| 3D camera / orbit                     | `OrbitCamera` / `OrbitControls`                                                                                                                                              | same                                                        | already a primitive                                                                                                            |
| `CameraAxis3D`                        | per-orbit CPU placement of axis/tick/label positions                                                                                                                         | composition of `Axis`/`Tick`/`Label`                        | Keep for now. It is already composed from primitives.                                                                          |
| text rotation                         | `RotatedLabel` (141), custom attachment shader                                                                                                                               | none: `LabelLayer` has no angle                             | **Keep (gap).** Upstream an `angle` trait and then delete.                                                                     |
| dashed lines                          | custom dash fragment in `ChunkedLine`                                                                                                                                        | none: `dash` is a dead trait upstream                       | **Keep (gap).** Upstream and then delete.                                                                                      |
| variable-length line chunks           | `ChunkedLine` over `LineLayer` + `useLineSegmentsSource`                                                                                                                     | `<Line>` lacks an explicit chunk-length list                | **Shrink.** The layer + hook core is already primitive. The RenderTree prop adaptation goes with vnh.7.                        |
| concave faces                         | `ChunkedFace` over `FaceLayer` + `useFaceSegmentsConcaveSource`                                                                                                              | same hooks                                                  | **Shrink**, same reason.                                                                                                       |

---

## 3. The resident runtime (3,710 LOC, the largest area)

| Piece                                                                                                                          | LOC    | Verdict                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resident_host.tsx` hoisting, `collectResidentNodes`, `HOISTED_PRODUCTS`                                                       | ≈350   | **Delete (vnh.5).** It exists only because the RenderTree places products under `<Plot>`.                                                                                                                                                                                                            |
| `resident_registry.ts`, the `ResidentProduct` node, `compile/resident.ts`                                                      | ≈150   | **Delete (vnh.5).**                                                                                                                                                                                                                                                                                  |
| standalone "view" forms (`resident_count_view`, `resident_view`, `resident_tile_view`)                                         | ≈350   | **Delete.** Each rebuilds `Cartesian`/`Axis`/`Grid` to auto-size y from a summary. In the component path the scale tier trains from the summary, so ordinary guides apply and no special view form is needed.                                                                                        |
| kernel wiring (`resident_count_kernel_live`, `resident_histogram_kernel_live`, `resident_domain_kernel_live`, `resident_grid`) | ≈1,160 | **Consolidate**, but not onto a Use.GPU primitive: the `<Kernel>`/`<Stage>` calls _are_ the primitives. The bulk is hand-built per-product binding memos. A generic named-port adapter (vnh.15 decision 3) collapses the repetition, and **must** carry the generation lifecycle (vnh.15 finding 2). |
| `resident_readback.tsx` channel + predicates                                                                                   | ≈350   | **Keep.** `useReadbackStorage` looks like a deletion route but brings back the copy-before-compute ordering bug that vs7.4 fixed. The channel is the price of `<Readback>.then` mounting in the queue tree.                                                                                          |
| `usegpu_compat.ts`                                                                                                             | 233    | **Research.** It exists because Deno reads Use.GPU's CJS types while Vite resolves ESM. If a Deno import-map entry to the `.d.mts` types fixes that, the shim and every `as unknown as` cast it centralizes go away.                                                                                 |

---

## 4. Guides and layout

| Piece                                                         | Verdict                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| break selection (`prettyBreaks`, `gridDivision`)              | **Keep (semantics).** `@use-gpu/plot` `<Scale>` generates its own nice ticks, but ggplot break and label semantics are a product requirement.                                                                                                                                                                                  |
| grid lines                                                    | already `<Grid>` with `nice: false` and an explicit `divide`                                                                                                                                                                                                                                                                   |
| guide layout and margins (`guideLayout`, ≈140), legends (414) | **Research.** `@use-gpu/layout` (flex/block/inline text, glyph measurement) is published at 0.20.0, matching our pins, but is **not installed**. It could own margins and legend boxes, but adds a dependency and a second layout model next to Cartesian ranges. Spike it only after vnh.6 defines what the guide tier needs. |
| font resources / measurement                                  | **Keep.** It is a thin readiness and validation layer over `FontLoader`/`useFontContext`.                                                                                                                                                                                                                                      |

---

## 5. Scorecard (upper bounds, from current file sizes)

| Category                                                                                                                                                              | ≈LOC             | Depends on                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------- |
| Deletable **now**, current architecture (spike vnh.17)                                                                                                                | 300–400          | nothing                   |
| Deleted by the component-first plan already filed (emit 704, rendertree 182, resident hoisting/registry/views ≈850, pack cache 342 + test 389, `renderTree` registry) | ≈2,500           | vnh.5 / vnh.7 / vnh.10–14 |
| Replaced by GPU scale bindings (CPU color/size/alpha packing + scale keys)                                                                                            | ≈200–300         | vnh.16 → vnh.6 / vnh.7    |
| Consolidated, not deleted (kernel wiring → named-port adapter)                                                                                                        | ≈1,160 → ≈400    | vnh.15 decision 3         |
| Deletable after **upstream** fixes (dash, label angle)                                                                                                                | ≈300             | Use.GPU PRs               |
| Research (`usegpu_compat`, `@use-gpu/layout`)                                                                                                                         | 233 / ≈550       | spikes                    |
| **Kept**: semantics, documented gaps, parity harness (stats 2.8k, scales 0.8k, geom lowering, reductions 2.6k, readback, munching, ticks)                             | most of the rest | —                         |

The point of the table: **the big deletions come from the architecture change,
not from swapping in primitives.** Swapping primitives in the current
architecture is worth a few hundred lines plus a large drop in conceptual weight
(one versioning scheme, no nesting, no duplicated viewport math). The 2.5k-line
drop needs vnh.

## 6. Spike results (vnh.17)

All three changes were **kept**. Net **−328 hand-written lines** (src −299,
tests −29), plus −6,170 lines of a regenerated `polar_bar` fixture. They were
measured against base `0bf034a`, cumulatively (C1, then C1+C2, then C1+C2+C3).
Landing is `gggplot-wwu`.

| Change                                                                                                                                                     | Net LOC | Notable finding                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** flat `useRawTensorSource` data mount; `HoldLevel`, the `RawData` export and `GPUPlotRuntime` deleted                                                |    −182 | `useRawSource` has no minimum allocation, and a zero-byte storage binding is a WebGPU validation error. An empty column now uploads one placeholder element but still reports length 0. The hook also does not signal a frame on a version change the way `RawData` did; gate tracked in `gggplot-eudx`. |
| **C2** `<Transform>` replaces hand-built `PanelViewport`/`RadialViewport` matrices (live and emitted); the never-mounted `FacetPanel` component is deleted |    −116 | `Transform` is translation × rotation × scale composed through the same `useCombinedMatrixTransform`, so it is an exact drop-in, negative y included. Its trait props parse by identity, so they **must be memoized**. Removing the `FacetPanel` export is a public-API change and needs sign-off.       |
| **C3** `<Grid divide nice:false detail>` replaces CPU ring/spoke geometry for the polar grid                                                               |     −30 | The old grid **never followed scale breaks**: 4 even rings and 12 spokes, confirmed at `0bf034a`. Grid reproduces it pixel-identically. Following ggplot breaks is a pre-existing bug, now `gggplot-f8sq`.                                                                                               |

Gates:

- `deno task test`: 642 pass (−2 `GPUPlotRuntime` tests, +1 empty-column test).
- `check`, `lint`, `test:rerender` and `test:gpu-instrument` pass. Mark
  creations/writes stay 0/0.
- Every pixel floor that drew matched its recorded figure exactly (70.4%, 27.4%,
  62.9%, 74.6%), with no draw rate worse than baseline.
- Per-surface captures are identical to baseline outside a known noise set,
  including facets, `coord_flip`, both polar charts and all 11 3D surfaces.

The pixel and visual gates were flaky at baseline. That was the readback stall,
since fixed by `gggplot-5ie9` (349ed90). Re-run them on the rebased tree when
landing.

**What this confirms about §5:** the "deletable now" estimate (300–400 lines)
held. The measured deletion was 328 lines, with no new abstractions and no pixel
change.

### Landed (gggplot-wwu)

The landed version differs from the spike's in three places:

- **The flat mount renders `QueueReconciler.signal()`** whenever an upload's
  version moves, as `<RawData>` did, so a data replacement schedules the frame
  that re-dispatches kernels reading it. `gggplot-eudx` (a gate proving that end
  to end) stays open.
- **`FacetPanel` stays exported**, re-implemented over `<Transform>`. Removing a
  public export waits for sign-off.
- **The decision is a pure `planColumnMounts()`**, so the slot-stability and
  resident zero-upload tests run headless. The spike's empty-column fix (a
  one-element placeholder reporting length 0) is adopted.

Parity at landing: 7 doc examples captured with `example_frames.ts`
(`PolarPoints`, `PolarThetaY`, `ScatterLine`, `FlippedBars`, `ZoomedPanel`,
`FacetedScatter`, `ResidentInlineBars`) are pixel-identical to the tree before
the landing.

## 7. Recommendations

1. **Adopt "one versioning mechanism: Use.GPU's `version`"** as an explicit
   ADR-007 decision. It removes more conceptual weight than any single file
   deletion.
2. Land whatever vnh.17 proves (data mount, `<Transform>`, polar grid) **in the
   current architecture**. It is low-risk deletion that also shrinks what vnh.4
   has to port.
3. Open two upstream issues/PRs on Use.GPU: a working `dash`, and a label
   `angle` trait. Each lets us delete a local shader.
4. Two small research spikes: `usegpu_compat` via Deno type resolution, and
   `@use-gpu/layout` for guide layout (the latter after vnh.6).
5. Do **not** pursue deleting the readback channel, the CPU reducers, the
   Deno-side GPU executor, tick semantics, or position-transform CPU code. Each
   is semantics or a documented gap, and deleting it would cost correctness.
