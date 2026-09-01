# Current 3D design

Status: current architecture overview\
Last verified: 2026-08-30

gggplot implements 2D and 3D through one grammar, compiler, RenderTree, live
host, and emitter. A mapped third position does not select a separate product;
the geom registry selects a dimensional realization whose contract is checked
before stats, scales, or lowering run.

This file is the current entry point. The source of truth for exact behavior is
the registry and resolver in `packages/core/src/geom/`; the focused documents
linked in [Document map](#document-map) retain detailed decisions and contracts.

## Unified pipeline

```text
ggplot + ordinary geoms
        │
        ▼
GGSpec ── resolvePlotDimension() ── stats + x/y/z scale training
        │
        ▼
shared geom lowering ── vec2 or homogeneous vec4 data-space marks
        │
        ▼
RenderTree ─┬─ GGPlot live host (OrbitControls + OrbitCamera)
            └─ emitSource standalone source
```

Projection remains on the GPU. Three-dimensional positions are packed as
`[x, y, z, 1]`; homogeneous `w` is internal and never a grammar aesthetic.
`Cartesian` normalizes the three trained position ranges and supports an `xyz`
axis permutation. Only cartesian 3D coordinates are currently supported.

## Dimension selection and validation

`GeomDefinition.modes` declares each supported realization. A mode owns its
required position aesthetics, allowed stats and positions, dimensional params,
and depth policy. `resolvePlotDimension()` computes effective mappings
(including inheritance and layer overrides), selects each layer's mode, and
rejects:

- an incomplete 3D position mapping;
- an unsupported stat, position adjustment, or dimensional parameter;
- a consumed `z` on a geom with no 3D mode;
- mixed 2D and 3D drawable layers;
- a camera on a 2D plot;
- faceted or non-cartesian 3D plots.

A mapped `z` is not globally positional. Contour and 2D summary stats consume it
as a value, `geom_tile` explicitly declares it as a non-positional value
channel, and `geom_blank` may use it only to train a scale. Those cases remain
2D.

## Shipped 3D geom modes

All modes below use the shared alpha-aware depth policy. Unless noted, they
support only `stat_identity` and `position_identity`.

| Geom      | Required positions        | Special contract                                     | Lowered topology      |
| --------- | ------------------------- | ---------------------------------------------------- | --------------------- |
| `point`   | x, y, z                   | `sizeMode`: `constant` (default) or `perspective`    | one point node        |
| `line`    | x, y, z                   | sorts within group by x                              | one chunked line node |
| `path`    | x, y, z                   | preserves input order                                | one chunked line node |
| `segment` | x, y, z, xend, yend, zend | independent endpoints                                | one chunked line node |
| `text`    | x, y, z                   | camera-facing glyphs; point-like `sizeMode`          | one label node        |
| `area`    | x, y, z                   | planar filled bands, not volumes                     | one chunked face node |
| `ribbon`  | x, ymin, ymax, z          | planar filled bands, not volumes                     | one chunked face node |
| `polygon` | x, y, z                   | grouped planar loops                                 | one chunked face node |
| `rect`    | xmin, xmax, ymin, ymax, z | planar rectangles, no extrusion                      | one chunked face node |
| `col`     | x, y, z                   | identity stat; identity or stack; `zwidth` thickness | one chunked face node |
| `surface` | x, y, z                   | complete rectangular height-field grid               | one chunked face node |
| `voxel`   | x, y, z                   | `stat_bin_3d` (default) or identity; sparse cells    | one chunked face node |

The one-node topology is covered by
`packages/core/tests/node_budget_3d_test.ts`, which also fails when a registry
mode is missing from the inventory.

## Camera, guides, and depth

The camera is separate from the coordinate system. `camera3d()` serializes an
initial perspective orbit pose; the live host seeds `OrbitControls` from it and
keeps drag/zoom state at runtime. The emitter derives the initial view from the
same canonical orbit fields. Orthographic projection is rejected until both live
and emitted paths support it.

Axes, grids, ticks, and their labels are camera-aware in-scene guides. Legends
and plot titles remain a flat screen-space overlay. Point and text sizes are
pixel-constant by default, with perspective sizing available through `sizeMode`.

Opaque marks test and write depth. If any effective alpha is below 1, the layer
still tests depth but disables depth writes and enters the transparent pass.
use.gpu sorts transparent **draw calls** back-to-front on every frame;
primitives packed inside one `ChunkedFace` remain in packing order. This is a
measured and accepted limitation for translucent surfaces and voxels. Opaque
content is not affected. There is no internal per-frame primitive reorder or
order-independent-transparency implementation.

## Sparse bins and voxels

`stat_bin_3d` requires numeric x, y, and z, drops rows with missing positions,
and emits occupied cells only. V1 does not support weights, arbitrary summary
functions, mapped value reductions, or group carry-through. Each output row has
the three cell centers, `count`, volume-normalized `density`, and
`binWidthX`/`binWidthY`/`binWidthZ`.

`geom_voxel` lowers those cells to packed axis-aligned boxes in a `ChunkedFace`.
`padding` may shrink boxes for legibility without changing the represented bins.
This is occupancy rendering, not volume rendering: ray marching, transfer
functions, interpolation, isosurfaces, and semantic connectivity between
adjacent cells are out of scope.

## Current limits

- No mixed 2D/3D panels or faceted 3D plots.
- No non-cartesian 3D coordinates or orthographic camera.
- No lighting, shadows, picking, hit-testing, arbitrary mesh interchange, or
  general scattered-point triangulation.
- No implicit volume semantics for planar geoms or prisms.
- Translucent primitives within one packed draw retain packing-order blending.

## Document map

- [ADR 002](ADR_002_3D_AND_EXTENSION_BOUNDARIES.md) owns the accepted boundary
  between core 3D grammar and extension-only scene capabilities.
- [3D geom matrix](DESIGN_3D_GEOM_MATRIX.md) records executable per-geom
  contracts, rationale, topology, and the accepted transparency measurement.
- [3D bin product](DESIGN_3D_BIN_PRODUCT.md) is the source-cited
  `stat_bin_3d`/`geom_voxel` product contract.
- [Migrating the 3D API](MIGRATING_3D_API.md) maps removed preview names onto
  the shared public API.
- [3D grammar considerations](DESIGN_3D_CONSIDERATIONS.md) preserves the
  decision record that led to the current architecture; historical paths and
  names in its earlier sections are not current API guidance.
- [Archived in-core spike](design-history/DESIGN_3D_IN_CORE.md) describes the
  retired parallel implementation that preceded unification.
