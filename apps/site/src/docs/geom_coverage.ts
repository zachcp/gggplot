export interface GeomExampleCoverage {
  exampleIds: readonly string[];
  mode: "dedicated" | "comparison";
}

/** Public geom constructor -> docs examples where it is a primary subject. */
export const geomExampleCoverage: Readonly<
  Record<string, GeomExampleCoverage>
> = {
  geomPoint: { exampleIds: ["ScatterLine"], mode: "comparison" },
  geomLine: { exampleIds: ["ScatterLine"], mode: "comparison" },
  geomPath: { exampleIds: ["PathOrder"], mode: "dedicated" },
  geomBar: { exampleIds: ["CountStackedBar"], mode: "dedicated" },
  geomHistogram: { exampleIds: ["HistogramStatBin"], mode: "dedicated" },
  geomCol: { exampleIds: ["FlippedBars"], mode: "dedicated" },
  geomArea: { exampleIds: ["AreaAndRibbon"], mode: "comparison" },
  geomRibbon: { exampleIds: ["AreaAndRibbon"], mode: "comparison" },
  geomPolygon: { exampleIds: ["PolygonShapes"], mode: "dedicated" },
  geomTile: { exampleIds: ["TileHeatmap"], mode: "dedicated" },
  geomRaster: { exampleIds: ["RasterGrid"], mode: "dedicated" },
  geomText: { exampleIds: ["ThemedChart"], mode: "comparison" },
  geomLabel: {
    exampleIds: ["LabelsAndIntervals", "LabelBackgrounds"],
    mode: "comparison",
  },
  geomBoxplot: { exampleIds: ["LabelsAndIntervals"], mode: "comparison" },
  geomErrorbar: { exampleIds: ["LabelsAndIntervals"], mode: "comparison" },
  geomErrorbarh: { exampleIds: ["IntervalFamily"], mode: "comparison" },
  geomLinerange: { exampleIds: ["IntervalFamily"], mode: "comparison" },
  geomPointrange: { exampleIds: ["IntervalFamily"], mode: "comparison" },
  geomCrossbar: { exampleIds: ["IntervalFamily"], mode: "comparison" },
  geomSmooth: { exampleIds: ["SmoothLm"], mode: "dedicated" },
  geomDensity: { exampleIds: ["DensityCurve"], mode: "dedicated" },
  geomDensity2d: { exampleIds: ["Density2dContours"], mode: "comparison" },
  geomDensity2dFilled: {
    exampleIds: ["Density2dContours"],
    mode: "comparison",
  },
  geomEcdf: { exampleIds: ["EmpiricalCdf"], mode: "dedicated" },
  geomViolin: { exampleIds: ["ViolinAndDots"], mode: "comparison" },
  geomDotplot: { exampleIds: ["ViolinAndDots"], mode: "comparison" },
  geomBin2d: { exampleIds: ["RectangularAndHexBins"], mode: "comparison" },
  geomHex: { exampleIds: ["RectangularAndHexBins"], mode: "comparison" },
  geomWaffle: { exampleIds: ["WaffleChart"], mode: "dedicated" },
  geomQq: { exampleIds: ["QqDiagnostics"], mode: "comparison" },
  geomQqLine: { exampleIds: ["QqDiagnostics"], mode: "comparison" },
  geomQuantile: { exampleIds: ["QuantileRegression"], mode: "dedicated" },
  geomContour: { exampleIds: ["ContourBands"], mode: "comparison" },
  geomContourFilled: { exampleIds: ["ContourBands"], mode: "comparison" },
  geomCount: { exampleIds: ["CountedPoints"], mode: "dedicated" },
  geomFreqpoly: { exampleIds: ["FreqpolyAndJitter"], mode: "comparison" },
  geomBlank: { exampleIds: ["FunctionAndBlank"], mode: "comparison" },
  geomStep: { exampleIds: ["ConnectedGeomVariants"], mode: "comparison" },
  geomCurve: { exampleIds: ["ConnectedGeomVariants"], mode: "comparison" },
  geomSpoke: { exampleIds: ["ConnectedGeomVariants"], mode: "comparison" },
  geomRug: { exampleIds: ["ConnectedGeomVariants"], mode: "comparison" },
  geomFunction: { exampleIds: ["FunctionAndBlank"], mode: "comparison" },
  geomJitter: { exampleIds: ["FreqpolyAndJitter"], mode: "comparison" },
  geomHline: { exampleIds: ["AnnotationComposite"], mode: "comparison" },
  geomVline: { exampleIds: ["AnnotationComposite"], mode: "comparison" },
  geomAbline: { exampleIds: ["AnnotationComposite"], mode: "comparison" },
};
