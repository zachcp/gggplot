# gggplot Architecture

gggplot transpiles a **grammar-of-graphics specification** into a **UseGPU Live**
component tree. This document covers the three concerns the project must get
right: the **API** (how users describe plots), the **UseGPU mapping** (what we
compile *to*), and the **transpilation process** (how we get from one to the
other).

---

## 1. The API — a ggplot-shaped DSL

ggplot2 builds a plot by adding layers with `+`. TypeScript has no operator
overloading, so we use a fluent builder whose `.add()` plays the role of `+`:

```ts
ggplot(data, aes({ x: "wt", y: "mpg", color: "cyl" }))
  .add(geomPoint({ size: 3 }))
  .add(geomSmooth({ method: "lm" }))
  .add(scaleColor())
  .add(facetWrap(["gear"]))
  .add(themeMinimal())
  .build();      // → GGSpec
```

Design rules:

- **`aes()` maps aesthetics to *column names*** (`x: "wt"`). Fixed aesthetics
  (`color: "red"`) go in the geom's params, exactly like ggplot's
  aes-vs-argument distinction.
- **Every `geom_*`/`scale_*`/`coord_*`/`facet_*`/`theme_*` returns a `SpecPart`**
  — a small tagged object. `.add()` folds parts into the spec. This keeps the
  DSL a thin, pure layer over the IR, and makes parts reorderable and testable.
- **Data is a column-oriented `DataFrame`** (`Record<string, unknown[]>`), the
  natural shape for tabular data and for vectorized scale/stat operations.

### The IR (`src/ir/types.ts`)

`ggplot(...).build()` produces a **`GGSpec`** — plain serializable data with no
UseGPU or DOM dependency. It is the transpiler's AST:

```ts
interface GGSpec {
  data: DataFrame;
  mapping: Aes;          // plot-level aesthetics
  layers: Layer[];       // geom + stat + position + param/data overrides
  scales: Scale[];       // declared scales (domains filled in by training)
  coord: Coord;          // cartesian | polar | flip | fixed
  facet: Facet;          // none | wrap | grid
  theme: Theme;
}
```

Because the IR is serializable, plots can be saved, diffed, sent over the wire,
and round-tripped through either backend.

---

## 2. The UseGPU mapping — what we compile *to*

The key enabler: **`@use-gpu/plot` is already a grammar-of-graphics engine.**
Its exports line up almost 1:1 with ggplot concepts, so gggplot is mostly a
*lowering*, not a rendering engine.

| ggplot concept        | `@use-gpu/plot` target                          |
|-----------------------|-------------------------------------------------|
| `ggplot()` root       | `<Plot>`                                         |
| `coord_cartesian()`   | `<Cartesian range={[[x0,x1],[y0,y1]]} axes>`     |
| `coord_polar()`       | `<Polar>`                                         |
| `geom_point()`        | `<Point positions colors size>`                  |
| `geom_line/path()`    | `<Line positions color width>`                   |
| `geom_polygon/area()` | `<Polygon>` / `<Face>`                           |
| `geom_text()`         | `<Label>`                                         |
| axis guides           | `<Axis axis="x">`, `<Axis axis="y">`             |
| grid / panel.grid     | `<Grid axes="xy">`                               |
| scales / data binding | `source/scale`, `DataContext`, `RangeContext`    |
| facets                | multiple views (`<Cartesian>` panels / `Scissor`)|

Two JSX worlds coexist (as in usegpu-deno): React owns the app shell; UseGPU
Live components open with the classic pragma:

```ts
/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
import { createElement, Fragment } from "@use-gpu/live";
```

---

## 3. The transpilation process

The compiler mirrors ggplot2's own build pipeline. `compile(spec)` runs these
stages and returns a **RenderTree** — an abstract, serializable description of
the UseGPU component tree (`{ component, props, children }`).

```
GGSpec
  │
  ├─ ① stat transform      per layer: identity | count | bin | smooth | summary
  │                        (may add computed columns, e.g. stat_count → y)
  ├─ ② scale training      scan post-stat data across layers → domains;
  │                        map data → visual space (position, color, size)
  ├─ ③ facet partition     split data into panels (wrap / grid)
  ├─ ④ coord resolution    pick the view: Cartesian | Polar (+ flip/fixed)
  ├─ ⑤ geom → mark          scaled aesthetics → shape component + props
  └─ ⑥ guides / theme       axes, grid, legends, background
  ▼
RenderTree
```

### Why a RenderTree in the middle?

It **decouples the front-end from the back-end** and gives us *two backends from
one compiler*:

```
RenderTree
  ├── renderLive()   → UseGPU Live elements via createElement   (runtime)
  └── emitSource()   → .tsx source string                        (codegen)
```

- **`renderLive` (`src/render/GGPlot.tsx`)** — `<GGPlot spec>` compiles and maps
  each node to a real `@use-gpu/plot` component. Used by the interactive doc
  page; hosts inside a `<WebGPU><AutoCanvas><Pass>`.
- **`emitSource` (`src/emit/mod.ts`)** — walks the same tree and prints a
  self-contained UseGPU Live `.tsx` module. This is the literal "transpiler"
  and the basis for a future `gggplot compile` CLI.

Both consume the identical RenderTree, so behavior can't drift between "live"
and "emitted," and either can be tested in isolation.

### Module layout (`packages/core/src`)

```
ir/         GGSpec types (the AST)
dsl/        ggplot()/aes()/geom_*/scale_*/coord_*/facet_*/theme_*
stat/       stat transforms (registry; identity done, rest stubbed)
scale/      scale training + aesthetic mapping (x/y continuous done)
compile/    IR → RenderTree  (the transpiler core) + rendertree.ts
render/     RenderTree → UseGPU Live  (runtime backend)
emit/       RenderTree → .tsx source  (codegen backend)
mod.ts      public API
```

---

## Roadmap (tracked in beads)

1. **Geoms**: bar/col, area, tile, polygon, text, ribbon, errorbar, boxplot.
2. **Stats**: `count`, `bin` (histogram), `smooth` (lm/loess), `summary`.
3. **Scales**: discrete scales, color/size/shape palettes, log/sqrt transforms,
   legends as guides.
4. **Coords**: real polar, `coord_flip`, fixed aspect.
5. **Facets**: `facet_wrap`/`facet_grid` panel layout + shared/free scales.
6. **Positions**: stack, dodge, fill, jitter.
7. **Theme**: background, gridlines, fonts, spacing → UseGPU props.
8. **CLI**: `gggplot compile spec.ts → chart.tsx` on top of `emitSource`.
9. **Doc site**: gallery of examples, live editing, side-by-side emitted source.
```
