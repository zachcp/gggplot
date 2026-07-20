// Barrel for the per-geom documentation examples. The DocExample declarations
// live in two topic modules (shapes/connectors/distributions and
// intervals/smoothing/stacking); this file re-exports them and assembles the
// ordered geomDocExamples registry consumed by pages.ts and examples.tsx.
import {
  areaAndRibbon,
  boxplotReference,
  connectedGeomVariants,
  contourBands,
  countedPoints,
  density2dContours,
  densityCurve,
  freqpolyAndJitter,
  functionAndBlank,
  labelsAndIntervals,
  pathOrder,
  polygonShapes,
  qqDiagnostics,
  rasterGrid,
  rectangularAndHexBins,
  violinAndDots,
  violinReference,
} from "./geom_examples_shapes.tsx";
import {
  alignedStackedArea,
  bumpChart,
  empiricalCdf,
  intervalFamily,
  labelBackgrounds,
  loessSmooth,
  logisticSmooth,
  quantileRegression,
  stackedArea,
  streamgraph,
  summaryHexCells,
  uniqueRows,
  waffleChart,
} from "./geom_examples_intervals.tsx";

export * from "./geom_examples_shapes.tsx";
export * from "./geom_examples_intervals.tsx";

export const geomDocExamples = [
  pathOrder,
  areaAndRibbon,
  polygonShapes,
  rasterGrid,
  labelsAndIntervals,
  boxplotReference,
  densityCurve,
  violinAndDots,
  violinReference,
  rectangularAndHexBins,
  qqDiagnostics,
  contourBands,
  freqpolyAndJitter,
  connectedGeomVariants,
  functionAndBlank,
  countedPoints,
  density2dContours,
  intervalFamily,
  quantileRegression,
  loessSmooth,
  logisticSmooth,
  labelBackgrounds,
  empiricalCdf,
  uniqueRows,
  summaryHexCells,
  streamgraph,
  stackedArea,
  alignedStackedArea,
  bumpChart,
  waffleChart,
];
