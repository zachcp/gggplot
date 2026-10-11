# Golden frames

One PNG per doc example (`?capture=<id>`, a 640x400 canvas): the frame the
compile path drew before `compile()` was retired (gggplot-w8zq), captured with
`scripts/example_frames.ts capture`. `ComposeWithUseGpu` never had a compile
form; its golden is its own verified chart frame.

`deno task --cwd apps/site test:goldens` renders every example's hand-written
JSX (`DocExample.chart`, `&path=chart`) and compares it with its golden:

- A difference of up to 32 per channel is allowed. Glyph anti-aliasing depends
  on the atlas's packing order, which depends on mount history, so the same
  chart's text differs from itself by up to ~24. Marks and grids that move or
  recolor differ by far more.
- An example without a golden, a missing frame or a changed frame size fails.

The 68 2D examples and 11 3D showcases were pixel-identical to these goldens
when the JSX rewrite (gggplot-vnh.10.1) landed. To add an example, verify its
chart and capture its golden:

```sh
deno run -A scripts/example_frames.ts capture-chart goldens <ExampleId>
```

## Re-captured goldens

- **The five resident examples** (CountStackedBar, GroupedHistogram,
  ResidentCategoricalCount, ResidentInlineBars, ResidentTileStrip), at
  gggplot-vnh.5.1. That change gave the component root the resident products, so
  every resident plot now gets y-axis labels. The standalone views it replaced
  drew no labels.
  - Against the same chart with `<Execution resident={false} />`:
    - ResidentInlineBars is identical. Its old golden had no trained y, so the
      bars ran to the top of the panel instead of five-sixths of the way up
      to 6000.
    - CountStackedBar and ResidentCategoricalCount differ only at edges. The
      re-leveled count grid (gggplot-mos5) put CountStackedBar's suv and pickup
      bars back under their own labels.
  - GroupedHistogram keeps the resident bar width and x domain (gggplot-py8d).
  - ResidentTileStrip has no CPU equivalent (examples_stats.tsx).
