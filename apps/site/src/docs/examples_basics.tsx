/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// Feature-tour examples, written as component JSX (gggplot-vnh.10.1). Each
// `chart` is the live example, and the reader sees it printed (printJsx,
// gggplot-vnh.11) with the site's <SitePlot> (dark theme, loaded fonts) shown
// as <GGPlot>. Data the source names is exported, so it prints by name.
import * as Jsx from "@gggplot/core/jsx";
import {
  CoordCartesian,
  CoordFixed,
  CoordFlip,
  CoordPolar,
  Execution,
  FacetWrap,
  GeomCol,
  GeomHistogram,
  GeomLine,
  GeomPoint,
  GeomText,
  GGData,
  ScaleColorViridis,
  ScaleLinetype,
  ScaleLinewidth,
  ThemeOverrides,
} from "@gggplot/core";
import { SitePlot } from "../site_plot.tsx";
import type { DocExample } from "./types.ts";
import {
  facetedData,
  groupedData,
  rankedData,
  scatterData,
} from "./data/demo.ts";
import { loadIris, loadMpg, loadMtcars } from "./data/real.ts";

export const scatterLine: DocExample = {
  id: "ScatterLine",
  title: "Scatter + line",
  description: "Continuous x/y scales, two layers over the same mapping.",
  whatChanged:
    "Both layers share the plot mapping. Points lower to a Point mark and the sorted path to a Line mark.",
  dataPreview: scatterData,
  chart: () => (
    <SitePlot data={scatterData} mapping={{ x: "wt", y: "mpg" }}>
      <GeomPoint size={6} color="#3b82f6" />
      <GeomLine color="#ef4444" />
    </SitePlot>
  ),
};

export const discreteX: DocExample = {
  id: "DiscreteX",
  title: "Discrete x",
  description:
    "A character column is inferred as a factor and mapped to level-index positions.",
  whatChanged:
    "The x column trains a discrete position scale, so the string levels become stable numeric slots before rendering.",
  dataPreview: rankedData,
  chart: () => (
    <SitePlot data={rankedData} mapping={{ x: "tier", y: "score" }}>
      <GeomPoint size={8} color="#1baf7a" />
    </SitePlot>
  ),
};

export const histogramStatBin: DocExample = {
  id: "HistogramStatBin",
  title: "Histogram with stat_bin",
  description:
    "The full 234-row mpg table shows stat_bin over engine displacement.",
  whatChanged:
    "This example selects the CPU-reference stat path so its computed bin geometry remains inspectable; 234 observations make the distribution shape and bin resolution visible.",
  dataSource: { id: "mpg" },
  chart: () => (
    <GGData load={loadMpg}>
      <SitePlot mapping={{ x: "displ" }}>
        <GeomHistogram bins={18} fill="#3b82f6" />
        <Execution resident={false} />
      </SitePlot>
    </GGData>
  ),
};

export const groupedHistogram: DocExample = {
  id: "GroupedHistogram",
  title: "Grouped histogram",
  description:
    "All 150 iris measurements show species-specific sepal-length distributions.",
  whatChanged:
    "Species is encoded as the factor group for stat_bin. Because it uses the default discrete fill scale, the group grid and mapped palette remain eligible for the resident path.",
  dataSource: { id: "iris" },
  chart: () => (
    <GGData load={loadIris}>
      <SitePlot mapping={{ x: "Sepal.Length", fill: "Species" }}>
        <GeomHistogram bins={16} opacity={0.78} />
      </SitePlot>
    </GGData>
  ),
};

export const categoricalGroupedData = {
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
  chart: () => (
    <SitePlot
      data={categoricalGroupedData}
      mapping={{ x: "wt", y: "mpg", color: "cyl" }}
    >
      <GeomPoint size={8} />
      <ThemeOverrides textColor="#e8e8f0" />
    </SitePlot>
  ),
};

export const mtcarsLineStyles: DocExample = {
  id: "MtcarsLineStyles",
  title: "Real-data line styles",
  description:
    "The vendored mtcars table is loaded lazily as typed columns; transmission maps to linetype and horsepower maps to linewidth.",
  whatChanged:
    "The scale stage turns transmission levels into one dash binding per effective group and maps horsepower into per-vertex GPU line widths. No stat result or row-shaped transfer is introduced.",
  dataSource: { id: "mtcars" },
  chart: () => (
    <GGData load={loadMtcars}>
      <SitePlot
        mapping={{ x: "wt", y: "mpg", linetype: "am", linewidth: "hp" }}
      >
        <GeomLine color="#38bdf8" />
        <ScaleLinetype name="Transmission" />
        <ScaleLinewidth name="Horsepower" range={[1, 4]} />
      </SitePlot>
    </GGData>
  ),
};

export const mpgFuelEconomy: DocExample = {
  id: "MpgFuelEconomy",
  title: "Fuel economy by vehicle class",
  description:
    "The real ggplot2 mpg dataset is fetched on demand and kept as typed columns through scale training and point lowering.",
  whatChanged:
    "Class is a factor, so color trains a categorical guide while displacement and highway mileage remain numeric GPU mark inputs. This is a direct mark path: no stat product or data readback is required.",
  dataSource: { id: "mpg" },
  chart: () => (
    <GGData load={loadMpg}>
      <SitePlot mapping={{ x: "displ", y: "hwy", color: "class" }}>
        <GeomPoint size={4} />
      </SitePlot>
    </GGData>
  ),
};

export const mpgContinuousPalettes: DocExample = {
  id: "MpgContinuousPalettes",
  title: "Continuous palette selection",
  description:
    "A real mpg scatter uses a viridis color ramp for highway mileage; changing the scale changes only color bindings.",
  whatChanged:
    "Viridis is stored as a small serializable scale ramp. The same typed point positions and source columns remain valid, so a palette change does not rerun a stat or re-upload the data. <ScaleColorGradient2> offers the corresponding diverging ramp for centered values.",
  dataSource: { id: "mpg" },
  chart: () => (
    <GGData load={loadMpg}>
      <SitePlot mapping={{ x: "displ", y: "cty", color: "hwy" }}>
        <GeomPoint size={4} />
        <ScaleColorViridis name="Highway MPG" />
      </SitePlot>
    </GGData>
  ),
};

export const irisMeasurements: DocExample = {
  id: "IrisMeasurements",
  title: "Iris measurements",
  description:
    "The classic iris table demonstrates a typed real-data scatter plot with a discrete species guide.",
  whatChanged:
    "Sepal dimensions lower to positions while Species trains the color scale. The chart is lazy at the site boundary: the CSV is not requested until this example is opened.",
  dataSource: { id: "iris" },
  chart: () => (
    <GGData load={loadIris}>
      <SitePlot
        mapping={{ x: "Sepal.Length", y: "Sepal.Width", color: "Species" }}
      >
        <GeomPoint size={4} />
      </SitePlot>
    </GGData>
  ),
};

export const flippedBars: DocExample = {
  id: "FlippedBars",
  title: "Flipped bar chart",
  description:
    "coord_flip swaps the rendered axes without touching the data or trained domains.",
  whatChanged:
    "The bar polygons stay in data space; the cartesian coord projects the rendered axes as yx.",
  dataPreview: rankedData,
  chart: () => (
    <SitePlot data={rankedData} mapping={{ x: "tier", y: "score" }}>
      <GeomCol color="#eb6834" />
      <CoordFlip />
    </SitePlot>
  ),
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
  chart: () => (
    <SitePlot data={rankedData} mapping={{ x: "tier", y: "score" }}>
      <GeomCol color="#38bdf8" />
      <CoordCartesian ylim={[0, 60]} />
    </SitePlot>
  ),
};

export const polarBars: DocExample = {
  id: "PolarPoints",
  title: "Polar bars",
  description:
    "coord_polar bends bars into wedges with munched curved edges and polar grid guides.",
  whatChanged:
    "Rectangular bar polygons are subdivided before the nonlinear polar projection so edges curve smoothly.",
  dataPreview: rankedData,
  chart: () => (
    <SitePlot data={rankedData} mapping={{ x: "tier", y: "score" }}>
      <GeomCol color="#4a3aa7" />
      <CoordPolar />
    </SitePlot>
  ),
};

export const themedChart: DocExample = {
  id: "ThemedChart",
  title: "Themed chart",
  description:
    "Theme overrides draw a panel background while recoloring the grid and axes above it.",
  whatChanged:
    "Theme defaults flow into grid, axis, and Label marks unless a layer overrides them.",
  dataPreview: groupedData,
  chart: () => (
    <SitePlot
      data={groupedData}
      mapping={{ x: "wt", y: "mpg", label: "cyl", family: "family" }}
    >
      <GeomPoint size={8} color="#1a1a2e" />
      <GeomText size={14} angle={-25} color="#f8fafc" />
      <ThemeOverrides
        background="#241f45"
        gridColor="#a78bfa"
        axisColor="#4a3aa7"
        fontFamily="Basic"
      />
    </SitePlot>
  ),
};

export const facetedScatter: DocExample = {
  id: "FacetedScatter",
  title: "Faceted scatter (facet_wrap)",
  description:
    "facet_wrap partitions the data by cyl into one panel per level with shared x/y scales.",
  whatChanged:
    "Rows are sliced per facet level, while scales and plot-level legends remain shared across panels.",
  dataPreview: facetedData,
  chart: () => (
    <SitePlot data={facetedData} mapping={{ x: "wt", y: "mpg" }}>
      <GeomPoint size={8} color="#3b82f6" />
      <FacetWrap vars={["cyl"]} />
    </SitePlot>
  ),
};

export const freeFacetData = {
  group: ["small", "small", "large", "large"],
  x: [0, 1, 100, 200],
  y: [0, 10, 1000, 2000],
};

/** The text shared by the three free-scale facet fixtures. */
const freeFacetText = (scales: string) => ({
  title: `Facet wrap with ${scales} scales`,
  description:
    `Visible fixture for panel-local ${scales} domain training and axis policy.`,
  whatChanged:
    "The same rows are partitioned into two panels while only the requested position domains train locally.",
  dataPreview: freeFacetData,
});

export const facetFree: DocExample = {
  id: "FacetFree",
  ...freeFacetText("free"),
  chart: () => (
    <SitePlot data={freeFacetData} mapping={{ x: "x", y: "y" }}>
      <GeomPoint size={8} />
      <FacetWrap vars={["group"]} ncol={2} scales="free" />
    </SitePlot>
  ),
};

export const facetFreeX: DocExample = {
  id: "FacetFreeX",
  ...freeFacetText("free_x"),
  chart: () => (
    <SitePlot data={freeFacetData} mapping={{ x: "x", y: "y" }}>
      <GeomPoint size={8} />
      <FacetWrap vars={["group"]} ncol={2} scales="free_x" />
    </SitePlot>
  ),
};

export const facetFreeY: DocExample = {
  id: "FacetFreeY",
  ...freeFacetText("free_y"),
  chart: () => (
    <SitePlot data={freeFacetData} mapping={{ x: "x", y: "y" }}>
      <GeomPoint size={8} />
      <FacetWrap vars={["group"]} ncol={2} scales="free_y" />
    </SitePlot>
  ),
};

export const facetCoordFlip: DocExample = {
  id: "FacetCoordFlip",
  title: "Facets with flipped coordinates",
  description: "Facet rectangles remain stable while displayed axes swap.",
  whatChanged:
    "<CoordFlip> projects y horizontally and x vertically inside each panel.",
  dataPreview: facetedData,
  chart: () => (
    <SitePlot data={facetedData} mapping={{ x: "wt", y: "mpg" }}>
      <GeomPoint />
      <FacetWrap vars={["cyl"]} />
      <CoordFlip />
    </SitePlot>
  ),
};

export const facetCoordFixed: DocExample = {
  id: "FacetCoordFixed",
  title: "Facets with fixed aspect",
  description:
    "A fixed unit ratio applies independently inside every responsive panel.",
  whatChanged:
    "<CoordFixed> locks the Cartesian ratio without changing facet membership.",
  dataPreview: facetedData,
  chart: () => (
    <SitePlot data={facetedData} mapping={{ x: "wt", y: "mpg" }}>
      <GeomPoint />
      <FacetWrap vars={["cyl"]} />
      <CoordFixed />
    </SitePlot>
  ),
};
