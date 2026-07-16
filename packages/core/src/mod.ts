// @gggplot/core — a ggplot → UseGPU Live transpiler.
//
// Pipeline:  DSL → GGSpec (IR) → compile() → RenderTree → { renderLive | emitSource }
// See docs/ARCHITECTURE.md for the full design.

// IR types (the transpiler's AST)
export type * from "./ir/types.ts";

// Portable semantic declarations — CPU/GPU bindings are mounted separately.
export * from "./plan/mod.ts";

// Mounted resource lifecycle. Use.GPU adapters satisfy the opaque source factory.
export * from "./runtime/mod.ts";

// DSL — ggplot()/aes()/geom_*/scale_*/coord_*/facet_*/theme_*
export * from "./dsl/mod.ts";

// Data ingestion prototype — row/column-store raw data -> typed columns.
export * from "./data/mod.ts";

// Compiler + render tree
export { compile, type CompileOptions } from "./compile/mod.ts";
export {
  type ComponentName,
  node,
  type RenderNode,
} from "./compile/rendertree.ts";
export {
  groupColumnsOf,
  groupKeyAt,
  splitByEffectiveGroup,
} from "./group/mod.ts";

// Backends
export { emitSource } from "./emit/mod.ts";
export {
  FacetGrid,
  type FacetGridProps,
  GGPlot,
  type GGPlotProps,
  renderTree,
} from "./render/GGPlot.tsx";

// Pipeline stages (exposed for testing/extension)
export {
  applyStat,
  createStatBinProductPlan,
  type StatBinPlanOptions,
  type StatFn,
  type StatResult,
} from "./stat/mod.ts";
export {
  expandRange,
  namedLinetypeValue,
  scaleAlphaValue,
  scaleColorValue,
  scaleLinetypeValue,
  scaleLinewidthValue,
  scalePosition,
  scaleShapeValue,
  scaleSizeValue,
  type TrainedScale,
  trainScales,
} from "./scale/mod.ts";
export {
  categoricalColor,
  categoricalRange,
  GRADIENT2_RAMP,
  interpolateColorRamp,
  sequentialColor,
  VIRIDIS_RAMP,
} from "./scale/palette.ts";
export {
  dodgeBars,
  jitter,
  type PlacedBar,
  type PositionedBar,
  stackBars,
} from "./position/mod.ts";
export {
  createHistogramBarTopologyPlan,
  type HistogramBarTopologyOptions,
} from "./geom/bar_grid.ts";
