# ADR 002: 3D grammar and extension boundaries

Status: accepted (architecture only)\
Date: 2026-07-17

## Decision

Core owns the serializable grammar, extension metadata, registry validation,
camera/projection interfaces, and backend conformance rules. Optional,
statically imported packages own 3D geoms and renderer adapters. There is no
runtime package discovery and serialized plots never contain JavaScript
functions, shader closures, GPU handles, or package URLs.

An extension is identified by a versioned string such as
`@gggplot/3d:geom_point_cloud@1`. A host explicitly imports the package and
registers its declarative `ExtensionDefinition` plus separately typed CPU, GPU,
Live-render, and emitted-source adapters. Registration rejects duplicate
identifiers, unknown major versions, missing capabilities, and metadata that
does not match the adapter. Minor additions must remain backward compatible; a
semantic or port-layout change requires a new major identifier. Deserialization
resolves identifiers against the host registry and fails with an actionable
missing-extension error.

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

Positions, facets, scales, and coordinates do not gain generic 3D behavior by
accepting z. A 3D coordinate declares camera, projection, clipping, handedness,
depth range, and interaction policy. A 3D position declares all affected axes.

## Point-cloud vertical slice

The first package contract is deliberately narrow:

```ts
interface PointCloudLayerIR {
  extension: "@gggplot/3d:geom_point_cloud@1";
  mapping: { x: string; y: string; z: string; color?: string; size?: string };
  params: { opacity?: number; depthTest?: boolean };
}

interface PointCloudRenderNode {
  component: "@gggplot/3d:PointCloud@1";
  props: {
    positions: Float32Array; // packed xyz
    colors?: Float32Array;
    sizes?: Float32Array;
    camera: {
      projection: "perspective" | "orthographic";
      near: number;
      far: number;
    };
  };
  children: [];
}
```

The package registers the geom definition, lowering adapter, Live component, and
emitter import. Core validates x/y/z numeric fields and version/capability
compatibility. The package owns packed buffers, camera defaults, depth-tested
point rendering, and its conformance fixture. Export uses the same mounted
render tree, so it introduces no separate 3D export path.

## Consequences and sequence

1. Implement the static versioned registry and backend adapter contracts
   (`gggplot-9gj`). `ExtensionRegistry` now implements this boundary: it
   validates JSON-only definitions, exact major identifiers, declared adapter
   capabilities, duplicate registration, and shared Live/emitter resolution.
2. Only then implement the optional point-cloud package and its conformance
   vertical slice (`gggplot-74p`).
3. Add further 3D primitives only when their topology, statistic, camera, and
   occlusion semantics are explicit; adding `z` to every geom is not parity.

This reuses the existing `ExtensionDefinition` and portable plan vocabulary, but
does not claim that the current registry/runtime implementation is already
complete.
