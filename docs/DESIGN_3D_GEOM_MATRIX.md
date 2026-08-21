# 3D geom compatibility matrix and milestone order

Status: specification for `gggplot-lcy.1`\
Date: 2026-08-21

[ADR 002](ADR_002_3D_AND_EXTENSION_BOUNDARIES.md) decided *which* families get a
3D contract and what kind. This document specifies *what each one must declare*
to be implementable, and the order to build them in.

## The contract is already executable

A geom's dimensional realizations live in its `GeomDefinition.modes`
(`packages/core/src/geom/types.ts`), and `selectGeomMode()`
(`packages/core/src/geom/dimension.ts`) enforces them before stats, scales, or
lowering run. A mode is:

```ts
interface GeomMode {
  dimensions: PlotDimension;
  requiredPosition: readonly AesName[];
  stats?: readonly StatKind[];      // omit to keep the 2D stat surface
  positions?: readonly PositionKind[];
  params?: Readonly<Record<string, readonly unknown[]>>;
}
```

So every row below is written as the mode literal it becomes. This matrix is
meant to be copied into `GEOM_REGISTRY`, not paraphrased into it.

### What ships today

Three geoms declare a 3D mode, all identically conservative:

| Geom | requiredPosition | stats | positions | params |
| --- | --- | --- | --- | --- |
| `point` | x, y, z | `identity` | `identity` | `sizeMode: constant \| perspective` |
| `line` | x, y, z | `identity` | `identity` | — |
| `path` | x, y, z | `identity` | `identity` | — |

Plot-level constraints enforced by `resolvePlotDimension()`:

- Mixed 2D/3D layers throw.
- `camera3d()` without a 3D layer throws.
- Faceting a 3D plot throws (not implemented).
- Non-cartesian coords in 3D throw.
- A 3D plot requires trained x, y, **and** z scales.

## Two gaps this specification has to close

**1. A mapped `z` on a geom with no 3D mode is silently dropped.**
`selectGeomMode()` selects the 3D mode only when the geom declares one *and*
that mode requires `z`; otherwise it falls back to the 2D mode and the `z`
mapping is discarded without a diagnostic. Verified against `geom_bar`,
`geom_tile`, and `geom_area`: each compiles a 2D plot and no error is raised.

This contradicts the epic's own rule that unsupported combinations must fail
clearly rather than fall back silently, and it will get worse as geoms are
added one at a time — every unimplemented geom is a silent no-op rather than a
"not yet" message. **Fix before adding any new mode**, otherwise each milestone
below ships a new way to be quietly ignored.

The rule: if `z` is mapped and the resolved mode does not consume it, throw
`geom_<name> has no 3D mode; z is not supported`. A caller who genuinely wants
z ignored can drop it from the mapping.

**2. `GeomMode` cannot express depth behavior.** Only
`prism_instances_3d.tsx` sets `depthTest`/`depthWrite` explicitly; point, line,
and path inherit renderer defaults. That is survivable while everything 3D is
opaque, and stops being survivable at the first translucent planar surface —
which is milestone 2. Depth policy must become a declared, serializable part of
the mode rather than a renderer accident.

Proposed addition, with today's three geoms defaulting to `opaque`:

```ts
depth?: "opaque" | "translucent" | "overlay";
```

| Policy | depthTest | depthWrite | Draw order |
| --- | --- | --- | --- |
| `opaque` | on | on | any |
| `translucent` | on | **off** | back-to-front by camera distance |
| `overlay` | **off** | off | after scene content |

## The matrix

Each row gives the mode literal, the topology it lowers to, and its non-goals.
"Non-goal" means a reading a user might reasonably expect that this geom
explicitly does **not** provide.

### 1. `segment` — and reference lines

```ts
{ dimensions: 3, requiredPosition: ["x", "y", "z", "xend", "yend", "zend"],
  stats: ["identity"], positions: ["identity"], depth: "opaque" }
```

- **Topology:** independent 2-vertex segments; no ordering or grouping.
- **Missing values:** any missing endpoint component drops the whole segment.
- **Camera:** none beyond the shared camera; widths stay pixel-constant.
- **Requires:** a `zend` positional aesthetic, which does not exist yet, and
  which must train on the z scale like `xend`/`yend` do on x/y.
- **Non-goals:** `abline`/`hline`/`vline` do **not** become planes. A reference
  line in 3D is a line, and a reference *plane* is a separate primitive with
  its own parameters — as ADR 002 already states.

### 2. `polygon`, `area`, `ribbon`, `rect`, `tile`

```ts
{ dimensions: 3, requiredPosition: ["x", "y", "z"],
  stats: ["identity"], positions: ["identity"], depth: "translucent" }
```

- **Topology:** a planar surface embedded in 3D — triangulated in its own
  plane, then placed. Vertex `z` positions the plane; it does not extrude.
- **Missing values:** a missing vertex breaks the ring; the polygon is dropped
  rather than closed across the gap, which would invent area.
- **Camera:** the first translucent content, so it forces the depth policy
  above and back-to-front sorting per frame.
- **Non-goals:** **no implicit volume.** A ribbon between two z values is two
  surfaces, not a solid. `area` in 3D does not fill down to a z floor, because
  "the floor" is a choice the grammar has not made.

### 3. `text` / `label`

```ts
{ dimensions: 3, requiredPosition: ["x", "y", "z"],
  stats: ["identity"], positions: ["identity"],
  params: { billboard: [true, false] }, depth: "opaque" }
```

- **Topology:** camera-facing billboard quads at a depth-tested anchor.
- **Missing values:** a missing position or label drops the glyph.
- **Camera:** glyphs stay screen-legible, so size is pixel-constant by default
  and `sizeMode: "perspective"` is the opt-in, matching `point`.
- **Non-goals:** no in-scene text layout, no collision avoidance, no
  occlusion-aware label placement. Overlapping labels overlap.

### 4. `bar` / `col` — prisms

```ts
{ dimensions: 3, requiredPosition: ["x", "y", "z"],
  stats: ["identity", "count"], positions: ["identity", "stack"],
  params: { depthMode: ["constant", "mapped"] }, depth: "opaque" }
```

- **Topology:** a rectangular prism per row. This is a **distinct 3D
  primitive**, not a z extension: a 2D bar has one categorical axis and one
  measured extent, and a prism has two categorical axes.
- **Missing values:** a missing extent drops the prism; a missing category
  drops the row before binning.
- **Depth grouping:** `depthMode` names where the second footprint axis comes
  from — a constant slab thickness, or a mapped extent. Stacking applies along
  the measured axis only; there is no stacking in two axes at once.
- **Non-goals:** does not imply voxel semantics. A prism is a drawn box, not an
  occupancy cell, and adjacency between prisms means nothing.

### 5. `surface` / `mesh` — height fields

```ts
{ dimensions: 3, requiredPosition: ["x", "y", "z"],
  stats: ["identity"], positions: ["identity"],
  params: { shading: ["flat", "smooth"] }, depth: "opaque" }
```

- **Topology:** a grid-connected height field: z = f(x, y) over a regular or
  rectilinear grid, triangulated by grid adjacency.
- **Missing values:** a missing z leaves a hole — the adjacent quads are
  dropped rather than interpolated across, which would fabricate terrain.
- **Requires:** a declared grid contract. Inferring adjacency from scattered
  points is a triangulation problem this geom does not solve; input that is not
  grid-shaped must fail with that message.
- **Non-goals:** not an isosurface, not a volume, not a general mesh format.
  Arbitrary 3D meshes belong to an extension, per ADR 002.

### 6. `bin` / `voxel` — where volume semantics begin

```ts
{ dimensions: 3, requiredPosition: ["x", "y", "z"],
  stats: ["bin_3d"], positions: ["identity"],
  params: { representation: ["prism", "voxel"] }, depth: "translucent" }
```

- **Topology:** occupancy cells on a 3D lattice, with a count or summary per
  cell.
- **Missing values:** rows with any missing position are dropped before
  binning, never binned into a "missing" cell.
- **Camera:** interior cells are invisible without translucency or slicing, so
  this is the one geom whose usefulness depends on the depth policy.
- **Blocked on:** a `stat_bin_3d` product contract — bin edges, closure, count
  vs. density, and empty-cell representation — decided **before** any voxel
  rendering exists. This ordering is the whole point of `gggplot-lcy.5`
  preceding `.6`.
- **Non-goals:** no volume rendering, no ray marching, no transfer functions,
  no isosurface extraction.

### Explicitly out of scope for every row

Lighting and shading models, shadows, picking and hit-testing, scene-graph
interchange, and faceted 3D. ADR 002 places the first four outside the
decision; faceting throws today and stays that way until its layout and
interaction contract is written.

## Milestone order

Ordered so that each step's data contract is settled before anything renders
against it, and so that no step promises volumetric semantics it has not
defined.

| # | Work | Why here | Bead |
| --- | --- | --- | --- |
| 0 | Fail on unsupported `z` | Every later milestone otherwise ships a new silent no-op | *(new)* |
| 1 | `segment` + reference-line modes | Lowest risk: existing line topology, but forces the `zend` aesthetic | `lcy.2` |
| 2 | Declared depth policy | Required before the first translucent geom, not after | *(new)* |
| 3 | Planar surfaces: polygon, area, ribbon, rect, tile | First translucent content; validates milestone 2 | `lcy.3` |
| 4 | `text` billboards | Independent of 2 and 3; slot in wherever convenient | *(new)* |
| 5 | Prisms: bar, col | First distinct 3D primitive; needs the footprint decision, not just z | `lcy.8` |
| 6 | `surface`/`mesh` | Needs the grid contract from milestone 5's footprint thinking | `lcy.4` |
| 7 | `stat_bin_3d` product contract | Decide bin semantics with nothing rendering yet | `lcy.5` |
| 8 | Voxel rendering | Only after 7 | `lcy.6` |
| 9 | 3D interaction and visual QA | Needs enough geoms to be worth testing | `lcy.7` |

Milestones 0, 2, and 4 have no bead yet and need filing.

### The guard against accidental volume semantics

Three rows in this matrix draw things that *look* solid — ribbons, prisms, and
voxels — and only one of them means anything volumetric:

- A **ribbon** is two surfaces. The space between them is not filled, not
  measured, and not queryable.
- A **prism** is a drawn box whose second footprint axis is a display choice
  named by `depthMode`. Two adjacent prisms are two marks, not a partitioned
  region.
- A **voxel** is the only occupancy cell, and it is gated behind a stat product
  contract precisely so that "this cell contains n observations" is a claim the
  grammar has actually defined before anything renders it.

Anything that would blur those lines — an `area` that fills to a z floor, a
prism grid presented as a density, adjacency treated as connectivity — is out
of scope for this epic rather than a later refinement.
