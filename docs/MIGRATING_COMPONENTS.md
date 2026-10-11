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
`<GeomLayer geom="bar" />` build the same layer. Scales, coords, facets and
themes are still passed as `<GGPart part>` until their own components land.

Parity: of the 65 doc examples in the basics, stats, intervals and shapes pages,
every example rendered through `<GeomLayer>` matches the compile path pixel for
pixel, with two exceptions. Jittered examples vary run to run on either path
(`gggplot-plrj`). Resident-eligible examples still take the CPU stats on the
component path until the product tier arrives there (`gggplot-280`).
