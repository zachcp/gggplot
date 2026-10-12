# gggplot

The grammar of graphics as composable **[Use.GPU](https://usegpu.live) Live
components**, built as a Deno workspace. A plot is a component tree: data,
layers, scales, coords, facets and themes are elements you compose, and the tree
renders on WebGPU next to any other Live component.

```tsx
/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
import * as Jsx from "@gggplot/core/jsx";
import { GeomPoint, GeomSmooth, GGPlot, Labs, ScaleColor } from "@gggplot/core";

export const chart = (
  <GGPlot data={mtcars} mapping={{ x: "wt", y: "mpg", color: "cyl" }}>
    <GeomPoint size={3} />
    <GeomSmooth method="lm" />
    <ScaleColor />
    <Labs title="Weight against fuel economy" />
  </GGPlot>
);
```

"GPU-rendered" describes the rendering backend, not a claim that every stat runs
on the GPU. Eligible bin/count stats are GPU-resident products the plot hosts
and reads its y range back from; other stats run on the CPU and pack once into
stable GPU sources. See the
[architecture](docs/ARCHITECTURE.md#4-gpu-native-execution-model) and the
[CPU/GPU residency matrix](docs/RESIDENCY_MATRIX.md).

## What's here

| Path                              | Description                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/core/`                  | `@gggplot/core`: the components, the grammar's stats, scales, positions and geoms. |
| `packages/reductions/`            | `@gggplot/reductions`: the CPU/GPU reductions behind count, bin and summary stats. |
| `packages/model-inspect/`         | `@gggplot/model-inspect`: renderer-neutral model inspection products.              |
| `apps/site/`                      | The documentation site: every example is component JSX rendered live on WebGPU.    |
| `docs/ARCHITECTURE.md`            | The design: the component tiers, the Use.GPU mapping, and the execution model.     |
| `docs/MIGRATING_COMPONENTS.md`    | Moving from the removed `GGSpec`/DSL/`compile` API to components.                  |
| `docs/ADR_007_COMPONENT_FIRST.md` | Why components are the only authoring form.                                        |

## Requirements

- [Deno](https://deno.land) >= 2.1
- A WebGPU browser for live rendering: Chrome/Edge 113+, or Safari 18+

## Quick start

```bash
# Build a component tree in code and print it as JSX, no browser:
deno task demo

# Type-check, lint and test the workspace:
deno task check
deno task lint
deno task test

# Doc site dev server at http://localhost:8080
deno task dev
deno task build    # production build -> apps/site/dist/
```

`gggplot print chart.tsx` writes a module's component tree out as the JSX you
would write, with its data imported by reference (`deno task gggplot print`).

## Deploying The Doc Site

The site is a static Vite build:

```bash
deno task build
```

Deploy `apps/site/dist/` to any static host that serves `index.html`, JS assets,
font files, and `.wasm` files. Live rendering requires a WebGPU-capable browser
in a secure context, so use HTTPS in production. For a local production smoke
test, run:

```bash
deno task preview
```

## How a plot renders

```
<GGData load>                    data tier: mount columns once, share them
  <GGPlot data mapping>          the root
    <GeomPoint/> <ScaleX…/> …    parts, captured in tree order
      │ prepare   filter rows, run CPU stats, plan GPU products
      │ train     scales and domains across layers (and read-back products)
      │ layout    guides, panels and marks at the host's size
      ▼
    Use.GPU Live: <Plot>/<Cartesian>/<Polar>/<Scene3D>, layers, compute
```

A resize re-runs layout only; a changed layer re-prepares only itself; an
unchanged mark keeps its GPU buffers. `<GGPanel>` and `useGGScales()` let custom
Use.GPU primitives draw in a panel's data space with the plot's scales. See
`docs/ARCHITECTURE.md`.

## Status

The component path covers the core stats, scales, positions, geoms, facets,
cartesian/flip/polar coords, 3D, theming, legends, GPU-resident bin/count
products and PNG export (`ggsave`). Task tracking lives in
[beads](https://github.com/gastownhall/beads); run `bd ready`.
