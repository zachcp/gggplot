# Core module boundary audit

**Status: historical (superseded).** This audit describes the pre-refactor layout — the 2,515-line `compile/mod.ts` and 1,235-line `stat/mod.ts` it measures no longer exist. The geom-registry refactor (`gggplot-elv`, landed `22301c9`) split lowering into `geom/*` behind `GEOM_REGISTRY`, and the flat-array epic (`gggplot-tzc`, landed `677b903`) reshaped the mark pipeline. For the current layout see `ARCHITECTURE.md`; for current review findings see `REVIEW_2026-07-19_THIRD_PASS.md`.

Audit date: 2026-07-17

## Finding

The package has a coherent one-way pipeline, but `compile/mod.ts` (2,515 lines)
and `stat/mod.ts` (1,235 lines) concentrate independently changeable
responsibilities. File length alone is not the reason to split them: compiler
layout, guide construction, geom lowering, and orchestration change for
different reasons, while statistical families share only dispatch and data
helpers. The 583-line DSL and 494-line scale modules are the next mechanical
boundaries. The 336-line Live interpreter is appropriately backend-specific and
should not be merged with emitted-source templates.

## Current map

```text
data ──> ir <── plan
  │       │       │
  ├──> dsl│       └──> runtime (mounted CPU/GPU resources)
  ├──> group ──> stat / position / scale
  └──────────────> compile ──> RenderTree
                               ├──> render/GGPlot (Live interpreter)
                               └──> emit (source backend)
GGPlot ──> compile              export ──> GGPlot
```

There are no observed source-level cycles. The notable coupling is
`render/font_resources.ts` importing `TextMeasurer` from the compiler; that
interface belongs in a small layout contract module when compiler extraction
starts. `GGPlot` compiling a spec is a convenience boundary, not a semantic
cycle, but rendering a precompiled tree must remain available internally for
export and backend conformance.

## Proposed dependency rule

```text
foundation: data, ir, plan
semantic:   group, stat, position, scale, dsl
lowering:   compile/{pipeline,layout,guides,geoms,rendertree}
backends:   render, emit, runtime
hosts:      export, cli
```

Imports may point left/up this ordering, never from foundation or semantic
modules into compiler/backends/hosts. `compile` may use semantic modules but not
Live components. `render` and `emit` consume the same RenderTree contract; they
do not import one another. Runtime owns mounted Use.GPU resources and may
implement plan contracts, but portable plan/IR types never import runtime.

## Stable API constraints

- `src/mod.ts` remains the supported package barrel. Existing named exports and
  type-only exports retain their paths and signatures during extraction.
- `dsl/mod.ts`, `stat/mod.ts`, and `scale/mod.ts` remain compatibility barrels;
  new internal family modules are not automatically public API.
- `compile()` and `RenderNode` stay backend-neutral and serializable.
- Live helpers cannot be literally reused by emitted output. Shared semantics
  live in data/IR or generated templates, with conformance tests comparing the
  two backends.
- A repository check should reject new upward/circular imports after the
  mechanical moves; do not rely only on reviewer memory.

## Staged migration

1. Split statistical families (`gggplot-zsu`); this is layout-independent and
   gives the highest low-risk reduction after the compiler.
2. Partition DSL constructors behind the stable barrel (`gggplot-c0g`).
3. Separate scale training from aesthetic mapping (`gggplot-4x4`).
4. After facet semantics in `gggplot-8e0.8` are settled, extract compiler
   pipeline, panel/layout, guides, and geom lowering (`gggplot-k5m`). Move
   `TextMeasurer` to the layout contract in this stage.

Each stage is mechanical first: move code, preserve exports, run type checks,
unit tests, both backend tests, docs build, and the visual gate. Semantic
cleanup follows in separate work. This avoids disguising behavior changes as
organization work and prevents the facet layout rewrite from being split across
moving modules.
