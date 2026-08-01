# Migrating the 3D API

The preview-only parallel 3D surface was removed when 2D and 3D joined the same
grammar. There is no separate 3D spec, geom name, compiler, renderer, or
emitter. Dimensionality is selected from the effective aesthetic mapping.

```ts
const spec = ggplot(data, {
  x: "x",
  y: "y",
  z: "z",
  color: "series",
}).add(
  geomPoint(),
  geomPath(),
  camera3d({ bearing: 0.8, pitch: 0.45 }),
  scaleZContinuous({ nBreaks: 4 }),
  labels({ z: "Depth" }),
).build();

const tree = compile(spec);
const source = emitSource(tree);
// Live: <GGPlot spec={spec} />
```

The removed preview names map as follows:

| Removed preview API            | Shared replacement                     |
| ------------------------------ | -------------------------------------- |
| `Point3DSpec`                  | `GGSpec` built with `ggplot(...)`      |
| `geom: "point_3d"`             | `geomPoint()` with mapped `z`          |
| `compile3d(spec)`              | `compile(spec)`                        |
| `GGPlot3D` / `GGPlot3DOverlay` | `GGPlot` (the two passes are internal) |
| `emitPoint3dSource(node)`      | `emitSource(compile(spec))`            |
| `Point3DSpec.coord.axes`       | `coordCartesian({ axes: "xzy" })`      |
| `Point3DSpec.guides.grid`      | `theme({ grid: false })`               |
| `Point3DSpec.guides.axes`      | `theme({ axes: false })`               |
| `Point3DSpec.guides.titles`    | `theme({ axisTitles: false })`         |
| `Point3DSpec.guides.tickCount` | `scaleX/Y/ZContinuous({ nBreaks })`    |

`camera3d()` is a singleton spec component: a later declaration replaces an
earlier one. Omit it for the standard three-quarter perspective view. Camera
interaction remains runtime state and does not mutate the serialized spec.

The first shared 3D modes are `geomPoint()`, `geomLine()`, and `geomPath()`.
Their 3D realizations require identity stats and positions; unsupported
combinations fail during dimensional resolution instead of silently falling back
to 2D.
