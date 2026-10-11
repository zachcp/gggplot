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
