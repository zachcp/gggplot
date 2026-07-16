# GPU-Native Architecture Plan

## Decision

gggplot should remain a high-level grammar-of-graphics DSL, but its live
backend should evolve from **"compile rows into JSX value props"** to
**"compile plot semantics into a persistent GPU dataflow."**

The CPU remains responsible for the small, irregular parts of plotting:
schema inference, factor dictionaries, DSL validation, plot/facet layout,
text shaping, and guide labels. The GPU owns large numeric columns, derived
fields, reductions, topology, and mark attributes. This is not a proposal to
port every current JavaScript function to WGSL; it is a proposal to give the
compiler two explicit execution domains.

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

## What stays compatible

The public grammar remains recognisably ggplot2-shaped:

```ts
ggplot(data, aes({ x: "weight", y: "price", color: "class" }))
  .add(geomPoint({ size: 3 }))
  .add(scaleXLog10())
  .add(facetWrap(["cut"]))
```

`aes()` continues to map names, fixed geom parameters remain literal, and
stats/positions/scales/coords remain independently describable. `GGSpec` is
still serializable as the *semantic* artifact. A mounted Live backend receives
a CPU `DatasetDescriptor`/typed data and realizes non-serializable GPU
resources; neither a `GPUDevice`, a `StorageSource`, nor a Live hook belongs in
the serializable IR.

## Two compiler products

### 1. SemanticPlotPlan (CPU, serializable)

This replaces the Use.GPU-shaped `RenderTree` as the durable intermediate
representation. It contains only decisions that can be saved, diffed, emitted,
or tested without a device:

- effective layer mappings, required columns, fixed aesthetics, and group keys;
- logical operators (`filter`, `transform`, `bin1d`, `aggregate`, `stack`,
  `sort`, `segment`, `polygon`);
- scale policy (continuous/discrete, transform, limits, expansion, palette);
- coord/facet/layout policy; and
- guide requirements and the exact small summaries they require.

It must not contain `[x, y]` arrays, hex-color arrays, `GPUBuffer`s, or a
component name as its primary meaning. A `PointMark` is semantic; a Use.GPU
`Point` is one possible realization.

### 2. LiveExecutionGraph (GPU, ephemeral)

At mount time, the Use.GPU backend realizes the plan into a graph of stable
sources and layers. Its resources have stable identities until their input
version changes:

- `StorageSource`s for numeric columns, factor IDs, validity masks, and lookup
  tables;
- derived `ShaderSource`s for transforms, scale mapping, filtering, and mark
  accessors;
- persistent scratch/output storage for compute operators; and
- Use.GPU `Point`, `Line`, `Polygon`, `Surface`, `ImplicitSurface`, `Axis`,
  and `Grid` layers consuming those sources.

This is the natural boundary offered by Use.GPU: data sources upload typed
arrays once, while geometry layers consume their handles and evaluate size
lazily. React/Live should reconcile source *handles*, not newly-created arrays
of every vertex on each render.

## Data model

### GPUDataFrame

`TypedDataFrame` becomes the CPU-side schema and ingestion representation.
`GPUDataFrame` is its device-resident companion:

| Column kind | CPU representation | GPU representation |
| --- | --- | --- |
| numeric | `Float32Array` or `Float64Array` plus validity | `f32` storage source plus optional validity bit/mask |
| factor | ordered string dictionary + `Uint32Array` codes | `u32` factor-ID source; strings never enter shaders |
| boolean | packed bool/byte array | `u32`/byte mask |
| text | string table + row IDs | CPU-only table and `u32` row IDs; upload glyph/layout output only when text is drawn |

Ingestion may still accept row objects and strings, but conversion happens once.
For a static dataset, the runtime uploads each mapped numeric/factor-ID column
once. For streaming data, a source owns capacity, length, and a monotonically
increasing version; appends/subranges update only changed buffer ranges.

### Data ownership and cache keys

`DatasetDescriptor` owns CPU typed columns and their logical versions. A
mounted `GPUPlotRuntime`/source-provider component owns `useRawSource` calls,
Use.GPU resource lifetime, reconciliation, and cleanup. It is keyed by dataset
identity, device generation, schema, and version—not by a React render.
Derived buffers are keyed by:

```
(device generation, source identity/content version, required-column IDs,
 field layout/shape, operator parameters, group/panel policy, executor version)
```

View-only changes (pan/zoom, continuous limits, theme colors, legend position)
must not invalidate raw or derived geometry. They update uniforms or layer
props. A changed filter, stat parameter, position adjustment, or data version
invalidates only its downstream nodes.

## Execution stages

### A. CPU planning: one small pass

1. Validate required aesthetics, resolve layer inheritance, infer schema, and
   establish factor dictionaries.
2. Build the facet-key universe and panel layout (including empty grid panels).
3. Resolve per-layer panel membership/grouping, then the lifecycle: inherited
   mapping → panel membership/grouping →
   stat setup/compute → `afterStat` mapping → scale train/map → position →
   coordinate projection → geom. Cycles between automatic stat defaults and
   scale/domain summaries are rejected during planning.
4. Build the `SemanticPlotPlan`, including whether an operator has a CPU
   fallback and which compact summary it exports.
5. Collect guide requirements and finish the plan. Text layout stays CPU-side
   until a deliberate GPU text-layout project exists.

No full row materialization, per-row scale mapping, or `[x, y]` tuple creation
occurs in this stage.

### B. Upload: once per changed source

For static/replaced columns, the mounted source-provider uses
`useRawSource`/`RawData` with stable typed-array identity and an explicit
content version. Prefer struct-of-arrays for plot columns, because x, y, factor
IDs, validity, color IDs, and sizes are independently consumed. `Data` and
`GeometryData` are convenient CPU-ingest packers; `StructData` is reserved for
custom WGSL operators that genuinely benefit from array-of-struct layout.

Streaming is a distinct `SourceAdapter`, not `useRawSource`: it owns persistent
buffers, capacity growth, range writes, logical length, content version, and
device-loss rehydration. Passing a typed-array subview to `useRawSource` is not
a range-write protocol because that hook uploads the backing `ArrayBuffer`.

The first migration may pack final `Float32Array` positions on the CPU and use
stable `RawData` sources. That alone removes repeated nested-array conversion
and upload. The mature path uses shader accessors to read raw columns directly.

### C. GPU transform graph

Operators run in dependency order. They can be fused when they are purely
elementwise:

```
raw x/y → validity/filter → log/sqrt/normalization → position accessor
raw factor ID → palette/shape lookup → visual attribute accessor
```

Use `ValueShader`/`DataShader`-style derived sources for elementwise work where
possible. Use `Compute`/`Kernel`/`Dispatch` only for materializing operations:
histograms, group-by reductions, scans, compaction, sorting, indirect draw
metadata, tessellation, density grids, and contour extraction.

### D. Small GPU → CPU feedback boundary

The GPU returns metadata, not row data:

- continuous min/max or a small quantile/tick summary;
- category presence/counts, if categories are data-dependent;
- per-panel summaries; and
- overflow/error counters.

This is typically tens to thousands of bytes. It lets CPU code choose human
labels and guide layout while avoiding a readback of millions of rows. Domain
policies that are explicit (`limits`) need no readback. Automatic-domain policy
is specified later: a data-dependent stat cannot redraw with changed parameters
after an asynchronous refinement.

### E. GPU marks

Use.GPU view components remain the renderer:

- `Cartesian`/`Polar` own final coordinate projection;
- `Point` consumes position/color/size/shape sources;
- `Line` consumes one positions source plus segment/loop topology rather than
  one Live component per ggplot group;
- `Polygon`/`Face` consume compact loops or GPU-tessellated output;
- `Surface`/`ImplicitSurface` consume GPU-resident grids for raster, density,
  and contour work.

This preserves Use.GPU's batching and virtual-layer aggregation while making
the data sources, rather than JSX arrays, the unit of reuse.

## Stats and positions

### CPU-first operators

Keep tiny, irregular, or inherently string/text-based work on the CPU:

- schema/factor dictionary inference;
- very small datasets (a configurable threshold, measured rather than guessed);
- custom JavaScript summary functions;
- median/quantiles before a proven GPU selection implementation; and
- text collision/layout.

### GPU-native operators

Prioritize operators with a GPU-resident input and output that can draw
directly:

1. `stat_bin` / `stat_bin2d`: atomic count grids, then bars/tiles directly.
2. `stat_count`: factor-ID histogram with a small category-count output.
3. `position_stack` / `position_fill`: segmented scans over grouped bins.
4. `stat_density` / 2D density: compute grid, render as raster or feed contour
   extraction without readback.
5. filtering/selection and jitter: derived accessors or compaction buffers.
6. `stat_smooth`: only after the above; linear sufficient statistics are
   feasible, but the output is small and CPU is usually adequate.

Every GPU operator must have: an explicit output shape, a persistent output
buffer policy, a CPU reference test, a threshold/fallback policy, and a way to
remain on GPU through its immediate mark stage.

## Scales, guides, and facets

Continuous scale transforms should be represented as shader-accessible
functions and small uniform parameter blocks. A zoom or domain update then
changes a uniform rather than recomputing all positions.

Discrete scales are two parts: a CPU-owned ordered dictionary for labels and a
GPU `u32` code/lookup table for mapping. Palette colors and shape IDs become
small lookup buffers. The runtime must keep factor ordering deterministic even
when a GPU presence reduction discovers which levels are visible.

Facets add a GPU panel/facet ID rather than copying rows into one DataFrame per
panel. Initially, separate scissored layers per panel are acceptable. A later
optimization can draw multiple panels from one source with a `facet` attribute
and per-panel transform/range tables. Fixed/free scale semantics remain a
control-plane choice, not a reason to duplicate raw data.

## Source emission

`emitSource()` should eventually emit a reusable chart component with a data
boundary:

```ts
export const SalesChart = ({ data }: { data: DatasetDescriptor | TypedDataFrame }) =>
  <GPUPlot spec={salesSpec} data={data} />;
```

Generated source should not encode a million points as nested JSX literals.
It should either import typed binary/columnar data, accept a `DatasetDescriptor`,
or expose an async loader. A small static example may retain inline data for
readability, but that is explicitly a demo mode, not the large-data backend.

## Phased migration

### Phase 0 — establish measurements and contracts

- Add a performance harness measuring compile CPU time, JS allocation, upload
  bytes, GPU dispatch time, readback bytes/time, draw count, and frame time.
- Benchmark static, view-update, and data-update scenarios at 10k, 100k, 1M,
  and 10M rows where hardware permits.
- Define a device capability/fallback matrix; CPU remains a first-class
  non-WebGPU backend for compile/emit/tests.

### Phase 1 — typed columns through the semantic IR

Complete `gggplot-e76`: make `GGSpec.data` and `Layer.data` typed-column
objects. Remove legacy sidecars from the semantic/stat/scale path. This is the
non-negotiable precursor to reliable typed uploads and factor IDs.

### Phase 2 — persistent source-backed marks

Introduce `DatasetDescriptor`, a mounted live source runtime, and
`SemanticPlotPlan`. Keep
current CPU stat/scale calculations, but lower final mark attributes once into
flat typed arrays, bind them as stable Use.GPU sources, and reuse them across
rerenders. Replace per-group `Line` node creation with segment topology where
the target primitive permits it.

### Phase 3 — shader-accessible scales and view updates

Move continuous transforms and scale mapping from CPU materialization into
derived shader sources/uniforms. Prove that pan/zoom/domain changes do not
upload the dataset. Add factor/palette lookup sources for discrete aesthetics.

### Phase 4 — resident aggregate-to-mark pipelines

Implement GPU `bin1d`, `bin2d`, count, and stack/fill pipelines with cached
pipelines/buffers and no row-shaped readback. Draw their output directly as
bars, tiles, or grids. Keep compact domain/category summaries only.

### Phase 5 — advanced topology and spatial operators

Add GPU compaction, sort/segment generation where justified, density grids,
contours, and polar tessellation. Do not port an operator until profiling shows
the previous phase is bottlenecked by that operator.

## Reducer and stat contracts

The first GPU-resident reducer is tracked as `gggplot-1tt`. It establishes the
contract for every later stat. A reducer does **not** return a `DataFrame` by
default. It returns typed fields with a declared logical shape and a residency
guarantee. Expansion into sparse/row-shaped output is an explicit CPU
materialization request, not a hidden implementation step.

```ts
type Residency = "cpu" | "gpu";
type FieldFormat = "f32" | "u32" | "i32" | "vec2<f32>" | "vec4<f32>";

interface DataShape {
  /** Axis order and meaning, e.g. ["group", "bin"]. */
  axes: readonly string[];
  /** Logical element counts, including zero-valued cells. */
  size: readonly number[];
  /** Physical layout for buffer indexing; never inferred from a row list. */
  strides?: readonly number[];
}

interface PhysicalLayoutSpec {
  wgslFormat: string;
  byteStride: number;
  byteAlignment: number;
  logicalToPhysical: "contiguous" | "strided" | "indexed";
}

interface FieldSpec {
  id: string;
  role: string; // built-in grammar role or validated @scope/pkg:role
  format: FieldFormat;
  shape: DataShape;
  layout: PhysicalLayoutSpec;
  topology: "row" | "point" | "segment" | "loop" | "cell" | "grid";
  nullable: boolean;
  validityFieldId?: string;
}

interface ProductPlan { id: string; fields: Record<string, FieldSpec>; }
interface SummarySpec {
  kind: "domain" | "group-totals" | "category-presence" | "sample";
  maxBytes: number;
}
interface ReducerPlan {
  output: ProductPlan;
  cacheKey: readonly unknown[];
  execute: "lazy-source" | "compute-barrier" | "cpu-fallback";
  summaries: readonly SummarySpec[];
}
```

`StatDefinition.plan()` returns a lazy `ReducerPlan`. It declares no GPU
resource; a mounted executor resolves it only when a downstream geom, position,
scale summary, or explicit caller consumes it.

### Required behavior

1. **Shape is part of correctness.** A grouped 1D histogram has logical shape
   `[groupsCount, bins]`, axes `["group", "bin"]`, and `u32` counts. Empty
   groups and empty bins still exist in that shape. A later geom can therefore
   index cells directly without rebuilding sparse rows.
2. **Bindings compose by handle.** A position, scale, or geom consumes a
   resolved field binding; it must not force `materialize()`. Derived GPU
   bindings may be virtual shader accessors rather than another buffer.
3. **Laziness is demand-driven.** GPU work begins at a terminal consumer:
   draw, requested summary, picking/export, or an explicit eager policy.
   Unused layers and summaries do not dispatch. Changing a uniform-only view
   parameter does not invalidate the reducer result.
4. **Caching is semantic.** Cache keys include device generation, input content
   versions, operator kind, grouping/panel policy, parameters, layout, and
   logical shape. Pipelines are cached by WGSL/module/layout. Initial runtime
   policy caches exact-shape `ComputeBuffer`s; capacity pooling requires a
   separate gggplot compute-target adapter.
5. **Readback is opt-in and bounded.** The mounted runtime's `summary()` may
   fulfill a declared min/max, group-total, category-presence, or fixed-sample
   request. It may not return row-shaped bin data. Runtime `materialize()` is
   explicit/asynchronous export or debugging behavior, never a live-geom step.
6. **CPU and GPU are equivalent executors.** Both implement the same logical
   schema, factor/group ordering, missing-value policy, and shape. CPU is the
   fallback for unsupported devices, custom JS functions, and small-data
   thresholds; choosing it changes residency, not plot semantics.

### `stat_bin` as the reference implementation

Inputs are `x: f32[N]`, optional `groupId: u32[N]`, a validity mask, and a
fully specified parameter schema: limits/domain source, transform space,
binwidth or bin count, boundary/closed-side, padding, and zero-cell policy.
Unweighted mode produces `n: u32[groupsCount, bins]`; bin centers and density
are derived fields. Weighted mode produces `count: f32[groupsCount, bins]` and
requires a deterministic floating reduction implementation; until that exists,
it explicitly selects the CPU executor. In the current DSL, `weight` is a
numeric column name (or finite scalar) in a stat-bearing geom's parameters,
for example `geomHistogram({ weight: "mass" })`. An eligible unweighted layer
lowers to `ResidentHistogram`; adding `weight` deliberately leaves the normal
CPU stat/render path in the RenderTree. Weights are never quantized or silently
cast to `u32`; non-finite weights are omitted by the CPU weighted reducer.
Every GPU invalidation executes an ordered clear kernel (or buffer-clear
command) before the atomic histogram kernel.

`geom_bar` and the dense tile-grid consumer then consume the count grid
directly. The resident executor emits both bar vertices and one tile rectangle
per declared `[group, bin]` cell (including zero cells); neither path reads
count rows back. Identity, stack, dodge, and fill layouts are selected in the
GPU vertex pass; stack/fill use the same per-bin group scan. The only normal
GPU-to-CPU response is a requested small
summary such as `[min, max]`, group totals, or bin/domain metadata needed for
axis labels. No `DataFrame` of `{ x, count, group }` rows is built unless an
exporter explicitly requests one.

## Composable dataflow is a first-class contract

Tracked by `gggplot-1tt.1`, the execution plan is a directed acyclic graph
(DAG) of typed products, not a sequence of layer-specific arrays. This is the
rule that makes multiple geoms cheap and makes extension predictable.

```ts
/** A graph input/output port is the same portable schema as a declared field. */
type FieldPort = FieldSpec;

interface DataProduct {
  id: string;
  fields: Readonly<Record<string, FieldPort>>;
  version: number;
  /** Semantic provenance: source IDs and operator IDs, never runtime handles. */
  provenance: readonly string[];
}

interface OperatorPlan {
  kind: "source" | "stat" | "position" | "scale" | "topology" | "geom";
  inputs: readonly FieldPort[];
  outputs: readonly FieldPort[];
  parameters: Readonly<Record<string, unknown>>;
  /** Identical semantic nodes share one execution/cache entry. */
  cacheKey: string;
  execute: "lazy-source" | "compute-barrier" | "cpu-fallback";
}
```

### Composition rules

1. **Stats create products; geoms consume products.** A stat never constructs
   JSX or a `Point`/`Line`/`Polygon`. A geom never recomputes a stat. Both
   communicate only through named typed ports.
2. **Products fan out without copying.** One `stat_bin` count grid may feed a
   bar geom, tile geom, annotation, and a compact summary simultaneously. One
   raw `x/y/groupId` product may feed a point layer and a line layer. Each
   consumer receives the same stable source handles.
3. **Only barriers materialize.** Elementwise transforms, scale accessors,
   palette lookup, and coordinate access are lazy derived sources. Group-by,
   scan, compaction, sort, tessellation, and histogram operations are explicit
   compute barriers with a declared output product.
4. **Deduplicate execution, never plot semantics.** The compiler may merge two
   graph nodes only when their source versions, mappings, grouping policy,
   parameters, output schema, and coordinate-independent semantics are equal.
   It must retain original layer order, z-order, `showLegend`, and fixed
   aesthetics as separate consumer/geom nodes.
5. **Shape compatibility is checked at planning time.** A position transform
   may accept `grid[group, bin]`; a point geom may accept `point[N]`; a line
   geom additionally requires a `segment[N]` topology port. Broadcast and
   lookup rules must be explicit. An extension cannot silently reinterpret a
   cell grid as independent points.
6. **Ownership follows the graph.** `DatasetDescriptor` owns CPU products; the
   mounted runtime owns cached derived/compute products. Reference counting
   or graph reachability releases a product only after its last consumer is
   gone. Replacing a source version invalidates descendants, not siblings or
   unrelated layers.
7. **Materialization is an API boundary.** `ResolvedCPUProduct` and
   `ResolvedGPUProduct` bind the same `FieldSpec` schema. Crossing from GPU to
   CPU requires runtime `summary()` or `materialize()`; no geom, scale, or
   position may perform an implicit full readback.

### Examples

Multiple geoms over the same input should compile to a shared source product:

```text
raw x/y/colorId ──► scaled point product ──┬──► geom_point
                                           └──► segment topology ─► geom_line
```

Likewise, a grouped histogram is one reducer result with multiple possible
views, rather than separate reductions:

```text
x/groupId ──► stat_bin grid[group, bin] ──┬──► position_stack ─► geom_bar
                                           ├──► geom_tile
                                           └──► summary(domain/totals)
```

Extensions participate by declaring ports and an `OperatorPlan`; they do not
receive or return ad-hoc JavaScript arrays. A custom WGSL stat is therefore
composable by construction, while a custom JavaScript stat explicitly selects
the CPU executor and still returns the same declared product shape.

## Review-mandated ABI and runtime refinements

This section incorporates the independent primitives and ggplot-compatibility
reviews (tracked by `gggplot-1tt.2`). It supersedes the earlier illustrative
runtime types wherever they imply that a serializable plan owns a GPU source.

### Serializable declarations versus mounted bindings

The semantic compiler deals only in declarations. The Live backend binds those
declarations to Use.GPU resources after it is mounted:

```ts
// FieldSpec and ProductPlan above are portable declarations.
// These bindings exist only inside mounted GPUPlotRuntime.
interface ResolvedGPUField extends FieldSpec {
  source: StorageSource | LambdaSource;
  access: "read" | "read-write";
  contentVersion: number;   // graph-owned; not inferred from handle identity
}
interface ResolvedCPUField extends FieldSpec {
  array: TypedArray | CPUAccessor;
  contentVersion: number;
}
interface ResolvedGPUProduct {
  planId: string;
  fields: Record<string, ResolvedGPUField>;
}
interface ResolvedCPUProduct {
  planId: string;
  fields: Record<string, ResolvedCPUField>;
}
type ResolvedProduct = ResolvedGPUProduct | ResolvedCPUProduct;
interface ResolvedProductRuntime {
  product: ResolvedProduct;
  summary(request: SummarySpec): Promise<ReducerSummary>;
  materialize?(request: MaterializeRequest): Promise<TypedDataFrame>;
}
```

`FieldPort` and `OperatorPlan` name schemas and graph edges; `ResolvedProduct`
owns actual bindings. `GPUPlotRuntime` is the sole hook-owning adapter boundary
for Use.GPU imports. Stats and geoms depend on gggplot's field interfaces, not
on Use.GPU component props, insulating the DSL from upstream API churn.

### Layer and extension ABI

An extension definition must declare semantic behavior in addition to ports:

- `requiredAes`, optional/default aesthetics, default stat/geom/position, and
  a parameter schema with defaults and validation;
- missing-value policy; setup/panel/group/row execution granularity; output
  fields and computed-aesthetic defaults such as `y = afterStat("count")`;
- legend key/guide contribution policy, including
  `showLegend: true | false | "auto"`; and
- a versioned portable identifier such as `@scope/pkg:stat_bin@1`, separated
  from its registered CPU or WGSL runtime implementation.

Mappings must support `column`, `afterStat(field)`, and later `afterScale(expr)`
forms. `expr` is a portable restricted AST (field references, constants,
whitelisted pure operations, and declared lookups), never arbitrary JavaScript.
Each mapping form declares allowed input roles, output dtype/shape, broadcast,
missing-value, and phase rules; invalid or cyclic references are rejected.
Stats expose stable named fields rather than mutating a layer's mapping.
Custom JavaScript callbacks select a declared CPU executor; custom WGSL still
must declare the same metadata, ports, and output semantics. Code generation
imports registered definitions/loaders by identifier or rejects a nonportable
definition; it never serializes callbacks, shader closures, or GPU handles.

Position, Scale, Coord, and Facet definitions have separate extension contracts:
Position declares required fields/topology and its panel/group scope; Scale
declares train-summary, map, and guide behavior; Coord declares projection and
topology effects; Facet declares key universe, layout, membership, and scale
policy. None may be an untyped geom implementation detail.

### Scheduling, topology, and lifecycle

GPU compute uses persistent buffers and explicit invalidation:

```tsx
<Compute>
  <ComputeBuffer width={bins} height={groups} format="u32">
    {(counts) => <>
      <Kernel initial version={inputContentVersion} shader={clearCountsKernel} />
      <Kernel initial version={inputContentVersion} shader={binKernel} />
    </>}
  </ComputeBuffer>
</Compute>
```

The ordered clear stage is mandatory before atomic count dispatch. `Kernel
initial`/the supplied version gates both stages. The graph records output
content validity after dispatch because a stable `ComputeBuffer` handle does
not itself prove new content. Pipelines are cached by module/layout. Initial
policy caches exact-shape buffers because `ComputeBuffer` reallocates when its
dimensions change; capacity pooling is a future gggplot compute-target adapter.
Device loss drops resolved products and rehydrates them from retained CPU typed
columns and the semantic plan.

Physical field layout is explicit: WGSL format, element count, byte
stride/alignment, logical-to-physical indexing, read/write access, and validity
representation. A topology bundle is equally explicit: a `Line` requires
compatible `positions` and `segments` (and, when needed, loop/slice/welded
padding fields). `stat_bin`'s `grid[group, bin]` requires a declared
grid-to-bar/tile topology adapter; it cannot be passed directly to `Polygon`.

### Panels, guides, sharing, and conformance

Panel membership is a semantic field, not a late rendering detail. A layer
with matching facet variables filters to compatible panels; one without them
replicates according to the declared facet rule. Stat cache identity includes
layer-data identity, effective mapping expressions, panel membership, grouping,
NA policy, default-resolved parameters, and stat-domain context. Free/fixed
scale behavior, empty grid combinations, `drop`, margins, and unsupported
facet options must be explicitly represented or rejected.

Guide inputs are independent from visual mark products, so shared products do
not accidentally merge legends. The initial ABI must test `showLegend`,
constant-within-group aesthetics, and guide keys separately from mark fan-out.

CPU fallback is an observable asynchronous executor choice (`unsupported
device`, custom JS, or configured threshold), not an implicit GPU readback.
Maintain a CPU/GPU conformance matrix covering missing values, factor order,
group/panel partitioning, zero cells, bin-edge rules, line row order, computed
aesthetics, and summary/readback bounds. Automatic domains must either await a
bounded summary, render an explicitly provisional frame with stable stat
parameters, or require user limits. A provisional domain is allowed only when
it does not parameterize a data-dependent stat; `stat_bin` must await its
summary, use explicit limits, or retain its chosen bin parameters unchanged.

## Beads implementation action plan

The architecture feature `gggplot-1tt` is deliberately dependency-ordered. No
GPU reducer implementation begins until its semantic and mounted-runtime
contracts are available.

1. **Typed semantic data** — `gggplot-e76`: **implemented** direct
   `TypedDataFrame` storage in `GGSpec`/layers and stat output. The DSL and
   core transformations preserve typed columns end-to-end; row/column arrays
   are ingested only at public input boundaries. Transitional helpers retain
   legacy input compatibility without becoming a semantic-pipeline format.
2. **Portable extension ABI** — `gggplot-1tt.5`: **implemented** the
   serializable `plan/` declarations: versioned extension metadata,
   `FieldSpec`/`ProductPlan`, mapping-expression AST, and parameter/plan
   validation. It contains no Use.GPU handles or callback values.
3. **Mounted static-data runtime** — `gggplot-1tt.6`: **implemented**. The
   core `GPUPlotRuntime` lifecycle contract provides stable opaque source
   bindings, content versions, CPU/GPU resolved fields, view-update isolation,
   and device-loss rehydration. `GPUDataProvider` is the hook-owning Live
   adapter: it nests Use.GPU `RawData` nodes using stable typed arrays and
   returns named storage sources. Vite's ESM build is the integration target
   and verifies the documented `RawData` export. Deno sees Workbench's CJS
   type surface, so the compatibility cast is isolated to that adapter; the
   upstream conditional-exports PR remains a portability improvement, not a
   local runtime blocker.
4. **First resident reduction** — `gggplot-1tt.7`: implement unweighted
   `stat_bin` as `n: u32[group, bin]`, using exact-shape persistent targets,
   ordered clear/atomic dispatch, bounded summaries, and direct bar/tile
   lowering. The reductions package now supplies the persistent-grid kernel
   primitive (with optional readback only for tests/metadata). Its ordered
   second compute pass expands the count grid directly into packed
   `[group, bin, corner, xy]` bar vertices, using a per-bin group prefix sum
   for `position = "stack"`; no row-shaped result is created. The semantic
   `geom_histogram_grid` topology contract declares those bar positions/faces.
   Binding the resident vertex source into a mounted Use.GPU mark and adding
   tile/fill/dodge execution remain in this bead.
5. **Evidence gate** — `gggplot-1tt.9`: add CPU/GPU conformance fixtures and
   upload/dispatch/readback/frame-time instrumentation around the first path.
6. **Streaming data** — `gggplot-1tt.10`: add the separate range-write
   `SourceAdapter` after static sources are reliable.
7. **Weighted reductions** — `gggplot-1tt.8`: retain unweighted `u32` atomics;
   implement deterministic weighted `f32` accumulation only when feasible, or
   keep an observable CPU fallback.

The final three tasks are intentionally later than the unweighted reference
path. They must not weaken semantic conformance or introduce implicit readback.

## Non-goals and guardrails

- Do not put strings, arbitrary JavaScript callbacks, or the entire theme
  system in WGSL.
- Do not read GPU results back merely to re-create a row-shaped `DataFrame`.
- Do not replace Use.GPU's plot/layer primitives with bespoke draw code unless
  a required topology cannot be expressed through sources and layers.
- Do not force GPU execution for small data; the DSL should select an executor
  based on data residency, operator support, and measured thresholds.
- Do not let backend resources leak into saved specs or emitted semantic plans.

## Success criteria

For a static million-row point plot, changing only a view/continuous-scale
uniform performs no dataset upload and no CPU per-row rebuild. For a resident
histogram/density pipeline, the full input and intermediate grid remain on the
GPU; only guide/domain metadata is read back. The output remains visually and
semantically equivalent to the CPU reference for grouping, scales, positions,
facets, and missing values.
