/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// Path, band, polygon, distribution, contour and connected-mark geoms, written
// as component JSX (gggplot-vnh.10.1); see examples_basics.tsx for the
// chart convention.
import * as Jsx from "@gggplot/core/jsx";
import {
  GeomArea,
  GeomBin2d,
  GeomBlank,
  GeomBoxplot,
  GeomContour,
  GeomContourFilled,
  GeomCount,
  GeomCurve,
  GeomDensity,
  GeomDensity2d,
  GeomDensity2dFilled,
  GeomDotplot,
  GeomErrorbar,
  GeomFreqpoly,
  GeomFunction,
  GeomHex,
  GeomJitter,
  GeomLabel,
  GeomPath,
  GeomPolygon,
  GeomQq,
  GeomQqLine,
  GeomRaster,
  GeomRect,
  GeomRibbon,
  GeomRug,
  GeomSpoke,
  GeomStep,
  GeomViolin,
} from "@gggplot/core";
import { SitePlot } from "../site_plot.tsx";
import type { DocExample } from "./types.ts";
import {
  bandData,
  contourData,
  distributionData,
  heatmapData,
  intervalData,
  pointCloud2dData,
  polygonData,
  rectData,
  scatterData,
} from "./data/demo.ts";

export const pathOrder: DocExample = {
  id: "PathOrder",
  title: "Path preserves row order",
  description:
    "<GeomPath> connects observations in input order instead of sorting by x like <GeomLine>.",
  visualSummary:
    "A connected path that doubles back across the panel in source-row order.",
  whatChanged:
    "The path lowering consumes rows exactly as supplied, making trajectories and ordered traces distinct from line charts.",
  dataPreview: scatterData,
  chart: () => (
    <SitePlot data={scatterData} mapping={{ x: "wt", y: "mpg" }}>
      <GeomPath color="#7c3aed" linewidth={3} />
    </SitePlot>
  ),
};

export const areaAndRibbon: DocExample = {
  id: "AreaAndRibbon",
  title: "Area and ribbon bands",
  description:
    "<GeomArea> closes y to zero while <GeomRibbon> fills independently mapped ymin/ymax bounds.",
  visualSummary:
    "A blue area under a line with a translucent orange uncertainty ribbon.",
  whatChanged:
    "Both geoms lower to closed polygons, but only the ribbon reads two boundary aesthetics.",
  dataPreview: bandData,
  chart: () => (
    <SitePlot data={bandData} mapping={{ x: "x", y: "y" }}>
      <GeomArea fill="#60a5fa" opacity={0.45} />
      <GeomRibbon
        mapping={{ x: "x", ymin: "ymin", ymax: "ymax" }}
        fill="#f59e0b"
        opacity={0.35}
      />
    </SitePlot>
  ),
};

export const rectBounds: DocExample = {
  id: "RectBounds",
  title: "Rectangles from explicit bounds",
  description:
    "<GeomRect> draws one rectangle per row from xmin/xmax/ymin/ymax rather than centring a fixed-size mark on x/y.",
  visualSummary:
    "Four overlapping translucent rectangles of differing size, one per phase.",
  whatChanged:
    "All four corner aesthetics are required, so the mark carries its own extent instead of borrowing a width from a discrete scale the way <GeomTile> does.",
  dataPreview: rectData,
  chart: () => (
    <SitePlot
      data={rectData}
      mapping={{
        xmin: "xmin",
        xmax: "xmax",
        ymin: "ymin",
        ymax: "ymax",
        fill: "phase",
      }}
    >
      <GeomRect opacity={0.55} />
    </SitePlot>
  ),
};

export const polygonShapes: DocExample = {
  id: "PolygonShapes",
  title: "Grouped polygons",
  description:
    "<GeomPolygon> closes one ordered loop per effective group and maps fill independently.",
  visualSummary:
    "A filled square and triangle rendered as separate grouped polygons.",
  whatChanged:
    "The group aesthetic partitions row-ordered vertices before each loop is lowered.",
  dataPreview: polygonData,
  chart: () => (
    <SitePlot
      data={polygonData}
      mapping={{ x: "x", y: "y", group: "group", fill: "group" }}
    >
      <GeomPolygon opacity={0.72} />
    </SitePlot>
  ),
};

export const rasterGrid: DocExample = {
  id: "RasterGrid",
  title: "Full-resolution raster cells",
  description:
    "<GeomRaster> is tile lowering fixed to the complete axis resolution without custom cell dimensions.",
  visualSummary: "A contiguous three-by-three colored raster grid.",
  whatChanged:
    "The raster form keeps cells edge-to-edge while the fill scale maps the numeric value column.",
  dataPreview: heatmapData,
  chart: () => (
    <SitePlot data={heatmapData} mapping={{ x: "x", y: "y", fill: "value" }}>
      <GeomRaster />
    </SitePlot>
  ),
};

export const labelsAndIntervals: DocExample = {
  id: "LabelsAndIntervals",
  title: "Labels, boxplots, and error bars",
  description:
    "<GeomLabel> places mapped labels; <GeomBoxplot> computes grouped quartiles; <GeomErrorbar> draws explicit bounds.",
  visualSummary:
    "Two grouped boxplots with interval caps and labels above their centers.",
  whatChanged:
    "The boxplot uses raw grouped values, while the error bars and labels use layer-specific mappings over the same rows.",
  dataPreview: intervalData,
  chart: () => (
    <SitePlot data={intervalData} mapping={{ x: "group", y: "value" }}>
      <GeomBoxplot fill="#bfdbfe" />
      <GeomErrorbar
        mapping={{ x: "group", ymin: "low", ymax: "high" }}
        width={0.35}
        color="#1d4ed8"
      />
      <GeomLabel
        mapping={{ x: "group", y: "high", label: "group" }}
        color="#111827"
        angle={-12}
      />
    </SitePlot>
  ),
};

export const boxplotReference: DocExample = {
  id: "BoxplotReference",
  title: "Grouped boxplots",
  description:
    "Raw grouped observations are reduced into quartiles, whiskers, and outliers.",
  visualSummary: "Two side-by-side boxplots summarizing grouped values.",
  whatChanged:
    "<GeomBoxplot> owns the example so its stat_boxplot inputs and box topology can be read without unrelated layers.",
  dataPreview: distributionData,
  chart: () => (
    <SitePlot data={distributionData} mapping={{ x: "group", y: "value" }}>
      <GeomBoxplot fill="#bfdbfe" coef={1.5} />
    </SitePlot>
  ),
};

export const densityCurve: DocExample = {
  id: "DensityCurve",
  title: "Grouped density curves",
  description:
    "<GeomDensity> estimates one smooth x-density per effective color group.",
  visualSummary: "Two colored density curves over numeric observations.",
  whatChanged:
    "The density stat emits a regular evaluation grid before line lowering.",
  dataPreview: distributionData,
  chart: () => (
    <SitePlot data={distributionData} mapping={{ x: "value", color: "group" }}>
      <GeomDensity n={48} linewidth={3} />
    </SitePlot>
  ),
};

export const violinAndDots: DocExample = {
  id: "ViolinAndDots",
  title: "Violin and dot distributions",
  description:
    "<GeomViolin> mirrors grouped y-density while <GeomDotplot> stacks deterministic x bins beneath it.",
  visualSummary:
    "Two translucent violin shapes with dark stacked dots showing the observations.",
  whatChanged:
    "The violin produces polygon density products; the dot layer uses its own x mapping and a fixed bin width.",
  dataPreview: distributionData,
  chart: () => (
    <SitePlot
      data={distributionData}
      mapping={{ x: "group", y: "value", fill: "group" }}
    >
      <GeomViolin n={36} opacity={0.45} />
      <GeomDotplot
        mapping={{ x: "value" }}
        inheritAes={false}
        binwidth={0.35}
        color="#111827"
        size={4}
      />
    </SitePlot>
  ),
};

export const violinReference: DocExample = {
  id: "ViolinReference",
  title: "Grouped violins",
  description: "Mirrored kernel densities compare grouped y distributions.",
  visualSummary: "Two translucent violin density polygons.",
  whatChanged:
    "The dedicated example exposes <GeomViolin>'s ydensity stat and bandwidth-controlled polygon product.",
  dataPreview: distributionData,
  chart: () => (
    <SitePlot
      data={distributionData}
      mapping={{ x: "group", y: "value", fill: "group" }}
    >
      <GeomViolin n={48} opacity={0.55} />
    </SitePlot>
  ),
};

export const rectangularAndHexBins: DocExample = {
  id: "RectangularAndHexBins",
  title: "Rectangular and hexagonal 2D bins",
  description:
    "<GeomBin2d> and <GeomHex> aggregate the same points into different cell topology.",
  visualSummary:
    "Blue rectangular count cells overlaid with outlined six-sided count cells.",
  whatChanged:
    "Both stats count observed cells; tile lowering emits four vertices and hex lowering emits six.",
  dataPreview: pointCloud2dData,
  chart: () => (
    <SitePlot data={pointCloud2dData} mapping={{ x: "x", y: "y" }}>
      <GeomBin2d bins={5} opacity={0.38} />
      <GeomHex bins={5} opacity={0.72} />
    </SitePlot>
  ),
};

export const qqDiagnostics: DocExample = {
  id: "QqDiagnostics",
  title: "QQ points and reference line",
  description:
    "<GeomQq> maps ordered samples to normal quantiles and <GeomQqLine> adds the quartile reference.",
  visualSummary:
    "Ordered QQ points aligned around a straight quartile reference line.",
  whatChanged:
    "Both layers consume the same y sample but produce distinct point and two-endpoint line products.",
  dataPreview: distributionData,
  chart: () => (
    <SitePlot data={distributionData} mapping={{ y: "value" }}>
      <GeomQq size={6} color="#2563eb" />
      <GeomQqLine color="#ef4444" linewidth={2} />
    </SitePlot>
  ),
};

export const contourBands: DocExample = {
  id: "ContourBands",
  title: "Contour lines and filled bands",
  description:
    "<GeomContour> extracts isolines while <GeomContourFilled> assigns stepped fills to the same x/y/z grid.",
  visualSummary:
    "A stepped filled hill with dark contour lines crossing its color bands.",
  whatChanged:
    "The shared grid is lowered once into filled cells and again into line segments at explicit breaks.",
  dataPreview: contourData,
  chart: () => (
    <SitePlot data={contourData} mapping={{ x: "x", y: "y", z: "z" }}>
      <GeomContourFilled breaks={[0.5, 1.5, 2.5]} opacity={0.7} />
      <GeomContour breaks={[0.5, 1.5, 2.5]} color="#111827" linewidth={2} />
    </SitePlot>
  ),
};

export const aliasData = {
  x: [0, 0.2, 0.7, 1.1, 1.2, 1.8, 2.1, 2.4, 2.8, 3],
  y: [1, 1.4, 1.1, 2, 1.7, 2.6, 2.1, 3, 2.7, 3.4],
};

export const freqpolyAndJitter: DocExample = {
  id: "FreqpolyAndJitter",
  title: "Frequency polygon and jitter",
  description:
    "<GeomFreqpoly> connects binned counts while <GeomJitter> reveals individual observations without exact overlap.",
  visualSummary:
    "A count-frequency line above a jittered cloud of observations.",
  whatChanged:
    "Both components are concise forms: a line with stat_bin, and points with position_jitter (seeded, so every render matches).",
  dataPreview: aliasData,
  chart: () => (
    <SitePlot data={aliasData} mapping={{ x: "x", y: "y" }}>
      <GeomFreqpoly
        mapping={{ x: "x" }}
        inheritAes={false}
        bins={7}
        color="#dc2626"
        linewidth={3}
      />
      <GeomJitter width={0.08} height={0.08} color="#2563eb" size={5} />
    </SitePlot>
  ),
};

export const connectedData = {
  x: [0, 1, 2],
  y: [0.5, 1.8, 1.1],
  xend: [0.8, 1.8, 2.8],
  yend: [1.5, 0.7, 2.1],
  angle: [0, Math.PI / 3, Math.PI * 0.8],
  radius: [0.45, 0.55, 0.5],
};

export const connectedGeomVariants: DocExample = {
  id: "ConnectedGeomVariants",
  title: "Steps, curves, spokes, and rugs",
  description:
    "Four connected-mark geoms demonstrate explicit topology and panel-edge annotation.",
  visualSummary:
    "A stair-step trace, curved links, radial spokes, and short rug ticks along the bottom and left edges.",
  whatChanged:
    "Steps insert corner vertices, curves use fixed quadratic tessellation, spokes derive endpoints from angle/radius, and rugs convert CSS pixels into panel units.",
  dataPreview: connectedData,
  chart: () => (
    <SitePlot data={connectedData} mapping={{ x: "x", y: "y" }}>
      <GeomStep direction="mid" color="#2563eb" linewidth={3} />
      <GeomCurve
        mapping={{ x: "x", y: "y", xend: "xend", yend: "yend" }}
        curvature={0.25}
        color="#7c3aed"
      />
      <GeomSpoke
        mapping={{ x: "x", y: "y", angle: "angle", radius: "radius" }}
        color="#ea580c"
      />
      <GeomRug sides="bl" length={7} color="#111827" />
    </SitePlot>
  ),
};

export const functionRange = { x: [-2, 2] };
/** The function GeomFunction samples. */
export const square = (x: number) => x * x;
export const blankBounds = { bx: [-3, 3], by: [-1, 10] };

export const functionAndBlank: DocExample = {
  id: "FunctionAndBlank",
  title: "Function curves and invisible scale training",
  description:
    "<GeomFunction> evaluates a function over x while <GeomBlank> expands the trained domain without drawing a mark.",
  visualSummary:
    "A smooth parabola shown inside a domain extended by invisible boundary data.",
  whatChanged:
    "The blank layer participates in scale training but draws no marks and adds no guide keys.",
  dataPreview: functionRange,
  chart: () => (
    <SitePlot data={functionRange} mapping={{ x: "x" }}>
      <GeomFunction fun={square} n={64} color="#059669" linewidth={3} />
      <GeomBlank
        data={blankBounds}
        mapping={{ x: "bx", y: "by" }}
        inheritAes={false}
      />
    </SitePlot>
  ),
};

export const repeatedData = {
  x: [0, 0, 0, 1, 1, 2],
  y: [1, 1, 1, 2, 2, 1.5],
};

export const countedPoints: DocExample = {
  id: "CountedPoints",
  title: "Count-sized points",
  description:
    "<GeomCount> collapses repeated positions and maps their computed n to point area.",
  visualSummary:
    "Repeated coordinate pairs shown as circles whose area reflects frequency.",
  whatChanged:
    "stat_sum emits serializable n and prop columns per x/y/group tuple before the size scale is trained.",
  dataPreview: repeatedData,
  chart: () => (
    <SitePlot data={repeatedData} mapping={{ x: "x", y: "y" }}>
      <GeomCount color="#2563eb" />
    </SitePlot>
  ),
};

export const density2dContours: DocExample = {
  id: "Density2dContours",
  title: "Two-dimensional density contours",
  description:
    "Gaussian product-kernel density is evaluated on a grid and rendered as filled bands with isolines.",
  visualSummary:
    "Smooth filled density regions crossed by darker contour lines.",
  whatChanged:
    "Both layers share KDE bandwidth and contour-break semantics; one lowers grid bands and the other line segments.",
  dataPreview: pointCloud2dData,
  chart: () => (
    <SitePlot data={pointCloud2dData} mapping={{ x: "x", y: "y" }}>
      <GeomDensity2dFilled n={32} bins={8} opacity={0.65} />
      <GeomDensity2d n={32} bins={8} contourVar="density" color="#172554" />
    </SitePlot>
  ),
};
