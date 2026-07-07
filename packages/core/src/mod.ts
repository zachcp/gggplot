// @gggplot/core — a ggplot → UseGPU Live transpiler.
//
// Pipeline:  DSL → GGSpec (IR) → compile() → RenderTree → { renderLive | emitSource }
// See docs/ARCHITECTURE.md for the full design.

// IR types (the transpiler's AST)
export type * from "./ir/types.ts";

// DSL — ggplot()/aes()/geom_*/scale_*/coord_*/facet_*/theme_*
export * from "./dsl/mod.ts";

// Compiler + render tree
export { compile } from "./compile/mod.ts";
export { node, type ComponentName, type RenderNode } from "./compile/rendertree.ts";

// Backends
export { emitSource } from "./emit/mod.ts";
export { FacetGrid, type FacetGridProps, GGPlot, renderTree, type GGPlotProps } from "./render/GGPlot.tsx";

// Pipeline stages (exposed for testing/extension)
export { applyStat, type StatFn, type StatResult } from "./stat/mod.ts";
export {
  expandRange,
  scaleAlphaValue,
  scaleColorValue,
  scalePosition,
  scaleShapeValue,
  scaleSizeValue,
  trainScales,
  type TrainedScale,
} from "./scale/mod.ts";
export { categoricalColor, categoricalRange, sequentialColor } from "./scale/palette.ts";
export {
  dodgeBars,
  jitter,
  type PlacedBar,
  type PositionedBar,
  stackBars,
} from "./position/mod.ts";
