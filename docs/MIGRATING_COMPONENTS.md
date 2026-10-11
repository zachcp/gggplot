# Migrating to component-first gggplot

gggplot is moving from "compile a spec, then render the tree" to Use.GPU Live
components you compose yourself (epic `gggplot-vnh`). This guide collects what
changes for hosts and users, one section per change as it lands. The `GGSpec` +
DSL path keeps working throughout: `<GGPlot spec>` stays a supported facade.

## Typed Live JSX (`@gggplot/core/jsx`)

`GGPlot` used to return `any`. That was the only way a Live component could be
used from a `.tsx` file: the classic `@jsx createElement` pragma makes
TypeScript check JSX against React's namespace, and React rejects a component
that returns a `LiveElement` (TS2786). It now returns a real `LiveElement`, and
`@gggplot/core/jsx` supplies a JSX namespace for Live.

Opt a file in with a **qualified** pragma:

```tsx
/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
/** @jsxFrag Jsx.Fragment */
import * as Jsx from "@gggplot/core/jsx";
import { GGPlot } from "@gggplot/core";

export const Chart = ({ spec }) => <GGPlot spec={spec} />; // props checked
```

The pragma has to be qualified. An unqualified `@jsx createElement` still
resolves to React's namespace, even when `createElement` comes from this module.

Without JSX (plain `.ts`), call the same factory. Props are checked the same
way:

```ts
import { createElement } from "@gggplot/core/jsx";
createElement(GGPlot, { spec }); // a wrong or missing prop is a type error
```

### What hosts change

- **A Live scene file** (one that renders `<WebGPU>`, `<AutoCanvas>`,
  `<GGPlot>`, ...) switches its pragma as above. Use.GPU's own components
  type-check under it too, and the checks are real: an incompatible prop that
  React's namespace let through can now surface, e.g. passing
  `FontResources.faces` to `FontLoader`.
- **A React file that mounts a Live scene inside `<LiveCanvas>`** builds the
  scene with the factory instead of React JSX, since the scene is a Live
  element, not a React one:

  ```tsx
  import { createElement as liveElement } from "@gggplot/core/jsx";
  <LiveCanvas>{(canvas) => liveElement(Scene, { canvas, spec })}</LiveCanvas>;
  ```

`apps/site/src/live_jsx_example.tsx` holds the checked examples, including the
wrong-prop cases that must keep failing; it is part of `deno task check`.

## Layers as components (`<GeomLayer>`)

A layer is now a child of the component root, in z-order:

```tsx
<GGPlot data={mpg} mapping={{ x: "displ", y: "hwy", color: "drv" }}>
  <GeomPoint size={3} opacity={0.55} />
  <GeomSmooth method="loess" se={false} />
</GGPlot>;
```

Every DSL constructor has a named component: `geomPoint(opts)` becomes
`<GeomPoint {...opts} />`, `statSummary2d(opts)` becomes `<StatSummary2d />`,
and `annotate("text", opts)` becomes `<Annotate geom="text" />`. Their props are
typed per geom family, so a parameter the geom does not read is a type error
(`<GeomPoint bins={3} />`). Parameters a component does not type go through
`params`, for example another stat's after a `stat` override:
`<GeomPoint stat="summary" params={{ fun: "max" }} />`.
`geomFunction(fun, opts)` becomes `<GeomFunction fun={fun} />`.

The untyped form underneath is `<GeomLayer geom="point" ... />`.

`<GeomLayer geom>` takes what the DSL's `geomX(opts)` took: `mapping`, a
layer-only `data` (with `dataOptions`), `stat`, `position`, `inheritAes`, and
every other prop as a geom/stat parameter. Defaults for `stat` and `position`
come from the geom registry, as before, so `geomBar()` and
`<GeomLayer geom="bar" />` build the same layer.

## Plot parts as components

Scales, coords, facets, themes, labels, the 3D camera and the execution policy
are children too, one component per DSL constructor:

| DSL                               | Component                                             |
| --------------------------------- | ----------------------------------------------------- |
| `scaleXLog10({ name })`           | `<ScaleXLog10 name="..." />`                          |
| `scaleColorViridis()`             | `<ScaleColorViridis />`                               |
| `coordCartesian({ ylim })`        | `<CoordCartesian ylim={[0, 60]} />`                   |
| `coordPolar({ theta: "y" })`      | `<CoordPolar theta="y" />`                            |
| `coordFixed(2)`                   | `<CoordFixed ratio={2} />`                            |
| `facetWrap(["g"], 2, "free_y")`   | `<FacetWrap vars={["g"]} ncol={2} scales="free_y" />` |
| `facetGrid(["a"], ["b"])`         | `<FacetGrid rows={["a"]} cols={["b"]} />`             |
| `labels({ title })`               | `<Labs title="..." />`                                |
| `themeMinimal()` + `theme({...})` | `<ThemeMinimal fontSize={12} />`                      |
| `theme({...})`                    | `<ThemeOverrides gridColor="#eee" />`                 |
| `camera3d(opts)`                  | `<Camera3d {...opts} />`                              |
| `execution({ resident: false })`  | `<Execution resident={false} />`                      |

They apply in tree order with the DSL's `.add()` semantics: a later coord, facet
or camera replaces an earlier one, while themes and labels merge. A theme
preset's props override its fields. `theme()` became `<ThemeOverrides>` because
`Theme` is already the type's name.

Parity: of the 65 doc examples in the basics, stats, intervals and shapes pages,
every example rendered through components matches the compile path pixel for
pixel. The exception is jittered examples, which vary from run to run on either
path (`gggplot-plrj`).

## GPU-resident stats

Layers eligible for a GPU stat (stat_count and stat_bin bars and tile strips, by
the same rules as before) render from resident products on the component path
too. The root mounts each distinct product once and hands it to every mark that
reads it, so two layers over one bin grid dispatch it once. Nothing changes for
authors: `<Execution resident={false} />` still opts a plot out.

## Row-removal diagnostics

`compile()` reported dropped rows on the tree root (`diagnostics`) and with a
console warning. The component root keeps both. `onDiagnostics` is called with
the same records whenever the set changes, including an empty list once it
clears:

```tsx
<GGPlot data={data} mapping={{ x: "x", y: "y" }} onDiagnostics={setRemovals}>
  <GeomPoint />
  <ScaleXContinuous domain={[0, 10]} />
</GGPlot>;
```

The warning fires once per distinct set rather than on every re-assembly, so a
resize does not repeat it.

## Custom primitives in the panel (`<GGPanel>`)

Any Use.GPU component can draw inside the plot's panel, in its data coordinates,
after the marks:

```tsx
<GGPlot data={mtcars} mapping={{ x: "wt", y: "mpg", color: "mpg" }}>
  <GeomPoint />
  <GGPanel>
    <MyPrimitive />
  </GGPanel>
</GGPlot>;
```

Inside, `useGGColors(values, aes?)` and `useGGSizes(values)` return lambda
sources computed by the plot's own GPU scale functions, the ones gggplot's bound
points use. A primitive colored with them matches a point layer exactly and
follows every retrain by uniform write, with no relink. `useGGScales()` gives
the immutable trained scales and their revision for CPU work, and `useGGPanel()`
gives the panel's bounds. In a faceted plot the content draws in every panel; in
3D, in the scene's data space.

## Custom layers (`<GGLayer>`)

`<GGPanel>` draws but trains nothing. `<GGLayer>` declares the rows and
aesthetics its primitive shows, as a geom would. They train the plot's scales,
widening the axes and adding a legend for any color, fill or size it maps, and
they are censored and faceted like any layer's rows. Its children draw in the
panel and bind those same scales:

```tsx
<GGLayer data={stations} mapping={{ x: "lon", y: "lat", color: "temp" }}>
  <StationGlyphs />
</GGLayer>;
```

### `sceneExtras` is gone

`<GGPlot spec sceneExtras={...}>` mounted extra Live content in a 3D scene by
splicing it into the compiled tree. Put that content in `<GGPanel>` instead. In
a 3D plot it draws in the scene's Cartesian, inside the 3D camera's view, which
is where `ScenePicker` and `PrismInstances3D` need to be.
