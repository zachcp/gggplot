import {
  geomArea,
  geomBin2d,
  geomBlank,
  geomBoxplot,
  geomContour,
  geomContourFilled,
  geomCount,
  geomCurve,
  geomDensity,
  geomDensity2d,
  geomDensity2dFilled,
  geomDotplot,
  geomErrorbar,
  geomFreqpoly,
  geomFunction,
  geomHex,
  geomJitter,
  geomLabel,
  geomPath,
  geomPolygon,
  geomQq,
  geomQqLine,
  geomRaster,
  geomRect,
  geomRibbon,
  geomRug,
  geomSpoke,
  geomStep,
  geomViolin,
  ggplot,
} from "@gggplot/core";
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
    "geomPath connects observations in input order instead of sorting by x like geomLine.",
  visualSummary:
    "A connected path that doubles back across the panel in source-row order.",
  whatChanged:
    "The path lowering consumes rows exactly as supplied, making trajectories and ordered traces distinct from line charts.",
  dataPreview: scatterData,
  dslSource: `ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPath({ color: "#7c3aed", linewidth: 3 }))
  .build();`,
  spec: ggplot(scatterData, { x: "wt", y: "mpg" })
    .add(geomPath({ color: "#7c3aed", linewidth: 3 })).build(),
};

export const areaAndRibbon: DocExample = {
  id: "AreaAndRibbon",
  title: "Area and ribbon bands",
  description:
    "geomArea closes y to zero while geomRibbon fills independently mapped ymin/ymax bounds.",
  visualSummary:
    "A blue area under a line with a translucent orange uncertainty ribbon.",
  whatChanged:
    "Both geoms lower to closed polygons, but only the ribbon reads two boundary aesthetics.",
  dataPreview: bandData,
  dslSource: `ggplot(data, { x: "x", y: "y" })
  .add(geomArea({ fill: "#60a5fa", opacity: 0.45 }))
  .add(geomRibbon({ mapping: { x: "x", ymin: "ymin", ymax: "ymax" }, fill: "#f59e0b", opacity: 0.35 }))
  .build();`,
  spec: ggplot(bandData, { x: "x", y: "y" }).add(
    geomArea({ fill: "#60a5fa", opacity: 0.45 }),
    geomRibbon({
      mapping: { x: "x", ymin: "ymin", ymax: "ymax" },
      fill: "#f59e0b",
      opacity: 0.35,
    }),
  ).build(),
};

export const rectBounds: DocExample = {
  id: "RectBounds",
  title: "Rectangles from explicit bounds",
  description:
    "geomRect draws one rectangle per row from xmin/xmax/ymin/ymax rather than centring a fixed-size mark on x/y.",
  visualSummary:
    "Four overlapping translucent rectangles of differing size, one per phase.",
  whatChanged:
    "All four corner aesthetics are required, so the mark carries its own extent instead of borrowing a width from a discrete scale the way geomTile does.",
  dataPreview: rectData,
  dslSource: `ggplot(data, {
  xmin: "xmin", xmax: "xmax", ymin: "ymin", ymax: "ymax", fill: "phase",
})
  .add(geomRect({ opacity: 0.55 }))
  .build();`,
  spec: ggplot(rectData, {
    xmin: "xmin",
    xmax: "xmax",
    ymin: "ymin",
    ymax: "ymax",
    fill: "phase",
  }).add(geomRect({ opacity: 0.55 })).build(),
};

export const polygonShapes: DocExample = {
  id: "PolygonShapes",
  title: "Grouped polygons",
  description:
    "geomPolygon closes one ordered loop per effective group and maps fill independently.",
  visualSummary:
    "A filled square and triangle rendered as separate grouped polygons.",
  whatChanged:
    "The group aesthetic partitions row-ordered vertices before each loop is lowered.",
  dataPreview: polygonData,
  dslSource: `ggplot(data, { x: "x", y: "y", group: "group", fill: "group" })
  .add(geomPolygon({ opacity: 0.72 }))
  .build();`,
  spec: ggplot(polygonData, { x: "x", y: "y", group: "group", fill: "group" })
    .add(geomPolygon({ opacity: 0.72 })).build(),
};

export const rasterGrid: DocExample = {
  id: "RasterGrid",
  title: "Full-resolution raster cells",
  description:
    "geomRaster is tile lowering fixed to the complete axis resolution without custom cell dimensions.",
  visualSummary: "A contiguous three-by-three colored raster grid.",
  whatChanged:
    "The raster alias keeps cells edge-to-edge while the fill scale maps the numeric value column.",
  dataPreview: heatmapData,
  dslSource: `ggplot(data, { x: "x", y: "y", fill: "value" })
  .add(geomRaster())
  .build();`,
  spec: ggplot(heatmapData, { x: "x", y: "y", fill: "value" }).add(geomRaster())
    .build(),
};

export const labelsAndIntervals: DocExample = {
  id: "LabelsAndIntervals",
  title: "Labels, boxplots, and error bars",
  description:
    "geomLabel places mapped labels; geomBoxplot computes grouped quartiles; geomErrorbar draws explicit bounds.",
  visualSummary:
    "Two grouped boxplots with interval caps and labels above their centers.",
  whatChanged:
    "The boxplot uses raw grouped values, while the error bars and labels use layer-specific mappings over the same rows.",
  dataPreview: intervalData,
  dslSource: `ggplot(data, { x: "group", y: "value" })
  .add(geomBoxplot({ fill: "#bfdbfe" }))
  .add(geomErrorbar({ mapping: { x: "group", ymin: "low", ymax: "high" }, width: 0.35, color: "#1d4ed8" }))
  .add(geomLabel({ mapping: { x: "group", y: "high", label: "group" }, color: "#111827", angle: -12 }))
  .build();`,
  spec: ggplot(intervalData, { x: "group", y: "value" }).add(
    geomBoxplot({ fill: "#bfdbfe" }),
    geomErrorbar({
      mapping: { x: "group", ymin: "low", ymax: "high" },
      width: 0.35,
      color: "#1d4ed8",
    }),
    geomLabel({
      mapping: { x: "group", y: "high", label: "group" },
      color: "#111827",
      angle: -12,
    }),
  ).build(),
};

export const boxplotReference: DocExample = {
  id: "BoxplotReference",
  title: "Grouped boxplots",
  description:
    "Raw grouped observations are reduced into quartiles, whiskers, and outliers.",
  visualSummary: "Two side-by-side boxplots summarizing grouped values.",
  whatChanged:
    "geomBoxplot owns the example so its stat_boxplot inputs and box topology can be read without unrelated layers.",
  dataPreview: distributionData,
  dslSource: `ggplot(data, { x: "group", y: "value" })
  .add(geomBoxplot({ fill: "#bfdbfe", coef: 1.5 }))
  .build();`,
  spec: ggplot(distributionData, { x: "group", y: "value" })
    .add(geomBoxplot({ fill: "#bfdbfe", coef: 1.5 })).build(),
};

export const densityCurve: DocExample = {
  id: "DensityCurve",
  title: "Grouped density curves",
  description:
    "geomDensity estimates one smooth x-density per effective color group.",
  visualSummary: "Two colored density curves over numeric observations.",
  whatChanged:
    "The density stat emits a regular evaluation grid before line lowering.",
  dataPreview: distributionData,
  dslSource: `ggplot(data, { x: "value", color: "group" })
  .add(geomDensity({ n: 48, linewidth: 3 }))
  .build();`,
  spec: ggplot(distributionData, { x: "value", color: "group" }).add(
    geomDensity({ n: 48, linewidth: 3 }),
  ).build(),
};

export const violinAndDots: DocExample = {
  id: "ViolinAndDots",
  title: "Violin and dot distributions",
  description:
    "geomViolin mirrors grouped y-density while geomDotplot stacks deterministic x bins beneath it.",
  visualSummary:
    "Two translucent violin shapes with dark stacked dots showing the observations.",
  whatChanged:
    "The violin produces polygon density products; the dot layer uses its own x mapping and a fixed bin width.",
  dataPreview: distributionData,
  dslSource: `ggplot(data, { x: "group", y: "value", fill: "group" })
  .add(geomViolin({ n: 36, opacity: 0.45 }))
  .add(geomDotplot({ mapping: { x: "value" }, inheritAes: false, binwidth: 0.35, color: "#111827", size: 4 }))
  .build();`,
  spec: ggplot(distributionData, { x: "group", y: "value", fill: "group" }).add(
    geomViolin({ n: 36, opacity: 0.45 }),
    geomDotplot({
      mapping: { x: "value" },
      inheritAes: false,
      binwidth: 0.35,
      color: "#111827",
      size: 4,
    }),
  ).build(),
};

export const violinReference: DocExample = {
  id: "ViolinReference",
  title: "Grouped violins",
  description: "Mirrored kernel densities compare grouped y distributions.",
  visualSummary: "Two translucent violin density polygons.",
  whatChanged:
    "The dedicated example exposes geomViolin's ydensity stat and bandwidth-controlled polygon product.",
  dataPreview: distributionData,
  dslSource: `ggplot(data, { x: "group", y: "value", fill: "group" })
  .add(geomViolin({ n: 48, opacity: 0.55 }))
  .build();`,
  spec: ggplot(distributionData, { x: "group", y: "value", fill: "group" })
    .add(geomViolin({ n: 48, opacity: 0.55 })).build(),
};

export const rectangularAndHexBins: DocExample = {
  id: "RectangularAndHexBins",
  title: "Rectangular and hexagonal 2D bins",
  description:
    "geomBin2d and geomHex aggregate the same points into different cell topology.",
  visualSummary:
    "Blue rectangular count cells overlaid with outlined six-sided count cells.",
  whatChanged:
    "Both stats count observed cells; tile lowering emits four vertices and hex lowering emits six.",
  dataPreview: pointCloud2dData,
  dslSource: `ggplot(data, { x: "x", y: "y" })
  .add(geomBin2d({ bins: 5, opacity: 0.38 }))
  .add(geomHex({ bins: 5, opacity: 0.72 }))
  .build();`,
  spec: ggplot(pointCloud2dData, { x: "x", y: "y" }).add(
    geomBin2d({ bins: 5, opacity: 0.38 }),
    geomHex({ bins: 5, opacity: 0.72 }),
  ).build(),
};

export const qqDiagnostics: DocExample = {
  id: "QqDiagnostics",
  title: "QQ points and reference line",
  description:
    "geomQq maps ordered samples to normal quantiles and geomQqLine adds the quartile reference.",
  visualSummary:
    "Ordered QQ points aligned around a straight quartile reference line.",
  whatChanged:
    "Both layers consume the same y sample but produce distinct point and two-endpoint line products.",
  dataPreview: distributionData,
  dslSource: `ggplot(data, { y: "value" })
  .add(geomQq({ size: 6, color: "#2563eb" }))
  .add(geomQqLine({ color: "#ef4444", linewidth: 2 }))
  .build();`,
  spec: ggplot(distributionData, { y: "value" }).add(
    geomQq({ size: 6, color: "#2563eb" }),
    geomQqLine({ color: "#ef4444", linewidth: 2 }),
  ).build(),
};

export const contourBands: DocExample = {
  id: "ContourBands",
  title: "Contour lines and filled bands",
  description:
    "geomContour extracts isolines while geomContourFilled assigns stepped fills to the same x/y/z grid.",
  visualSummary:
    "A stepped filled hill with dark contour lines crossing its color bands.",
  whatChanged:
    "The shared grid is lowered once into filled cells and again into line segments at explicit breaks.",
  dataPreview: contourData,
  dslSource: `ggplot(data, { x: "x", y: "y", z: "z" })
  .add(geomContourFilled({ breaks: [0.5, 1.5, 2.5], opacity: 0.7 }))
  .add(geomContour({ breaks: [0.5, 1.5, 2.5], color: "#111827", linewidth: 2 }))
  .build();`,
  spec: ggplot(contourData, { x: "x", y: "y", z: "z" }).add(
    geomContourFilled({ breaks: [0.5, 1.5, 2.5], opacity: 0.7 }),
    geomContour({ breaks: [0.5, 1.5, 2.5], color: "#111827", linewidth: 2 }),
  ).build(),
};

const aliasData = {
  x: [0, 0.2, 0.7, 1.1, 1.2, 1.8, 2.1, 2.4, 2.8, 3],
  y: [1, 1.4, 1.1, 2, 1.7, 2.6, 2.1, 3, 2.7, 3.4],
};

export const freqpolyAndJitter: DocExample = {
  id: "FreqpolyAndJitter",
  title: "Frequency polygon and jitter sugar",
  description:
    "geomFreqpoly connects binned counts while geomJitter reveals individual observations without exact overlap.",
  visualSummary:
    "A count-frequency line above a jittered cloud of observations.",
  whatChanged:
    "Both constructors are concise aliases: line plus stat_bin, and point plus position_jitter.",
  dataPreview: aliasData,
  dslSource: `ggplot(data, { x: "x", y: "y" })
  .add(geomFreqpoly({ mapping: { x: "x" }, inheritAes: false, bins: 7, color: "#dc2626", linewidth: 3 }))
  .add(geomJitter({ width: 0.08, height: 0.08, color: "#2563eb", size: 5 }))
  .build();`,
  spec: ggplot(aliasData, { x: "x", y: "y" }).add(
    geomFreqpoly({
      mapping: { x: "x" },
      inheritAes: false,
      bins: 7,
      color: "#dc2626",
      linewidth: 3,
    }),
    geomJitter({ width: 0.08, height: 0.08, color: "#2563eb", size: 5 }),
  ).build(),
};

const connectedData = {
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
  dslSource: `ggplot(data, { x: "x", y: "y" })
  .add(geomStep({ direction: "mid", color: "#2563eb", linewidth: 3 }))
  .add(geomCurve({ mapping: { x: "x", y: "y", xend: "xend", yend: "yend" }, curvature: 0.25, color: "#7c3aed" }))
  .add(geomSpoke({ mapping: { x: "x", y: "y", angle: "angle", radius: "radius" }, color: "#ea580c" }))
  .add(geomRug({ sides: "bl", length: 7, color: "#111827" }))
  .build();`,
  spec: ggplot(connectedData, { x: "x", y: "y" }).add(
    geomStep({ direction: "mid", color: "#2563eb", linewidth: 3 }),
    geomCurve({
      mapping: { x: "x", y: "y", xend: "xend", yend: "yend" },
      curvature: 0.25,
      color: "#7c3aed",
    }),
    geomSpoke({
      mapping: { x: "x", y: "y", angle: "angle", radius: "radius" },
      color: "#ea580c",
    }),
    geomRug({ sides: "bl", length: 7, color: "#111827" }),
  ).build(),
};

export const functionAndBlank: DocExample = {
  id: "FunctionAndBlank",
  title: "Function curves and invisible scale training",
  description:
    "geomFunction evaluates a function over x while geomBlank expands the trained domain without drawing a mark.",
  visualSummary:
    "A smooth parabola shown inside a domain extended by invisible boundary data.",
  whatChanged:
    "The blank layer participates in semantic scale training but is absent from the RenderTree and guides.",
  dataPreview: { x: [-2, 2] },
  dslSource: `ggplot(data, { x: "x" })
  .add(geomFunction((x) => x * x, { n: 64, color: "#059669", linewidth: 3 }))
  .add(geomBlank({ data: { bx: [-3, 3], by: [-1, 10] }, mapping: { x: "bx", y: "by" }, inheritAes: false }))
  .build();`,
  spec: ggplot({ x: [-2, 2] }, { x: "x" }).add(
    geomFunction((x) => x * x, { n: 64, color: "#059669", linewidth: 3 }),
    geomBlank({
      data: { bx: [-3, 3], by: [-1, 10] },
      mapping: { x: "bx", y: "by" },
      inheritAes: false,
    }),
  ).build(),
};

export const countedPoints: DocExample = {
  id: "CountedPoints",
  title: "Count-sized points",
  description:
    "geomCount collapses repeated positions and maps their computed n to point area.",
  visualSummary:
    "Repeated coordinate pairs shown as circles whose area reflects frequency.",
  whatChanged:
    "stat_sum emits serializable n and prop columns per x/y/group tuple before the size scale is trained.",
  dataPreview: {
    x: [0, 0, 0, 1, 1, 2],
    y: [1, 1, 1, 2, 2, 1.5],
  },
  dslSource: `ggplot(data, { x: "x", y: "y" })
  .add(geomCount({ color: "#2563eb" }))
  .build();`,
  spec: ggplot(
    { x: [0, 0, 0, 1, 1, 2], y: [1, 1, 1, 2, 2, 1.5] },
    { x: "x", y: "y" },
  ).add(geomCount({ color: "#2563eb" })).build(),
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
  dslSource: `ggplot(data, { x: "x", y: "y" })
  .add(geomDensity2dFilled({ n: 32, bins: 8, opacity: 0.65 }))
  .add(geomDensity2d({ n: 32, bins: 8, contourVar: "density", color: "#172554" }))
  .build();`,
  spec: ggplot(pointCloud2dData, { x: "x", y: "y" }).add(
    geomDensity2dFilled({ n: 32, bins: 8, opacity: 0.65 }),
    geomDensity2d({
      n: 32,
      bins: 8,
      contourVar: "density",
      color: "#172554",
    }),
  ).build(),
};
