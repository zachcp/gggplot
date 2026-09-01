// Barrel for the feature-tour documentation examples. The DocExample
// declarations live in two topic modules (examples_basics: mappings, real
// datasets, facets, coords; examples_stats: stats, scales, themes,
// annotations). This file re-exports them and assembles the ordered
// allDocExamples registry (feature-tour examples followed by the per-geom set).
import { geomDocExamples } from "./geom_examples.tsx";
import {
  colorMapped,
  discreteX,
  facetCoordFixed,
  facetCoordFlip,
  facetedScatter,
  facetFree,
  facetFreeX,
  facetFreeY,
  flippedBars,
  groupedHistogram,
  histogramStatBin,
  polarBars,
  scatterLine,
  themedChart,
} from "./examples_basics.tsx";
import {
  annotationComposite,
  classicTheme,
  countStackedBar,
  facetGridStats,
  filledTiles,
  packedTensorReuse,
  polarThetaY,
  residentCategoricalCount,
  scaledAesthetics,
  scaleTransforms,
  smoothLm,
  sqrtScale,
  summaryMean,
  themeComparison,
  tileHeatmap,
  weightedHistogramFallback,
} from "./examples_stats.tsx";

export * from "./examples_basics.tsx";
export * from "./examples_stats.tsx";

export const allDocExamples = [
  scatterLine,
  discreteX,
  histogramStatBin,
  groupedHistogram,
  residentCategoricalCount,
  packedTensorReuse,
  weightedHistogramFallback,
  colorMapped,
  flippedBars,
  polarBars,
  themedChart,
  facetedScatter,
  facetFree,
  facetFreeX,
  facetFreeY,
  facetCoordFlip,
  facetCoordFixed,
  countStackedBar,
  summaryMean,
  smoothLm,
  tileHeatmap,
  annotationComposite,
  scaleTransforms,
  scaledAesthetics,
  facetGridStats,
  polarThetaY,
  themeComparison,
  classicTheme,
  sqrtScale,
  filledTiles,
  ...geomDocExamples,
];
