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
  - GroupedHistogram's bar width and x domain were fixed later (below).
  - ResidentTileStrip has no CPU equivalent (examples_stats.tsx).
- **The three histograms** (GroupedHistogram, HistogramStatBin,
  WeightedHistogramFallback), at gggplot-py8d. As in ggplot2, `stat_bin` now
  reports its binwidth as `width`, so CPU bars span their whole bin and touch
  instead of filling 0.9 of it. The x range is the outer bin edges on both
  paths: the resident layer no longer pads the raw data by a bar's half-width.
  - GroupedHistogram's resident frame against its CPU frame (the same chart with
    `<Execution resident={false} />`) went from ~12k changed pixels to 1771.
    Everything is within tolerance except one row: the CPU frame omits the y =
    20 gridline that its axis labels. That is a separate CPU bug (gggplot-ovcn),
    and the resident frame is the correct one.
- **Nine frames whose grid now sits on the axis labels** (AlignedStackedArea,
  ContourBands, FlippedBars, HistogramStatBin, RectangularAndHexBins,
  StackedArea, Streamgraph, SummaryHexCells, ZoomedPanel), at gggplot-ovcn. The
  grid used to break the trained scale before widening, while the labels broke
  the widened domain. A stacked total, a bar's zero baseline or a tile's
  half-cell could add a labeled break with no line, or move every line off the
  labels (FlippedBars drew 10/20/30/40 under labels 25/50/75/100). Both now
  break the same scale. Under coord_cartesian zoom both break the zoomed view,
  so ZoomedPanel labels 0–60 instead of spreading 0–100 over a 0–60 panel.
  ZoomedPanel still draws no bars, as its old golden didn't (gggplot-arby), and
  discrete labels still sit at the panel edges (gggplot-vfpf).
