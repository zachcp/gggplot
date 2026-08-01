# ADR 002: 3D grammar and extension boundaries

Status: accepted; amended after unified 3D implementation\
Date: 2026-07-17; amended 2026-08-01

## Decision

Core owns dimensionality as part of the ordinary serializable grammar. A mapped
positional `z` selects a geom's 3D mode; the same `geomPoint()`, `geomLine()`,
`geomPath()`, `compile()`, renderer, and `emitSource()` APIs serve 2D and 3D.
`camera3d()` is the one optional singleton camera component. It resolves a
complete canonical default and supports partial named overrides, so plots need
no camera declaration for the common case and serialize exactly one camera
when customized.

The extension registry remains available for specialized geoms whose topology
or policy does not belong in core, but 3D itself is not an extension boundary.
There is no runtime package discovery and serialized plots never contain
JavaScript functions, shader closures, GPU handles, or package URLs. Extension
registration continues to reject duplicate identifiers, incompatible versions,
missing capabilities, and metadata that does not match its adapter.

This static model is dependency injection, not a security boundary. Extension
code has the authority of the importing application. Sandboxing untrusted
packages, dynamic discovery, lighting systems, picking, and general scene-graph
interchange are outside this decision.

## Geom compatibility matrix

“z extension” preserves the 2D geom's statistical meaning while adding depth.
“3D primitive” needs a distinct topology or ambiguity-resolving name. “N/A”
means z does not add a stable visual/statistical contract.

| Current family                                  | Classification                           | 3D contract                                                                       |
| ----------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| point, text                                     | z extension                              | point cloud / billboard labels with depth testing                                 |
| line, path, segment, smooth, abline/hline/vline | z extension                              | polyline or segment positions carry z; reference planes need explicit parameters  |
| polygon, area, ribbon, rect, tile               | z extension                              | planar surface embedded in 3D; no implicit volume                                 |
| bar, col, histogram, dotplot                    | distinct 3D primitive                    | prism/voxel topology; must name depth grouping and occlusion semantics            |
| density, violin, boxplot, errorbar              | z extension only as positioned 2D glyphs | z locates the glyph plane; it does not invent a 3D statistic                      |
| hex, bin2d, contour, contour-filled             | z extension                              | scalar height-field or positioned plane; volume contours are a separate primitive |
| QQ and ellipse                                  | N/A by default                           | z requires a separately defined multivariate statistic                            |
| raster                                          | N/A by default                           | texture placement belongs to a surface primitive                                  |

Position scales share one x/y/z trainer and scale DSL. Coordinates share the
same `coordCartesian()` component, including validated axis swizzles. Faceted
3D remains unsupported until its layout/interaction contract is explicit.
Camera projection, clipping, and interaction are resolved by the singleton
camera component and runtime scene rather than a parallel coordinate grammar.

## Point-cloud vertical slice

The original `@gggplot/3d` point-cloud extension was a useful architecture
spike, but it CPU-projected coordinates and required a second spec, compiler,
camera, renderer, emitter, and export API. The unified core path supersedes it:

```ts
ggplot(data, { x: "x", y: "y", z: "z", color: "group" })
  .add(geomPoint(), camera3d({ bearing: 0.8 }))
  .build();
```

Omit `camera3d()` for the standard three-quarter view. Core packs vec4
positions, trains z with the same position-scale machinery as x/y, projects on
the GPU, renders depth-tested marks, and emits the same RenderTree. The legacy
package is retired rather than shimmed because preserving its incompatible
camera/spec types would make the public API less consistent.

## Consequences and sequence

1. `ExtensionRegistry` continues to validate JSON-only definitions, exact major
   identifiers, declared adapter capabilities, duplicate registration, and
   shared Live/emitter resolution.
2. The unified core point/line/path slice is the reference 3D contract; see
   `MIGRATING_3D_API.md` for the removed parallel API.
3. Add further 3D modes only when topology and occlusion semantics are explicit.
   A z-positioned 2D stat is not automatically a volumetric statistic.
4. Do not add a 3D reducer merely for dimensional symmetry. True voxel/bin3d,
   density-volume, or isosurface work first needs a named grammar product and a
   renderer that can consume its GPU-resident output.
