# gggplot Architecture

gggplot is the grammar of graphics as composable **Use.GPU Live components**
([ADR 007](ADR_007_COMPONENT_FIRST.md)). A plot is a component tree: data,
layers, scales, coords, facets, themes and labels are elements, and the tree
renders on WebGPU beside any other Live component. This document covers the
**API** (the component tiers), the **Use.GPU mapping** (what a plot renders to),
and the **execution model** (where work runs and what it reuses).

---

## 1. The API — components

ggplot2 builds a plot by adding layers with `+`. gggplot composes elements:

```tsx
<GGData load={loadMtcars}>
  <GGPlot mapping={{ x: "wt", y: "mpg", color: "cyl" }}>
    <GeomPoint size={3} />
    <GeomSmooth method="lm" />
    <ScaleColor />
    <FacetWrap vars={["gear"]} />
    <ThemeMinimal />
    <Labs title="Weight against fuel economy" />
  </GGPlot>
</GGData>;
```

Design rules:

- **`mapping` maps aesthetics to column names** (`x: "wt"`). Fixed aesthetics
  (`color="red"`) are props on the geom, exactly like ggplot's aes-vs-argument
  distinction.
- **Mapped aesthetics are scaled; fixed props are literal.** A `"red"` in a
  mapped column is a data value that trains the color scale;
  `<GeomPoint
  color="red" />` is the final visual color and creates no guide.
- **Every part is a typed component.** Named geoms (`GeomPoint`,
  `GeomHistogram`, …) type their props per geom family; plot parts
  (`ScaleXLog10`, `CoordPolar`, `FacetGrid`, `ThemeMinimal`, `Labs`,
  `Camera3dFit`, `Execution`) type theirs. Typed Live JSX comes from
  `@gggplot/core/jsx` (the qualified `@jsx Jsx.createElement` pragma), or its
  `createElement` without JSX.
- **Data enters through typed ingestion.** `<GGPlot data>` and `<GGData>` accept
  row-store or column-store data and normalize it with `ingest()` into typed
  numeric/factor columns; `asFactor()`/`asNumeric()` override inference.
  `<GGData load>` takes an async loader and mounts the columns once for every
  plot below it.
- **Escape hatches are components too.** `<GGPanel>` draws custom Use.GPU
  primitives in a panel's data space; `useGGScales()`/`useGGColors()` give them
  the plot's trained scales as GPU bindings; `<GGLayer>` lets a custom layer
  contribute domains and legend keys; `<GeomLayer layer>` takes a raw IR layer.

There is no serialized plot form and no spec builder: the tree is the plot.
`printJsx(tree, { refs })` prints a tree back to the JSX that builds it (data by
reference), which `gggplot print` and the doc site's source panels use.

### The three tiers

```
<GGData>                  data tier     typed columns mounted once as GPU
                                         sources (GGDataContext)
  <GGPlot>                the root      captures its parts in tree order
    parts                 product tier  each layer prepared: rows filtered,
                                         CPU stat run, or a GPU product planned
                          scale tier    scales trained across layers, provided
                                         to marks and custom primitives
                                         (GGScalesContext, GGPanelContext)
```

The root (`components/gg_plot_root.ts`, `components/root_assembly.ts`) runs in
three phases:

1. **Capture.** Every part reports itself (`GGLayerPart`, `GGPart`, `GGPanel`)
   through a Live capture, in tree order.
2. **Prepare and train (PlotView).** Each layer is prepared per facet panel,
   reusing any whose layer, rows, `prepareSignature` and column versions are
   unchanged; GPU-eligible layers become product plans the root hosts
   (`runtime/product_host.tsx`). Scales train across the prepared layers, and a
   resident layer that owns its y range trains it from the product's read-back
   summary. Layout-free: a resize never reaches it.
3. **Layout (PlotLayout).** At the host's size with the font measurer: guides,
   panel bounds, facet strips, and each layer's marks, from the per-layer
   lowering memo unless layout-bound. Only this phase re-renders on a resize.

The layout produces an internal render tree (`compile/rendertree.ts`) that
`render/render_tree.tsx` realizes as Use.GPU elements. It is a debug artifact,
not API.

### Peer Dialect Alignment

gggplot differs from Typst-native and SQL-native ggplot dialects by being
component-native: the grammar is a set of Live components rather than a text
syntax. See [Grammar Alignment](./GRAMMAR_ALIGNMENT.md) for the comparison with
Gribouille and ggsql and the coverage matrix.

---

## 2. The Use.GPU mapping — what a plot renders to

The key enabler: **`@use-gpu/plot` is already a grammar-of-graphics engine.**
Its exports line up almost 1:1 with ggplot concepts, so gggplot is mostly a
_lowering_, not a rendering engine.

| ggplot concept                | `@use-gpu/plot` target                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `<GGPlot>` root               | `<Embedded normalize>` wrapping a view                                                            |
| `<CoordCartesian>`            | `<Cartesian range={[[x0,x1],[y0,y1]]} axes>`                                                      |
| `<CoordFlip>`                 | `<Cartesian axes="yx">`                                                                           |
| `<CoordPolar>`                | `<Polar>` plus pre-munched polygon edges; `theta="y"` reuses the same `axes="yx"` projection swap |
| `<GeomPoint>`                 | `<Point positions colors/sizes shape>`, or a GPU-bound point layer                                |
| `<GeomLine>`/`<GeomPath>`     | chunked `<Line>` layers, one per dash batch                                                       |
| bars/tiles/areas/polygon/rect | chunked face layers                                                                               |
| `<GeomText>`                  | `<Label>`                                                                                         |
| `<GeomHline>`/`<GeomVline>`   | `<Line>` spanning the panel's trained domain                                                      |
| GPU-resident bin/count        | a product hosted in a `<Compute>` beside the plot, drawn by `ProductMark`                         |
| axis guides                   | `<Axis axis="x">`, `<Axis axis="y">`                                                              |
| grid / panel.grid             | `<Grid axes="xy">`; polar rings/spokes are one `<Grid detail>` under `<Polar>`                    |
| legends                       | overlay `<Label>` + `<Point>` guide nodes                                                         |
| facets                        | `FacetGrid` + one panel viewport per facet                                                        |
| 3D (a `z` mapping)            | `Scene3D`: an orbit pass for the marks and a flat overlay for guides                              |

Two JSX worlds coexist: React owns the app shell; Live components use the
classic pragma, qualified so TypeScript checks Live props:

```ts
/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
/** @jsxFrag Jsx.Fragment */
import * as Jsx from "@gggplot/core/jsx";
```

---

## 3. From parts to marks

Each layer goes through ggplot2's own build stages, split across the root's
phases:

```
parts (captured)
  │
  ├─ ① facet partition     split rows into panels (wrap / grid)       prepare
  ├─ ② row filtering       missing positions, then scale limits       prepare
  ├─ ③ stat                CPU stat via @gggplot/reductions, or a     prepare
  │                        GPU product plan (bin/count)
  ├─ ④ scale training      domains across layers (per panel if free)  train
  ├─ ⑤ coord resolution    Cartesian | Polar | Scene3D (+ swizzles)   layout
  ├─ ⑥ geom → mark          scaled aesthetics → mark tensors + owners  layout
  └─ ⑦ guides / theme       axes, grid, legends, strips, labels        layout
  ▼
Use.GPU elements
```

What each change invalidates is the point of the split: a theme, label or coord
limit leaves prepared rows alone (it is not in `prepareSignature`); a resize
re-runs only ⑤–⑦ and re-lowers only layout-bound geoms; an unchanged mark keeps
its tensor identity (`reuseUnchanged`), so its GPU buffers are not re-uploaded.

### Module layout (`packages/core/src`)

```
components/  the component API and the root (gg_plot_root, root_assembly)
ir/          the grammar's value types (Layer, Aes, Scale, Theme, …)
data/        row/column ingestion, typed metadata, factor/numeric lowering
group/       effective ggplot grouping, row counts, metadata-preserving slicing
stat/        CPU stats (identity/count/bin/smooth/summary/…)
scale/       scale training + aesthetic mapping
position/    stack/dodge/fill/jitter/nudge
geom/        per-geom lowering to mark tensors, and GPU product plans
compile/     prepare/train/layout: the stages the root runs, and the internal
             render tree
render/      the render tree as Use.GPU elements; GPU scale bindings; fonts
runtime/     GPU-resident products, their host and marks; Use.GPU interop
emit/        printJsx: a component tree printed as JSX
export/      ggsave: a component tree to PNG
dsl/         the internal builder for the root's plot-level spec
mod.ts       public API
```

---

## Current Capability Snapshot

Implemented and tested on the component path:

1. **Components**: `<GGPlot>`, `<GGData>` (with async `load`), named geoms with
   typed props, plot parts, `<GGPanel>`, `<GGLayer>`, `<GeomLayer>`, and typed
   Live JSX.
2. **Geoms**: point, line/path/step, bar/col/histogram, area/ribbon,
   tile/raster/rect, text/label, smooth, errorbar/crossbar/pointrange,
   boxplot/violin/dotplot, polygon, density and 2D density, contours, hex and 2D
   bins, ECDF, QQ, quantile, rug, curve/spoke/segment, waffle, and the 3D
   point/path/surface/voxel/prism forms.
3. **Annotations**: `<Annotate>` for literal marks, plus `<GeomHline>`,
   `<GeomVline>` and `<GeomAbline>` reference lines.
4. **Stats**: identity, count, bin, smooth (lm/loess/glm), summary and the 2D
   summaries, density, ECDF, quantile, unique, sum, align, connect, waffle.
   Reducing stats are backed by `@gggplot/reductions`; eligible bin/count layers
   run as GPU-resident products.
5. **Scales**: continuous/discrete x/y/z, log/sqrt transforms, expand/domain
   overrides, color/fill palettes (viridis, gradient2), size, alpha, shape,
   linetype, linewidth and stroke; continuous and discrete point colors bind on
   the GPU.
6. **Coords**: cartesian (with zoom limits), fixed, flip, polar and radial, with
   a shared axes swizzle.
7. **Facets**: `<FacetWrap>` and `<FacetGrid>`, with free x/y scales.
8. **Theme**: presets and overrides for backgrounds, grid/axis styling, text and
   font families.
9. **Legends**: color/fill (discrete and colorbar), size and shape guides.
10. **Output**: live WebGPU rendering, PNG export (`ggsave`), and printing a
    tree as JSX (`printJsx`, `gggplot print`).

The phase model and execution principles live in §4–5 below. Detailed current
executor, eligibility, and fallback status lives only in the
[CPU/GPU residency matrix](./RESIDENCY_MATRIX.md), so capability changes have
one status table to update. Measurements that support its upload claims live in
[the performance baseline](./PERF_BASELINE.md); fine-grained future work remains
tracked in beads.

---

## 4. GPU-native execution model

gggplot stays a high-level grammar of graphics, but the live backend realizes
plot _semantics_ as a persistent GPU dataflow rather than turning rows into JSX
value props. There are two explicit execution domains:

```
                  control plane (small, CPU)
parts ──► semantic plan ──► layout + guide metadata
                 │                    ▲
                 ▼                    │ compact summaries only
             GPU execution plan ──────┘
                 │
                 ▼
             data plane (large, GPU)
raw columns → transforms → groups/stats → mark sources → Use.GPU layers
```

**The CPU control plane** owns the small, irregular parts of plotting: schema
inference, factor dictionaries, prop validation, plot/facet layout, text
shaping, and guide labels. **The GPU data plane** owns large numeric columns,
derived fields, reductions, topology, and mark attributes. This is not a plan to
port every JavaScript function to WGSL — the split is deliberate, and the CPU
stays a first-class, non-WebGPU executor (and the reference every GPU operator
is tested against).

The live backend realizes that model through two explicit flows. Both finish in
UseGPU/WebGPU rendering; they differ in where plot computation happens and what
is uploaded:

```
raw input → typed columns → resident eligibility plan
                             │
              ┌──────────────┴────────────────┐
              │                               │
              ▼                               ▼
Flow A: resident product             Flow B: CPU pack-once
required typed columns               CPU stats / scales / positions
        │                                      │
        ▼                                      ▼
GPU StorageSources                  FlatTensor / MarkTopology
        │                                      │
GPU stat → topology → supported                ▼
position / palette expansion         stable GPU RawData sources
        │                                      │
        └──────────────┬───────────────────────┘
                       ▼
                  UseGPU marks
```

Flow A applies only when a registered resident product's eligibility gate
accepts the full layer. It returns bounded guide/domain summaries rather than
row-shaped data. The component root owns Flow A end to end
(`runtime/product_host.tsx`):

- It plans one product per distinct product key and mounts each once, in a
  `<Compute>` beside the plot.
- It trains y from a product's read-back stacked maximum when no y domain is
  declared.
- It draws each resident layer as a `ProductMark` under the trained axes.

Flow B covers general plots: CPU work produces packed tensors whose stable
references prevent another upload while the mapped columns' identities and
versions stay unchanged. The [residency matrix](./RESIDENCY_MATRIX.md) is the
authoritative detailed list of which operations currently take each flow.

### Component-path invariants (gggplot-bv0)

The component root (`components/gg_plot_root.ts`, `root_assembly.ts`) makes four
performance promises, held by a standing gate:

| Change                                    | Promise                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Resize                                    | 0 stats, 0 trainings, 0 lowerings (layout-bound text/label/rug aside), 0 mark uploads |
| A fixed aesthetic beside a GPU-bound one  | 0 mark uploads (uniform writes only)                                                  |
| Adding a layer                            | only that layer mounts; no sibling remounts                                           |
| A column touched in place (`touchColumn`) | exactly that column uploads, and the layers reading it re-prepare                     |

`apps/site/scripts/component_root_check.ts`
(`deno task --cwd apps/site
test:component-root`) measures each in the browser
through the GPU instrumentation and the root's work counters (`componentProbe`),
and fails on any regression. It runs in CI's browser job, which is non-blocking
until a GPU runner exists (SwiftShader cannot draw WebGPU; see the job comment
in `.github/workflows/ci.yml`). The CPU side of each promise is also pinned by
blocking headless tests: `component_resize_test.ts` (resize, touched columns),
`scale_change_classes_test.ts` (what each scale change invalidates),
`component_tensor_reuse_test.ts` and `discrete_binding_test.ts`.

### Two products of a plot

- **Semantic plan (CPU).** The durable intermediate: effective layer mappings,
  required columns, group keys, logical operators (`filter`, `transform`,
  `bin1d`, `aggregate`, `stack`, `sort`, `segment`, `polygon`),
  scale/coord/facet policy, and the exact small summaries guides require. It
  holds no `[x, y]` arrays, hex-color arrays, `GPUBuffer`s, or component names
  as primary meaning — a `PointMark` is semantic; a Use.GPU `Point` is one
  realization. The root's internal plot spec and the `plan/` declarations
  (versioned extension metadata, `FieldSpec`/`ProductPlan`, mapping-expression
  AST) are this domain.
- **Live execution graph (GPU, ephemeral).** At mount time the backend realizes
  the plan into stable `StorageSource`s for numeric columns / factor IDs /
  validity masks, derived `ShaderSource`s for transforms and mark accessors,
  persistent scratch/output storage for compute operators, and Use.GPU
  `Point`/`Line`/`Polygon`/`Axis`/`Grid` layers consuming those handles.
  Resources keep stable identity until their input _version_ changes.

React/Live reconciles source _handles_, not freshly-created vertex arrays on
each render. `runtime/usegpu_compat.ts` is the sole typed boundary for Use.GPU
imports; stats and geoms depend on gggplot's field interfaces, not on Use.GPU
component props.

### Residency principles

- **View-only changes update uniforms, not geometry.** Pan/zoom, continuous
  limits, theme colors, and legend position must not invalidate raw or derived
  buffers. A changed filter, stat parameter, position, or data version
  invalidates only its downstream nodes.
- **The GPU→CPU boundary returns metadata, not rows** — a min/max, a small
  quantile/tick summary, category presence/counts, or per-panel totals (tens to
  thousands of bytes), never a row-shaped readback of a million points.
- **Every GPU operator has a CPU reference.** CPU and GPU are equivalent
  executors of the same logical schema, factor/group ordering, missing-value
  policy, and output shape; choosing CPU changes residency, not plot semantics.
  CPU is the fallback for unsupported devices, custom JS functions, and small or
  view-ineligible data.
- **Composable dataflow.** The execution plan is a DAG of typed products, not
  per-layer arrays. One `stat_bin` count grid can feed a bar geom, a tile geom,
  and a compact summary at once; one raw `x/y/groupId` product can feed both a
  point and a line layer. Stats create products; geoms consume them; the two
  communicate only through named typed ports. The compiler may deduplicate
  identical execution nodes but never merges plot semantics (layer order,
  z-order, `showLegend`, fixed aesthetics stay separate consumers).

### Reducer contract

A reducer does **not** return a `DataFrame`. It returns typed fields with a
declared logical shape (e.g. a grouped 1-D histogram is `n: u32[groups, bins]`,
axes `["group","bin"]`, with empty groups/bins still present) and a residency
guarantee. Shape is part of correctness: a downstream geom indexes cells
directly instead of rebuilding sparse rows. Work is demand-driven — GPU dispatch
begins only at a terminal consumer (a draw, a requested summary, or an explicit
export). Readback is opt-in and bounded; `materialize()` to a row frame is an
explicit export/debug boundary, never a live-geom step.

## 5. Phased trajectory & status

The migration is dependency-ordered; no GPU reducer lands before its semantic
and mounted-runtime contracts exist. The coarse trajectory is:

1. **Typed columns through the semantic IR** — _done._
2. **Persistent source-backed marks** — _done._
3. **Shader-accessible scales and view updates** — _partial._
4. **Resident aggregate-to-mark pipelines** — _partial._
5. **Advanced topology and spatial operators** — _open._

These phases define ordering and architectural intent. The
[residency matrix](./RESIDENCY_MATRIX.md) owns the detailed current status for
individual scales, stats, geoms, and positions.

**Guardrails.** Do not put strings, arbitrary JS callbacks, or the theme system
in WGSL; do not read GPU results back merely to rebuild a row `DataFrame`; do
not replace Use.GPU's plot/layer primitives with bespoke draw code unless a
topology cannot be expressed through sources and layers; do not force GPU
execution for small data; do not let backend resources leak into printed JSX or
plan declarations. Per-operator design detail and open sub-tasks live in beads.
