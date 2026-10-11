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
