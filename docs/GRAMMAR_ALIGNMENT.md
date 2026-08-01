# Grammar Alignment

This note compares gggplot's grammar boundaries with two peer dialects:

- [Gribouille](https://github.com/mcanouil/gribouille), a Typst-native Grammar
  of Graphics library.
- [ggsql](https://ggsql.org/), a SQL extension for declarative visualization.

The purpose is not to copy either project wholesale. gggplot's center of gravity
is different: it is a TypeScript DSL that lowers a serializable `GGSpec` into a
backend-independent `RenderTree`, then renders live through UseGPU or emits
UseGPU Live source. Gribouille is document-native; ggsql is query-native;
gggplot is render-backend-native.

## Architectural Comparison

| Concern              | gggplot                                    | Gribouille                                                  | ggsql                                                |
| -------------------- | ------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------- |
| Host language        | TypeScript/Deno                            | Typst                                                       | SQL extension                                        |
| Primary user surface | `ggplot(data, aes(...)).add(...)`          | `#plot(data:, mapping:, layers:, scales:, labels:, theme:)` | `SELECT ... VISUALISE ... DRAW ...`                  |
| Data location        | In-memory columnar `DataFrame`             | Typst data, CSV, tables                                     | Database/query result                                |
| Backend              | UseGPU Live / emitted TSX                  | Typst + CeTZ drawing                                        | Readers/writers around SQL plus visualization output |
| Internal center      | `GGSpec -> RenderTree`                     | Document-native plot object/layout                          | Parsed query + visualization AST                     |
| Best-fit use case    | Interactive GPU render and source emission | Publication-quality Typst documents                         | Data-near analysis without leaving SQL               |

## Alignment Principles

1. Keep the RenderTree-first architecture. gggplot should not become a Typst
   clone or SQL dialect. The durable design choice is that both runtime
   rendering and emitted source consume the same backend-independent tree.

2. Make grammar concepts explicit before adding surface area. Peer dialects
   expose labels, projection, annotations, and literal settings as first-class
   grammar concepts. gggplot should prefer clear IR fields over ad hoc compiler
   fallbacks.

3. Treat mapped aesthetics and literal settings as different kinds of input.
   Mapped aesthetics train/use scales. Literal settings pass through as visual
   values. This is already the intended `aes()` vs geom-params split, but the
   IR/docs/tests should make it impossible to confuse.

4. Keep aesthetics independent. `color`, `fill`, and future `stroke` should not
   share one compiler scale shortcut. Each aesthetic should train, guide, and
   render independently unless an explicit API says otherwise.

5. Do not export grammar promises that compile to nothing. A public DSL helper
   should either lower to a RenderTree node or be clearly marked unsupported.
   The current `geomPolygon()` gap violates this.

## Coverage Matrix

Status values:

- `yes`: implemented in gggplot today.
- `partial`: implemented, but weaker than peer dialects or missing important
  edge cases.
- `tracked`: not complete, but an open bead exists.
- `missing`: no known implementation or bead yet.

| Area                                                       | gggplot status | Peer signal                                                                         | Next action                                                                                                                                                                                                    |
| ---------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core data + mapping                                        | yes            | All three dialects have global data/mapping concepts.                               | Keep current `GGSpec.data` + `mapping`.                                                                                                                                                                        |
| Layer mapping override                                     | yes            | ggsql `DRAW MAPPING` overrides global mappings; Gribouille layers accept mappings.  | Keep current layer `mapping`; clarify inheritance tests/docs.                                                                                                                                                  |
| Literal settings                                           | partial        | ggsql separates `MAPPING` from `SETTING`; `PLACE` layers are literal-only.          | `gggplot-1be.1` formalizes mapped vs fixed aesthetics.                                                                                                                                                         |
| Top-level labels                                           | partial        | Gribouille has `labels(...)`; ggsql has `LABEL`.                                    | `gggplot-1be.2` added `GGSpec.labels`, DSL `labels()`, legend titles, facet variable labels, and simple non-faceted title/subtitle/caption text; fuller faceted outer-title layout remains future layout work. |
| Point, line, path                                          | yes            | Common to peer dialects.                                                            | No alignment change.                                                                                                                                                                                           |
| Bar/col, area, ribbon, tile                                | yes            | Common to peer dialects.                                                            | No alignment change.                                                                                                                                                                                           |
| Text/label geoms                                           | partial        | Gribouille has text and labels; ggsql has text.                                     | Keep text; add real label boxes after text measurement work.                                                                                                                                                   |
| Polygon                                                    | tracked        | Both Gribouille and ggsql expose polygon-like layers.                               | `gggplot-165` implements or removes export.                                                                                                                                                                    |
| Segment/rule/range annotations                             | yes            | ggsql has segment/rule/range and `PLACE`; Gribouille has reference/error geoms.     | `gggplot-1be.4` added `annotate()` (segment/rect/text/point) plus `geom_hline`/`geom_vline`/`geom_abline`.                                                                                                     |
| Density/violin/spatial                                     | missing        | ggsql lists density, violin, spatial; Gribouille advertises richer geoms.           | Defer unless product direction needs them.                                                                                                                                                                     |
| Stats: identity/count/bin/smooth/summary                   | yes            | Peer dialects cover these core stat families.                                       | No alignment change.                                                                                                                                                                                           |
| Positions: identity/stack/dodge/fill/jitter                | yes            | Peer dialects expose these common adjustments.                                      | No alignment change.                                                                                                                                                                                           |
| Scales: continuous/discrete/log/sqrt/color/fill/size/shape | partial        | Peers keep more scale kinds and aesthetics independent.                             | `gggplot-gic`; add stroke/linetype/linewidth only when needed.                                                                                                                                                 |
| Binned/ordinal/identity scale kinds                        | missing        | ggsql explicitly exposes binned, ordinal, and identity scales.                      | Consider after color/fill/stroke cleanup.                                                                                                                                                                      |
| Facets                                                     | partial        | Gribouille supports shared/free scales; ggsql has `FACET`.                          | Current fixed scales are fine; free scales are future work.                                                                                                                                                    |
| Faceted legends                                            | tracked        | Guides should be plot-layout-level, not lost under facets.                          | `gggplot-ob3`.                                                                                                                                                                                                 |
| Coordinate projection                                      | yes            | ggsql `PROJECT` names position aesthetics and coordinate system.                    | `Coord.axes` is the shared output-axis swizzle used by every coord kind.                                                                                                                                       |
| Polar                                                      | partial        | ggsql treats polar as a coordinate system; gggplot has polar with polygon munching. | `coord_polar(theta: "y")` now reassigns the angle via the same `"yx"` swizzle `coordFlip()` uses; munching still needs to extend to paths/lines.                                                               |
| Themes                                                     | partial        | Gribouille has named themes and overrides.                                          | Current theme fields are enough; add elements with labels/annotations.                                                                                                                                         |
| Live/codegen parity                                        | yes            | gggplot-specific.                                                                   | Preserve as a core invariant.                                                                                                                                                                                  |

## Recommended Implementation Order

1. `gggplot-1be.1`: document and test mapped aesthetics vs literal settings.
   This is the conceptual foundation for labels, annotations, and scale fixes.
2. `gggplot-gic`: split color/fill scale plumbing, because this is a real
   correctness issue and a peer-dialect alignment issue.
3. `gggplot-1be.2`: add top-level labels to the IR/DSL, then route guide titles
   through that model.
4. `gggplot-ob3`: fix faceted legend layout using the new label/guide model
   where possible.
5. `gggplot-165`: implement `geomPolygon()` or remove it from public API.
6. `gggplot-1be.4`: add a first annotation/literal layer API — done via
   `annotate("segment"|"rect"|"text"|"point", ...)` (single synthetic-row
   literal layers, `inheritAes: false`) plus dedicated `geom_hline`/
   `geom_vline`/`geom_abline` reference-line builders that span the panel's
   trained domain.
7. `gggplot-1be.3`/`gggplot-5tg`: generalize coordinate projection once the
   user-facing grammar vocabulary is clearer — done: `Coord.axes` replaces the
   cartesian-only `"flip"` coord kind, so `coordFlip()` and
   `coordPolar({ theta: "y" })` both reduce to the same `"yx"` swizzle accepted
   by `Cartesian` and `Polar` in `@use-gpu/plot`.

## Open Design Questions

- Should gggplot use American `color` only, or provide `colour` aliases to match
  ggplot2/Gribouille? The current TypeScript API uses `color`.
- Should `stroke` be a first-class aesthetic distinct from `color`, or should
  `color` remain the outline/stroke aesthetic and `fill` the interior?
- ~~Should annotations be separate `annotate*()` helpers, a `place*()` family
  inspired by ggsql, or `geom*({ inheritAes: false, data: ... })` sugar?~~
  Resolved by `gggplot-1be.4`: a single ggplot2-style `annotate(geom, opts)`
  builds a literal single-row layer (reusing existing geom lowering via a
  synthetic `{ aes: [value] }` data/mapping pair), plus dedicated
  `geom_hline`/`geom_vline`/`geom_abline` builders for reference lines, which
  need the panel's final trained domain rather than a literal position.
- Should `labels()` be additive like `theme()`, or should later label specs
  replace earlier ones?
- How much of ggsql's projection generality belongs in a user-facing DSL versus
  an internal `Coord` representation?
