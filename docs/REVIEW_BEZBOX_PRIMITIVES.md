# Review: bezbox's primitive definitions, and the Use.GPU 0.21 package split

**Status: complete (spike `gggplot-cual`, 2026-10-12).** Research only. No
production code changed. Follow-up work is filed as beads (§8).

**Questions asked:**

1. **(Primary)** How does bezbox define its representation units (arrows and the
   other primitives)? That covers each primitive's schema and prop types, how it
   reaches the GPU, and the small one-primitive-per-file layout. Can gggplot's
   geom param and aes surface adopt the same simplicity?
2. **(Secondary)** Use.GPU 0.21 moves Math and Frame into their own packages.
   What moves, how does it map onto `runtime/usegpu_compat.ts`, and how much
   import churn does 0.20 → 0.21 cost?

**Sources, pinned:**

| Source                                 | Commit                                 | Notes                                                               |
| -------------------------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| bezbox (`gitlab.com/unconed/bezbox`)   | `9f93175` (2026-08-19)                 | `src/canvas-2d`, `src/plot-2d`; depends on `@use-gpu/*@0.21.0-rc.1` |
| Use.GPU (`gitlab.com/unconed/use.gpu`) | `8a53c69` (2026-10-12)                 | master; `CHANGELOG.md` heads `0.21.0-dev`                           |
| Use.GPU 0.20.0, installed              | `node_modules/.deno/@use-gpu+*@0.20.0` | what gggplot runs today                                             |

**Method:** I read the sources, not docs. Every claim about our code cites a
file. Claims about upstream cite a package path at the pinned commit. Four
claims were also run, not just read. Each is marked **(probed)** and explained
in place.

---

## 0. Summary

**bezbox is not a GPU renderer.** Its `plot-2d` is a **Canvas2D
re-implementation of `@use-gpu/plot`'s API**: `Point`, `Line`, `Arrow`, `Face`,
`Label`, `Polygon`, `Axis`, `Grid`, `Cartesian`, `Transform`, `ScissorBox`. It
reuses Use.GPU's trait, schema, Live and Frame machinery, and each shape draws
with `CanvasRenderingContext2D` calls instead of a pipeline. Upstream promoted
it on the day of this review to two new packages, `@use-gpu/2d-canvas` and
`@use-gpu/2d-plot`. Their commits are "wip 2d canvas", "2d-plot parity" and
"swap canvases", all dated 2026-10-12.

So the useful object of study is **the shared primitive contract** that bezbox
proves is renderer-independent. That contract has three layers. Traits declare
the props (parser, default and TypeScript type in one place). A compact schema
declares GPU attribute layout, as singular/plural pairs. A short shape file
connects the two. The GPU half of the question is answered by reading
`@use-gpu/plot` and `@use-gpu/workbench`, which share that contract (§3).

**Recommendation in one line:** adopt the _contract shape_ (declare each geom's
params and aesthetics once and derive the rest), keep our lowering pure, and
lean harder on plot's shapes, which already take GPU-bound attributes. Don't
adopt bezbox's Canvas2D backend.

| #  | Pattern                                                                      | Verdict                                                                                                            | Bead                            |
| -- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| P1 | One primitive per file, ~100 lines                                           | **Already ours** (`geom/*.ts`). Keep.                                                                              | n/a                             |
| P2 | Traits: parser + default + TS type declared once, `combine`d                 | **Adapt**: types via `import type`; a local pure `trait/combine/parseTrait` (runtime traits won't load under Deno) | `gggplot-w1qm` → `gggplot-2926` |
| P3 | Singular/plural attribute pairs (`color`/`colors`) from one compact schema   | **Adopt** as the literal-param ↔ mapped-aes rule                                                                   | `gggplot-2926`                  |
| P4 | Schema → archetype → aggregated struct-of-arrays → `@optional @link` getters | **Skip re-implementing**; target plot's schemas as our node contract                                               | (part of `gggplot-2926`)        |
| P5 | `bindable()` props: any per-vertex attribute may be a GPU source             | **Adopt after a verification spike**; it may retire per-mark `BoundX` components                                   | `gggplot-asx4`                  |
| P6 | `<Arrow>` as a first-class primitive                                         | **Adopt** for ggplot2's `arrow()`                                                                                  | `gggplot-kfwa`                  |
| P7 | Context-provided view (`MatrixContext`/`RangeContext`)                       | **Already ours** via plot's `Cartesian`/`Transform`. Keep.                                                         | n/a                             |
| P8 | Same contract, swappable backend (WebGPU ↔ Canvas2D)                         | **Skip for now**; revisit at 0.21 GA as a no-WebGPU fallback                                                       | n/a                             |

Reading the code also turned up two **correctness bugs** in our own geoms, both
caused by drift between a geom's typed props and what its lowering reads. They
are the strongest argument for P2/P3 (§5): `gggplot-4y7b` (probed) and
`gggplot-savp` (code-traced).

**Package split:** the volume of churn is small, about ten files and fifteen
lines. The _risk_ is that it fails silently. Four symbols we use moved with no
re-export, and seven modules probe Workbench on a symbol that moved (§7). Both
can be hardened **now, on 0.20** (`gggplot-hn39`). The bump itself waits for
npm, since 0.21 is so far only `rc.1` on GitLab's registry (`gggplot-79z5`).

---

## 1. What bezbox is

`bezbox` is the code behind the interactive Bézier figures on acko.net. Its
README calls it WebGPU embeds for a noise generator, but the `src/graph/*`
figures (`Bezier.tsx` is 2,020 lines) all draw through `plot-2d`. Layout:

```text
src/canvas-2d/   providers (render, view, matrix), dom (Canvas, AutoCanvas, AutoSize, FontLoader), useMatrixTransform
src/plot-2d/     plot.ts, traits.ts (620), schemas.ts (108),
                 shape/{point,line,arrow,face,label,polygon,axis,grid}.ts (56–189 each),
                 view/{cartesian,transform}.ts, scissor/scissor-box.ts, util/*
```

The pipeline is the GPU one with the last stage swapped:

- **`<Canvas>`** (canvas-2d) provides a `RenderContext` of
  `{context: CanvasRenderingContext2D, pixelRatio, …}` and runs a `SyncLoop`
  that clears and repaints.
- **`<Cartesian>`** computes a `mat3` from its `range` (plus swizzle and
  transform) and provides `MatrixContext` and Frame's `RangeContext`. This is
  the 2D analogue of plot's `mat4` view.
- **Each shape** parses its props through traits, builds its schema with
  `adjustSchema`/`schemaToAttributes`, and `yeet`s a renderable
  `{draw(), pick?(), zIndex}` into a `LayerReconciler`.
- **`<Plot>`** gathers the renderables, sorts them by `zIndex`, and quotes one
  `run()` into the frame queue. Picking walks them in reverse.

Every shape keeps the GPU shape's prop surface, down to the destructured names
(`zBias`, `depth`, `lookup`). Some props mean nothing on a canvas, and the
upstream `2d-plot` copy has started pruning them (`zBias` was dropped from its
`SHAPE_SCHEMA`). That is the main finding of §1: **the prop and schema contract
is the stable part, and the renderer is the replaceable part.**

---

## 2. Anatomy of a primitive (the contract)

### 2.1 Traits: props declared once

A trait comes from `@use-gpu/traits`. It is a map of prop name to _parser_ plus
an optional map of defaults: `trait({size: parseNumber}, {size: 1})`.
`combine(…)` concatenates traits. `TraitProps<typeof T>` derives the component's
**input prop type** from the parsers' argument types, and the output type from
their return types. Defaults are parsed once, when the trait is defined. Parsers
come from `@use-gpu/parse` (`parseColor`, `parseVec2Array`,
`parseScalarArrayLike`, …) and accept loose inputs (CSS strings, nested arrays,
typed arrays), returning one canonical typed form.

A primitive is **a `combine` of small, reusable traits.** For example, the Arrow
composite in `plot-2d/traits.ts`:

| Trait                                                  | Contributes                                                                                                                                        |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CompositeColorsTrait()`                               | `color`/`colors` (+ `opacity`), normalized to RGBA                                                                                                 |
| inline `trait({…})`                                    | `width`/`widths`, `size`/`sizes`                                                                                                                   |
| `CompositeVerticesTrait`                               | `positions` (nested polylines), `id(s)`, `lookup(s)`                                                                                               |
| `DataTrait([...keys])`                                 | fills any **unset** listed prop from Frame's `DataContext` (`<Tensor as="positions">`), records input formats, and routes GPU sources to `sources` |
| `SegmentsTrait` (GPU: `ArrowSegmentsTrait`)            | derives `chunks`/`groups` from the positions' shape; on the GPU, also `segments`/`anchors`/`trims` from `start`/`end`/`loop`                       |
| `ArrowTrait`, `ROPTrait`, `StrokeTrait`, `ZIndexTrait` | `size` default 3, `blend`, `join`/`dash`, `zIndex` default 0                                                                                       |

The shape file's whole job is then `const parsed = useTraits(props)`.
`ArrowProps = TraitProps<typeof ArrowTraits>` is the public type, with no
hand-written interface anywhere.

Traits run as **Live hooks** (`makeUseTrait`, with `useProp` memoizing each
parsed prop). `@use-gpu/traits` also exports a **hook-free**
`parseTrait(props, trait)`, which matters for us (§6, P2).

### 2.2 Compact schema: singular/plural attribute pairs

`schemas.ts` declares GPU attribute layout compactly. Each entry is a plural
attribute with its element format and, optionally, its singular name:

| Entry (plot `ARROW_SCHEMA`)                     | Element format              | Singular | Expands to                                         |
| ----------------------------------------------- | --------------------------- | -------- | -------------------------------------------------- |
| `positions`                                     | `array<vec4<f32>>` (ragged) | n/a      | `positions: array<array<vec4<f32>>>`               |
| `widths`                                        | `f32`                       | `width`  | `widths: array<f32>`, `width: f32` (spread)        |
| `sizes`                                         | `f32`                       | `size`   | same pattern                                       |
| `depths`                                        | `f32`                       | `depth`  | same pattern                                       |
| `colors` (SHAPE)                                | `vec4<f32>`                 | `color`  | same pattern                                       |
| `ids`, `lookups`, `zBiases` (SHAPE)             | `u32`/`f32`                 | `id`, …  | same pattern                                       |
| `matrices` (MATRIX)                             | `mat4x4<f32>`               | `matrix` | `ref`: uploaded just-in-time                       |
| `segments`, `anchors`, `trims` (ARROW_SEGMENTS) | `i8`, `vec4<u32>`           | n/a      | `unwelded`; anchors/trims are **index** attributes |

`expandArrays` turns each compact entry into both forms. The **singular** form
is a per-item constant, `spread` across that item's vertices. The **plural** is
per-vertex. Formats are adjustable per call: `adjustSchema(SCHEMA, formats)`
lets a `vec2<f32>` or `f64` input through, with formats recorded by `DataTrait`.
This is _exactly_ ggplot's split between a literal param (`color = "red"`) and a
mapped aesthetic (`aes(color = g)`).

### 2.3 The shape file

All six shapes have the same three-step body:

1. `parsed = useTraits(props)`.
2. `schema = adjustSchema(SCHEMA, formats)`, then `attributes` from the schema
   and `parsed`.
3. Emit. bezbox emits `quote(yeet({draw, pick, zIndex}))`. Plot emits
   `quote(yeet({arrow: {count, archetype, attributes, flags, material, refs,
   schema, scissor, sources, transform, zIndex}}))`,
   which is a _description_ of the mark and not a draw.

Composites are just other components: `Polygon` returns a `Face` plus a looped
`Line`. `Axis` returns an `Arrow` or `Line` along the range. `Grid` computes
tick values (`util/domain.ts` linear/log) and returns two `Line`s. None of them
has a schema of its own.

---

## 3. From schema to GPU (plot + workbench, the shared contract's GPU path)

Traced end to end for `<Arrow>` at `8a53c69`. The other shapes differ only in
the last two rows.

| Stage                 | Where                                                           | What happens                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Props → parsed        | `plot/src/shape/arrow.ts`, `plot/src/traits.ts` (`ArrowTraits`) | Traits, as above. Per-vertex props are wrapped in `bindable(…)`, so a **GPU source** passes through untouched (§6 P5).                                                                                                                                                                                                                                                                                                    |
| Parsed → descriptor   | same                                                            | `schemaToEmitters` + `schemaToArchetype(schema, attributes, flags, refs, sources)`, where the archetype is a hash of present attributes, formats, flags and **source identities**. Yeets `{arrow: …}` into `LayerReconciler`.                                                                                                                                                                                             |
| Descriptors → batches | `workbench/src/layers/virtual-layers.ts` (inside `<Plot>`)      | `multiGather` by type. A partitioner keys items on archetype ^ material ^ scissor ^ transform ^ zIndex. **Every compatible `<Arrow>` in the plot becomes one layer.** Order: face, line, arrow, point.                                                                                                                                                                                                                    |
| Batch → buffers       | `workbench/src/hooks/useAggregator.ts`, `core/src/archetype.ts` | `schemaToAggregate` allocates **one buffer per attribute** (struct-of-arrays), sized with `useBufferedSize` headroom. Singular values are spread per item, index attributes are offset, `ref`s are uploaded per frame. Re-aggregation is an update + upload, not a relink.                                                                                                                                                |
| Layer                 | `workbench/src/layers/arrow-layer.ts`                           | `ArrowLayer` = `RawLines` (the shafts, trimmed by `trims`) + `RawArrows` (the heads).                                                                                                                                                                                                                                                                                                                                     |
| Draw                  | `workbench/src/primitives/raw-arrows.ts`                        | Each head is an **instanced mesh**: a cone with `detail` sides (`makeArrowGeometry`) or a flat triangle (`flat`), one instance per anchor. Every attribute becomes a `useShaderRef(single, plural)` and is linked into the vertex shader.                                                                                                                                                                                 |
| Shader                | `wgsl/wgsl/instance/vertex/arrow.wgsl`, `geometry/arrow.wgsl`   | Every input is `@optional @link fn getColor(i) -> vec4<f32> { default }`, so an unlinked attribute costs nothing and has its default **in the shader**. The vertex reads `getAnchor(instance)` → (start, next, end, both), builds an oriented frame from those positions, and scales the mesh by `getArrowSize`: head = `size × width × worldScale`, clamped to `segment length / 2.5`, halved when both ends have heads. |

The other primitives: `Point` → `PointLayer` → `RawQuads`
(`instance/vertex/quad.wgsl`). `Line` → `LineLayer` → `RawLines`
(`instance/vertex/line.wgsl`, with segment adjacency in an `i8 segments`
buffer). `Face` → `FaceLayer` → `RawFaces` (`instance/vertex/face.wgsl` +
`index/face.wgsl`, concave via `indices`). `Label` → `LabelLayer` → `RawLabels`
(an SDF atlas, `instance/vertex/label.wgsl`).

**Takeaway:** the GPU representation is generic. The schema says _which_
attributes exist and their formats. The aggregator never knows it is drawing an
arrow, and the shader reads attributes through optional links with defaults. A
new primitive is a schema entry, a trait combo, a raw primitive and a WGSL
vertex function. Batching, upload and partitioning are shared.

---

## 4. Side by side: plot's `<Arrow>` vs. our `geom_segment`

The closest thing we have to an arrow is a segment. ggplot2's `geom_segment`
takes `arrow = arrow()`, and we take none: `geom/curve.ts:21` explicitly rejects
`arrow`. Here is where each one's contract lives.

| Concern             | `@use-gpu/plot` `<Arrow>`                                                    | gggplot `geom_segment`                                                                                       |
| ------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Public prop type    | `TraitProps<typeof ArrowTraits>`: **derived**                                | `SegmentProps = PathProps` in `components/geoms.ts:215`: hand-written family                                 |
| Defaults            | in the trait (`size: 3`, `zIndex: 0`) and in the shader's `@optional` bodies | inline in the lowering: `?? "#3b82f6"`, `?? 2` (`geom/segment.ts:54,61`)                                     |
| Accepted aesthetics | the parsers present in the trait combo                                       | `doc(...)` lists in `GEOM_REGISTRY.segment` (`geom/mod.ts:395-414`): docs only, enforced nowhere             |
| Literal vs. mapped  | one schema entry → `width` _or_ `widths`                                     | per-geom code: `geom/line.ts` calls `colorsOf`/`linewidthsOf`/`dashOf`, `geom/segment.ts` calls none of them |
| Param parsing       | parsers normalize loose input                                                | `layer.params.x as T` casts (114 of them across `geom/`)                                                     |
| GPU layout          | `ARROW_SCHEMA` + aggregator                                                  | `packUniformChunks` → `FlatTensor` + `MarkTopology` → `node("Line", …)` → plot's `<Line>`                    |
| Files               | traits (shared) + schema (shared) + one shape file                           | `geom/segment.ts`, `geom/mod.ts`, `components/geoms.ts`, `geom/shared.ts`                                    |

One file per primitive is something we already have (P1). What we lack is a
**single declaration that the type, the defaults, the docs and the lowering all
read from**. bezbox's version is about 30 lines of traits and schema per
primitive.

---

## 5. What drift costs us today (two bugs found)

Our geom contract lives in four places that nothing reconciles: prop types
(`components/geoms.ts`), defaults (28 copies of `"#3b82f6"` across 16
`geom/*.ts` files), doc metadata (`GEOM_REGISTRY` `doc()`), and the params each
lowering actually reads. A param can type-check, appear in the docs, and do
nothing.

**Bug 1, `gggplot-4y7b` (probed).** `<GeomSegment>` admits `linewidth`,
`linetype`, `alpha` and mapped `color`. The 2D `lowerSegment` reads only
`params.color` and `params.strokeWidth`. A throwaway test lowered the same data,
`mapping: {…, color: "g"}`, and params
`{linewidth: 5, linetype: "dashed", alpha: 0.4}` through both geoms:

```text
segment Line        {"color":"#3b82f6","width":2}
line    ChunkedLine {"colors":{…alpha 0.4…},"widths":{…5…},"dash":[8,5],"opacity":0.4}
```

`geom_contour` and `geom_density2d` lower through segment, so they inherit the
gap.

**Bug 2, `gggplot-savp` (code-traced, needs a pixel test).** `spoke`, `curve`
and `rug` _do_ call `shared.ts` `literalLineProps`, which emits `dash` for a
named linetype. But they emit `node("Line")`, and `render_tree.tsx` maps `Line`
to plot's `<Line>`. gggplot-xc9 already traced plot's `dash` and found no shader
consumer (`render/chunked_line.tsx` header). That is why `ChunkedLine` carries
its own dash material. So a dashed spoke draws solid. Master `8a53c69` still has
no `dash` in any WGSL.

Both bugs are the failure mode P2/P3 remove. With the literal/mapped pair
declared once and resolved by one shared function, segment could not have missed
`colors`. With props derived from the declaration, the type could not have
promised `linetype`.

---

## 6. Patterns: adopt / adapt / skip

**P1. One primitive per file. Already ours; keep.** `geom/*.ts` mirrors
ggplot2's `geom-*.R` (`geom/mod.ts` header). bezbox's shape files run 56–189
lines; ours run 13–534, and the long ones are long because of ggplot semantics
(stacking, 3D modes), not plumbing. No action.

**P2. Traits: parser + default + type declared once. Adapt.** Two constraints
shape how we adopt it:

- Our lowering is **pure and runs headless** (the Deno CLI, compile-time tests),
  not inside Live. Hooks are out, but `parseTrait` is hook-free.
- **(probed)** `@use-gpu/traits@0.20.0` **cannot be loaded at runtime under
  Deno.** A scratch script failed with _"The requested module '@use-gpu/live'
  does not provide an export named 'useOne'"_, because traits' ESM build
  named-imports from `@use-gpu/live`, which Deno resolves to CommonJS. That is
  the same interop trap `usegpu_compat.ts` documents. The **types** work:
  `TraitProps<typeof combine(…)>` derived the right prop type under
  `deno check`, and a `@ts-expect-error` on a wrong-typed prop held.

So: `import type` the type machinery (or mirror its ~50 lines of mapped types),
and write a local `trait`/`combine`/`parseTrait`. The upstream implementation of
those three is about 40 lines. Do the cheap guard first: `gggplot-w1qm` fails
when a typed prop does not change the lowered output. Then the refactor,
`gggplot-2926`.

**P3. Singular/plural pairs from one compact schema. Adopt.** Give each geom
family a table of
`aes → {literal param, GPU attribute (single/plural),
format, default, scale}`.
One resolver turns a layer into `{color}` or `{colors}`, `{width}` or
`{widths}`, and so on. ggplot's literal-vs-mapped rule is this pair. It also
lines our RenderNode props up with plot's schema names, which they mostly
already use (`positions`, `colors`, `widths`, `sizes`). Part of `gggplot-2926`.

**P4. Schema → archetype → aggregator → optional-link getters. Skip
re-implementing.** This is plot/workbench's job, and our marks reach it already
(plot's `<Line>`, `<Point>`, `<Face>`, `<Label>`). Where we bypass it
(`ChunkedLine`, `BoundPoint`, the resident marks), the reasons are recorded and
still valid: a variable-chunk flat tensor (`chunked_line.tsx` header), dash, and
GPU-resident data. The useful takeaway is the **contract**: our node props for a
plot component should be a subset of that component's schema keys and formats. A
test can assert this cheaply (fold into `gggplot-2926`).

**P5. `bindable()`: every per-vertex attribute may be a GPU source. Adopt after
verification.** `render/bound_point.tsx` bypasses plot's `<Point>` for
workbench's `PointLayer`, because "`<Point>` drops a shader-bound `colors` prop
at parse time". Plot 0.20's `mjs/traits.mjs` says otherwise when read:

- `bindable(parse)` returns `undefined` for an `isShaderBinding` value instead
  of parsing it.
- `DataTrait` copies any such prop into `parsed.sources`.
- `schemaToArchetype` hashes each source's identity, so differently bound marks
  never merge.
- `VirtualLayers` spreads the item's `sources` into the layer's props.

If that holds at runtime, a GPU scale binding is just a hook that returns a
source. Then every plot shape takes it, color and linewidth on lines and fill on
faces, with no `BoundX` component per mark. This is a claim from reading,
contradicting one that was presumably observed, so it gets a spike with a pixel
test and a path-taken assertion before anything changes: `gggplot-asx4`.

**P6. Arrow as a primitive. Adopt.** Plot's `<Arrow>` covers `arrow()` directly:

| ggplot2 `arrow()`                  | plot `<Arrow>`                                                          |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `ends = "last" / "first" / "both"` | `end` / `start` / both                                                  |
| `length`                           | `size`, in line widths, auto-clamped to the segment                     |
| `type = "closed"`                  | the default head (`flat` for a 2D triangle)                             |
| `angle`                            | no prop (`ARROW_ASPECT` is a shader constant): unsupported, or upstream |

It also gives `geom_curve` arrows, once curve stops rejecting them.
`gggplot-kfwa`.

**P7. View from context. Already ours.** We use plot's `Cartesian`, `Transform`
and `RangeContext` (`render/render_tree.tsx`). No action, apart from the import
move in §7.

**P8. Swappable backend. Skip for now.** bezbox shows that the same props can
drive Canvas2D. `@use-gpu/2d-plot` would give a no-WebGPU fallback for our plain
plot-shape marks almost by swapping the `REGISTRY` in `render_tree.tsx`. It
would not cover the GPU-only marks (`ChunkedLine`'s dash material, `BoundPoint`,
the resident products, 3D), and it is a day old upstream. Revisit once 0.21 is
GA. No bead.

---

## 7. Secondary: the 0.21 package split

### 7.1 What moved

From `CHANGELOG.md` `0.21.0-dev` and `git diff 59534d4..8a53c69`, where
`59534d4` is the 0.20.0 bump:

| New package                              | Since                  | Contents                                                                                                                                                                                                                                                                                                                | Came from                                                                                                                                                 |
| ---------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@use-gpu/frame`                         | 2026-07-28 (`47bfdc1`) | WebGPU-independent runtime: animate, `Tensor`/`Sampler` emitters, DOM events, `Queue`/`SyncLoop`/`Await`/`Fetch`, providers (`Layout`, `Loop`, `Range`, `Data`, `Render`, `Time`, `Suspense`, `Cursor`, `Event`, `ViewFrame`), `QueueReconciler`/`EventReconciler`, router, worker, `useInspectable`, `useBufferedSize` | workbench (`animate/`, `queue/`, `providers/`, `router/`, `reconcilers`), plot (`DataContext`, `RangeContext`, `Tensor`, `Sampler`), webgpu (`dom-props`) |
| `@use-gpu/math`                          | 2026-08-10 (`a6ceb3b`) | `clamp`, `lerp`, `seq`, Bézier/Catmull-Rom, arc length, polynomial solvers                                                                                                                                                                                                                                              | core (`ease.ts`, deleted)                                                                                                                                 |
| `@use-gpu/2d-canvas`, `@use-gpu/2d-plot` | 2026-10-12             | bezbox's `canvas-2d`/`plot-2d`, upstreamed                                                                                                                                                                                                                                                                              | bezbox                                                                                                                                                    |

Workbench and plot keep **deprecated shims only for components**: `Animate`,
`Await`, `Clock`, `EaseToTarget`, `Fetch`, `Queue`, `Router`, `Routes`,
`SyncLoop`, `Sampler` and `Tensor`. **Contexts and reconcilers are not
re-exported.** Other 0.21 changes: `useRenderProp` is a Live built-in, and
`<Compute>` gained `pre`/`post` command phases (§7.3).

### 7.2 Our exposure

The import sites were inventoried across all tracked `.ts`/`.tsx`, including
namespace destructuring through `esm(…)` and `interop<…>(…)`. Every symbol we
take from Use.GPU was then located in master:

| Symbol                                                                                                                     | 0.20 home | 0.21 home | Our sites                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | --------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| `QueueReconciler`                                                                                                          | workbench | **frame** | `runtime/usegpu_compat.ts` (re-exported to `components/gg_data.ts`, `runtime/live.tsx`, `tests/support/live_gpu.ts`) |
| `LoopContext`                                                                                                              | workbench | **frame** | `usegpu_compat.ts` → `runtime/resident_readback.tsx`                                                                 |
| `LayoutContext`                                                                                                            | workbench | **frame** | `components/gg_plot_root.ts`, `render/render_tree.tsx`                                                               |
| `RangeContext`                                                                                                             | plot      | **frame** | `render/render_tree.tsx`                                                                                             |
| everything else (≈80 symbols: `Compute`, `Kernel`, `Readback`, the layers, sources, shader hooks, plot shapes, Live, core) | unchanged | unchanged | n/a                                                                                                                  |

We import nothing from what became `@use-gpu/math`, so **math costs zero
churn**. It only arrives as a transitive dependency.

**The hazard is silence, not volume.**

1. **The probe.** Seven modules resolve Workbench with
   `esm(UseGpuWorkbench, "LayoutContext")`: `gg_plot_root.ts`, `png.ts`,
   `GGPlot.tsx`, `prism_instances_3d.tsx`, `rotated_label.tsx`,
   `scene_picker.tsx` and `render_tree.tsx`. `interop` picks `namespace.default`
   only when the probe member exists. On 0.21 it doesn't, so under Deno's
   CommonJS build the bare namespace comes back, and **every member those
   modules destructure is `undefined`**: `FlatCamera`, `Pass`, `FontLoader`,
   `GeometryData`, `useViewContext`, and the rest, not just `LayoutContext`.
2. **The types.** `usegpu_compat.ts` hand-types each namespace
   (`interop<{QueueReconciler: …}>(Workbench, …)`), so `deno check` cannot
   notice that an export disappeared.
3. **Context identity.** `LayoutContext`/`RangeContext` are identity-keyed. If
   our import and workbench's dependency resolve to two copies of
   `@use-gpu/frame`, providers and consumers silently miss each other. This is
   the same class of failure as the module-cycle trap in memory
   `usegpu-compute-migration-2026-09`.

### 7.3 Behavior changes worth re-verifying

- **Compute phases.** `<Compute>` now mounts `DispatchPass`, `PreCommandPass`,
  `ComputePass` (`computePre` then `computePost`), `PostCommandPass` and
  `ReadbackPass`, in that order. `<Kernel>` goes through `dispatch()`, whose
  default phase now yields `computePre` (was `compute`). Raw `pre` commands no
  longer share `ComputePass`'s submit; they get their own in `PreCommandPass`.
  `ComputePass` still encodes every kernel into one pass and submits once.
  `<Readback>` still yields a `post`/`readback` pair, so **"the copy is enqueued
  behind this frame's compute" still holds structurally** (`usegpu_compat.ts`'s
  `Readback` note). The resident probes must be re-run anyway. We yield no raw
  pass keys ourselves.
- **`@use-gpu/traits` null guard (gggplot-cfe).** `sameArray` is still unguarded
  at `8a53c69`, so `apps/site/vite.config.ts`'s patch (which throws if the shape
  changes) keeps applying.

### 7.4 Churn estimate and plan

| Step                                                                                                                      | When             | Files | Lines |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----- | ----- |
| Probe on a symbol that stays (`useDeviceContext`, as compat already does)                                                 | **now**, on 0.20 | 7     | 7     |
| Route the four movers through `usegpu_compat.ts` only                                                                     | **now**          | ~3    | ~6    |
| Compat-completeness test: every compat value defined under Deno                                                           | **now**          | 1 new | ~30   |
| Bump both `deno.json`s together, add `@use-gpu/frame`, source the four from frame inside compat                           | at 0.21 on npm   | 3     | ~6    |
| Re-run `deno task check`, tests, `test:visual`, `test:pixels`, resident GPU probes (figures must _match_, not just clear) | at the bump      | n/a   | n/a   |

After the prep, the bump is a three-file change. **Availability:** 0.21 is
`0.21.0-rc.1` on use.gpu's GitLab package registry only (bezbox's `yarn.lock`).
npm `latest` is 0.20.0, and `@use-gpu/frame` and `@use-gpu/math` are not on npm
at all. Until 0.21.0 is on npm, there is nothing to bump to without pointing a
Deno npm scope at GitLab, which isn't worth it for an rc.

Beads: `gggplot-hn39` (prep, now) blocks `gggplot-79z5` (the bump).

---

## 8. Follow-up beads

All are `discovered-from: gggplot-cual` and labelled `bezbox-followup`.

| Bead           | P | Kind    | Summary                                                                                               |
| -------------- | - | ------- | ----------------------------------------------------------------------------------------------------- |
| `gggplot-4y7b` | 2 | bug     | `geom_segment` ignores mapped color, alpha, linewidth, linetype (probed)                              |
| `gggplot-savp` | 2 | bug     | dashed spoke/curve/rug render solid: `dash` reaches plot `<Line>`, which ignores it                   |
| `gggplot-w1qm` | 2 | task    | Param-drift guard: every typed named-geom prop must change the lowered output                         |
| `gggplot-2926` | 3 | task    | Declare params + aesthetics once (trait-style table); derive types, defaults, docs. Depends on `w1qm` |
| `gggplot-asx4` | 2 | spike   | Verify plot shapes accept bound sources; if so, bind scales on Line/Face through them                 |
| `gggplot-kfwa` | 3 | feature | `arrow()` for segment/path/curve/spoke via plot `<Arrow>`                                             |
| `gggplot-hn39` | 2 | task    | Harden for the 0.21 split now (probes, single import site, completeness test)                         |
| `gggplot-79z5` | 3 | task    | Bump to 0.21 once on npm. Blocked by `hn39`                                                           |
