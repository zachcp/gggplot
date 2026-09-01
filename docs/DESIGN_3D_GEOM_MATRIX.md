# 3D geom compatibility matrix

Status: implemented contracts and decision record\
Last verified: 2026-08-30

[ADR 002](ADR_002_3D_AND_EXTENSION_BOUNDARIES.md) decided _which_ families get a
3D contract and what kind. This document specifies _what each one must declare_
and records the implementation rationale. See [DESIGN_3D.md](DESIGN_3D.md) for
the concise current overview.

## The contract is already executable

A geom's dimensional realizations live in its `GeomDefinition.modes`
(`packages/core/src/geom/types.ts`), and `selectGeomMode()`
(`packages/core/src/geom/dimension.ts`) enforces them before stats, scales, or
lowering run. A mode is:

```ts
interface GeomMode {
  dimensions: PlotDimension;
  requiredPosition: readonly AesName[];
  stats?: readonly StatKind[]; // omit to keep the 2D stat surface
  positions?: readonly PositionKind[];
  params?: Readonly<Record<string, readonly unknown[]>>;
  depth?: "opaque" | "alphaAware" | "overlay";
}
```

So every row below is written as the mode literal it becomes. This matrix is
meant to be copied into `GEOM_REGISTRY`, not paraphrased into it.

### What ships today

Twelve geoms declare a 3D mode: `point`, `line`, `path`, `segment`, `text`,
`area`, `ribbon`, `polygon`, `rect`, `col`, `surface`, and `voxel`. Exact
position requirements and special cases are recorded in the rows below and
summarized in [DESIGN_3D.md](DESIGN_3D.md). The executable inventory assertion
in `packages/core/tests/node_budget_3d_test.ts` keeps this list aligned with
`GEOM_REGISTRY`.

Plot-level constraints enforced by `resolvePlotDimension()`:

- Mixed 2D/3D layers throw.
- `camera3d()` without a 3D layer throws.
- Faceting a 3D plot throws (not implemented).
- Non-cartesian coords in 3D throw.
- A 3D plot requires trained x, y, **and** z scales.

## Two gaps closed during implementation

**1. A consumed `z` on a geom with no 3D mode now fails clearly.** Earlier,
`selectGeomMode()` could fall back to a 2D mode and silently discard the
mapping.

The rule: if `z` is mapped and _nothing_ consumes it, throw
`geom_<name> has no 3D mode; z is not supported`. A caller who genuinely wants z
ignored can drop it from the mapping. This rule is implemented.

"Nothing consumes it" turned out to be subtler than "the mode does not require
it". `z` is a legitimate non-positional aesthetic in three other places, and the
first draft of this rule broke all of them:

- **The stat reads it as a value.** `contour` and `contour_filled` take z as a
  height field; `summary_2d`, `summary_hex`, and `summary_bin` reduce it per
  cell. Whether z is positional is therefore a property of the _stat_, not the
  geom.
- **The geom documents it as a value channel.** `geom_tile` lists z among its
  optional aesthetics, and a test asserts that a tile z stays 2D.
- **The layer only trains scales.** `geom_blank` maps z to widen a domain
  without drawing, and is exempt via its existing `contributesDimension: false`.

Implemented in `selectGeomMode()` against a named `Z_VALUE_STATS` list and a
`GeomDefinition.nonPositionalAes` declaration, so each exemption is stated
rather than inferred.

**2. `GeomMode` could not express depth behavior.** The first draft of this
section claimed point, line, and path inherited renderer defaults. That was
wrong — it came from grepping the render layer, where only
`prism_instances_3d.tsx` sets the flags, and missing the geom lowering. All
three already derived `depthWrite: !transparent` from observed alpha, and did so
correctly.

The real gap was that they each derived it _separately_, so the planar surfaces
in milestone 3 would have been the third copy of the same rule. Depth is now a
declared part of the mode, resolved through one shared `depthProps()`:

```ts
depth?: "opaque" | "alphaAware" | "overlay";
```

| Policy       | depthTest | depthWrite               | Notes                                                                                        |
| ------------ | --------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| `opaque`     | on        | on                       | Always writes; a translucent tint cannot silently disable occlusion                          |
| `alphaAware` | on        | off _when any alpha < 1_ | The effective policy depends on the data, so a mode declares the capability, not the outcome |
| `overlay`    | **off**   | off                      | Sits on top of the scene regardless of position                                              |

Omitting the policy means `alphaAware`: writing depth for genuinely translucent
content produces visible blending artifacts, while the reverse costs nothing, so
the forgiving reading is the safe default.

**Back-to-front draw order already works, at the draw-call level.** This section
previously claimed nothing sorted translucent geometry. That was wrong.

use.gpu's colour pass draws opaque calls, then transparent ones, and passes
`sign = -1` to `drawToPass` for the transparent set
(`@use-gpu/workbench/pass/color-pass`). `drawToPass` sorts renderables by a
culler-computed depth and that sign reverses the comparison, which is a
back-to-front sort, recomputed every frame as the camera moves. The raw
primitives supply the `bounds` that depth is derived from — `raw-faces` computes
it from transformed positions and hands it to the renderable — so gggplot's
marks participate without doing anything.

Two real limits remain, and both matter for the same geom:

- **The sort is per draw call, not per primitive.** Renderables are ordered
  against each other; the instances inside one of them are not. A voxel lattice
  is a single instanced draw containing thousands of mutually overlapping boxes,
  so it gets no internal ordering. Measured and accepted in `gggplot-lcy.13`.

### Ordering inside one draw call is an ACCEPTED limitation

`gggplot-lcy.12` established that use.gpu sorts translucent _renderables_
back-to-front every frame. It does not order the primitives inside one of them,
and nothing in `@use-gpu/workbench` does — there is no per-primitive depth sort
anywhere in the package.

Prisms, voxels, and surfaces each pack every box or quad into a single
`ChunkedFace`, so a voxel lattice is one renderable holding thousands of
mutually overlapping rings. Those rings blend in packing order.

**The exposure is bounded and opt-in.** A voxel layer with no `alpha` resolves
to `opaque` with `depthWrite` on, and the depth buffer orders it correctly with
no sorting involved. The artifact appears only when a user asks for
translucency, which is exactly when they are asking to see through overlapping
cells.

**A compile-time sort was considered and rejected.** `LayerContext` carries
scales, theme, and panel pixels — not the camera — so sorting during lowering
would mean threading a camera through every geom's lowering signature for one
narrow purpose. Worse, the result would be correct only for the declared camera:
the RenderTree is static, and orbiting is the primary 3D interaction, so the
ordering would decay from correct to reversed as the user does the one thing the
scene is built for. An ordering that is right at t=0 and silently wrong
afterwards is harder to reason about than no ordering at all.

A correct fix reorders per frame with the live camera — either inside
`ChunkedFace`, which would have to repack its buffers as the camera moves, or
through an order-independent transparency scheme. Both are renderer work.

**Measured, then accepted (2026-08-29, `gggplot-lcy.13`).** The artifact was
quantified in a rendering browser: the voxel showcase at `alpha` 0.45, orbited
through 7 camera angles, each diffed against the same angle with the box packing
order reversed. Since blend order inside one draw call _is_ packing order, any
difference between those two images is the artifact in isolation. The same build
captured twice is bit-exact at all 7 angles, so the numbers are not jitter.

|                                 |               |
| ------------------------------- | ------------- |
| mean \|delta\|                  | ~8–11 / 255   |
| max                             | 116–163       |
| pixels differing by > 32 levels | 10.8 %–15.4 % |

The error lands in the **interior intensity** of overlapping cells, not in
occlusion: no wrong silhouette, no cube visibly punching through another. That
still matters for `geom_voxel` specifically, where fill encodes count, so
composited intensity is itself a data channel and `stat_bin_3d`'s packing order
is arbitrary with respect to it.

`alphaToCoverage` was evaluated as the cheap fix and rejected. `workbench`'s raw
layers accept it, but `usePipelineOptions` gates it on
`alphaToCoverage &&
samples > 1` while `AutoCanvas` defaults to `samples = 1`,
so setting it alone is a bit-exact no-op. Raising the 3D canvas to `samples = 4`
reduces but does not remove the artifact — max 163 → 94, and > 32-level pixels
12.5 % → 9.3 % — because four samples give only five coverage levels, so
overlapping translucent layers still blend order-dependently once coverage
saturates. A ~30 % reduction is mitigation, not correctness, and it costs 4×
MSAA on every 3D canvas.

**The decision was to accept the artifact and not fund the per-frame reorder.**
It is opt-in (nothing without `alpha < 1` is affected) and bounded to interior
intensity. If it ever needs removing, the path is known: `useViewContext()`
exposes the live camera inside a live component, so a per-frame reorder inside
`ChunkedFace` is reachable — the earlier "the camera is not available" objection
applied to compile-time lowering via `LayerContext`, not to render time. For an
axis-aligned lattice the correct back-to-front order is also cheaper than a full
sort: it is one of only 8 lexicographic orderings, selected by the signs of the
view direction, so 8 precomputed index permutations would do. That is
unevaluated for performance.

## The matrix

Each row gives the mode literal, the topology it lowers to, and its non-goals.
"Non-goal" means a reading a user might reasonably expect that this geom
explicitly does **not** provide.

### 1. `segment` — and reference lines

```ts
{ dimensions: 3, requiredPosition: ["x", "y", "z", "xend", "yend", "zend"],
  stats: ["identity"], positions: ["identity"], depth: "alphaAware" }
```

Implemented. `depth` is `alphaAware`, not the `opaque` this row first proposed:
segments are lines and fade with alpha exactly as `geom_line` does, and the two
resolve identically while a layer is opaque.

- **Topology:** independent 2-vertex segments; no ordering or grouping.
- **Missing values:** any missing endpoint component drops the whole segment.
- **Camera:** none beyond the shared camera; widths stay pixel-constant.
- **Requires:** a `zend` positional aesthetic, added with this milestone. It
  trains the z scale exactly as `xend`/`yend` train x/y — without that a far
  endpoint scales outside the cube.
- **Selection:** a 3D mode is chosen only when its _whole_ position set is
  mapped. Keying on a mapped `z` alone was not enough: `geom_contour` lowers
  through the same geom and maps z as a height field, so it would have claimed
  the six-position 3D mode. A partially mapped 3D segment now names the
  aesthetics still missing rather than reporting "z is not supported", which
  would be false for a geom that does have a 3D mode.
- **Non-goals:** `abline`/`hline`/`vline` do **not** become planes. A reference
  line in 3D is a line, and a reference _plane_ is a separate primitive with its
  own parameters — as ADR 002 already states. In practice the family is
  structurally immune: each supplies its own literal data with
  `inheritAes: false`, so it never sees a plot-level `z`. Combining one with a
  3D layer reports the existing mixed-dimension error.

### 2. `polygon`, `area`, `ribbon`, `rect`, `tile`

```ts
{ dimensions: 3, requiredPosition: ["x", "y", "z"],
  stats: ["identity"], positions: ["identity"], depth: "alphaAware" }
```

Implemented for `polygon`, `area`, `ribbon`, and `rect`, each declaring the
positions it actually needs — `ribbon` takes `x`/`ymin`/`ymax`/`z`, `rect` takes
its four bounds plus `z`. `depth` is `alphaAware`; the row's original
`translucent` spelling predates the vocabulary settled in `gggplot-lcy.10`.

**`geom_tile` is excluded, and cannot be included as written.** Its `z` is
already a value channel — `stat_summary_2d` reduces a mapped `z` per cell, and
`geom_tile` declares `nonPositionalAes: ["z"]` for exactly that reason. Giving
it a `z`-based 3D mode would make a mapped `z` ambiguous between "the value to
colour by" and "the plane to sit in", which is the ambiguity this epic exists to
prevent. `geom_rect` covers the 3D rectangle case with unambiguous bounds. A 3D
tile would need a different aesthetic to carry its plane, which is a design
question rather than a missing implementation.

- **Topology:** a planar surface embedded in 3D — triangulated in its own plane,
  then placed. Vertex `z` positions the plane; it does not extrude.
- **Missing values:** a missing vertex breaks the ring; the polygon is dropped
  rather than closed across the gap, which would invent area.
- **Camera:** the first translucent content, so it forces the depth policy above
  and back-to-front sorting per frame.
- **Non-goals:** **no implicit volume.** A ribbon between two z values is two
  surfaces, not a solid. `area` in 3D does not fill down to a z floor, because
  "the floor" is a choice the grammar has not made.

### 3. `text` / `label`

```ts
{ dimensions: 3, requiredPosition: ["x", "y", "z"],
  stats: ["identity"], positions: ["identity"],
  params: { sizeMode: ["constant", "perspective"] }, depth: "alphaAware" }
```

Implemented, with two corrections to this row. The proposed `billboard`
parameter does not exist: use.gpu's `Label` is always camera-facing, so a
`billboard: false` option would be unimplementable rather than merely unbuilt.
The real knob is sizing, spelled exactly as `geom_point` spells it. And `depth`
is `alphaAware` rather than `opaque`, matching every other 3D geom.

No new renderer capability was needed — the 3D axis tick labels have been
passing vec4 world anchors to `Label` since the unified 3D work, so glyph
billboarding was already proven in production.

- **Topology:** camera-facing billboard quads at a depth-tested anchor.
- **Missing values:** a missing position or label drops the glyph. The check
  must read the _raw_ values: `ingest()` turns `NaN` into `null` and
  `scalePosition()` maps `null` onto a finite coordinate, so testing the scaled
  result alone silently places a glyph where the data had none. The 2D path
  still has that hole — filed as `gggplot-ybv`.
- **Camera:** glyphs stay screen-legible, so size is pixel-constant by default
  and `sizeMode: "perspective"` is the opt-in, matching `point`.
- **Non-goals:** no in-scene text layout, no collision avoidance, no
  occlusion-aware label placement. Overlapping labels overlap.
- **`geom_label` is excluded.** Its background box is measured in CSS pixels and
  converted through the panel's data-per-pixel ratio, which has no meaning under
  a perspective camera. A 3D label box would have to be a billboarded quad sized
  in screen space — a primitive that does not exist — so mapping z to it reports
  that rather than drawing bare glyphs and quietly losing the box.

### 4. `bar` / `col` — prisms

```ts
{ dimensions: 3, requiredPosition: ["x", "y", "z"],
  stats: ["identity"], positions: ["identity", "stack"],
  depth: "alphaAware" }   // plus a free-form `zwidth` param
```

Implemented for **`geom_col` only**, with three corrections to this row.

**There is no `depthMode` enum.** It dissolves once the second footprint axis is
treated as what it is: an ordinary mapped position. `z` gives the prism its
place, and `zwidth` gives it thickness — a free param defaulting to the scale
resolution, exactly how `width` already works on x. "Constant depth" is that
default; mapping the thickness later is an additive change needing no new mode.
Note `zwidth` is deliberately not a `dimensionalParam`, because
`GeomMode.params` is an enumerated allow-list and a thickness has no finite
value set.

**`geom_bar` is excluded.** Its default stat is `count`, and a count has no
per-`(x, z)` meaning — counting into a 3D footprint is a different statistic,
and the binned form of it is `stat_bin_3d`. `geom_col` carries pre-computed
values, which is what a prism actually needs.

**`dodge` is rejected.** Dodging splits along x, which in 3D competes with `z`
for the footprint; `identity` and `stack` are supported, and stacking groups by
the `(x, z)` cell rather than by x alone — the 2D stacker keys on x only and
would pile up prisms that share an x but sit at different depths.

- **Topology:** a rectangular prism per row. This is a **distinct 3D
  primitive**, not a z extension: a 2D bar has one categorical axis and one
  measured extent, and a prism has two categorical axes.
- **Missing values:** a missing extent drops the prism; a missing category drops
  the row before binning.
- **Depth grouping:** mapped `z` locates the second footprint axis and `zwidth`
  controls slab thickness. Stacking applies along the measured axis only; there
  is no stacking in two axes at once.
- **Non-goals:** does not imply voxel semantics. A prism is a drawn box, not an
  occupancy cell, and adjacency between prisms means nothing.

### 5. `surface` / `mesh` — height fields

```ts
{ dimensions: 3, requiredPosition: ["x", "y", "z"],
  stats: ["identity"], positions: ["identity"], depth: "alphaAware" }
```

Implemented as **`geom_surface`**, not `geom_mesh`: it triangulates by grid
adjacency and nothing else, so "mesh" would promise arbitrary topology that is
an explicit non-goal.

The proposed `shading: ["flat", "smooth"]` parameter **does not exist**, for the
same reason `billboard` did not. Smooth shading needs per-vertex normals and a
lighting model; `ChunkedFace` draws flat-coloured faces, and lighting is listed
out of scope for every row of this matrix and by ADR 002. The parameter would
have been unimplementable rather than merely unbuilt. `depth` is `alphaAware`,
matching every other 3D geom.

- **Topology:** a grid-connected height field: z = f(x, y) over a regular or
  rectilinear grid, triangulated by grid adjacency.
- **Missing values:** a missing z leaves a hole — the adjacent quads are dropped
  rather than interpolated across, which would fabricate terrain.
- **Requires:** a declared grid contract, enforced. Every combination of the
  distinct x and y values must appear exactly once; scattered input fails naming
  the row count it would have needed, and a duplicated cell fails naming its
  position. Inferring adjacency from scattered points is a triangulation problem
  this geom does not solve.
- **Non-goals:** not an isosurface, not a volume, not a general mesh format.
  Arbitrary 3D meshes belong to an extension, per ADR 002.

### 6. `bin` / `voxel` — where volume semantics begin

```ts
{ dimensions: 3, requiredPosition: ["x", "y", "z"],
  stats: ["bin3d", "identity"], positions: ["identity"], depth: "alphaAware" }
```

Specified in [DESIGN_3D_BIN_PRODUCT.md](DESIGN_3D_BIN_PRODUCT.md). Two
corrections to this row: the geom is **`geom_voxel`** (decided 2026-08-21 —
`stat_bin_3d` reduces, `geom_voxel` draws, and collapsing them would make the
geom's name a claim about statistics), and the `representation` parameter is
dropped. Once the geom is named for the representation, a parameter selecting
between "prism" and "voxel" is naming the same thing twice — and a prism is a
different geom with a different meaning, not a display mode of this one.

- **Topology:** occupancy cells on a 3D lattice, with a count or summary per
  cell.
- **Missing values:** rows with any missing position are dropped before binning,
  never binned into a "missing" cell.
- **Camera:** interior cells are invisible without translucency or slicing, so
  this is the one geom whose usefulness depends on the depth policy.
- **Sparse:** empty cells are dropped, so absence means "no observations", not
  zero. A dense lattice would cost memory proportional to bins rather than data
  and draw nothing visible for it.
- **Renderer:** implemented as packed axis-aligned boxes in one `ChunkedFace`,
  sharing the surface lowerer's `boxNode` path and alpha-aware depth props.
- **Status:** implemented. Transparent draw calls are sorted per frame; boxes
  inside the packed face retain the accepted packing-order limitation above.
- **Non-goals:** no volume rendering, no ray marching, no transfer functions, no
  isosurface extraction.

### Explicitly out of scope for every row

Lighting and shading models, shadows, picking and hit-testing, scene-graph
interchange, and faceted 3D. ADR 002 places the first four outside the decision;
faceting throws today and stays that way until its layout and interaction
contract is written.

## Completed milestone order

Ordered so that each step's data contract is settled before anything renders
against it, and so that no step promises volumetric semantics it has not
defined.

| # | Work                                         | Why here                                                                                     | Bead        |
| - | -------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------- |
| 0 | Fail on unsupported `z`                      | Every later milestone otherwise ships a new silent no-op                                     | `lcy.9` ✅  |
| 1 | `segment` + reference-line modes             | Lowest risk: existing line topology, but forces the `zend` aesthetic                         | `lcy.2` ✅  |
| 2 | Declared depth policy                        | Required before the first translucent geom, not after                                        | `lcy.10` ✅ |
| 3 | Planar surfaces: polygon, area, ribbon, rect | First translucent content; validates milestone 2. `tile` excluded — its z is a value channel | `lcy.3` ✅  |
| 4 | `text` billboards                            | Independent of 2 and 3; slot in wherever convenient                                          | `lcy.11` ✅ |
| 5 | Prisms: col                                  | First distinct 3D primitive; footprint is z + a zwidth param                                 | `lcy.8` ✅  |
| 6 | `surface`                                    | Needs the grid contract from milestone 5's footprint thinking                                | `lcy.4` ✅  |
| 7 | `stat_bin_3d` product contract               | Decide bin semantics with nothing rendering yet                                              | `lcy.5` ✅  |
| 8 | Voxel rendering                              | Only after 7                                                                                 | `lcy.6` ✅  |
| 9 | 3D interaction and visual QA                 | Needs enough geoms to be worth testing                                                       | `lcy.7` ✅  |

All milestones are complete. The table is retained to explain the dependency
order, not as a current roadmap.

### The guard against accidental volume semantics

Three rows in this matrix draw things that _look_ solid — ribbons, prisms, and
voxels — and only one of them means anything volumetric:

- A **ribbon** is two surfaces. The space between them is not filled, not
  measured, and not queryable.
- A **prism** is a drawn box whose second footprint axis comes from mapped `z`;
  `zwidth` controls its thickness. Two adjacent prisms are two marks, not a
  partitioned region.
- A **voxel** is the only occupancy cell, and it is gated behind a stat product
  contract precisely so that "this cell contains n observations" is a claim the
  grammar has actually defined before anything renders it.

Anything that would blur those lines — an `area` that fills to a z floor, a
prism grid presented as a density, adjacency treated as connectivity — is out of
scope for this epic rather than a later refinement.
