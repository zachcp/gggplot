# 3D grammar considerations (planning)

**Status: decisions recorded inline per section.** Companion to
`DESIGN_3D_IN_CORE.md`, which covered the _data_ path (pack → lower → emit).
This file covers everything 3D adds that the 2D grammar has no analog for:
**transforms, cameras, depth/occlusion, mark sizing, axes/guides**. Transforms
(§2), coords (§3), cameras (§4), depth/transparency (§5), sizing (§6), and
guides (§7) are all **decided** (gggplot-4q2.8.1/.2/.3/.4/.5). The 3D grammar
model is settled; what remains is implementation, tracked separately.

## 0. Why this document exists

The first 3D slice was built by analogy to the 2D data path and then made to
render by trial-and-error. It works, but several of its behaviours were _chosen
accidentally_ rather than designed (§5). Before extending 3D we need to decide
the model deliberately, against what use.gpu actually offers.

## 1. What use.gpu actually gives us

Read from `@use-gpu/plot/mjs/traits.mjs` + `util/{swizzle,compose}.mjs` and
`@use-gpu/workbench` camera sources. These are the real primitives:

| Trait                     | Props                                                         | What it controls                                                                                            |
| ------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `AxesTrait`               | `axes` (swizzle, default `'xyzw'`), `range` (3 ranges)        | Which **data** axis feeds which **output** axis, plus the data→cube box. `Cartesian` uses this.             |
| `Axes4DTrait`             | `axes`, `range` (4 ranges)                                    | Same, 4D.                                                                                                   |
| `ObjectTrait`             | `position`, `scale`, `rotation`, `quaternion`, `matrix`       | A full **TRS + matrix transform on any node**.                                                              |
| `Object4DTrait`           | vec4 `position`/`scale`, left/right quaternions, `matrix`     | 4D/projective transform.                                                                                    |
| `ROPTrait`                | `depthTest`, `depthWrite`, `blend`, `alphaToCoverage`, `mode` | **Depth + transparency** (raster ops).                                                                      |
| `PointTrait`              | `size`, `depth`                                               | Mark size, and whether size is **pixel-constant or perspective-scaled**.                                    |
| `LineTrait`               | `width`, `depth`                                              | Same for lines.                                                                                             |
| `AxisTrait` / `GridTrait` | `axis`/`axes`, `range`, `zBias` (+ `Grid`'s `origin`, `auto`) | 3D axis + grid guides. `Grid axes` is a **2-axis pair**; `auto` culls the camera-facing face **in-shader**. |

Cameras (`@use-gpu/workbench`):

- `OrbitCamera` —
  `bearing, pitch, roll, radius, target, fov, near, far,
  dolly, focus, scale`.
  Provides **only** `ViewProvider` (view/projection uniforms). Not
  `LayoutContext`.
- `LookAt` — converts `position`/`target` into orbit props.
- `FlatCamera` (2D) — provides `LayoutContext` **and** `ViewProvider`.
- `Cartesian` builds the data→[-1,1] mat4 and provides `MatrixContext`,
  `RangeContext`, `TransformContext`. It needs **no** `LayoutContext`.
- `Plot` = `SDFFontProvider` + `VirtualLayers`; **requires a `FontContext`**
  (supply `FontLoader`).
- `@use-gpu/interact` (`OrbitControls`, `Cursor`) is installed (`^0.20.0`) and
  wired: `OrbitControls` owns the live orbit view (drag/zoom), seeded from the
  spec's initial camera (gggplot-4q2.8.1, Q11).

## 2. The new concern: transforms

2D gggplot has no notion of placing a layer _in space_. `ObjectTrait` means
every 3D node can carry position/rotation/scale/matrix.

Open questions:

- **Q1.** Does the grammar expose transforms at all, or are they
  compiler-internal (used only to realize coords/facets)? ggplot2 has no
  layer-transform concept; exposing one is a deliberate extension beyond the
  ggplot2-shaped DSL rule.
- **Q2.** If exposed, at what level — plot, layer, or a `transform()` spec part?
  What is the composition order with the coord and the camera?
- **Q3.** Euler order is configurable in `composeTransform` (default `xyz`). Do
  we pin one for serializability?

**DECISION (gggplot-4q2.8.4).**

- **Q1: transforms stay COMPILER-INTERNAL; the grammar does not expose them.**
  ggplot2 has no layer-transform concept, and ARCHITECTURE §"Design rules" pins
  the DSL to `geom_*`/`scale_*`/`coord_*`/`facet_*`/`theme_*` spec parts. A
  `transform()` part would be a new top-level concept with no ggplot2
  counterpart. It is also unnecessary: every _grammatical_ reason to move
  something in space is already owned by a decided concept — axis remapping is
  the coord swizzle (Q4), framing is the camera (Q8), and panel placement is
  faceting. `ObjectTrait` remains available to the **compiler** to _realize_
  those concepts (e.g. placing 3D facet panels), which is exactly how the 2D
  compiler already treats layout.
- **Q2: not exposed, so there is no plot/layer/part question.** For internal use
  the composition order is fixed by `Cartesian` itself (read from
  `@use-gpu/plot/mjs/view/cartesian.mjs`):
  `normalize(range) → swizzle(axes) →
  composeTransform(position/rotation/scale/matrix)`,
  with the camera's view·projection applied on top. So a compiler-placed
  transform acts in **cube space, after the coord and before the camera** — the
  one order that keeps coord semantics and camera framing independent.
- **Q3: pin `xyz` Euler order, and prefer quaternion/matrix internally.**
  `composeTransform`'s default (`xyz`) is the pinned order should Euler angles
  ever be serialized; internal callers should use `quaternion` or `matrix`,
  which are order-free and avoid the ambiguity entirely.

Consequence: `Render3DNode` carries **no** transform field, and `render.tsx`
passes no `ObjectTrait` props to `Cartesian`. Revisit only if 3D faceting needs
per-panel placement — that is a compiler concern, not a grammar surface.

## 3. The new concern: coords and the axes swizzle

`Coord.axes` is a use.gpu-style output-axis swizzle. In 2D, `"xy"` is the
default and `"yx"` is what `coord_flip` _is_; 3D widens the same representation
to the permutations of `xyz` while homogeneous `w` remains internal.

- **Q4.** Should coordinate projection generalize to an axes string (`'xyzw'`,
  `'yxzw'`, …) so 2D flip and 3D axis remap are one mechanism?
- **Q5.** Where does `z` live in `PositionAxis` / `AesName` / scale training?
- **Q6.** `range` is 3 axes (`AxesTrait`) or 4 (`Axes4DTrait`). Does gggplot
  ever need the `w` axis, or do we pin 3 and treat `w` as homogeneous?
- **Q7.** Do `expand` (scale padding) and discrete position scales mean the same
  thing on `z`?

**DECISION (gggplot-4q2.8.2).**

- **Q4: yes — the coord projection IS an output-axis swizzle.** `Cartesian`
  normalizes each data axis into the `[-1,1]` cube from `range`, then (if `axes`
  ≠ `"xyzw"`) permutes the output axes via `swizzleMatrix`. That permutation is
  exactly what `coord_flip` does, generalized to 3D. 3D adopts the swizzle
  natively: `Point3DSpec.coord.axes` (see `geom_3d/coord.ts`, `resolveAxes3d`)
  lowers to `Render3DNode.axes` and is passed to `Cartesian` in both the live
  and emit paths. The 2D compiler now uses the same representation through
  `Coord.axes` (`"xy"`/`"yx"`, with `"xyzw"`/`"yxzw"` accepted at its boundary).
- **Q5: `z` is a position aesthetic, same status as `x`/`y`.** It already exists
  in `AesName`; 3D position axes are `x`/`y`/`z` and the coord swizzle reorders
  them. `PositionAxis` includes `z`, while 2D coordinate validation accepts only
  the x/y swizzles.
- **Q6: pin 3 axes (`AxesTrait`); `w` is homogeneous and NOT grammar-visible.**
  Positions are vec4 `[x,y,z,1]` for the GPU, but `w` is never a data aesthetic
  and never a swizzle target — `resolveAxes3d` rejects any swizzle that moves a
  data axis onto `w`. 4D/projective (`Axes4DTrait`/`Object4DTrait`) is out of
  grammar scope.
- **Q7: `expand` and discrete scales mean the same on `z` as on `x`/`y`.** `z`
  is an ordinary position scale; its training (continuous `expand` padding,
  discrete band domains) mirrors the 2D position scales. **Implemented** in
  gggplot-4q2.3: `geom_3d/position.ts` `trainPosition3d` replaced the ad-hoc
  `domainOf`, reusing the 2D `transformFor`/`expandRange`/`scalePosition` and
  the `numericRange` level-index convention, so every 3D position axis trains
  like a 2D one (`Point3DSpec.scales.{x,y,z}` declares limits/expand/kind).

## 4. The new concern: cameras

- **Q8.** **Is the camera part of the spec, the coord, or the runtime?** gggplot
  specs are serializable and static; a camera is arguably a _view_, like the
  pan/zoom that ARCHITECTURE §5 Phase 3 keeps as runtime state. A static camera
  in the spec is emit-friendly; an interactive one is not.
- **Q9.** Which parameterization is canonical — lookAt (`position`/`target`,
  what `Camera3D` uses today and what emission serializes) or orbit
  (`bearing`/`pitch`/`radius`, what `OrbitCamera` consumes)? We currently
  convert lookAt→orbit in `orbitCameraProps`, and _separately_ build a
  view·projection matrix in `cameraViewProjection` for emission. **Two
  parameterizations of the same camera is a smell.**
- **Q10.** `OrbitCamera.scale` sets the view ratio as `canvasHeight / scale`, so
  framing is **resolution-dependent**. What is the resolution-independent
  formulation? (Current code pins a fixed frame height to dodge this — a
  known-bad workaround.)
- **Q11.** Interactivity: adopt `@use-gpu/interact` for orbit/zoom? That adds a
  dependency and runtime camera state, and needs a story for how an interactive
  view relates to a serializable spec.

**DECISION (gggplot-4q2.8.1).**

- **Q8: the camera is SPEC (initial view) + RUNTIME (live view); it is NOT a
  coord.** The spec carries only the _initial_ orbit view — plain, serializable
  orbit params (`bearing`/`pitch`/`radius`/`target`) — so specs stay static and
  emit-friendly. The _live_ view (after drag/zoom) is runtime state owned by
  `OrbitControls`, never written back to the spec. This is the same spec-vs-view
  split ARCHITECTURE §5 uses for 2D pan/zoom. The camera is deliberately **not**
  a coord: the coord is the axes swizzle + Cartesian range (Q4), which is data→
  cube; the camera is cube→screen. Keeping them separate means
  `coord_flip`-style remaps and camera framing never entangle.
- **Q9 (recap):** orbit is canonical; `Camera3D` lookAt is sugar resolved via
  `orbitFromLookAt`. `cameraViewProjection` builds the emit/test matrix from the
  same canonical orbit, so emission and the live path never diverge.
- **Q10 (done under gggplot-4q2.8.3):** `OrbitCamera.scale` dropped; pixel-
  constant sizing makes framing resolution-independent.
- **Q11: adopted.** `apps/site/src/scene3d.tsx` wraps `OrbitCamera` in
  `OrbitControls`, seeded from the spec's initial orbit params; its render-prop
  feeds live `radius/bearing/pitch/target` to `OrbitCamera` each frame. Drag/
  zoom mutate runtime state only — the spec and emitted source (which serialize
  the _initial_ view) are unchanged. `AutoCanvas` already provides the
  `DOMEvents` + `CursorProvider` + `LayoutContext` `OrbitControls` needs, so no
  extra event wiring. Still open: no live→spec "save this view" round-trip yet
  (would reuse the same orbit fields; deferred until a spec-capture story
  lands).

## 5. The new concern: depth, occlusion, transparency

- **Q12.** Default `depthTest`/`depthWrite` for 3D marks?
- **Q13.** Transparency in 3D is order-dependent. `ROPTrait.mode` has a
  `'transparent'` path (use.gpu's own 3D example uses it). What is gggplot's
  contract when `alpha` < 1 in 3D — sorted, order-independent, or documented as
  approximate?
- **Q14.** Does `blend` become a theme/param surface, or stay internal?

**DECISION (gggplot-4q2.8.3).**

- **Q12:** `depthTest` and `depthWrite` both default **true** — opaque marks
  occlude correctly. When `alpha` < 1 the mark keeps `depthTest` but drops
  `depthWrite`, so a near translucent mark does not z-block a farther one it
  should blend with.
- **Q13:** Documented as **approximate**. `alpha` < 1 selects use.gpu's
  `mode: "transparent"` blend path; gggplot does **not** sort marks or run OIT
  in this pass, so overlapping translucent 3D marks are order-approximate.
  Sorting / OIT is a later upgrade with no spec change (same `alpha` surface).
- **Q14:** `blend` stays **internal** — chosen from opacity, not a grammar or
  param surface. Revisit when themes land.

These lower onto `Render3DNode.depthWrite` / `.transparent`; `render.tsx` and
`emit.ts` pass `depthWrite` and (when transparent) `mode="transparent"` to
use.gpu's `Point`.

## 6. The new concern: mark sizing

`PointTrait.depth` picks the sizing space: `0` = constant **pixels** (2D/ggplot2
semantics), `1` = **perspective-scaled world units** (near points bigger). This
is a grammar-visible semantic, not a tuning knob.

- **Q15.** Which is gggplot's default in 3D, and is it user-controllable?
  ggplot2 sizes are physical (mm/pt), implying `depth: 0`; but a 3D point cloud
  usually wants perspective.

**DECISION (gggplot-4q2.8.3): default `depth: 0` (pixel-constant), user-
controllable.** gggplot mirrors ggplot2, where `size` is a physical/screen
quantity independent of camera distance, so pixel-constant is the parity choice.
It is also the resolution-independent one: `OrbitCamera.scale` only existed to
rescale pixel sizing by canvas height, and with `depth: 0` the size is true
device pixels, so `scale` is dropped (`scale=null → unit=1, ratio=pixelRatio`) —
this resolves the resolution-dependence tracked as Q10 in gggplot-4q2.8.1.
`params.sizeMode: "constant" | "perspective"` exposes the choice (`constant`
default → `depth 0`; `perspective` → `depth 1` for point-cloud depth cueing).
The earlier `depth: 1` default was accidental; combined with `scale`, it was why
point visibility was so confusing.

## 7. The new concern: guides in 3D

- **Q16.** 3D axes/grids via `AxisTrait`/`GridTrait` (`zBias`, per-axis ranges)
  are a different layout problem than the 2D margin solver in
  `compile/guides.ts` (`guideLayout` measures text into pixel margins). What is
  the 3D equivalent — in-scene axes, or a screen-space overlay?
- **Q17.** Legends: screen-space overlay composited over the 3D pass?
- **Q18.** Do 3D ticks/labels need billboarding to face the camera?

**DECISION (gggplot-4q2.8.5).**

- **Q16: axes/grids/ticks are IN-SCENE (inside `Cartesian`, data space); only
  legends and plot titles are screen-space.** This is not a new split — the 2D
  compiler already draws exactly this line: `compile/mod.ts` puts `Grid`/`Axis`
  nodes _inside_ the `Cartesian`/`Polar` view (data space, layered by `zBias`),
  and sends only _text_ to the flat overlay (`axisGuideOverlay`, `legendNodes`).
  3D keeps that shape: three `Axis` nodes (`AxisTrait.axis` = `"x"|"y"|"z"`,
  parsed to an axis index) and up to three `Grid` nodes (`GridTrait.axes` is a
  **2-axis pair** — `"xy"`, `"yz"`, `"xz"` — one per coordinate plane of the
  cube).

  What does **not** carry over is `guideLayout`, the pixel-margin solver. It
  exists to inset a _flat_ panel so measured text has somewhere to live; a
  perspective-projected cube has no flat panel and no stable margin — the same
  tick lands at a different screen position every frame. So 3D does not run
  `guideLayout` for axis furniture at all. Axis text anchors to the cube in data
  space (Q18); the only part of the margin problem that survives is the legend
  (Q17).

  Face selection is free. `Grid`'s `auto` prop _is_ the camera-aware "grid on
  the back faces only" behaviour, resolved **in the shader, per frame**:
  `getGridPosition` emits each grid line twice (once on the min face, once
  shifted by the full extent) and `getGridAutoState` compares
  `getViewPosition()` against the transformed face normal, collapsing the copy
  that faces the camera to `vec4(0)`. gggplot passes `auto` and never needs the
  live camera on the CPU for grids.

  Inherited limitation, stated rather than fixed: grid line positions come from
  use.gpu's own `ScaleTrait` division (`nice`/`divide`/`base`), while gggplot's
  tick _labels_ come from its trained scale (`axisTickValues` → `linspace`), so
  grid lines and labelled ticks need not coincide. This is already true in 2D
  and is filed as its own bead.

- **Q17: legends and plot titles stay screen-space, composited over the 3D pass,
  reusing the 2D builders unchanged.** A legend is page furniture: its content
  depends on the trained color/size/alpha scales and never on the camera, so
  `legendNodes`/`plotLabelNodes` (which already yield flat `[-1,1]`
  `RenderNode`s) are reused verbatim and 3D grows no legend code of its own.
  Wiring constraint from §1: `OrbitCamera` provides only `ViewProvider`, **not**
  `LayoutContext`, so the overlay cannot hang under the orbit camera — it is a
  sibling under the canvas's own flat layout, drawn after the 3D pass with
  `depthTest: false`.

  Framing: the 3D pass is **not inset** to make room. There is no 3D analog of
  `guideLayout` shrinking `bounds`; the legend composites on top. If overlap
  becomes a real problem the fix is to offset/dolly the camera (a camera
  concern, Q8/Q10), not to reintroduce a margin solver.

  **Implemented (gggplot-4q2.11).** `geom_3d/legend.ts` calls the 2D builders
  and stores the result on `Render3DNode.overlay`; `geom_3d/overlay.tsx` mounts
  it under `Embedded normalize`, and the host renders it as a sibling
  `<FlatCamera><Pass overlay>` after the 3D pass — `overlay` sets the color
  attachment's `loadOp` to `'load'`, so the flat pass composites instead of
  clearing. Building it surfaced an inverted placement in the shared 2D builder:
  `plotLabelNodes` put the title at positive y and the caption at negative, but
  **y grows downward** here (`guideLayout` maps the top margin onto the negative
  side, and `axisGuideOverlay` places x tick labels at the larger
  `panelBounds[3]`), so titles rendered along the bottom. Fixed for both
  dimensions — no 2D example had ever put a plot title on screen.

- **Q18: billboarding is not ours to choose — use.gpu labels are already
  screen-aligned, and the real decision is the _anchor_.** `Label` glyphs are
  screen-space quads: the label vertex shader (`@use-gpu/wgsl`,
  `instance/vertex/label.wgsl`) takes `worldToClip(position)` and adds a
  **screen-space** offset scaled by `getScreenScale(clip.w, depth)`. Glyphs
  therefore always face the camera and cannot be tilted into the scene — there
  is nothing to opt into. Two knobs remain, and both are decided here:

  - `LabelTrait.depth` mirrors `PointTrait.depth`. Pin **0** (pixel-constant)
    for all axis text, consistent with Q15: labels stay legible at any camera
    distance and text size stays a physical quantity, as in ggplot2.
  - `AnchorTrait.placement`/`offset` choose which side of the anchor the text
    sits on — and _this_ is where the camera dependence that "billboarding"
    hides actually lives. Glyph orientation is camera-free; which cube edge the
    ticks hang on is not.

  Initial decision: anchor tick labels and axis titles to fixed minimum-corner
  edges. **Amended by `gggplot-4q2.12`:** the compiler now emits one declarative
  `CameraAxis3D` per axis. In the render layer it consumes the current orbit
  bearing/pitch and moves the axis, ticks, labels, and title together to the
  camera-near cube corner on every update. The emitted backend inlines the same
  context/component rule. Camera state remains runtime-only and the serialized
  spec still contains one initial camera.

Consequence for the IR: guides lower **declaratively** — which axes are drawn,
their ranges, tick values, label strings — never as pre-baked screen positions.
That keeps per-frame anchoring available to the render layer, while `emit.ts`
resolves the same declaration once against the serialized initial camera.

**Implemented (gggplot-4q2.10).** `geom_3d/guides.ts` builds `Guides3D` from the
same trained position scales the marks use (breaks via the 2D
`axisTickValues`/`tickLabel`, so 2D and 3D cannot drift); `render.tsx` and
`emit.ts` realize it identically as `Grid`(`auto`) × 3 planes, `Axis` × 3, plus
`Tick` and `Label` per axis. Verified live: the 3D route goes from 1 draw call
to 33 and renders grids on the far faces, rules, ticks, tick text and axis
titles.

Two traps worth keeping written down, both found by reading use.gpu's sources
rather than by guessing:

- **The homogeneous range must be pinned to `[1,1]`.** `Cartesian`'s matrix only
  reads the three data ranges, but it publishes the _parsed_ ranges as
  `RangeContext`, and `parseRanges3` pads a 3-range input with a default 4th
  range of `[0,2]`. `Grid auto` reads `parentRange[i]` for every i **including
  w**, so an unpinned w range seats grid vertices at w = 0 — a direction, not a
  point. `cartesianRange4` pins `[1,1]` (w = 1, zero shift) on both the live and
  emitted paths.
- **`Tick`'s `tangent` is not the tick's direction.** The mark is drawn along
  `offset`; `tangent` feeds the level-of-detail rule that thins ticks as their
  projected spacing tightens, so its _length_ must be the spacing between
  adjacent breaks.

Still cosmetically wrong, and not a guides bug: break _values_ come from
`linspace` over the raw trained domain, so a domain like [-0.9992, 1] labels
ticks `0.5004` instead of `0.5`. That is gggplot-42n, an existing 2D defect the
3D guides inherit.

## 8. Where the current implementation stands

Honest audit of what shipped, and which parts are _decisions_ vs _accidents_:

| Area               | Current behaviour                                                                                                           | Status                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Data path          | flat vec4 FlatTensor, real z, reuses 2D packers                                                                             | **Deliberate**, tested                          |
| Color              | `trainColor3d` (discrete palette / continuous ramp) reusing 2D scale                                                        | **Deliberate**, tested                          |
| Projection         | GPU (Cartesian mat4 + camera), no per-row CPU project                                                                       | **Deliberate**                                  |
| Axes swizzle       | `coord.axes` output swizzle (`resolveAxes3d`), 3 axes + homogeneous w, passed to Cartesian                                  | **Decided** (Q4–Q7, gggplot-4q2.8.2)            |
| Transforms         | none, deliberately — compiler-internal only, not a grammar surface                                                          | **Decided** (Q1–Q3, gggplot-4q2.8.4)            |
| Camera             | canonical orbit; spec = initial view, `OrbitControls` = live view; matrix for emit; `scale` dropped, resolution-independent | **Decided** (Q8–Q11, gggplot-4q2.8.1 + 4q2.8.3) |
| Point sizing       | `depth: 0` pixel-constant default (ggplot2 parity), `sizeMode` opt-in perspective                                           | **Decided** (Q15, gggplot-4q2.8.3)              |
| Depth/transparency | opaque writes depth; `alpha<1` → no depthWrite + `mode:transparent`, order-approximate                                      | **Decided** (Q12–Q14, gggplot-4q2.8.3)          |
| Guides             | shared authoritative breaks; camera-aware `Grid` planes + `CameraAxis3D` per axis; legend/title overlay in a flat pass      | **Built** (4q2.10/.11/.12, gggplot-42n)         |
| z scale            | `trainPosition3d` — discrete levels, `expand`, scale-kind transform, declared limits; reuses 2D scale primitives            | **Done** (gggplot-4q2.3)                        |

## 9. Proposed process

1. ~~Decide **Q8/Q9/Q10** first (camera model).~~ **DONE** (gggplot-4q2.8.1 +
   4q2.8.3): canonical orbit; camera is spec (initial view) + runtime
   (`OrbitControls` live view), not a coord; `scale` dropped for resolution-
   independence; `OrbitControls` wired in `scene3d.tsx`.
2. ~~Then **Q4/Q5** (axes swizzle + z as a position aesthetic).~~ **DONE**
   (gggplot-4q2.8.2): `coord.axes` swizzle (`resolveAxes3d`) wired through
   lower/render/emit; z is a position aesthetic; 3 axes with homogeneous w. The
   The 2D `Coord.axes` swizzle unification is complete in `gggplot-5tg`.
3. ~~Then **Q15 + Q12/Q13** (sizing and depth semantics).~~ **DONE**
   (gggplot-4q2.8.3): pixel-constant default sizing (`sizeMode` opt-in
   perspective), opaque depth-write, approximate transparency. This also fixed
   Q10 (resolution-independence) by removing `OrbitCamera.scale`.
4. ~~Then transforms (**Q1–Q3**).~~ **DONE** (gggplot-4q2.8.4): transforms stay
   compiler-internal; not a grammar surface.
5. ~~Then guides (**Q16–Q18**).~~ **DONE** (gggplot-4q2.8.5): axes/grids/ticks
   in-scene inside `Cartesian` (`Grid auto` for camera-aware face culling, done
   in-shader); legends and plot titles stay screen-space and reuse the 2D
   builders; labels are billboarded by construction, so the decision is the
   anchor — camera-near cube edges resolved at runtime, `depth: 0` text. No
   `guideLayout` in 3D.

All five are settled, so the "don't build on `geom_3d`" hold is lifted. The
grammar model is decided end to end and both halves of the guides are built:
in-scene axes/grids/ticks (gggplot-4q2.10) and the screen-space legend/title
overlay (gggplot-4q2.11). The two guide follow-ups are complete: camera-aware
axis/tick/label/title edges (`gggplot-4q2.12`) and authoritative shared pretty
breaks for grid rules and labels in both dimensions (`gggplot-42n`).

## 10. Decision: one grammar and one serialization for 2D and 3D

**Status:** accepted by the gggplot-8y2 design spike (2026-07-31).

The current `Point3DSpec`/`compile3d`/`Render3DNode` path is an artifact of how
the first 3D slice was developed, not a second grammar that users should have to
learn. We will converge on one `GGSpec`, one fluent DSL, one `compile`, one
`RenderNode` tree, one `GGPlot` host, and one `emitSource` entry point. Internal
lowering may remain specialized where the GPU view or topology genuinely
differs; that specialization must stay behind the ordinary geom definition.

### 10.1 Public grammar

Marks with the same semantics use the same public builder in either dimension.
`geomPoint()` remains `geomPoint()`; adding a mapped `z` selects its 3D mode.
The same rule will apply to `geomLine()` and `geomPath()`. A suffix such as `3d`
is reserved for a mark whose _topology_ is intrinsically 3D (for example a
future surface), not for selecting a renderer.

```ts
// 2D: unchanged
ggplot(data, aes({ x: "x", y: "y" }))
  .add(geomPoint());

// 3D: same grammar; z selects geomPoint's 3D mode
ggplot(data, aes({ x: "x", y: "y", z: "z" }))
  .add(
    geomPoint({ size: 6 }),
    camera3d({ bearing: Math.PI / 3, pitch: 0.55 }),
  );
```

There is no `ggplot3d`, `geomPoint3d`, `compile3d`, or user-visible `mode` in
the final API. Scales, labels, themes, mappings, data overrides, and grouping
remain the ordinary grammar parts. `scaleZContinuous()` and its discrete/log/
sqrt siblings are the direct third-axis counterparts of the existing x/y
helpers, backed by the same `Scale` type and trainer.

### 10.2 Dimensionality is a geom-mode decision, not a global `z` test

The original proposal to add `GeomDefinition.dims: 2 | 3` is too rigid: it would
force duplicate geom identities for a mark that supports both modes. A global
rule saying "mapped z means 3D" is also wrong. `z` already means a _value_
aesthetic for 2D `geomTile()`/`statSummary2d()`, so that rule would silently
turn existing 2D summary plots into 3D scenes.

Each geom definition therefore declares one or more **dimensional modes**. A
mode owns its required position aesthetics, lowerer, and supported stat/
position combinations. Conceptually (the implementation may choose equivalent
names):

```ts
interface GeomMode {
  dimensions: 2 | 3;
  requiredPosition: readonly AesName[];
  lower: GeomLower;
  stats: readonly StatKind[];
  positions: readonly PositionKind[];
}

interface GeomDefinition {
  // existing defaults/docs/hooks remain
  modes: readonly GeomMode[];
}
```

The resolver runs once, before stat/scale/lowering work:

1. Compute each layer's effective mapping, honoring `inheritAes` and layer
   overrides.
2. If the geom has a 3D mode and its position requirements include a mapped `z`,
   select that mode. A 3D-only geom selects its sole mode and then reports any
   missing required aesthetics. A 2D-only geom remains 2D even if it uses `z` as
   a value aesthetic.
3. Validate the selected mode's required aesthetics, stat, and position.
   Initially point/line/path 3D support only combinations implemented with
   parity; unsupported combinations fail instead of falling back silently.
4. Require every drawable layer in one plot to select the same dimension. Empty
   plots default to 2D. Mixed 2D/3D layers initially fail with an actionable
   error; implicit `z = 0` promotion is deferred until it has a coherent z-scale
   and guide contract.
5. Initially reject faceted 3D plots. A single camera cannot by itself answer
   how multiple 3D panels are placed and clipped; that remains a separate
   object/layout design problem.

This keeps inference local and predictable: `geomPoint` interprets `z` as its
third position axis, while `geomTile` continues to interpret `z` as a 2D value
to summarize.

### 10.3 Camera is a serialized singleton grammar component

The camera remains separate from the coord. A coord maps data to the normalized
plot cube; a camera maps that cube to the screen. The unified spec gains one
optional, top-level `camera` field, and the DSL gains one named spec part:

```ts
camera3d(options?: Partial<Camera3D>): SpecPart
```

`camera3d` behaves like the singleton coord/facet components: adding it stores
`GGSpec.camera`; adding it again replaces the earlier value, so the built spec
can never contain two cameras. The camera is plot-wide, never per-layer or
per-facet. A camera on a purely 2D plot is an error rather than ignored data.

The canonical v1 serialization is a fully resolved orbit pose with an explicit
perspective projection:

```ts
interface Camera3D {
  kind: "orbit";
  projection: "perspective";
  bearing: number;
  pitch: number;
  radius: number;
  target: [number, number, number];
  fov: number;
  near: number;
  far: number;
}
```

The standard normalized-cube view remains the current, tested three-quarter
view: bearing `π/4`, pitch `0.45`, radius `3.6`, target `[0,0,0]`, vertical FOV
`π/4`, near `0.1`, far `100`. `camera3d()` serializes that complete value.
Partial options merge with the default _in the builder_, so a saved spec is
stable even if a future library version changes its implicit default. Omitting
the camera entirely is valid for a 3D plot and resolves to the same default at
compile time.

The spec serializes parameters, not a view-projection matrix and never live
`OrbitControls` state. The compiler/emitter may derive a matrix. Interactive
drag/zoom begins from the spec value and remains runtime state, exactly as 2D
pan/zoom does.

The old look-at `Camera3D` input also claimed orthographic/up/aspect fields, but
`orbitFromLookAt` drops those fields and `cameraViewProjection` always builds a
perspective matrix. That silent semantic loss is not carried into the unified
API. V1 supports perspective orbit cameras only. Unsupported orthographic input
must throw until an orthographic live and emitted path exists. If migration
needs look-at convenience, a separately named helper may convert position/
target into the canonical orbit object immediately; it does not create a second
serialized camera shape.

### 10.4 Concrete serialized examples

A 2D plot has no camera field:

```json
{
  "data": { "x": [1, 2], "y": [3, 4] },
  "mapping": { "x": "x", "y": "y" },
  "layers": [
    {
      "geom": "point",
      "stat": "identity",
      "position": "identity",
      "params": {}
    }
  ],
  "scales": [],
  "coord": { "kind": "cartesian" },
  "facet": { "kind": "none" },
  "labels": {},
  "theme": { "name": "default" }
}
```

Calling `camera3d()` on a 3D plot serializes the full default, while the layer
is still the ordinary `point` geom:

```json
{
  "data": { "x": [1, 2], "y": [3, 4], "z": [5, 6] },
  "mapping": { "x": "x", "y": "y", "z": "z" },
  "layers": [
    {
      "geom": "point",
      "stat": "identity",
      "position": "identity",
      "params": {}
    }
  ],
  "scales": [],
  "coord": { "kind": "cartesian" },
  "facet": { "kind": "none" },
  "labels": {},
  "theme": { "name": "default" },
  "camera": {
    "kind": "orbit",
    "projection": "perspective",
    "bearing": 0.7853981633974483,
    "pitch": 0.45,
    "radius": 3.6,
    "target": [0, 0, 0],
    "fov": 0.7853981633974483,
    "near": 0.1,
    "far": 100
  }
}
```

`camera3d({ bearing: 0, radius: 5 })` produces the same canonical object with
only those resolved values changed; it does not serialize a partial camera:

```json
{
  "kind": "orbit",
  "projection": "perspective",
  "bearing": 0,
  "pitch": 0.45,
  "radius": 5,
  "target": [0, 0, 0],
  "fov": 0.7853981633974483,
  "near": 0.1,
  "far": 100
}
```

### 10.5 Compiler and RenderTree convergence

The widened compiler trains x/y/z through one scale path and carries domains by
position axis rather than maintaining `xDomain`/`yDomain` beside a parallel
`PositionScale3D`. A 2D point continues to pack a vec2; its 3D mode packs a vec4
`[x,y,z,1]`. Both return ordinary `RenderNode`s.

The 3D Cartesian box, `Grid`, `Axis`, `Tick`, `Label`, and `Point` are already
structurally RenderTree components. Add `Tick` plus one minimal named camera/
view wrapper to `ComponentName`; the live registry owns its runtime wiring. The
wrapper seeds `OrbitControls`, mounts the Cartesian scene, and composes the
ordinary flat overlay. This removes `Render3DNode`, `Guides3D`, `GGPlot3D`, and
`GGPlot3DOverlay` as parallel public products. `emitSource` handles the same
tree and may inline the derived initial matrix, removing `emitPoint3dSource`.

### 10.6 Guide configuration uses the shared grammar

The unified spec does **not** retain `GuideSpec3D` or add a second `guides3d`
part. Its fields lower onto ordinary grammar homes:

- `GuideSpec3D.grid` becomes the existing `theme.grid` switch.
- `GuideSpec3D.axes` becomes the existing `theme.axes` switch.
- `GuideSpec3D.titles` becomes a shared `theme.axisTitles` switch, honored by
  both the flat axis overlay and in-scene 3D axis labels. Axis-title text still
  comes from `labels`/scale names/mappings in the existing precedence order.
- Fixed `tickCount` becomes `Scale.nBreaks`, a hint rather than an exact count.
  `Scale.breaks` provides explicit break values. Both apply to ordinary x/y/z
  position scales, so 2D and 3D use one declaration and one break generator.

`nBreaks` is deliberately a hint: a pretty/extended generator may return a
nearby count to produce human-facing values. Explicit `breaks` always win over
`nBreaks`, which wins over the layout-derived 2D hint or the default 3D hint.
This is also the API resolution for gggplot-42n; that bead owns replacing raw
`linspace` with the shared pretty/explicit-break implementation. The compiler
unification does not otherwise need to wait for that cosmetic improvement.

The old `Point3DSpec.params.sizeMode` remains a per-layer `Layer.params` setting
because it changes point-mark realization, not the plot view. It is valid only
for a geom mode that declares support for it (initially the 3D point mode), with
values `"constant" | "perspective"`; using it on a 2D point or an unsupported 3D
geom is an error.

Migration of the old global 3D `tickCount` writes the same `nBreaks` hint onto
each declared x/y/z scale. Thus the existing Swizzled3D example remains
expressible with `theme({ grid: false })` plus three position scales carrying
`nBreaks: 3`; no user-facing 3D guide field is dropped.

### 10.7 Ordered implementation and cost

The implementation is tracked under gggplot-4q2.13:

| Order               | Bead             | Scope                                       | Estimate |
| ------------------- | ---------------- | ------------------------------------------- | -------: |
| parallel foundation | gggplot-4q2.13.1 | geom modes + dimension resolver             |     18 h |
| parallel foundation | gggplot-4q2.13.2 | canonical `camera3d` GGSpec/DSL component   |      8 h |
| after gggplot-5tg   | gggplot-4q2.13.3 | x/y/z scale, coord, and context widening    |     24 h |
| after .1/.2/.3      | gggplot-4q2.13.4 | shared point lowering + ordinary RenderTree |     32 h |
| after .4            | gggplot-4q2.13.5 | one live `GGPlot` host                      |     24 h |
| after .4            | gggplot-4q2.13.6 | one emitter                                 |     16 h |
| after .5/.6         | gggplot-4q2.13.7 | site migration + parallel-API retirement    |     12 h |
| after .5/.6         | gggplot-4q2.13.8 | shared line/path 3D modes                   |     24 h |

Total new work is approximately **158 engineering hours (about 20 developer
days)**, excluding the already-open gggplot-5tg prerequisite. The honest range
is **20–25 days** because the highest-risk work touches the stable 2D compiler,
live camera/pass composition, and standalone emission. The work is deliberately
staged so camera and dimension metadata can land with focused tests before the
cross-cutting compiler change, and live/emitted backends can proceed in parallel
once the unified RenderTree exists.
