# Design: 3D geoms in core (`core/src/geom_3d`)

> Historical design spike. The parallel `core/src/geom_3d` implementation was
> retired by `gggplot-4q2.13`; see [MIGRATING_3D_API.md](MIGRATING_3D_API.md)
> for the unified `GGSpec`/`compile`/`GGPlot`/`emitSource` API. The superseded
> `packages/3d` CPU-projection extension was retired by `gggplot-4q2.5`.

**Status: design spike (`gggplot-4q2.1`).** Supersedes the "3D is a separate
extension package" posture of `ADR_002` (see §7).

**Scope note:** this file covers the **data** path (pack → lower → render →
emit), which has landed. Everything 3D adds that the 2D grammar has no analog
for — transforms, cameras, depth/occlusion, mark sizing, 3D guides — is
deliberately _not_ settled here; see **`DESIGN_3D_CONSIDERATIONS.md`**
(`gggplot-4q2.8`) for that open planning work. Several behaviours in the shipped
slice are accidental rather than designed and are audited there.

## 1. Goal and constraints

Bring 3D plotting into `packages/core` as a first-class citizen of the flat,
GPU-native pipeline, instead of the current bolt-on `packages/3d` extension.
Constraints set by the project owner:

- **Same separation as 2D:** mark data lives in flat-native `FlatTensor`s;
  projection happens on the GPU, not the CPU.
- **Same emission ergonomics as 2D** (`emitSource` static-import pattern),
  extended with the extra dimension(s).
- **Keep all logic in `core` + `reductions`** until the shape is proven — no new
  package yet.
- Lowering/emission follow the same pattern as 2D.

## 2. Two findings that make this cheap

1. **use.gpu's view is already 3D/4D.** The 2D chart mounts `Plot.Cartesian`
   with a **4-component range** `[[-1,1],[-1,1],[-1,1],[-1,1]]` and `mat4`
   transforms (`render/GGPlot.tsx`, `FacetPanel`). The 2D pipeline is the
   _degenerate flat-z_ case of a projector that is already 3D. A 3D geom fills
   the real `z` range and adds a camera matrix into the same `MatrixContext`
   chain.
2. **`@use-gpu/plot` is already a 3D plot library.** It exports `Cartesian` (3D
   range), `Point`/`Line`/`Face`/`Polygon`/`Sampled`/`ImplicitSurface`,
   `Axis`/`Grid`, and 3D traits (`Loop3DTrait`, `Object4DTrait`). We do not need
   a new renderer — only to drive these with flat tensors + a camera.

The current `packages/3d` uses **none** of this: `compile.ts` calls
`projectPoint()` to collapse each `(x,y,z)` to NDC on the **CPU**, then feeds a
2D `Plot.Point`. That is the one thing this epic deletes.

## 3. The 2D pipeline (what we mirror)

```
GGSpec → stat(applyStat) → geom lowering (geom/*.ts)
       → FlatTensor packing (geom/packing.ts: packScalar/packColorsRGBA/packMarkRows…)
       → RenderTree nodes (ir RenderNode: "Point"/"Line"/"Face"…)
       → { live:  render/GGPlot.tsx → Plot.Embedded + Cartesian(range,matrix) + marks
           emit:  emit/mod.ts → static-import JSX of the same Plot marks }
```

Projection is entirely in the view: the RenderTree carries **data-space**
positions; `Cartesian`'s `range` + `MatrixContext` `mat4` map them to clip space
on the GPU. Scales train `x`/`y` domains (`scale/training.ts`) which become the
`range`.

## 4. The 3D analog (stage by stage)

| Stage      | 2D                                     | 3D (`geom_3d`)                                                                                         |
| ---------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Aes        | `x,y` position                         | add **`z`** position aesthetic (`AesName`, `PositionAxis`)                                             |
| Geom kind  | flat `GeomKind` union                  | 3D kinds (`point_3d`, `line_3d`, `path_3d`, `surface`) — see §5 for union-vs-registry                  |
| Pack       | `packMarkRows` → vec2 positions        | `packMarkRows3d` → **vec3/vec4** positions with real z (reuse `packScalar`/`packColorsRGBA` unchanged) |
| RenderTree | `node("Point", {positions,…})`         | same node shapes; positions are 3-wide; a `dimensions: 3` tag                                          |
| Scales     | train x/y domains                      | train **z** domain too → 3-axis `range` `[[x…],[y…],[z…]]`                                             |
| View       | `Cartesian(range2d, matrix)`           | `Cartesian(range3d, cameraMatrix)` — projection on GPU                                                 |
| Camera     | implicit (identity-ish)                | explicit **camera coord** → view/projection `mat4` (§6)                                                |
| Live       | `Plot.Point` etc.                      | same `Plot.Point`/`Line`/`Face`, now with 3D positions + camera                                        |
| Emit       | static-import JSX + serialized tensors | identical, plus serialized camera + 3-axis range                                                       |

The packing primitives in `geom/packing.ts` are dimension-light: `packScalar`,
`packColorsRGBA`, `expandByOwners`, `concatFlatTensors` are reusable as-is. Only
the position packer needs a vec3 variant.

## 5. Module layout — `core/src/geom_3d/`

Mirror `geom/`:

```
core/src/geom_3d/
  types.ts      # Geom3DKind, Camera, Render3DNode contract
  packing.ts    # packPoints3d (vec3/vec4); re-export shared 2D packers
  camera.ts     # view/projection mat4 builders (ported from packages/3d/camera.ts,
                # rewritten to RETURN a matrix, not project points)
  point.ts      # geom_point_3d (first geom)
  mod.ts        # GEOM3D_REGISTRY barrel
```

**Open decision A — geom kinds:** extend the existing `GeomKind` union with
`point_3d`/… vs. a parallel `Geom3DKind` + `GEOM3D_REGISTRY`. Recommendation:
**parallel registry** initially (keeps the 2D `GeomKind` exhaustiveness checks
and residency logic untouched while the 3D contract is still fluid), unify later
if it proves to be the same shape.

## 6. Camera as a coord

`Coord` uses `{ kind: "cartesian"|"polar", axes?: string }`, with `"xy"` and
`"yx"` as the 2D swizzles and `PositionAxis = "x"|"y"|"z"`. For 3D:

- validate `Coord.axes` as a permutation of `xyz` (homogeneous `w` stays
  internal);
- model the camera as a coord — either a new `CoordKind` (`"cartesian3d"`) or a
  `camera` param block on a cartesian coord:
  `{ projection, position, target,
  up, fov/orthoHeight, near, far }` (the
  existing `PointCloudCamera` shape).
- The camera lowers to a **view·projection `mat4`** built by the ported
  `camera.ts` (`resolveCamera` + the basis-vector math already there), pushed
  into `MatrixContext` exactly like `FacetPanel`'s `matrix`. Points stay in data
  space; the GPU applies camera × range. **No `projectPoint` per row.**

## 7. Relationship to `ADR_002`

`ADR_002` scoped 3D as a _separate extension package_ behind the plan registry,
to keep core's `GeomKind`/renderer 2D. Bringing 3D into core reverses that for
the **geom/render** boundary while keeping the extension registry itself (now
covered by synthetic core conformance tests). This doc superseded that part of
ADR_002; `gggplot-4q2.5` amended the ADR and retired `packages/3d` rather than
preserve its parallel spec, camera, CPU projection, and emitter.

## 8. Reductions

3D stats that are heavy and griddable (3D binning/voxel density, 3D KDE for
`ImplicitSurface`) belong in `packages/reductions` next to the 1D/2D reducers,
following the CPU-reference-then-resident pattern. Out of scope for the first
geom. `gggplot-4q2.5` added no reducer: a true volumetric grammar/render product
must be specified first; see `REDUCTIONS_COMPONENTS.md`.

## 9. First slice (`gggplot-4q2.2`)

`geom_point_3d`: pack `(x,y,z)` into a vec3/vec4 FlatTensor, train a z domain,
mount `Plot.Cartesian` with a 3-axis range + a fixed camera matrix, render
`Plot.Point`. Prove: (a) data-space positions with GPU projection (no CPU
projection), (b) `emitSource` parity, (c) it reuses the 2D packers/scales
unchanged where possible. Everything else (line/surface, camera-as-coord DSL,
reducers, `packages/3d` migration) follows once this slice validates the shape.

## 10. Decisions

- **A. RESOLVED (2026-07-20):** parallel `Geom3DKind` + `GEOM3D_REGISTRY`, kept
  separate from the 2D `GeomKind` while the contract is fluid; unify later if
  identical. `geom_3d` is built as a self-contained parallel module
  (`compile3d`/`render3d`/`emit3d`) so the mature 2D pipeline is untouched.
- **B. RESOLVED (2026-07-20):** camera lives as an optional `camera` param block
  on a **cartesian** coord (no new `CoordKind`), lowering to a view·projection
  `mat4` pushed into `MatrixContext`.
- **C. RESOLVED (2026-08-01):** retire `packages/3d`; retain the independently
  tested generic extension registry.
- **D.** DSL ergonomics (`geomPoint3d`, `coordCamera`/`scaleZ` naming) — settle
  as the DSL surface lands.

```
```
