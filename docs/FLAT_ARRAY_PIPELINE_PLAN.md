# Flat-Array GPU-Centric Mark Pipeline — Bead Plan

Epic: **`gggplot-tzc`** (created 2026-07-18, from the second-pass review
§2.3–2.4). Goal: the entire non-resident mark path stops passing nested JS
arrays through JSX and instead carries flat typed-array **tensors** that
Use.GPU uploads once and reconciles by identity + version. This is
`GPU_NATIVE_ARCHITECTURE_PLAN.md` Phase 2, plus the first step of Phase 3.

Each bead's full delegation spec (files, contracts, spike instructions,
acceptance gates) lives in the bead itself — `bd show <id>`. This file is
just the map.

## Load-bearing verified facts

- `@use-gpu/plot`'s `Point`/`Line`/`Face` accept a **TensorArray**
  (`{ array, format, dims, length, size, version? }` — see `@use-gpu/core`
  types) for `positions`/`colors`/`widths`/`sizes`, alongside `ShaderSource`
  handles. So the RenderTree can carry tensor-shaped props directly and
  Use.GPU owns upload/caching.
- Upstream `Ragged` is `(number[] | TypedArray)[]` — grouping arrays, **not**
  a chunk-length vector. Per the 2026-07-18 design review, `FlatTensor`
  therefore does not model ragged at all; chunk/loop/index topology lives in
  a separate integer-TypedArray `MarkTopology` prop, aligned with workbench
  `useLineSegmentsSource({chunks, groups, loops})` / `useFaceSegmentsSource`
  (already proven in `runtime/resident_bar.tsx`).

## Design-review revisions (2026-07-18, two passes)

The epic's notes carry both reviews and responses; **bead descriptions are
authoritative and self-contained** — notes are history. Headlines baked into
the specs: `FlatTensor` uses **interleaved** layout with an explicit layout
test; source-row selection (single-mask `packMarkRows`) is separated from
row-to-vertex expansion (`MarkTopology.owners` + `expandByOwners`) so
multi-vertex geoms keep attributes aligned; coordinate transforms dispatch on
topology metadata (not component names) with the order *loops/polyline →
polarize/munch → indices* enforced by munch throwing on pre-indexed nodes;
**polyline munching is implemented** (closing-edge distinction specified),
retiring the passthrough gap; munch expands companions by repetition;
concavity **spikes upstream `useFaceSegmentsConcaveSource` first**, with
custom ear clipping only as a documented-failure path (no nested-Polygon
fallback); zero re-pack is proven by a **staged geometry cache** (pack →
coordinate/topology → indices) whose stage outputs are the renderer-ready
tensors, tested by `===` across rebuilt specs for four geometry classes;
ingested columns are immutable by contract (`invalidate()` escape hatch);
tzc.8 instruments **mark-data-attributed** uploads (tagged tensor arrays),
not global GPU write counts — uniform writes on a domain change stay legal.

## Third review (final) — resolved decisions

Chunked marks are **distinct ComponentNames** (`ChunkedLine`/`ChunkedFace`);
plain `Line`/`Point`/`Polygon` remain for guides, annotations, and the theme
background, with guide-vs-mark tests in both backends. `owners` is
**compiler-internal** (`PackedGeometry`), consumed by `expandByOwners` during
lowering and stripped before renderer-facing `MarkTopology` — never emitted.
Cache invalidation uses **per-column revisions** (`WeakMap<column, number>`
folded into every stage key; `invalidate()` bumps a revision — no reverse
index, no strong refs). Upload attribution requires **source-boundary
tagging** (`createBuffer` sees only a descriptor; payload matching is
optional write-side corroboration). Reviewer verdict: ready to execute in
dependency order.

## Dependency graph

```
tzc.1  FlatTensor + MarkTopology contract, PackedGeometry/owners,
       packMarkRows, fixture serializer
  │
tzc.2  Topology-dispatched polarize/munch (loops AND polylines)
  ├────────────────┬
tzc.3 point/line   tzc.4 rect/area/polygon → one ChunkedFace node
  │  (ChunkedLine) │
  ├───────┬────────┤
tzc.5 staged       tzc.6 emit literals + inlined Chunked* components
  geometry cache     (parallel with tzc.5; needs only tzc.3 + tzc.4)
  │
tzc.7  Phase-3 raw positions (linear scales)
  │
tzc.8  staged bench, tagged mark-data upload instrumentation,
       node-budget + tripwires — closes the epic (blocked by .5, .6, .7)
```

Parallel resident-side track (independent of the epic):
`gggplot-rjg` (usegpu_compat shim) → `gggplot-5ez` (palette LUT for
fill-mapped resident bars), `gggplot-ysq` (wire resident tiles).

Superseded and closed: `gggplot-yxr`, `gggplot-17a` (absorbed into
tzc.1/3/4/5 with fuller specs).

## Epic-level acceptance (verified at tzc.8)

1. No nested `[[x,y],…]` mark positions anywhere in `packages/core/src/geom`.
2. Re-render of an unchanged spec at unchanged layout → reference-identical
   tensors (zero re-pack, zero re-upload).
3. One mark node per layer, with two documented exceptions (per-shape Point
   splits; per-group dash lines if the fallback was needed).
4. All gates green: `deno task check`, core tests, site tests, fixture check
   (`scripts/capture_geom_fixtures.ts --check`), `test:visual`.
5. Emitted source remains standalone, human-diffable, and compilable.
