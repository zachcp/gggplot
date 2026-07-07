# gggplot

A **ggplot → [UseGPU](https://usegpu.live) Live** transpiler, built as a Deno
workspace. Write a grammar-of-graphics spec; get a GPU-rendered chart — either
live in the browser or emitted as standalone `@use-gpu/plot` source.

## What's here

| Path | Description |
|---|---|
| `packages/core/` | `@gggplot/core` — the library: DSL, IR, compiler, and both backends. |
| `apps/site/` | Vite doc page demonstrating the transpiler (DSL → emitted source → live WebGPU render). |
| `docs/ARCHITECTURE.md` | The design: API, UseGPU mapping, and transpilation pipeline. |

## Requirements

- [Deno](https://deno.land) >= 2.1
- A WebGPU browser for live rendering: Chrome/Edge 113+, or Safari 18+

## Quick start

```bash
# Transpiler end-to-end, no browser (prints render tree + emitted source):
deno task demo

# Type-check the library:
deno task check

# Library tests:
deno task --cwd packages/core test

# Doc site dev server at http://localhost:8080
deno task dev
deno task build    # production build -> apps/site/dist/
```

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

## Pipeline

```
ggplot(data, aes(...)).add(geomPoint())      DSL
        │  build
GGSpec (IR)                                   the transpiler's "AST"
        │  compile()  — stat → scales → facet → coord → geoms → guides
RenderTree                                    abstract UseGPU node tree
        ├── renderLive()  → UseGPU Live elements   (<GGPlot spec>, runtime)
        └── emitSource()  → .tsx source string     (codegen)
```

`@use-gpu/plot` already provides the target vocabulary — `Plot`, `Cartesian`/
`Polar`, `Point`/`Line`/`Polygon`, `Axis`/`Grid` — so gggplot's job is to lower
a ggplot spec onto those primitives. See `docs/ARCHITECTURE.md`.

## Status

Working end-to-end for the core DSL, stats, scales, positions, common geoms,
facets, cartesian/flip/polar coords, theming, legends, emitted source, and the
live WebGPU backend. Task tracking lives in
[beads](https://github.com/gastownhall/beads) — run `bd ready`.
