import {
  coordCartesian,
  coordFixed,
  coordFlip,
  coordPolar,
  execution,
  facetWrap,
  geomCol,
  geomHistogram,
  geomLine,
  geomPoint,
  geomText,
  ggplot,
  scaleColorViridis,
  scaleLinetype,
  scaleLinewidth,
  theme,
} from "@gggplot/core";
import type { DocExample } from "./types.ts";
import {
  facetedData,
  groupedData,
  rankedData,
  scatterData,
} from "./data/demo.ts";

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

export const histogramStatBin: DocExample = {
  id: "HistogramStatBin",
  title: "Histogram with stat_bin",
  description:
    "The full 234-row mpg table shows stat_bin over engine displacement.",
  whatChanged:
    "This example selects the CPU-reference stat path so its computed bin geometry remains inspectable; 234 observations make the distribution shape and bin resolution visible.",
  dslSource: `const data = await loadStaticDataset("mpg");
ggplot(data, { x: "displ" })
  .add(geomHistogram({ bins: 18, fill: "#3b82f6" }))
  .add(execution({ resident: false }))
  .build();`,
  dataSource: { id: "mpg" },
  buildSpec: (data) =>
    ggplot(data, { x: "displ" })
      .add(geomHistogram({ bins: 18, fill: "#3b82f6" }))
      .add(execution({ resident: false }))
      .build(),
};

export const groupedHistogram: DocExample = {
  id: "GroupedHistogram",
  title: "Grouped histogram",
  description:
    "All 150 iris measurements show species-specific sepal-length distributions.",
  whatChanged:
    "Species is encoded as the factor group for stat_bin. Because it uses the default discrete fill scale, the group grid and mapped palette remain eligible for the resident path.",
  dslSource: `const data = await loadStaticDataset("iris");
ggplot(data, { x: "Sepal.Length", fill: "Species" })
  .add(geomHistogram({ bins: 16, opacity: 0.78 }))
  .build();`,
  dataSource: { id: "iris" },
  buildSpec: (data) =>
    ggplot(data, { x: "Sepal.Length", fill: "Species" })
      .add(geomHistogram({ bins: 16, opacity: 0.78 }))
      .build(),
};

const categoricalGroupedData = {
  ...groupedData,
  cyl: groupedData.cyl.map((value) => `cyl ${value}`),
};

export const colorMapped: DocExample = {
  id: "ColorMapped",
  title: "Color-mapped scatter",
  description:
    "A discrete color aesthetic assigns the fixed categorical palette by factor level.",
  whatChanged:
    "Mapped color trains a discrete color scale and emits a legend; literal color params would skip both.",
  dataPreview: categoricalGroupedData,
  dslSource: `ggplot(data, { x: "wt", y: "mpg", color: "cyl" })
  .add(geomPoint({ size: 8 }))
  .add(theme({ textColor: "#e8e8f0" }))
  .build();`,
  spec: ggplot(categoricalGroupedData, {
    x: "wt",
    y: "mpg",
    color: "cyl",
  })
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

export const zoomedPanel: DocExample = {
  id: "ZoomedPanel",
  title: "Zoom without dropping rows",
  description:
    "coord_cartesian narrows the view only. A scale domain would remove the excluded rows before the stat ran; this keeps every observation and clips the drawing to the panel.",
  visualSummary:
    "The same bars as above, viewed through a narrowed y window, with nothing spilling past the axes.",
  whatChanged:
    "The panel range narrows while the layer still receives every row, so any stat sees the full data. Marks outside the window are clipped by a scissor rather than culled, which is what keeps a zoomed boxplot's summary identical to the unzoomed one.",
  dataPreview: rankedData,
  dslSource: `ggplot(data, { x: "tier", y: "score" })
  .add(geomCol({ color: "#38bdf8" }), coordCartesian({ ylim: [0, 60] }))
  .build();`,
  spec: ggplot(rankedData, { x: "tier", y: "score" })
    .add(geomCol({ color: "#38bdf8" }), coordCartesian({ ylim: [0, 60] }))
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
  dslSource:
    `ggplot(data, { x: "wt", y: "mpg", label: "cyl", family: "family" })
  .add(geomPoint({ size: 8, color: "#1a1a2e" }))
  .add(geomText({ size: 14, angle: -25, color: "#f8fafc" }))
  .add(theme({ background: "#241f45", gridColor: "#a78bfa", axisColor: "#4a3aa7", fontFamily: "Basic" }))
  .build();`,
  spec: ggplot(groupedData, {
    x: "wt",
    y: "mpg",
    label: "cyl",
    family: "family",
  })
    .add(geomPoint({ size: 8, color: "#1a1a2e" }))
    .add(geomText({ size: 14, angle: -25, color: "#f8fafc" }))
    .add(
      theme({
        background: "#241f45",
        gridColor: "#a78bfa",
        axisColor: "#4a3aa7",
        fontFamily: "Basic",
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

const freeFacetData = {
  group: ["small", "small", "large", "large"],
  x: [0, 1, 100, 200],
  y: [0, 10, 1000, 2000],
};

const freeFacetExample = (
  id: string,
  scales: "free" | "free_x" | "free_y",
): DocExample => ({
  id,
  title: `Facet wrap with ${scales} scales`,
  description:
    `Visible fixture for panel-local ${scales} domain training and axis policy.`,
  whatChanged:
    "The same rows are partitioned into two panels while only the requested position domains train locally.",
  dataPreview: freeFacetData,
  dslSource: `ggplot(data, { x: "x", y: "y" })
  .add(geomPoint({ size: 8 }), facetWrap(["group"], 2, "${scales}"))
  .build();`,
  spec: ggplot(freeFacetData, { x: "x", y: "y" })
    .add(geomPoint({ size: 8 }), facetWrap(["group"], 2, scales))
    .build(),
});

export const facetFree = freeFacetExample("FacetFree", "free");
export const facetFreeX = freeFacetExample("FacetFreeX", "free_x");
export const facetFreeY = freeFacetExample("FacetFreeY", "free_y");

export const facetCoordFlip: DocExample = {
  id: "FacetCoordFlip",
  title: "Facets with flipped coordinates",
  description: "Facet rectangles remain stable while displayed axes swap.",
  whatChanged:
    "coordFlip projects y horizontally and x vertically inside each panel.",
  dataPreview: facetedData,
  dslSource: `ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPoint(), facetWrap(["cyl"]), coordFlip())
  .build();`,
  spec: ggplot(facetedData, { x: "wt", y: "mpg" })
    .add(geomPoint(), facetWrap(["cyl"]), coordFlip())
    .build(),
};

export const facetCoordFixed: DocExample = {
  id: "FacetCoordFixed",
  title: "Facets with fixed aspect",
  description:
    "A fixed unit ratio applies independently inside every responsive panel.",
  whatChanged:
    "coordFixed locks the Cartesian ratio without changing facet membership.",
  dataPreview: facetedData,
  dslSource: `ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPoint(), facetWrap(["cyl"]), coordFixed())
  .build();`,
  spec: ggplot(facetedData, { x: "wt", y: "mpg" })
    .add(geomPoint(), facetWrap(["cyl"]), coordFixed())
    .build(),
};
