# ADR 007: Components are the only authoring form

Status: accepted (signed off by the user, 2026-10-10)\
Decision bead: `gggplot-vnh.1`\
Epic: `gggplot-vnh` (component-first architecture)\
Supersedes: the RenderTree-first positioning recorded by `gggplot-1be.6`
(`docs/GRAMMAR_ALIGNMENT.md`)

gggplot started as a transpiler: a fluent DSL built a serializable `GGSpec`,
`compile()` ran one whole-plot CPU pass into a `RenderTree`, and the tree was
either interpreted (`renderTree()`) or printed (`emitSource()`). This ADR
replaces that. Plots are Use.GPU Live components that users write and compose
directly, and nothing serializable sits between the code and the GPU.

The evidence and the dataflow model are in `DESIGN_COMPONENT_DATAFLOW.md` (read
its corrections header first) and `REVIEW_USEGPU_SIMPLIFICATION.md`. The spikes
are `vnh.2` (typed JSX), `vnh.3` (Capture root), `vnh.16` (GPU scale bindings)
and `vnh.17` (deletions); the dataflow decisions are recorded on `vnh.15`.

## Decision 1: components only; GGSpec and the DSL are deleted

**Decided:** Live JSX components are the one way to author a plot:

```tsx
<GGData data={mtcars}>
  <GGPlot mapping={{ x: "wt", y: "mpg" }}>
    <GeomPoint size={6} color="#3b82f6" />
    <GeomLine color="#ef4444" />
  </GGPlot>
</GGData>;
```

`GGSpec` and the fluent DSL (`ggplot(data).add(geomPoint())…`) are removed from
the public API **as soon as the component path renders end to end**
(`gggplot-tnxt`). There is no `specToElements` bridge. The doc examples,
`ggsave` and the CLI are rewritten in JSX by hand.

**Rationale.** A spec was the right shape for a transpiler, and the wrong one
once the runtime is a mounted component graph. Every value has to be
serializable to travel through it, so GPU handles, shared data mounts, product
fan-out and custom primitives cannot (DESIGN §1). Keeping it as a second public
authoring form means two APIs to document and hold at parity forever, plus a
mapping layer between them. gggplot is pre-1.0 (0.0.1), which is the cheapest
time to have one API.

**What stays (internal, not API):** the grammar's IR and pure functions:
`Layer`/`Aes` shapes, stats, scale training (`TrainedScale`), geom `lower()`,
packing, the reductions and their CPU references. Components call them. The
`plan/` types (`ProductPlan`, `FieldSpec`) also stay. They describe products,
not plots, and `@gggplot/model-inspect` depends on them.

## Decision 2: no serialized save form, for now

**Decided:** there is no serializable plot description to save, diff or ship.
Plots are code, and the JSX printer (Decision 3) is the only way to write one
out. Revisit if a concrete need appears; the candidate then is a capture that
walks a mounted tree, not a revived `GGSpec`.

## Decision 3: emitSource becomes a JSX printer, data by reference

**Decided:** `emitSource` is replaced by a printer that emits the component JSX
a user would write, passing data by reference (`gggplot-vnh.11`). The
frozen-literal emitter, which inlines data as typed-array literals, is deleted.

**Rationale.** A snapshot with the data baked in is a poor starting point to
compose from, and it cannot express resident products, so it diverges from the
live path exactly where the project is heading (DESIGN evidence 5).

## Decision 4: the RenderTree is internal

**Decided:** the `RenderTree`, `compile()` and `renderTree()` stop being public
API. While the migration runs, the tree is an internal debug and test artifact.
`assemblePlot` keeps producing it for guides, and the fixture drift gate keeps
reading it until `gggplot-vnh.12` retargets those tests. After that it is
retired (`gggplot-vnh.14`).

## Decision 5: no deprecation window

**Decided:** `compile`, `renderTree`, `emitSource`, `GGSpec` and the DSL are
removed in the same release that switches to the component path. There is no
`@deprecated` period.

## Decision 6: public components and tiers

| Tier        | Where it mounts                                | Public surface                                                                                                                                                                                 |
| ----------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data        | above `<Plot>`                                 | `<GGData data>`: mounts typed columns once (flat raw-source hooks), provides `GGDataContext`; shareable by many plots                                                                          |
| Product     | above `<Plot>`, inside the frame's `<Compute>` | stats as named products (`ProductSpec`, `<ProductKernels>`) with CPU or GPU executors; fan-out to many consumers                                                                               |
| Root        | above `<Plot>`                                 | `<GGPlot mapping coord facet theme labels>`: captures layer declarations, trains scales, lays out guides                                                                                       |
| View / mark | inside `<Plot>`                                | `<GeomPoint>`, `<GeomLine>`, `<GeomBar>`, … (named, typed); `<GGPanel>` / `useGGScales()` for custom Use.GPU primitives; `<GGLayer>` for custom layers that contribute domains and legend keys |

JSX is typed through `@gggplot/core/jsx` (`gggplot-05w`).

## Decision 7: the dataflow rules (from `vnh.15`)

1. **Scales** are GPU functions bound over the existing `TrainedScale` specs,
   with stable runtime refs (a domain change is a uniform write), plus an
   immutable `{scales, revision}` for CPU consumers such as guides. There is no
   field AST. The missing-value contract is grey50 for color and "not drawn" for
   size and alpha (`gggplot-5qi`).
2. **Compute** uses a named-port `ProductSpec` adapter with a generation
   lifecycle (`gggplot-euh`) before more resident products are ported.
3. **Domain consistency:** marks are gated on the per-version readback, so marks
   and guides always show one generation. Binding a live GPU summary slot
   directly is a declared per-product opt-in, only where no CPU guide reads that
   domain.
4. **Layer declarations** travel by Live Capture (`vnh.3`): geoms memoize and
   report a declaration, and marks render from the root's continuation.

## Decision 8: one versioning mechanism

**Decided:** "this column changed" is tracked by Use.GPU's source `version` and
nothing else (`gggplot-67c`, from REVIEW recommendation 1). A column carries a
monotonic version that the data tier passes to its raw source. Kernels and
products key on `source.version`. In-place mutation is supported by bumping the
version, and the pack-cache revision machinery goes away.

## Consequences for the plan

- `gggplot-vnh.10` is no longer a spec facade. Its job becomes migration safety.
  Before the switch, the compile path's frames for every doc example are
  captured as goldens (`apps/site/scripts/example_frames.ts`); the hand-written
  JSX examples must match them.
- `gggplot-sb9f` (`specToElements`) is superseded by hand-rewriting the doc
  examples in JSX.
- `gggplot-tnxt` switches the doc site to JSX examples and deletes the
  spec-authored ones.
- New work: delete `GGSpec`, the DSL, `compile`/`renderTree`/`emitSource` from
  the public API, and move `ggsave` and the CLI onto component trees.
- `gggplot-vnh.13`'s migration guide covers the removal, with old DSL and new
  JSX side by side for the common cases.
