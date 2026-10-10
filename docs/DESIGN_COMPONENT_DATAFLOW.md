# Design: dataflow between components — fields, kernel specs, scale updates

**Status: draft for discussion.** Part of epic `gggplot-vnh` (component-first
architecture). Feeds ADR-007 (`gggplot-vnh.1`) and the two-phase root spike
(`gggplot-vnh.3`). Nothing here is decided yet; §8 lists the decisions.

> **Corrections after review (2026-10-10). Read these before the body.** A
> counter-review (comments on `gggplot-vnh.15`) and the GPU scale-binding spike
> (`gggplot-vnh.16`, commit `0bf034a`) overturned parts of this draft:
>
> 1. **§3.4 recommendation superseded.** Zero-upload scale updates do not need a
>    field AST. vnh.16 measured GPU functions bound over the existing
>    `TrainedScale` specs with stable runtime refs across 5 updates: 0 mark
>    uploads, 0 rebuilds, max error 1.2e-7, exact pixel parity. That adapter is
>    now the leading candidate. A field model is only worth revisiting for
>    arbitrary `after_stat`/`after_scale` authoring.
> 2. **§3.1/§3.4 "borrow verbatim" is wrong.** molgpu's `compile` inlines
>    domains, ranges and palette entries as f32 literals, so uniform-only
>    updates need a separate runtime-parameter contract.
> 3. **§7 "stable context with mutable refs" is insufficient.** CPU guides are
>    never notified when `ref.current` changes. Use stable refs for shaders
>    **plus** an immutable `{scales, revision}` value for CPU consumers.
> 4. **§4.2 `ProductSpec` needs a generation lifecycle,** not just a named
>    predicate: pending initialization, input/parameter invalidation, readiness,
>    liveness and disposal. Readback latency is not bounded at one frame (§5.3
>    overstates it).
> 5. **§5.2 is missing dependency classes.** A log/linear position transform can
>    force stat recomputation (ggplot2 bins on transformed data), and scale
>    limits censor before stats. Those rows are not relink-only.
> 6. **Indexing was unaddressed.** Filtering, sorting, step expansion and
>    four-vertex bars break `getField(vertex)`. Marks need explicit
>    row/stat-cell/vertex owner indices, which today's packing strips.
>
> See also `REVIEW_USEGPU_SIMPLIFICATION.md` for the deletion-first review.

The component-first move makes one question central that the RenderTree hid:
**how values move between a parent and its children.** In a transpiler, every
value is a prop on a serializable node. In a mounted component graph, values
come in at least three kinds (CPU values, GPU buffer handles, GPU _functions_).
They also travel in three directions: down, up, and across into another
reconciler tree. Use.GPU has a mechanism for each combination. Our weakness
isn't missing mechanisms. We use them ad hoc, one product at a time, with no
rule for which edge uses which.

This document:

1. inventories how values move in gggplot today (§1);
2. catalogs the mechanisms Use.GPU 0.20 actually offers (§2);
3. evaluates **fields** as the model for the aes → scale → visual edge (§3);
4. proposes a **kernel spec** for the compute edge (§4);
5. classifies **scale updates** by what they should cost (§5);
6. puts it together as one channel-per-edge model (§6).

---

## 1. How values move in gggplot today

| Edge                        | Mechanism today                                                                                                                                                                       | Where                                                                                | Problem                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| spec → marks (CPU path)     | Props on serializable `RenderNode`s, interpreted by `renderTree()`                                                                                                                    | `compile/mod.ts`, `render/GGPlot.tsx`                                                | Only serializable values can travel, so GPU handles cannot. Every change goes back through `compile()`.                                                  |
| aes + scale → color/size    | CPU `scaleColorValue` and friends, packed per vertex into `FlatTensor` `colors`                                                                                                       | `scale/mapping.ts`, `geom/packing.ts`                                                | A color-domain change **re-packs and re-uploads** the colors. Scale and mark are fused on the CPU.                                                       |
| aes + scale → position      | Raw values packed; domain goes to `<Cartesian range>`                                                                                                                                 | `RESIDENCY_MATRIX.md` § Scales                                                       | Already the right shape for linear scales. `log`/`sqrt` and discrete are CPU pre-transforms.                                                             |
| typed columns → GPU sources | Render-prop chain: `GPUDataProvider` nests one `RawData` per field, children-as-function                                                                                              | `runtime/live.tsx`                                                                   | Depth is identity: a missing level remounts everything below it. `HoldLevel` exists only to pin that depth. A user cannot place a sibling in this chain. |
| resident product → mark     | `ResidentProduct` node smuggled through the RenderTree, rewritten out by `collectResidentNodes`, built above `<Plot>`, handed down by `ResidentProductsContext` keyed by a stamped id | `runtime/resident_host.tsx`, `runtime/resident_products.ts`                          | Tree surgery to get around the fact that compute cannot mount under `<Plot>`. Product ids are positional stamps.                                         |
| kernel ← buffers/args       | `<Kernel sources=[…] args=[…]>`, **linked positionally** (args, sources, source, targets, history); hand-built `StorageTarget`s; identity-memoized binding objects                    | `runtime/resident_count_kernel_live.tsx` (≈275 LOC), histogram (≈326), domain (≈194) | Each product re-derives the same wiring by hand. Order is the schedule. Unstable identity relinks every frame.                                           |
| GPU summary → CPU view      | `<Readback>` mounted in the queue tree → per-version `ReadbackChannel` → `useAwait` in the view                                                                                       | `runtime/resident_readback.tsx`                                                      | Correct and hard-won (vs7 traps 1–2), but bespoke. Every new summary needs its own channel, decide function and readiness predicate.                     |
| 3D host content → scene     | `sceneExtras` prop spliced in by `appendSceneExtras` tree surgery                                                                                                                     | `render/GGPlot.tsx`                                                                  | The only extension point, and only for 3D.                                                                                                               |
| semantic mapping            | `plan/types.ts::MappingExpr` (`column` / `afterStat` / `afterScale` + an `Expression` AST)                                                                                            | `plan/`                                                                              | **Defined but unused**: referenced only by `plan/validate.ts` and one test. This is the seed of a field model that never got wired.                      |

The pattern: each edge got a local solution when a product needed it. None of
them generalizes to "a user drops a component in the tree".

---

## 2. What Use.GPU 0.20 offers

Every mechanism below exists in the installed `@use-gpu/*` 0.20 packages (read
from `node_modules`, not from docs). Two axes matter: **direction** and
**payload kind**.

### 2.1 Downward

| Mechanism                                          | Payload                   | Notes / where it fits us                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Props**                                          | anything                  | Explicit and typed. Fine for a component's own parameters (`<GeomPoint size={3}>`). Prop-drilling scales and data does not scale.                                                                                                                                                                                                                                                                  |
| **Children-as-function / `render`**                | anything, usually sources | `RawData`, `Data`, `Tensor`, `Sampler`, `Readback.then`, and our `GPUDataProvider`. Explicit value flow, but every async producer adds a nesting level, and **depth is identity**. Good inside a component. Bad as a user-facing composition idiom because it forbids siblings.                                                                                                                    |
| **Context** (`makeContext`/`provide`/`useContext`) | anything                  | Use.GPU uses it for ambient state: `TransformContext`, `MatrixContext`, `RangeContext`, `LayoutContext`, `FontContext`. Implicit dependencies, and a new context value re-renders every consumer, so values must be identity-stable. **Right for frame-wide ambient things: data frame, trained scales, panel.**                                                                                   |
| **Plot `DataContext` + `as=`**                     | named CPU `TensorArray`s  | `<Tensor as="positions">` / `<Sampler as=…>` inject named arrays, and plot shapes' `DataTrait` fills any **unset** prop with a matching key. This is Use.GPU's own built-in "aes", a name → tensor mapping. **But it carries CPU arrays** (`{array, format, size}`), not GPU sources. GPU sources must be passed as props (`isShaderBinding`). Instructive, not directly usable for resident data. |

### 2.2 Upward

| Mechanism                                                     | Payload            | Notes                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`yeet` + `gather` / `multiGather` / `mapReduce` / `fence`** | values             | Children yeet values; the parent receives them in a `then` continuation that renders after them. `RawData`/`Data` **yeet their sources when no `render` prop is given**. Caveat that bit vs7: `<Plot>`'s `VirtualLayers`/`LayerReconciler` `multiGather` intercepts any yeet below it. **Gather must happen outside `<Plot>`.** |
| **`capture` / `useCapture`** (`makeCapture`)                  | values, by context | A side channel. Children render normally and also report a value to the nearest capture, and `then` receives the result. Workbench uses it for event, cursor and light providers. **Good fit for layer declarations** (domain contributions, legend keys) while the layer component keeps a normal shape.                       |

### 2.3 Across (into another reconciler tree)

| Mechanism                                            | Notes                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`quote` / `unquote` / `reconcileTo`, reconcilers** | How shapes reach the layer tree (`Point` ends in `quote(yeet(shapes))`), and how `<Compute>` work reaches `ComputePass`. Also why a `<Readback>`'s `then` mounts in the **queue** tree, not next to the view that wants the value. Something has to bridge back, which is why `ReadbackChannel` exists. |
| `signalTo`, `suspend`, `detach`, `morph`             | Niche; not needed for this design.                                                                                                                                                                                                                                                                      |

### 2.4 GPU-side values: passing functions, not data

This is the axis the RenderTree could never express, and the one that matters
most.

| Mechanism                                                          | What it carries                                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StorageSource` / `TextureSource`                                  | A buffer handle plus `format`, `length`, `size`, `version`. `version` drives re-dispatch and re-read, not identity.                                                                                                                     |
| `LambdaSource` (`useLambdaSource`)                                 | A WGSL function that _looks like_ a source (`fn get(i) -> T`) composed over other sources. A derived column with no buffer.                                                                                                             |
| `useShader(module, values)` / `getShader`                          | Binds a WGSL module's `@link` declarations to sources, constants or lambdas and returns a bound bundle usable anywhere a source is. **Memoized on the identity of every value.** A fresh number literal relinks; a stable ref does not. |
| `useShaderRef` / `Lazy<T>` (`T`, `() => T`, `{current}`, `{expr}`) | A constant that becomes a **uniform re-read on every dispatch/draw**. Changing `ref.current` is a uniform write: no relink, no re-upload. `<Kernel args>` uses this, which is why our scalar args already update cheaply.               |
| `useDerivedSource(source, override)`                               | Re-view an existing source with different `format`, `length` or `size` (e.g. a read-only view of a write target).                                                                                                                       |

**Key consequence:** Use.GPU lets a parent hand a child _a function of the
data_, bound to stable buffers and uniforms, instead of a computed array. A
ggplot mapping (column → scale → visual value) is exactly such a function.

### 2.5 Async (GPU → CPU)

`<Readback>` (inside `<Compute>`, sequenced after `ComputePass`), `useAwait`
over promises, and our per-version `ReadbackChannel`. The rules from vs7 still
hold:

- Readiness is never inferred from a pass having run, or from a sentinel that a
  clear pass wrote.
- Channels are strictly per version: no last-value retention.

### 2.6 Files / external data

`<Fetch>`, image/texture loaders, `useAwait`, plus our ADR-006 GPU-native
loaders (`runtime/column_loader.ts`). These are ordinary producers. In the
component model they all terminate in the same place: a column source in the
data tier (`<GGData>`).

---

## 3. Fields as the model for the aes → visual edge

### 3.1 What molgpu's fields are

`molgpu-sept/packages/fields` defines a `Field` as an **opaque, serializable
expression tree** that assigns a value (scalar, RGBA color, or label) to every
row of a domain. It is built from constructors:

```ts
colormap(linear(attribute("bfactor"), { domain: [lo, hi] }), stops);
```

It has two evaluators for **one definition**:

- `evaluate(field, data)`: CPU, returns a packed `Float32Array` or `string[]`.
- `compile(field, { target })`: emits WGSL plus a **plain-data binding list**
  (`{id, kind: "buffer"|"uniform", wgslType, accessor, fill}`):
  - `target: "raw"` produces a standalone compute shader (headless parity);
  - `target: "link"` produces `@link fn` accessors and
    `@export fn getField(row)` for the Use.GPU linker.

The viewer's `useField(field, inputs)` binds each binding id (`attr:bfactor`,
`curve:t`, …) to an existing `StorageSource` or uniform and returns
`useShader(module, values)`. **A per-row color column is never uploaded, and
changing a uniform is a binding update.** No `ShaderSource` ever crosses the
package boundary: the WGSL is a string and the bindings are data.

### 3.2 Correspondence to ggplot

The match is close. ggplot's aes, scale and `after_*` stages are a field
pipeline with fixed stage names:

| ggplot concept                            | Field form                                                        | Binding kind                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `aes(color = bfactor)`                    | `attribute("bfactor")` (`MappingExpr.column`)                     | buffer: the column source already mounted by `<GGData>`                           |
| `scale_color_gradient(low, high)`         | `colormap(linear(·, {domain}), stops)`                            | domain → **uniform**; stops → literal or small buffer                             |
| `scale_*_discrete` / palettes             | `categorical(factorCode, cases, fallback)`                        | u32 code buffer + small level → color lookup buffer                               |
| `scale_size_continuous(range)`            | `linear(·, {domain, range})`                                      | uniforms                                                                          |
| `scale_x_log10()`                         | `log10(·)` before `linear`                                        | none (shader op)                                                                  |
| trained domain                            | the `domain` argument of `linear`/`colormap`                      | uniform from a CPU-trained scale, **or a storage slot** from a GPU summary (§5.3) |
| fixed param `geomPoint({ color: "red" })` | `constant([1,0,0,1])`                                             | none                                                                              |
| `after_stat(count / max(count))`          | field over the **stat's output domain** (`MappingExpr.afterStat`) | buffer: product output                                                            |
| `after_scale(alpha(fill, 0.4))`           | expression over the mapped value (`MappingExpr.afterScale`)       | none                                                                              |
| legend keys                               | `evaluate(field, legendKeys)` on the CPU                          | n/a: **guides and marks share one definition, so they cannot drift**              |

The last row is a significant side benefit. Today legends and marks compute
colors through separate CPU paths that happen to agree.

### 3.3 What fields do not cover

Fields are **per-row, pure, domain-preserving** maps. They are the wrong tool
for:

- **Reductions** (`stat_bin`, `stat_count`, `stat_summary`): the output domain
  differs from the input domain. These stay kernels (§4). Fields apply to their
  outputs via `afterStat`.
- **Position adjustments** (`stack`, `dodge`, `fill`): group-relative, so they
  need scans or summaries, not row-local maps.
- **Topology** (line chunks, polygon loops, triangulation, polar munching).
- **Strings in shaders**: label fields evaluate on the CPU only, as in molgpu.
- **Scale training itself**: a field _consumes_ a domain; something else
  produces it.

So fields govern one edge: **mapped value → visual value**. That edge is also
the one that owns most scale-update cost (§5).

### 3.4 Options

| Option                                                 | For                                                                                                                                                                                                   | Against                                                                                                                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Depend on `@molgpu/fields`**                      | Exists, tested, with a careful f32 literal policy                                                                                                                                                     | Coupled to `@molgpu/table` and its `atom`/`residue` domains. gggplot's domains are rows, stat cells and panels. A cross-project dependency for a ~1.5k LOC idea.                          |
| **B. Port the pattern into `plan/`** (recommended)     | Replaces the unused `MappingExpr`, which already has `column`/`afterStat`/`afterScale` phases. Same dual-evaluator rule as "every GPU operator has a CPU reference". Serializable, so it fits GGSpec. | An expression language to own: WGSL codegen, f32 policy, error messages. Keep the constructor set **closed** (scale-shaped) to bound it.                                                  |
| **C. No fields; keep CPU packing + `Cartesian range`** | Zero new machinery. Positions are already GPU-mapped.                                                                                                                                                 | Color, size and alpha domain changes keep re-packing and re-uploading. No way for a user's custom primitive to get "the color scale" as a GPU function. Legend/mark drift stays possible. |

**Recommendation: B, scoped to scales.** The constructor set is exactly the
ggplot scale vocabulary (`attribute`, `constant`, `linear`, `log`/`sqrt`,
`colormap`, `categorical`, plus the arithmetic already in `Expression`). It is
not a general compute language. Borrow molgpu's binding-list shape and its
`raw`/`link` dual target verbatim. It also gives `useGGScales()` (vnh.8) its GPU
payload: a custom primitive asks for `scales.color.field` and binds it with
`useShader`.

**Your concern about adopting fields is fair**, and the scoping above is the
answer to it. Fields become a problem when they turn into a general-purpose
shader DSL. Here they are a typed serialization of _scales_, which ggplot
already defines precisely.

---

## 4. Kernel specs for the compute edge

### 4.1 The problem, concretely

From `runtime/resident_count_kernel_live.tsx`:

- **Positional linking.** `<Kernel>` links "args, sources, source, targets,
  history" in that order. Reordering an array silently binds the wrong buffer.
- **Identity-sensitive memoization.** "a freshly built sources array or size
  tuple on each render would relink the bundle and recompile the pipeline every
  frame". So each product hand-builds a `CountKernelBindings` memo.
- **Hand-built views.** Separate `StorageTarget`s for the same buffer as plain
  u32 (clear), atomic (accumulate) and read-only (summary/vertices).
- **Order is the schedule.** "declaration order here is the dispatch order",
  enforced only by a comment and one link test.
- **Dual preambles.** The same WGSL bodies are driven by a raw executor
  (`@gggplot/reductions`, headless parity) and the linker (live), with two
  hand-maintained preambles (`render/resident_grid_kernels.ts`).
- **Readiness lives elsewhere.** `armGridSummary`, `decideGridSummary`,
  `decideDomain` sit in other modules and are re-wired per product.

Each new resident product costs about 200–330 LOC of this wiring. It is the main
thing that will stop the product tier (vnh.5) from scaling past count/bin.

### 4.2 Proposal: `KernelSpec` / `ProductSpec` as plain data

A spec in the same spirit as a compiled field: WGSL as a string, ports as
**named** plain data.

```ts
interface PortSpec {
  name: string; // "values", "counts", "summary"
  format: "f32" | "u32" | "vec2<f32>" | "vec4<f32>";
  access: "read" | "write" | "atomic"; // drives which view is built
  length: SizeExpr; // e.g. { mul: ["bins", "groups"] }
}
interface KernelSpec {
  id: string; // "@gggplot/core:grid_count@1"
  wgsl: string; // body only; preambles generated
  ports: PortSpec[];
  uniforms: { name: string; format: string }[];
  dispatch: { over: string }; // port or size symbol: "rows", "cells"
}
interface ProductSpec {
  id: string;
  buffers: PortSpec[]; // owned allocations
  passes: { kernel: KernelSpec; bind: Record<string, string> }[]; // ordered = schedule
  summary?: { port: string; decide: string }; // named readiness predicate
}
```

One generic `<ProductKernels spec bindings>` component then:

- allocates owned buffers once per shape (not per version);
- builds the read/write/atomic views per port, memoized by name, so it is
  identity-stable by construction;
- generates **both** preambles from the ports, which removes the hand-kept pair;
- links by **name**, with `@link fn get_<port>` / `@link var<storage> <port>`,
  not by position;
- dispatches once per version (`initial` + `version`), in `passes` order;
- mounts the summary `<Readback>` with the named `decide` predicate.

The headless executor in `@gggplot/reductions` consumes the **same spec** with
its raw preamble. That is molgpu's `raw`/`link` split applied to kernels, and it
keeps the CPU/GPU parity harness honest.

Elementwise derived columns (`log10(x)`, `after_scale` arithmetic) do **not**
need kernels at all. They are fields, composed lazily as `LambdaSource`s.
Kernels are only for domain-changing work: reductions, scans, topology. That
split keeps the kernel catalog small.

### 4.3 What stays hand-written

The WGSL bodies of reductions, and the readiness predicates. The vs7 traps came
from readiness semantics, not wiring, and a spec cannot abstract them away. It
can only make each product name its predicate explicitly so none is forgotten.

---

## 5. Scale updates: classify by what they should cost

### 5.1 Cost tiers (cheapest first)

1. **Uniform write**: `ref.current = …`, re-read next draw/dispatch.
2. **Relink**: new bound bundle (a shader value changed identity). The pipeline
   is usually cache-hit by hash, but it costs CPU each time.
3. **Re-dispatch**: compute runs again (input `version` bumped).
4. **Re-upload**: CPU → GPU copy of row data.
5. **Remount**: the component subtree is recreated, which implies 4 for
   everything below it.

### 5.2 Every scale-affecting change, with today's cost and the target

| Change                                                      | Today                                                   | Target            | Mechanism                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------- | ----------------- | -------------------------------------------------------------------- |
| zoom / pan / `coord_cartesian` limits                       | recompile; `Cartesian range` prop (no re-upload)        | 1                 | range as a ref                                                       |
| continuous position domain retrains (new data, other layer) | recompile; `range` prop                                 | 1                 | same                                                                 |
| continuous **color/size/alpha** domain retrains             | **4**: CPU re-pack of per-vertex colors                 | 1                 | field `domain` uniform                                               |
| palette / gradient stops change                             | 4                                                       | 1 or 2            | stops in a small buffer (1) or literals (2)                          |
| discrete level order / palette change                       | 4 (discrete position key includes the full level order) | 1                 | factor codes untouched; rewrite the level → value lookup buffer only |
| `log10` ↔ linear transform toggle                           | 4                                                       | 2                 | field shape change → relink                                          |
| fixed aesthetic change (`color: "red"` → `"blue"`)          | recompile + re-pack of that layer                       | 1                 | `constant` as a ref                                                  |
| column data replaced                                        | 4 for that column (stable per `RawData`)                | 3 + 4             | upload that column only; dependent kernels re-dispatch by version    |
| stat param change (`bins`)                                  | 3 (resident) / recompile (CPU)                          | 3                 | product re-dispatch; buffers reallocated only on shape change        |
| layer added / removed                                       | recompile of the whole plot                             | none for siblings | keyed, position-stable layers (vnh.3 measures this)                  |
| canvas resize                                               | **recompile of everything**                             | guides only       | guide layout reads `LayoutContext` (vnh.6)                           |

**Rule that falls out:** a scale's domain, range and constants are always passed
to `useShader` as **stable refs**, never as fresh literals or arrays. Breaking
that rule silently turns tier 1 into tier 2 on every frame.

### 5.3 Where a domain comes from, and the version-skew trap

A trained domain has two possible producers:

- **CPU training** (today's `trainScales`): the domain is a plain value, so the
  field gets a uniform ref.
- **GPU summary** (resident products): the domain lives in a summary buffer.
  Here a field can bind **the summary storage slot directly** as its domain
  input, so **marks rescale on the GPU with zero readback**. vs7.18's tile
  heatmap already does exactly this: it normalizes against the summary's
  stacked-maximum slot "needing no CPU readback".

The trap: guides (tick labels, legend text) need the domain **on the CPU**,
which means a readback that lands at least a frame later. If marks bind the live
GPU slot while the axis shows the read-back value, then during a version
transition the bars are drawn against version N's domain under version N−1's
labels. That is precisely the "plausible-but-wrong" output the per-version
channel was built to prevent, and no pixel floor catches it.

Options:

- **(i) Gate marks on the readback**: marks bind the uniform that the readback
  fills, so marks and guides always share one version. One frame of latency,
  always consistent. This is the current behavior.
- **(ii) Bind the GPU slot and accept skew**: lowest latency. Only acceptable
  where no CPU guide reads the same domain (e.g. a colorbar-less heatmap).
- **(iii) Bind the GPU slot, and draw the guides on the GPU too**: tick
  positions derived on the GPU, labels still CPU. Mostly a research item.

**Recommendation:** (i) by default. A product may opt into (ii) only when its
spec declares that no guide consumes that domain. The field binding layer should
make (i) the path of least resistance.

---

## 6. Proposed model: one channel per edge

```
           ┌──────────── outside <Plot> ────────────────────────────────┐
files ─▶ <GGData>  ──context: GGDataContext { column → StorageSource+version }
            │
            ├─ <ProductKernels spec>   (inside the frame's <Compute>)
            │      named ports in, named ports out; summary via <Readback>
            │                                  │ per-version channel
            │                                  ▼
<GGPlot> ── capture(LayerDeclCapture) ◀── layers report {fields used,
            │                                  domain contributions, legend keys}
            │   trains scales (CPU values + GPU summaries)
            ▼
           ┌──────────── inside <Plot> ─────────────────────────────────┐
            context: GGScalesContext { aes → TrainedScale{ cpu dict,
                                        field, refs } }
            context: GGPanelContext  { range ref, panel geometry }
               │
               ├─ <GeomPoint>   props: own params; GPU payload: useShader(field)
               └─ <MyPrimitive> useGGScales().color.field → useShader
```

| Edge                                     | Channel                                                                              | Why                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| component's own parameters               | props                                                                                | explicit, typed                                                                                        |
| frame-wide ambient (data, scales, panel) | context, identity-stable values                                                      | many readers, few writers                                                                              |
| layer → root declarations                | `capture`, **outside `<Plot>`**                                                      | layers keep a normal shape; the root trains across all of them; avoids the `LayerReconciler` intercept |
| mapping (aes → visual)                   | **field**: serializable definition, CPU `evaluate` for guides, WGSL `link` for marks | one definition, two evaluators; scale updates become uniform writes                                    |
| compute                                  | `ProductSpec` with named ports                                                       | removes positional linking and hand-built views                                                        |
| GPU → CPU                                | per-version channel + named readiness predicate                                      | keeps the vs7 guarantees                                                                               |
| internal async producers                 | children-as-function, **internal only**                                              | fine inside a component; never the user-facing idiom                                                   |

What this retires: the `ResidentProduct` node, `collectResidentNodes`,
`HOISTED_PRODUCTS`, `sceneExtras`, `MappingExpr`'s dead code, the hand-kept dual
kernel preambles, and per-vertex CPU color packing for scaled aesthetics.

---

## 7. Risks

- **Field codegen correctness.** f32 literal policy, NaN/missing handling per
  `MissingValuePolicy`, factor fallback colors. Mitigation: a CPU/GPU parity
  test per constructor, the same shape as the existing reduction parity harness.
- **Context churn.** A scales context object rebuilt on every retrain would
  re-render every mark. The context value must be stable, with mutable refs
  inside it. That is the opposite of React habits, so it needs to be enforced by
  a test (render counts).
- **Capture timing.** Layers whose domain comes from a GPU summary report
  "pending". The root must not train with a pending contribution treated as
  empty: vs7 trap 2 again, in a new place.
- **Two languages to debug** (TypeScript and generated WGSL). Mitigation: keep
  `compile(field)` output inspectable and include it in the fixture drift gate.

---

## 8. Decisions needed

1. **Adopt a field model for scales (option B)?** Or stay with CPU packing
   (option C)? This doc recommends B, scoped to the scale vocabulary.
2. **Depend on `@molgpu/fields` or port the pattern?** Recommended: port it, and
   keep the binding-list shape compatible so the two projects can share ideas.
3. **Adopt `ProductSpec` before porting more resident products?** Recommended:
   yes. Port count/bin onto it first as the proof.
4. **Domain-consistency default (§5.3).** Recommended: (i), with (ii) as a
   declared opt-in.
5. **`capture` vs `gather` for layer declarations.** Recommended: `capture`,
   pending the vnh.3 spike's measurement.

## 9. Proposed follow-up work (not yet filed)

- Spike: a field model in `plan/` replacing `MappingExpr` (constructors,
  `evaluate`, `compile` raw/link, `useScaleField`). Proof: a continuous color
  domain change = 0 uploads, and the legend matches the marks via the shared
  definition.
- Spike: `ProductSpec` + `<ProductKernels>`; port `stat_count` onto it and hold
  the 70.4% / 74.6% resident pixel floors exactly.
- Test: the context-stability render-count guard for `GGScalesContext`.
