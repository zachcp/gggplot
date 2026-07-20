# gggplot Architecture

gggplot transpiles a **grammar-of-graphics specification** into a **UseGPU
Live** component tree. This document covers the three concerns the project must
get right: the **API** (how users describe plots), the **UseGPU mapping** (what
we compile _to_), and the **transpilation process** (how we get from one to the
other).

---

## 1. The API — a ggplot-shaped DSL

ggplot2 builds a plot by adding layers with `+`. TypeScript has no operator
overloading, so we use a fluent builder whose `.add()` plays the role of `+`:

```ts
ggplot(data, aes({ x: "wt", y: "mpg", color: "cyl" }))
  .add(geomPoint({ size: 3 }))
  .add(geomSmooth({ method: "lm" }))
  .add(scaleColor())
  .add(facetWrap(["gear"]))
  .add(themeMinimal())
  .build(); // → GGSpec
```

Design rules:

- **`aes()` maps aesthetics to _column names_** (`x: "wt"`). Fixed aesthetics
  (`color: "red"`) go in the geom's params, exactly like ggplot's
  aes-vs-argument distinction.
- **Mapped aesthetics are scaled; fixed params are literal.** If a string column
  contains `"red"` and is mapped with `aes({ color: "shade" })`, `"red"` is a
  data value that trains the color scale. If a layer is written
  `geomPoint({ color: "red" })`, `"red"` is the final visual color and does not
  train a scale or create a guide.
- **Every `geom_*`/`scale_*`/`coord_*`/`facet_*`/`theme_*` returns a
  `SpecPart`** — a small tagged object. `.add()` folds parts into the spec. This
  keeps the DSL a thin, pure layer over the IR, and makes parts reorderable and
  testable.
- **Data enters through typed ingestion.** `ggplot()` accepts row-store or
  column-store data and normalizes it with `ingest()` into a `TypedDataFrame`
  (`GGSpec.data`) of typed numeric/factor columns. `asFactor()` and
  `asNumeric()` let callers override inference for numeric-coded categories and
  numeric strings; `typedArrayForColumn` exposes each column's GPU-ready
  typed array.

### The IR (`src/ir/types.ts`)

`ggplot(...).build()` produces a **`GGSpec`** — plain serializable data with no
UseGPU or DOM dependency. It is the transpiler's AST:

```ts
interface GGSpec {
  data: DataFrame;
  mapping: Aes; // plot-level aesthetics
  layers: Layer[]; // geom + stat + position + param/data overrides
  scales: Scale[]; // declared scales (domains filled in by training)
  coord: Coord; // cartesian | polar | flip | fixed
  facet: Facet; // none | wrap | grid
  labels: PlotLabels; // title/subtitle/caption + axis/guide/facet labels
  theme: Theme;
}
```

Because the IR is serializable, plots can be saved, diffed, sent over the wire,
and round-tripped through either backend.

### Peer Dialect Alignment

gggplot intentionally differs from Typst-native and SQL-native ggplot dialects:
it is centered on lowering to a RenderTree for UseGPU live rendering and source
emission. See [Grammar Alignment](./GRAMMAR_ALIGNMENT.md) for the comparison
with Gribouille and ggsql, the coverage matrix, and the alignment roadmap.

---

## 2. The UseGPU mapping — what we compile _to_

The key enabler: **`@use-gpu/plot` is already a grammar-of-graphics engine.**
Its exports line up almost 1:1 with ggplot concepts, so gggplot is mostly a
_lowering_, not a rendering engine.

| ggplot concept                | `@use-gpu/plot` target                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `ggplot()` root               | `<Embedded normalize>` wrapping a view                                                            |
| `coord_cartesian()`           | `<Cartesian range={[[x0,x1],[y0,y1]]} axes>`                                                      |
| `coord_flip()`                | `<Cartesian axes="yx">` (`Coord.project: ["y","x"]`)                                              |
| `coord_polar()`               | `<Polar>` plus pre-munched polygon edges; `theta:"y"` reuses the same `axes="yx"` projection swap |
| `geom_point()`                | `<Point positions colors/sizes shape>`                                                            |
| `geom_line/path()`            | `<Line positions color/colors width>`                                                             |
| bars/tiles/areas/polygon/rect | `<Polygon>` loops                                                                                 |
| `geom_text()`                 | `<Label>`                                                                                         |
| `annotate()`                  | literal single-row layer, reuses the target geom's node                                           |
| `geom_hline/vline/abline()`   | `<Line>` spanning the panel's trained domain                                                      |
| axis guides                   | `<Axis axis="x">`, `<Axis axis="y">`                                                              |
| grid / panel.grid             | `<Grid axes="xy">` or polar `<Line>` rings/spokes                                                 |
| legends                       | overlay `<Label>` + `<Point>` guide nodes                                                         |
| facets                        | custom `<FacetGrid>` + one `<Embedded>` per panel                                                 |

Two JSX worlds coexist (as in usegpu-deno): React owns the app shell; UseGPU
Live components open with the classic pragma:

```ts
/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
import { createElement, Fragment } from "@use-gpu/live";
```

---

## 3. The transpilation process

The compiler mirrors ggplot2's own build pipeline. `compile(spec)` runs these
stages and returns a **RenderTree** — an abstract, serializable description of
the UseGPU component tree (`{ component, props, children }`).

```
GGSpec
  │
  ├─ ① stat transform      per layer: identity | count | bin | smooth | summary
  │                        (core lowers groups/columns into @gggplot/reductions)
  ├─ ② scale training      scan post-stat data across layers → domains;
  │                        map data → visual space (position, color, size)
  ├─ ③ facet partition     split data into panels (wrap / grid)
  ├─ ④ coord resolution    pick the view: Cartesian | Polar (+ flip swizzle)
  ├─ ⑤ geom → mark          scaled aesthetics → shape component + props
  └─ ⑥ guides / theme       axes, grid, legends, background
  ▼
RenderTree
```

### Why a RenderTree in the middle?

It **decouples the front-end from the back-end** and gives us _two backends from
one compiler_:

```
RenderTree
  ├── renderLive()   → UseGPU Live elements via createElement   (runtime)
  └── emitSource()   → .tsx source string                        (codegen)
```

- **`renderLive` (`src/render/GGPlot.tsx`)** — `<GGPlot spec>` compiles and maps
  each node to a real `@use-gpu/plot` component. Used by the interactive doc
  page; hosts inside a `<WebGPU><AutoCanvas><FlatCamera><Pass>` shell and a
  host-configurable `FontLoader` so `Label` nodes can render real text.
- **`emitSource` (`src/emit/mod.ts`)** — walks the same tree and prints a
  self-contained UseGPU Live `.tsx` module. This is the literal "transpiler" and
  the basis for a future `gggplot compile` CLI.

Both consume the identical RenderTree, so behavior can't drift between "live"
and "emitted," and either can be tested in isolation.

### Module layout (`packages/core/src`)

```
ir/         GGSpec types (the AST)
dsl/        ggplot()/aes()/geom_*/scale_*/coord_*/facet_*/labels()/theme_*
data/       row/column ingestion, typed metadata, factor/numeric lowering
group/      effective ggplot grouping, row counts, metadata-preserving slicing
stat/       stat transforms (identity/count/bin/smooth/summary)
scale/      scale training + aesthetic mapping
compile/    IR → RenderTree  (the transpiler core) + rendertree.ts
render/     RenderTree → UseGPU Live  (runtime backend)
emit/       RenderTree → .tsx source  (codegen backend)
mod.ts      public API
```

The module list is intentionally stable, but the implementation has moved beyond
the original minimum slice:

- `stat/` implements `identity`, `count`, `bin`, `smooth`, and `summary`. Count,
  bin, summary, and linear-regression smooth all call the standalone
  `@gggplot/reductions` package after core has encoded ggplot semantics (mapped
  aesthetics, effective groups, factor ids, and missing values).
- `scale/` trains continuous/discrete position scales, color/fill palettes,
  size/alpha ranges, and shape palettes.
- `compile/` owns guide generation, domain widening for rectangular geoms, facet
  partitioning, coord selection, polar polygon munching, and the final
  RenderTree layout.
- `render/` and `emit/` both understand the custom `FacetGrid` node; `emit/`
  inlines its helper so generated source stays standalone.

---

## Current Capability Snapshot

Implemented and tested:

1. **Core DSL/IR**: `ggplot()`, `aes()`, additive `SpecPart`s, layer data and
   mapping overrides, `inheritAes: false`, and first-class `labels()`.
2. **Geoms**: point, line/path, bar/col, area/ribbon, tile/raster, text/label as
   text-only labels, smooth, errorbar, boxplot, and polygon.
3. **Annotations**: `annotate("segment"|"rect"|"text"|"point", ...)` for
   literal, non-data marks, plus `geom_hline`/`geom_vline`/`geom_abline`
   reference lines spanning the panel's trained domain.
4. **Stats**: identity, count, bin, smooth, and summary. The implemented
   reducing stats are backed by `packages/reductions`: CPU reducers are the
   synchronous compiler path, with optional WebGPU histogram executors available
   in the standalone package for future async/browser pipelines.
5. **Scales**: continuous/discrete x/y, log/sqrt transforms, expand/domain
   overrides, independent color/fill palettes, continuous size, alpha training,
   and discrete shape palettes.
6. **Coords**: cartesian and polar, with a shared `Coord.project` field
   (`[PositionAxis, PositionAxis]`) generalizing axis assignment — `coordFlip()`
   and `coordPolar({ theta: "y" })` both reduce to the same `["y","x"]` swap.
   Polar grids are explicit ring/spoke `Line` guides; polygon marks are
   subdivided before the nonlinear polar transform so bars/areas can draw curved
   wedges.
7. **Facets**: `facet_wrap` and `facet_grid` partition plot data into fixed
   shared-scale panels using `FacetGrid` and per-panel `Embedded` children.
8. **Theme**: panel background, grid/axis color and width, grid omission, text
   defaults, and font-family propagation for label nodes.
9. **Legends**: discrete color/fill, continuous size, and discrete shape legends
   are emitted as RenderTree guide nodes with `labels()`-driven titles,
   including for faceted plots (as plot-level overlays outside the `FacetGrid`).
10. **Backends**: live WebGPU rendering and emitted UseGPU Live source share the
    same RenderTree.

The GPU-first trajectory and what remains on the CPU (with the reason for
each deviation) live in one reviewable place: `RESIDENCY_MATRIX.md`. The
execution model it implements is described in §4 below. In brief, as of the
current tree:

- `GGSpec.data` stores `TypedDataFrame` directly; `typedArrayForColumn`
  exposes each column's canonical `Float32Array`/`Uint32Array` for GPU
  lowering. Storing typed `values` with validity masks in place of the boxed
  arrays is still open.
- Marks pack once into flat `FlatTensor`/`MarkTopology` and bind as stable
  `RawData` sources; the pack cache gives reference-identity reuse so an
  unchanged spec re-renders with zero re-upload. Eligible `stat_bin`/
  `stat_count` bar and tile layers run fully GPU-resident (grid, vertex
  expansion, per-group palette, bounded summary readback only); everything
  else is a documented CPU deviation (see the residency matrix).
- Text/label layout uses a real glyph-measurement pass (`FontResources`),
  which drives legend boxes, `geom_label` backgrounds, and guide placement.

Fine-grained future work remains tracked in beads rather than duplicated here.

---

## 4. GPU-native execution model

gggplot stays a high-level grammar-of-graphics DSL, but the live backend
compiles plot *semantics* into a persistent GPU dataflow rather than compiling
rows into JSX value props. The compiler has two explicit execution domains:

```
                   control plane (small, CPU)
 GGSpec ──► semantic plan ──► layout + guide metadata
                  │                    ▲
                  ▼                    │ compact summaries only
              GPU execution plan ──────┘
                  │
                  ▼
              data plane (large, GPU)
 raw columns → transforms → groups/stats → mark sources → Use.GPU layers
```

**The CPU control plane** owns the small, irregular parts of plotting: schema
inference, factor dictionaries, DSL validation, plot/facet layout, text
shaping, and guide labels. **The GPU data plane** owns large numeric columns,
derived fields, reductions, topology, and mark attributes. This is not a plan
to port every JavaScript function to WGSL — the split is deliberate, and the
CPU stays a first-class, non-WebGPU backend for compile/emit/tests.

### Two compiler products

- **Semantic plan (CPU, serializable).** The durable intermediate: effective
  layer mappings, required columns, group keys, logical operators (`filter`,
  `transform`, `bin1d`, `aggregate`, `stack`, `sort`, `segment`, `polygon`),
  scale/coord/facet policy, and the exact small summaries guides require. It
  holds no `[x, y]` arrays, hex-color arrays, `GPUBuffer`s, or component names
  as primary meaning — a `PointMark` is semantic; a Use.GPU `Point` is one
  realization. `GGSpec` and the `plan/` declarations (versioned extension
  metadata, `FieldSpec`/`ProductPlan`, mapping-expression AST) are this domain.
- **Live execution graph (GPU, ephemeral).** At mount time the backend realizes
  the plan into stable `StorageSource`s for numeric columns / factor IDs /
  validity masks, derived `ShaderSource`s for transforms and mark accessors,
  persistent scratch/output storage for compute operators, and Use.GPU
  `Point`/`Line`/`Polygon`/`Axis`/`Grid` layers consuming those handles.
  Resources keep stable identity until their input *version* changes.

React/Live reconciles source *handles*, not freshly-created vertex arrays on
each render. `GPUPlotRuntime` is the sole hook-owning adapter boundary for
Use.GPU imports; stats and geoms depend on gggplot's field interfaces, not on
Use.GPU component props.

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
  CPU is the fallback for unsupported devices, custom JS functions, and small
  or view-ineligible data.
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
directly instead of rebuilding sparse rows. Work is demand-driven — GPU
dispatch begins only at a terminal consumer (a draw, a requested summary, or an
explicit export). Readback is opt-in and bounded; `materialize()` to a row
frame is an explicit export/debug boundary, never a live-geom step.

## 5. Phased trajectory & status

The migration is dependency-ordered; no GPU reducer lands before its semantic
and mounted-runtime contracts exist. Current status:

1. **Typed columns through the semantic IR** — *done.* `GGSpec.data` and
   `Layer.data` are typed-column objects end-to-end; row/column arrays are
   ingested only at public input boundaries.
2. **Persistent source-backed marks** — *done.* Final mark attributes lower
   once into flat typed arrays bound as stable Use.GPU sources and reused
   across rerenders (the pack cache), with segment topology replacing
   per-group `Line` nodes where the primitive permits.
3. **Shader-accessible scales and view updates** — *partial.* Continuous
   domain→pixel mapping already routes through the view node's `range` prop
   (a view-only change re-packs nothing); moving continuous transforms and
   discrete factor/palette lookup into derived shader sources is still open.
4. **Resident aggregate-to-mark pipelines** — *partial.* Unweighted
   `stat_bin`/`stat_count` bar and tile layers run fully resident (atomic
   count grid → on-device vertex expansion, stack/dodge/fill in the vertex
   pass, bounded summaries only). `bin2d`/density and weighted reductions are
   open (weighted bin deliberately stays on the deterministic CPU reducer).
5. **Advanced topology and spatial operators** — *open.* GPU compaction,
   sort/segment generation, density grids, contours, and polar tessellation
   land only when profiling shows the prior phase is the bottleneck.

**Guardrails.** Do not put strings, arbitrary JS callbacks, or the theme system
in WGSL; do not read GPU results back merely to rebuild a row `DataFrame`; do
not replace Use.GPU's plot/layer primitives with bespoke draw code unless a
topology cannot be expressed through sources and layers; do not force GPU
execution for small data; do not let backend resources leak into saved specs or
emitted plans. Per-operator design detail and open sub-tasks live in beads.
