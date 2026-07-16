import {
  annotate,
  applyStat,
  coordFlip,
  coordPolar,
  facetGrid,
  facetWrap,
  geomAbline,
  geomBar,
  geomCol,
  geomHistogram,
  geomHline,
  geomLine,
  geomPoint,
  geomSmooth,
  geomText,
  geomTile,
  geomVline,
  ggplot,
  labels,
  scaleColorViridis,
  scaleFill,
  scaleLinetype,
  scaleLinewidth,
  scaleShape,
  scaleSize,
  scaleXLog10,
  scaleXSqrt,
  theme,
  themeClassic,
  themeGrey,
} from "@gggplot/core";
import type { Aes, DataFrame, GGSpec } from "@gggplot/core";
import type { DocExample } from "./types.ts";
import {
  countData,
  facetedData,
  groupedData,
  groupedHistogramData,
  heatmapData,
  histogramData,
  rankedData,
  scatterData,
  smoothData,
  summaryData,
  transformData,
} from "./data/demo.ts";

function previewStatRows(spec: GGSpec, layerIndex = 0): DataFrame | undefined {
  const layer = spec.layers[layerIndex];
  if (!layer || layer.stat === "identity") return undefined;
  const mapping: Aes = layer.inheritAes === false
    ? (layer.mapping ?? {})
    : { ...spec.mapping, ...layer.mapping };
  const data = layer.data ?? spec.data;
  return applyStat(layer, mapping, data).data;
}

export const scatterLine: DocExample = {
  id: "ScatterLine",
  title: "Scatter + line",
  description: "Continuous x/y scales, two layers over the same mapping.",
  whatChanged:
    "Both layers share the plot mapping. The compiler lowers points to a Point node and the sorted path to a Line node.",
  dataPreview: scatterData,
  dslSource: `ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPoint({ size: 6, color: "#3b82f6" }))
  .add(geomLine({ color: "#ef4444" }))
  .build();`,
  spec: ggplot(scatterData, { x: "wt", y: "mpg" })
    .add(geomPoint({ size: 6, color: "#3b82f6" }))
    .add(geomLine({ color: "#ef4444" }))
    .build(),
};

export const discreteX: DocExample = {
  id: "DiscreteX",
  title: "Discrete x",
  description:
    "A character column is inferred as a factor and mapped to level-index positions.",
  whatChanged:
    "The x column trains a discrete position scale, so the string levels become stable numeric slots before rendering.",
  dataPreview: rankedData,
  dslSource: `ggplot(data, { x: "tier", y: "score" })
  .add(geomPoint({ size: 8, color: "#1baf7a" }))
  .build();`,
  spec: ggplot(rankedData, { x: "tier", y: "score" })
    .add(geomPoint({ size: 8, color: "#1baf7a" }))
    .build(),
};

const histogramStatBinSpec = ggplot(histogramData, { x: "value" })
  .add(geomHistogram({ binwidth: 1, fill: "#3b82f6" }))
  .build();

export const histogramStatBin: DocExample = {
  id: "HistogramStatBin",
  title: "Histogram with stat_bin",
  description:
    "A bar layer can request stat_bin to reduce raw continuous values into count bins.",
  whatChanged:
    "stat_bin replaces raw x values with bin centers and emits computed count and density columns.",
  dataPreview: histogramData,
  dslSource: `ggplot(data, { x: "value" })
  .add(geomHistogram({ binwidth: 1, fill: "#3b82f6" }))
  .build();`,
  computedDataPreview: previewStatRows(histogramStatBinSpec),
  spec: histogramStatBinSpec,
};

const groupedHistogramSpec = ggplot(groupedHistogramData, {
  x: "value",
  fill: "cohort",
})
  .add(geomHistogram({ binwidth: 1 }))
  .build();

export const groupedHistogram: DocExample = {
  id: "GroupedHistogram",
  title: "Grouped histogram",
  description:
    "Mapped fill becomes an effective group before stat_bin, so counts are reduced per cohort.",
  whatChanged:
    "The fill factor is encoded as group ids before groupedHistogram1d counts each cohort per bin.",
  dataPreview: groupedHistogramData,
  dslSource: `ggplot(data, { x: "value", fill: "cohort" })
  .add(geomHistogram({ binwidth: 1 }))
  .build();`,
  computedDataPreview: previewStatRows(groupedHistogramSpec),
  spec: groupedHistogramSpec,
};

export const colorMapped: DocExample = {
  id: "ColorMapped",
  title: "Color-mapped scatter",
  description:
    "A discrete color aesthetic assigns the fixed categorical palette by factor level.",
  whatChanged:
    "Mapped color trains a discrete color scale and emits a legend; literal color params would skip both.",
  dataPreview: groupedData,
  dslSource: `ggplot(data, { x: "wt", y: "mpg", color: "cyl" })
  .add(geomPoint({ size: 8 }))
  .add(theme({ textColor: "#e8e8f0" }))
  .build();`,
  spec: ggplot(groupedData, { x: "wt", y: "mpg", color: "cyl" })
    .add(geomPoint({ size: 8 }))
    .add(theme({ textColor: "#e8e8f0" }))
    .build(),
};

export const mtcarsLineStyles: DocExample = {
  id: "MtcarsLineStyles",
  title: "Real-data line styles",
  description:
    "The vendored mtcars table is loaded lazily as typed columns; transmission maps to linetype and horsepower maps to linewidth.",
  whatChanged:
    "The scale stage turns transmission levels into one dash binding per effective group and maps horsepower into per-vertex GPU line widths. No stat result or row-shaped transfer is introduced.",
  dslSource: `const data = await loadStaticDataset("mtcars");
ggplot(data, { x: "wt", y: "mpg", linetype: "am", linewidth: "hp" })
  .add(geomLine({ color: "#38bdf8" }))
  .add(scaleLinetype({ name: "Transmission" }))
  .add(scaleLinewidth({ name: "Horsepower", range: [1, 4] }))
  .build();`,
  dataSource: { id: "mtcars" },
  buildSpec: (data) =>
    ggplot(data, { x: "wt", y: "mpg", linetype: "am", linewidth: "hp" })
      .add(
        geomLine({ color: "#38bdf8" }),
        scaleLinetype({ name: "Transmission" }),
        scaleLinewidth({ name: "Horsepower", range: [1, 4] }),
      )
      .build(),
};

export const mpgFuelEconomy: DocExample = {
  id: "MpgFuelEconomy",
  title: "Fuel economy by vehicle class",
  description:
    "The real ggplot2 mpg dataset is fetched on demand and kept as typed columns through scale training and point lowering.",
  whatChanged:
    "Class is a factor, so color trains a categorical guide while displacement and highway mileage remain numeric GPU mark inputs. This is a direct mark path: no stat product or data readback is required.",
  dslSource: `const data = await loadStaticDataset("mpg");
ggplot(data, { x: "displ", y: "hwy", color: "class" })
  .add(geomPoint({ size: 4 }))
  .build();`,
  dataSource: { id: "mpg" },
  buildSpec: (data) =>
    ggplot(data, { x: "displ", y: "hwy", color: "class" })
      .add(geomPoint({ size: 4 }))
      .build(),
};

export const mpgContinuousPalettes: DocExample = {
  id: "MpgContinuousPalettes",
  title: "Continuous palette selection",
  description:
    "A real mpg scatter uses a viridis color ramp for highway mileage; changing the scale changes only color bindings.",
  whatChanged:
    "Viridis is stored as a small serializable scale ramp. The same typed point positions and source columns remain valid, so a palette change does not rerun a stat or re-upload the data. scaleColorGradient2() offers the corresponding diverging ramp for centered values.",
  dslSource: `const data = await loadStaticDataset("mpg");
ggplot(data, { x: "displ", y: "cty", color: "hwy" })
  .add(geomPoint({ size: 4 }))
  .add(scaleColorViridis({ name: "Highway MPG" }))
  .build();`,
  dataSource: { id: "mpg" },
  buildSpec: (data) =>
    ggplot(data, { x: "displ", y: "cty", color: "hwy" })
      .add(
        geomPoint({ size: 4 }),
        scaleColorViridis({ name: "Highway MPG" }),
      )
      .build(),
};

export const irisMeasurements: DocExample = {
  id: "IrisMeasurements",
  title: "Iris measurements",
  description:
    "The classic iris table demonstrates a typed real-data scatter plot with a discrete species guide.",
  whatChanged:
    "Sepal dimensions lower to positions while Species trains the color scale. The chart is lazy at the site boundary: the CSV is not requested until this example is opened.",
  dslSource: `const data = await loadStaticDataset("iris");
ggplot(data, { x: "Sepal.Length", y: "Sepal.Width", color: "Species" })
  .add(geomPoint({ size: 4 }))
  .build();`,
  dataSource: { id: "iris" },
  buildSpec: (data) =>
    ggplot(data, { x: "Sepal.Length", y: "Sepal.Width", color: "Species" })
      .add(geomPoint({ size: 4 }))
      .build(),
};

export const flippedBars: DocExample = {
  id: "FlippedBars",
  title: "Flipped bar chart",
  description:
    "coord_flip swaps the rendered axes without touching the data or trained domains.",
  whatChanged:
    "The bar polygons stay in data space; the cartesian coord projects the rendered axes as yx.",
  dataPreview: rankedData,
  dslSource: `ggplot(data, { x: "tier", y: "score" })
  .add(geomCol({ color: "#eb6834" }), coordFlip())
  .build();`,
  spec: ggplot(rankedData, { x: "tier", y: "score" })
    .add(geomCol({ color: "#eb6834" }), coordFlip())
    .build(),
};

export const polarBars: DocExample = {
  id: "PolarPoints",
  title: "Polar bars",
  description:
    "coord_polar bends bars into wedges with munched curved edges and polar grid guides.",
  whatChanged:
    "Rectangular bar polygons are subdivided before the nonlinear polar projection so edges curve smoothly.",
  dataPreview: rankedData,
  dslSource: `ggplot(data, { x: "tier", y: "score" })
  .add(geomCol({ color: "#4a3aa7" }), coordPolar())
  .build();`,
  spec: ggplot(rankedData, { x: "tier", y: "score" })
    .add(geomCol({ color: "#4a3aa7" }), coordPolar())
    .build(),
};

export const themedChart: DocExample = {
  id: "ThemedChart",
  title: "Themed chart",
  description:
    "theme() draws a panel background while recoloring the grid and axes above it.",
  whatChanged:
    "Theme defaults flow into grid, axis, and Label nodes unless a layer overrides them.",
  dataPreview: groupedData,
  dslSource: `ggplot(data, { x: "wt", y: "mpg", label: "cyl" })
  .add(geomPoint({ size: 8, color: "#1a1a2e" }))
  .add(geomText({ size: 14 }))
  .add(theme({ background: "#241f45", gridColor: "#a78bfa", axisColor: "#4a3aa7", fontFamily: "Georgia" }))
  .build();`,
  spec: ggplot(groupedData, { x: "wt", y: "mpg", label: "cyl" })
    .add(geomPoint({ size: 8, color: "#1a1a2e" }))
    .add(geomText({ size: 14 }))
    .add(
      theme({
        background: "#241f45",
        gridColor: "#a78bfa",
        axisColor: "#4a3aa7",
        fontFamily: "Georgia",
      }),
    )
    .build(),
};

export const facetedScatter: DocExample = {
  id: "FacetedScatter",
  title: "Faceted scatter (facet_wrap)",
  description:
    "facet_wrap partitions the data by cyl into one panel per level with shared x/y scales.",
  whatChanged:
    "Rows are sliced per facet level, while scales and plot-level legends remain shared across panels.",
  dataPreview: facetedData,
  dslSource: `ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPoint({ size: 8, color: "#3b82f6" }), facetWrap(["cyl"]))
  .build();`,
  spec: ggplot(facetedData, { x: "wt", y: "mpg" })
    .add(geomPoint({ size: 8, color: "#3b82f6" }), facetWrap(["cyl"]))
    .build(),
};

const countStackedBarSpec = ggplot(countData, { x: "class", fill: "drive" })
  .add(geomBar())
  .build();

export const countStackedBar: DocExample = {
  id: "CountStackedBar",
  title: "Counted, stacked bars",
  description:
    "geomBar defaults to stat_count, then stacks the counted rows by mapped fill.",
  whatChanged:
    "stat_count emits one count row per class and drive group before position stacking builds bar polygons.",
  dataPreview: countData,
  dslSource: `ggplot(data, { x: "class", fill: "drive" })
  .add(geomBar())
  .build();`,
  computedDataPreview: previewStatRows(countStackedBarSpec),
  spec: countStackedBarSpec,
};

const summaryMeanSpec = ggplot(summaryData, { x: "day", y: "score" })
  .add(geomPoint({ stat: "summary", size: 9, color: "#0f766e" }))
  .build();

export const summaryMean: DocExample = {
  id: "SummaryMean",
  title: "Summary mean",
  description:
    "stat_summary reduces repeated observations to a mean y value for each x level.",
  whatChanged:
    "The stat encodes x levels, reduces y with groupedSummary1d, and renders the computed means as points.",
  dataPreview: summaryData,
  dslSource: `ggplot(data, { x: "day", y: "score" })
  .add(geomPoint({ stat: "summary", size: 9, color: "#0f766e" }))
  .build();`,
  computedDataPreview: previewStatRows(summaryMeanSpec),
  spec: summaryMeanSpec,
};

const smoothLmSpec = ggplot(smoothData, {
  x: "dose",
  y: "response",
  color: "cohort",
})
  .add(geomPoint({ size: 6 }))
  .add(geomSmooth({ method: "lm", se: false, n: 5 }))
  .build();

export const smoothLm: DocExample = {
  id: "SmoothLm",
  title: "Grouped linear smooth",
  description:
    "geomSmooth fits one linear model per mapped color group and emits fitted line rows.",
  whatChanged:
    "Effective color groups feed groupedLinearRegression1d; the compiler lowers each fitted group to a Line.",
  dataPreview: smoothData,
  dslSource: `ggplot(data, { x: "dose", y: "response", color: "cohort" })
  .add(geomPoint({ size: 6 }))
  .add(geomSmooth({ method: "lm", se: false, n: 5 }))
  .build();`,
  computedDataPreview: previewStatRows(smoothLmSpec, 1),
  spec: smoothLmSpec,
};

export const tileHeatmap: DocExample = {
  id: "TileHeatmap",
  title: "Tile heatmap",
  description:
    "geomTile maps a rectangular grid to polygon cells, with fill trained from a numeric value column.",
  whatChanged:
    "The compiler computes cell widths from x/y resolution and widens domains so edge tiles are not clipped.",
  dataPreview: heatmapData,
  dslSource: `ggplot(data, { x: "x", y: "y", fill: "value" })
  .add(geomTile())
  .build();`,
  spec: ggplot(heatmapData, { x: "x", y: "y", fill: "value" })
    .add(geomTile())
    .build(),
};

export const annotationComposite: DocExample = {
  id: "AnnotationComposite",
  title: "Annotations and reference lines",
  description:
    "Annotations are literal layers that do not inherit the plot mapping, while reference lines span the trained domain.",
  whatChanged:
    "Each annotation becomes a tiny synthetic layer; hline/vline/abline are lowered after scale training.",
  dataPreview: scatterData,
  dslSource: `ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPoint({ size: 6, color: "#2563eb" }))
  .add(geomHline({ yintercept: 20, color: "#ef4444" }))
  .add(geomVline({ xintercept: 3, color: "#0f766e" }))
  .add(geomAbline({ slope: -4, intercept: 32, color: "#7c3aed" }))
  .add(annotate("rect", { xmin: 2.4, xmax: 3.6, ymin: 17, ymax: 23, fill: "#f59e0b" }))
  .add(annotate("text", { x: 3.7, y: 24, label: "target band", color: "#f8fafc" }))
  .build();`,
  spec: ggplot(scatterData, { x: "wt", y: "mpg" })
    .add(geomPoint({ size: 6, color: "#2563eb" }))
    .add(geomHline({ yintercept: 20, color: "#ef4444" }))
    .add(geomVline({ xintercept: 3, color: "#0f766e" }))
    .add(geomAbline({ slope: -4, intercept: 32, color: "#7c3aed" }))
    .add(
      annotate("rect", {
        xmin: 2.4,
        xmax: 3.6,
        ymin: 17,
        ymax: 23,
        fill: "#f59e0b",
      }),
    )
    .add(
      annotate("text", {
        x: 3.7,
        y: 24,
        label: "target band",
        color: "#f8fafc",
      }),
    )
    .build(),
};

export const scaleTransforms: DocExample = {
  id: "ScaleTransforms",
  title: "Scale transforms",
  description:
    "A transformed x scale trains and maps values through log10 or sqrt before marks are emitted.",
  whatChanged:
    "The x domain and every x position are transformed consistently; y remains on the original continuous scale.",
  dataPreview: transformData,
  dslSource: `ggplot(data, { x: "size", y: "latency" })
  .add(geomPoint({ size: 8, color: "#2563eb" }))
  .add(geomLine({ color: "#0f766e" }))
  .add(scaleXLog10())
  .build();`,
  spec: ggplot(transformData, { x: "size", y: "latency" })
    .add(geomPoint({ size: 8, color: "#2563eb" }))
    .add(geomLine({ color: "#0f766e" }))
    .add(scaleXLog10())
    .build(),
};

export const scaledAesthetics: DocExample = {
  id: "ScaledAesthetics",
  title: "Size and shape scales",
  description:
    "Mapped size and shape aesthetics train their own scales and emit compact legends.",
  whatChanged:
    "Continuous size values interpolate into radii while shape levels pick fixed glyphs from the shape palette.",
  dataPreview: {
    wt: groupedData.wt,
    mpg: groupedData.mpg,
    cyl: groupedData.cyl,
    size: [8, 12, 16, 9, 18, 10, 14, 13],
  },
  dslSource: `ggplot(data, { x: "wt", y: "mpg", size: "size", shape: "cyl" })
  .add(geomPoint())
  .add(scaleSize({ range: [4, 12] }), scaleShape())
  .build();`,
  spec: ggplot({
    ...groupedData,
    size: [8, 12, 16, 9, 18, 10, 14, 13],
  }, { x: "wt", y: "mpg", size: "size", shape: "cyl" })
    .add(geomPoint(), scaleSize({ range: [4, 12] }), scaleShape())
    .build(),
};

export const facetGridStats: DocExample = {
  id: "FacetGridStats",
  title: "Facet grid with per-panel stats",
  description:
    "Facets partition rows before stats, so each panel gets its own counted bars.",
  whatChanged:
    "facet_grid crosses drive and class levels, slices panel data, then runs stat_count inside each panel.",
  dataPreview: countData,
  dslSource: `ggplot(data, { x: "drive" })
  .add(geomBar({ fill: "#3b82f6" }), facetGrid(["class"], ["drive"]))
  .build();`,
  spec: ggplot(countData, { x: "drive" })
    .add(geomBar({ fill: "#3b82f6" }), facetGrid(["class"], ["drive"]))
    .build(),
};

export const polarThetaY: DocExample = {
  id: "PolarThetaY",
  title: "Polar theta y",
  description:
    "coord_polar can reassign the angle to y, sharing the same projection model as coord_flip.",
  whatChanged:
    "The coord stores a yx projection, so the polar view reads y as the angular axis.",
  dataPreview: rankedData,
  dslSource: `ggplot(data, { x: "tier", y: "score" })
  .add(geomCol({ color: "#0f766e" }), coordPolar({ theta: "y" }))
  .build();`,
  spec: ggplot(rankedData, { x: "tier", y: "score" })
    .add(geomCol({ color: "#0f766e" }), coordPolar({ theta: "y" }))
    .build(),
};

export const themeComparison: DocExample = {
  id: "ThemeComparison",
  title: "Theme comparison",
  description:
    "Theme helpers set panel, grid, axis, and text defaults without changing data or scales.",
  whatChanged:
    "The same point layer is compiled under theme_grey plus a custom override for text color.",
  dataPreview: scatterData,
  dslSource: `ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPoint({ size: 7, color: "#111827" }), themeGrey(), theme({ textColor: "#111827" }))
  .build();`,
  spec: ggplot(scatterData, { x: "wt", y: "mpg" })
    .add(
      geomPoint({ size: 7, color: "#111827" }),
      themeGrey(),
      theme({ textColor: "#111827" }),
    )
    .build(),
};

export const classicTheme: DocExample = {
  id: "ClassicTheme",
  title: "Classic theme",
  description:
    "themeClassic removes grid lines while keeping axes and marks unchanged.",
  whatChanged:
    "Only guide/theme nodes change; the compiled Point positions are identical to the default theme.",
  dataPreview: scatterData,
  dslSource: `ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPoint({ size: 7, color: "#2563eb" }), themeClassic())
  .build();`,
  spec: ggplot(scatterData, { x: "wt", y: "mpg" })
    .add(geomPoint({ size: 7, color: "#2563eb" }), themeClassic())
    .build(),
};

export const sqrtScale: DocExample = {
  id: "SqrtScale",
  title: "Sqrt x scale",
  description:
    "A sqrt scale is another position transform over the same source rows.",
  whatChanged:
    "The transform path is shared with log scales: domains and mark positions are both projected through the scale.",
  dataPreview: transformData,
  dslSource: `ggplot(data, { x: "size", y: "latency" })
  .add(geomPoint({ size: 8, color: "#7c3aed" }))
  .add(scaleXSqrt())
  .build();`,
  spec: ggplot(transformData, { x: "size", y: "latency" })
    .add(geomPoint({ size: 8, color: "#7c3aed" }), scaleXSqrt())
    .build(),
};

export const filledTiles: DocExample = {
  id: "FilledTiles",
  title: "Custom fill range",
  description:
    "A continuous fill mapping can use an explicit color range while the tile grid stays the same.",
  whatChanged:
    "Only fill scale interpolation changes; tile positions and domain widening are unchanged.",
  dataPreview: heatmapData,
  dslSource: `ggplot(data, { x: "x", y: "y", fill: "value" })
  .add(geomTile(), scaleFill({ range: ["#dbeafe", "#1d4ed8"] }))
  .build();`,
  spec: ggplot(heatmapData, { x: "x", y: "y", fill: "value" })
    .add(geomTile(), scaleFill({ range: ["#dbeafe", "#1d4ed8"] }))
    .build(),
};

export const allDocExamples = [
  scatterLine,
  discreteX,
  histogramStatBin,
  groupedHistogram,
  colorMapped,
  flippedBars,
  polarBars,
  themedChart,
  facetedScatter,
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
];
