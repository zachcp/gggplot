# 3D bin product: `stat_bin_3d` and `geom_voxel`

Status: specification for `gggplot-lcy.5`\
Date: 2026-08-21

Implementation is `gggplot-lcy.6`, which is deliberately sequenced after this
document so that "this cell contains n observations" is a claim the grammar has
defined before anything renders it.

## Naming

**`stat_bin_3d` is the statistic; `geom_voxel` is the geom.** Decided
2026-08-21.

The two names describe different things and keeping them separate is the point.
`bin_3d` is a reduction — assign observations to lattice cells and count them.
`voxel` is a representation — a drawn occupancy cell. Collapsing them into one
`geom_bin_3d` would make the geom's name a claim about statistics, which is
exactly the confusion this epic is trying to avoid: a prism is a drawn box, and
only a voxel carries occupancy meaning.

This mirrors the 2D split the codebase already has, where `stat_summary_2d`
reduces and `geom_tile` draws.

### No 2D `geom_bin` alias

`geom_bin2d` already exists and means rectangular 2D binning. Adding a bare
`geom_bin` alias would give the codebase three spellings for binning
(`bin2d`, `bin`, `voxel`), and a name whose dimensionality is implicit is
exactly the kind that gets mapped a `z` and silently ignored — the failure mode
`gggplot-lcy.9` was filed to eliminate. Recommend **no alias**.

## The product is sparse

**Empty cells are dropped.** This is the load-bearing decision.

A dense lattice at the 2D default of 30 bins per axis is 27,000 cells in 3D,
and a real point cloud leaves the overwhelming majority empty. Retaining them
would cost memory and draw calls proportional to the lattice rather than the
data, and would draw nothing visible for the trouble — an empty cell has no
count to encode.

Dropping matches `stat_summary_2d`, which already emits one row per occupied
cell rather than one per lattice site. A `drop: false` parameter is
**deliberately not offered** until a use case exists; adding it later is
additive, and shipping it now would mean supporting a dense mode nothing asks
for.

The consequence to state plainly: **absence is not zero**. A missing cell means
"no observations landed here", and a consumer that needs zeros must generate
the lattice itself.

## Serializable product schema

`stat_bin_3d` emits one row per occupied cell, in the same column-frame shape
every other stat produces:

| Column | Meaning |
| --- | --- |
| *(x column name)* | Cell center on x, named for the mapped column, as `stat_summary_2d` does |
| *(y column name)* | Cell center on y |
| *(z column name)* | Cell center on z |
| `count` | Observations in the cell; always present |
| `density` | `count / (total × cellVolume)`; present when requested |
| `value` | Summary of a mapped value column, when `fun` is supplied |
| *(group columns)* | Carried through unchanged, one cell per group |

Cell geometry is not emitted per row. The lattice is regular, so the three bin
widths and the three origins describe every cell and belong in the layer's
resolved parameters rather than repeated across thousands of rows.

### Density has a volume divisor

`density` divides by `cellVolume = xWidth × yWidth × zWidth`, not by a cell
count and not by an area. This is worth stating because the wrong divisor still
produces a plausible-looking number: a 2D-style area divisor yields values that
are internally consistent, monotone in count, and wrong by a factor with units
of length. The test for this must compare against a hand-computed value with
known bin widths, not merely check that density rises with count.

## Parameters

Mirrors the 2D binning vocabulary so a reader who knows `stat_summary_2d` can
predict this:

| Parameter | Meaning |
| --- | --- |
| `bins` | Bin count per axis; scalar or `[x, y, z]` |
| `binwidth` | Width per axis; scalar or `[x, y, z]`. Overrides `bins` |
| `boundary` | Bin edge alignment; scalar or `[x, y, z]` |
| `fun` | Optional summary over a mapped value column, producing `value` |

Scalar-or-triple is the existing 2D convention (`params.binwidth` already
accepts a scalar or a pair), extended by one axis.

## CPU reference reducer

The reference implementation is a single pass, and its shape follows
`statSummary2d` closely enough to be reviewed against it:

1. Require numeric `x`, `y`, and `z` mappings; throw naming all three if any is
   missing, as the 2D stats do.
2. Drop rows where any of x, y, z is non-finite. **Read the raw values, not the
   scaled ones** — `ingest()` turns `NaN` into `null` and a later scale maps
   `null` onto a finite coordinate, which is the bug `gggplot-ybv` records for
   `geom_text`. A row with a missing position is never binned into a "missing"
   cell.
3. Resolve per-axis width and origin from `bins`/`binwidth`/`boundary` against
   the finite extent.
4. Assign each row a cell index triple, keyed with any group columns.
5. Accumulate count, and the value list when `fun` is supplied.
6. Emit one row per occupied cell with centers, `count`, and optionally
   `density` and `value`.

Degenerate extents — every observation sharing an x, for instance — collapse to
a single bin on that axis rather than dividing by a zero width.

## Renderer topology

**Voxels reuse the existing prism primitive.** `PrismInstances3D`
(`packages/core/src/render/prism_instances_3d.tsx`) already draws instanced,
axis-aligned, filled boxes from `{ center, size, color }` — which is exactly a
voxel. It was built for the model-inspection scene, and nothing about it is
model-specific.

One change is required: it currently hardcodes `mode: "opaque"` with
`depthTest` and `depthWrite` both true. Voxels need the resolved depth props
from the layer's declared policy, because interior cells are invisible without
translucency.

That makes the dependency chain concrete:

- `geom_voxel` declares `depth: "alphaAware"`, so a voxel layer with alpha
  becomes translucent.
- Translucent boxes overlap heavily by construction — a lattice is nothing but
  overlapping depth ranges — so correct blending needs the back-to-front sort
  from `gggplot-lcy.12`. Voxels are the geom that makes that sort visible.

Sizing: one instance per occupied cell, `size` set to the three bin widths so
cells tile exactly, `center` at the emitted cell center. A `padding` parameter
shrinking each box slightly is worth considering during implementation — it
makes individual cells legible in a dense lattice — but it is a rendering
affordance, not part of the stat contract.

## Domain and scale behavior

Cell centers train x, y, and z through the ordinary position scales. The
extents must widen each domain by half a bin width on each side, or the outer
half of every boundary cell falls outside the cube. `geom_tile` already does
exactly this through `domainContribution`, and `geom_voxel` should use the same
hook rather than a special case.

## What this does not promise

No volume rendering, no ray marching, no transfer functions, no isosurface
extraction, and no interpolation between cells. A voxel is an occupancy cell
with a count; adjacency between voxels carries no meaning beyond adjacency of
their bins.
