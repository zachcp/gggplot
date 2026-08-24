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

The rule: if `z` is mapped and *nothing* consumes it, throw
`geom_<name> has no 3D mode; z is not supported`. A caller who genuinely wants
z ignored can drop it from the mapping.

"Nothing consumes it" turned out to be subtler than "the mode does not require
it". `z` is a legitimate non-positional aesthetic in three other places, and
the first draft of this rule broke all of them:

- **The stat reads it as a value.** `contour` and `contour_filled` take z as a
  height field; `summary_2d`, `summary_hex`, and `summary_bin` reduce it per
  cell. Whether z is positional is therefore a property of the *stat*, not the
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
three already derived `depthWrite: !transparent` from observed alpha, and did
so correctly.

The real gap was that they each derived it *separately*, so the planar surfaces
in milestone 3 would have been the third copy of the same rule. Depth is now a
declared part of the mode, resolved through one shared `depthProps()`:

```ts
depth?: "opaque" | "alphaAware" | "overlay";
```

| Policy | depthTest | depthWrite | Notes |
| --- | --- | --- | --- |
| `opaque` | on | on | Always writes; a translucent tint cannot silently disable occlusion |
| `alphaAware` | on | off *when any alpha < 1* | The effective policy depends on the data, so a mode declares the capability, not the outcome |
| `overlay` | **off** | off | Sits on top of the scene regardless of position |

Omitting the policy means `alphaAware`: writing depth for genuinely
translucent content produces visible blending artifacts, while the reverse
costs nothing, so the forgiving reading is the safe default.

**Back-to-front draw order already works, at the draw-call level.** This
section previously claimed nothing sorted translucent geometry. That was wrong.

use.gpu's colour pass draws opaque calls, then transparent ones, and passes
`sign = -1` to `drawToPass` for the transparent set
(`@use-gpu/workbench/pass/color-pass`). `drawToPass` sorts renderables by a
culler-computed depth and that sign reverses the comparison, which is a
back-to-front sort, recomputed every frame as the camera moves. The raw
primitives supply the `bounds` that depth is derived from — `raw-faces`
computes it from transformed positions and hands it to the renderable — so
gggplot's marks participate without doing anything.

Two real limits remain, and both matter for the same geom:

- **The sort is per draw call, not per primitive.** Renderables are ordered
  against each other; the instances inside one of them are not. A voxel lattice
  is a single instanced draw containing thousands of mutually overlapping
  boxes, so it gets no internal ordering. Filed as `gggplot-lcy.13`.
- **`PrismInstances3D` never enters the transparent pass.** It hardcodes
  `mode: "opaque"` with both depth flags on, so prism and voxel content is
  excluded from the sorted set entirely until it takes the layer's resolved
  depth props. That change belongs to `gggplot-lcy.6`.

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
- **Selection:** a 3D mode is chosen only when its *whole* position set is
  mapped. Keying on a mapped `z` alone was not enough: `geom_contour` lowers
  through the same geom and maps z as a height field, so it would have claimed
  the six-position 3D mode. A partially mapped 3D segment now names the
  aesthetics still missing rather than reporting "z is not supported", which
  would be false for a geom that does have a 3D mode.
- **Non-goals:** `abline`/`hline`/`vline` do **not** become planes. A reference
  line in 3D is a line, and a reference *plane* is a separate primitive with
  its own parameters — as ADR 002 already states. In practice the family is
  structurally immune: each supplies its own literal data with
  `inheritAes: false`, so it never sees a plot-level `z`. Combining one with a
  3D layer reports the existing mixed-dimension error.

### 2. `polygon`, `area`, `ribbon`, `rect`, `tile`

```ts
{ dimensions: 3, requiredPosition: ["x", "y", "z"],
  stats: ["identity"], positions: ["identity"], depth: "alphaAware" }
```

Implemented for `polygon`, `area`, `ribbon`, and `rect`, each declaring the
positions it actually needs — `ribbon` takes `x`/`ymin`/`ymax`/`z`, `rect`
takes its four bounds plus `z`. `depth` is `alphaAware`; the row's original
`translucent` spelling predates the vocabulary settled in `gggplot-lcy.10`.

**`geom_tile` is excluded, and cannot be included as written.** Its `z` is
already a value channel — `stat_summary_2d` reduces a mapped `z` per cell, and
`geom_tile` declares `nonPositionalAes: ["z"]` for exactly that reason. Giving
it a `z`-based 3D mode would make a mapped `z` ambiguous between "the value to
colour by" and "the plane to sit in", which is the ambiguity this epic exists
to prevent. `geom_rect` covers the 3D rectangle case with unambiguous bounds.
A 3D tile would need a different aesthetic to carry its plane, which is a
design question rather than a missing implementation.

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
  must read the *raw* values: `ingest()` turns `NaN` into `null` and
  `scalePosition()` maps `null` onto a finite coordinate, so testing the scaled
  result alone silently places a glyph where the data had none. The 2D path
  still has that hole — filed as `gggplot-ybv`.
- **Camera:** glyphs stay screen-legible, so size is pixel-constant by default
  and `sizeMode: "perspective"` is the opt-in, matching `point`.
- **Non-goals:** no in-scene text layout, no collision avoidance, no
  occlusion-aware label placement. Overlapping labels overlap.
- **`geom_label` is excluded.** Its background box is measured in CSS pixels
  and converted through the panel's data-per-pixel ratio, which has no meaning
  under a perspective camera. A 3D label box would have to be a billboarded
  quad sized in screen space — a primitive that does not exist — so mapping z
  to it reports that rather than drawing bare glyphs and quietly losing the
  box.

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
  stats: ["bin_3d"], positions: ["identity"], depth: "alphaAware" }
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
- **Missing values:** rows with any missing position are dropped before
  binning, never binned into a "missing" cell.
- **Camera:** interior cells are invisible without translucency or slicing, so
  this is the one geom whose usefulness depends on the depth policy.
- **Sparse:** empty cells are dropped, so absence means "no observations", not
  zero. A dense lattice would cost memory proportional to bins rather than
  data and draw nothing visible for it.
- **Renderer:** reuses the existing `PrismInstances3D` primitive, which already
  draws instanced filled boxes from `{ center, size, color }`. It needs the
  resolved depth props rather than its current hardcoded opaque mode.
- **Blocked on:** the contract above, now written, and on `gggplot-lcy.12` —
  a lattice is nothing but overlapping depth ranges, so voxels are the geom
  that makes back-to-front sorting visible.
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
| 0 | Fail on unsupported `z` | Every later milestone otherwise ships a new silent no-op | `lcy.9` ✅ |
| 1 | `segment` + reference-line modes | Lowest risk: existing line topology, but forces the `zend` aesthetic | `lcy.2` ✅ |
| 2 | Declared depth policy | Required before the first translucent geom, not after | `lcy.10` |
| 3 | Planar surfaces: polygon, area, ribbon, rect | First translucent content; validates milestone 2. `tile` excluded — its z is a value channel | `lcy.3` ✅ |
| 4 | `text` billboards | Independent of 2 and 3; slot in wherever convenient | `lcy.11` ✅ |
| 5 | Prisms: bar, col | First distinct 3D primitive; needs the footprint decision, not just z | `lcy.8` |
| 6 | `surface`/`mesh` | Needs the grid contract from milestone 5's footprint thinking | `lcy.4` |
| 7 | `stat_bin_3d` product contract | Decide bin semantics with nothing rendering yet | `lcy.5` ✅ |
| 8 | Voxel rendering | Only after 7 | `lcy.6` |
| 9 | 3D interaction and visual QA | Needs enough geoms to be worth testing | `lcy.7` |

Milestone 0 is done; the rest are beaded and dependency-ordered.

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
