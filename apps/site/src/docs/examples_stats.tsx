/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// Stats, scales, themes and annotations, written as component JSX
// (gggplot-vnh.10.1); see examples_basics.tsx for the chart/jsxSource
// convention.
import * as Jsx from "@gggplot/core/jsx";
import {
  Annotate,
  CoordPolar,
  FacetGrid,
  GeomAbline,
  GeomBar,
  GeomCol,
  GeomHistogram,
  GeomHline,
  GeomLine,
  GeomPoint,
  GeomSmooth,
  GeomTile,
  GeomVline,
  GGData,
  ingest,
  ScaleFill,
  ScaleShape,
  ScaleSize,
  ScaleXLog10,
  ScaleXSqrt,
  ScaleYContinuous,
  ThemeClassic,
  ThemeGrey,
} from "@gggplot/core";
import { SitePlot } from "../site_plot.tsx";
import type { DocExample } from "./types.ts";
import {
  countData,
  groupedData,
  heatmapData,
  rankedData,
  scatterData,
  summaryData,
  transformData,
} from "./data/demo.ts";
import { loadIris, loadMpg } from "./data/real.ts";
import { previewStatRows } from "./stat_preview.ts";

export const countStackedBar: DocExample = {
  id: "CountStackedBar",
  title: "Counted, stacked bars",
  description:
    "<GeomBar> defaults to stat_count, then stacks the counted rows by mapped fill.",
  whatChanged:
    "stat_count emits one count row per class and drive group before position stacking builds bar polygons.",
  dataPreview: countData,
  computedDataPreview: previewStatRows(GeomBar, {}, countData, {
    x: "class",
    fill: "drive",
  }),
  jsxSource: `<GGPlot data={countData} mapping={{ x: "class", fill: "drive" }}>
  <GeomBar />
</GGPlot>`,
  chart: () => (
    <SitePlot data={countData} mapping={{ x: "class", fill: "drive" }}>
      <GeomBar />
    </SitePlot>
  ),
};

const residentCountData = {
  category: Array.from(
    { length: 20_000 },
    (_, i) => ["alpha", "beta", "gamma", "delta"][i % 4],
  ),
};
export const residentCategoricalCount: DocExample = {
  id: "ResidentCategoricalCount",
  title: "GPU-resident categorical counts",
  description:
    "Twenty thousand factor ids are counted into a compact GPU grid and consumed directly by bar topology.",
  whatChanged:
    "stat_count keeps its u32 count grid resident; only its bounded summary (the stacked maximum) crosses back, and the root trains the y axis from it.",
  executionDetail:
    "The root hosts a resident product for this eligible unweighted factor count. Default-scale factor fill or color grouping can use the same path.",
  jsxSource: `<GGPlot data={residentCountData} mapping={{ x: "category" }}>
  <GeomBar fill="#2563eb" />
</GGPlot>`,
  chart: () => (
    <SitePlot data={residentCountData} mapping={{ x: "category" }}>
      <GeomBar fill="#2563eb" />
    </SitePlot>
  ),
};

export const residentInlineBars: DocExample = {
  id: "ResidentInlineBars",
  title: "GPU-resident counts as an inline mark",
  description:
    "The same resident stat_count grid as above, but with the y domain pinned so the panel owns the scale instead of the product.",
  visualSummary:
    "Four equal blue bars, one per category, reaching five-sixths of the way up a y axis that runs to 6000.",
  whatChanged:
    "Pinning y with <ScaleYContinuous> means the root no longer needs the product's summary. Unpinned, the root waits for the stacked maximum read back off the GPU and trains y from it; pinned, it trains y from the declared domain, and the product contributes bar topology only and reads nothing back. Same kernel, same resident grid, same mark: the difference is who owns the scale.",
  executionDetail:
    "barResidentPlan sets autoYDomain only when no y domain is declared, and the root reads a summary back only for a plan that asks for it. A declared domain is also what lets a resident layer share its panel with other layers, which is why this case is documented next to the unpinned one rather than left implicit.",
  jsxSource: `<GGPlot data={residentCountData} mapping={{ x: "category" }}>
  <GeomBar fill="#2563eb" />
  <ScaleYContinuous domain={[0, 6000]} />
</GGPlot>`,
  chart: () => (
    <SitePlot data={residentCountData} mapping={{ x: "category" }}>
      <GeomBar fill="#2563eb" />
      <ScaleYContinuous domain={[0, 6000]} />
    </SitePlot>
  ),
};

// Ingested once, so every re-render reads the same typed columns.
const packedReuseData = ingest({
  x: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  y: [1, 3, 2, 5, 4, 6, 3, 7, 5, 8],
});

export const packedTensorReuse: DocExample = {
  id: "PackedTensorReuse",
  title: "Stable packed tensors: zero re-upload",
  description:
    "A direct point-and-line plot ingests once and reuses the same typed columns across re-renders.",
  whatChanged:
    "This is Flow B, not a resident histogram: the CPU packs renderer-ready tensors once, and stable column/pack identities let re-renders and linear-domain changes reuse those tensors.",
  executionDetail:
    "The companion browser probe measures mark-buffer creations and writes around five unchanged re-renders and one domain-only change; both windows must remain zero while the frame redraws.",
  action: {
    href: "?instrument",
    label: "Open the browser-instrumented Flow B surface →",
  },
  dataPreview: {
    x: [0, 1, 2, 3, 4],
    y: [1, 3, 2, 5, 4],
  },
  jsxSource: `<GGPlot data={packedReuseData} mapping={{ x: "x", y: "y" }}>
  <GeomPoint size={4} />
  <GeomLine />
</GGPlot>`,
  chart: () => (
    <SitePlot data={packedReuseData} mapping={{ x: "x", y: "y" }}>
      <GeomPoint size={4} />
      <GeomLine />
    </SitePlot>
  ),
};

const weightedHistogramData = {
  value: [0.2, 0.4, 0.7, 1.1, 1.2, 1.8, 2.1, 2.2],
  mass: [0.25, 1.5, 0.5, 2, 0.75, 1.25, 0.5, 1.75],
};

export const weightedHistogramFallback: DocExample = {
  id: "WeightedHistogramFallback",
  title: "Weighted histogram: deliberate CPU fallback",
  description:
    "Fractional observation weights require the CPU reference reducer before the resulting bars render on WebGPU.",
  whatChanged:
    "The resident count grid has integer occupancy semantics, so weight selects Flow B and preserves fractional weighted-bin sums instead of silently changing their meaning.",
  executionDetail:
    "Weight is the blocker here. An unweighted factor group mapped to fill or color can remain in Flow A when it uses the default discrete scale; mapped fill is not inherently a CPU fallback.",
  dataPreview: weightedHistogramData,
  computedDataPreview: previewStatRows(
    GeomHistogram,
    { bins: 5, weight: "mass", fill: "#f59e0b" },
    weightedHistogramData,
    { x: "value" },
  ),
  jsxSource: `<GGPlot data={weightedHistogramData} mapping={{ x: "value" }}>
  <GeomHistogram bins={5} weight="mass" fill="#f59e0b" />
</GGPlot>`,
  chart: () => (
    <SitePlot data={weightedHistogramData} mapping={{ x: "value" }}>
      <GeomHistogram bins={5} weight="mass" fill="#f59e0b" />
    </SitePlot>
  ),
};

export const summaryMean: DocExample = {
  id: "SummaryMean",
  title: "Summary mean",
  description:
    "stat_summary reduces repeated observations to a mean y value for each x level.",
  whatChanged:
    "The stat encodes x levels, reduces y with groupedSummary1d, and renders the computed means as points.",
  dataPreview: summaryData,
  computedDataPreview: previewStatRows(
    GeomPoint,
    { stat: "summary", size: 9, color: "#0f766e" },
    summaryData,
    { x: "day", y: "score" },
  ),
  jsxSource: `<GGPlot data={summaryData} mapping={{ x: "day", y: "score" }}>
  <GeomPoint stat="summary" size={9} color="#0f766e" />
</GGPlot>`,
  chart: () => (
    <SitePlot data={summaryData} mapping={{ x: "day", y: "score" }}>
      <GeomPoint stat="summary" size={9} color="#0f766e" />
    </SitePlot>
  ),
};

export const smoothLm: DocExample = {
  id: "SmoothLm",
  title: "Grouped local smooth",
  description:
    "<GeomSmooth> fits robust loess curves for each drivetrain across all 234 mpg vehicles.",
  whatChanged:
    "Core smoothing supports lm, robust local-quadratic loess, and binomial-logit glm with serializable controls. GAM solvers attach through the extension registry rather than silently falling back.",
  jsxSource: `<GGData load={loadMpg}>
  <GGPlot mapping={{ x: "displ", y: "hwy", color: "drv" }}>
    <GeomPoint size={3} opacity={0.55} />
    <GeomSmooth method="loess" span={0.75} se={false} n={80} />
  </GGPlot>
</GGData>`,
  dataSource: { id: "mpg" },
  chart: () => (
    <GGData load={loadMpg}>
      <SitePlot mapping={{ x: "displ", y: "hwy", color: "drv" }}>
        <GeomPoint size={3} opacity={0.55} />
        <GeomSmooth method="loess" span={0.75} se={false} n={80} />
      </SitePlot>
    </GGData>
  ),
};

export const tileHeatmap: DocExample = {
  id: "TileHeatmap",
  title: "Tile heatmap",
  description:
    "<GeomTile> maps a rectangular grid to polygon cells, with fill trained from a numeric value column.",
  whatChanged:
    "Cell widths come from the x/y resolution, and the domains widen so edge tiles are not clipped.",
  dataPreview: heatmapData,
  jsxSource:
    `<GGPlot data={heatmapData} mapping={{ x: "x", y: "y", fill: "value" }}>
  <GeomTile />
</GGPlot>`,
  chart: () => (
    <SitePlot data={heatmapData} mapping={{ x: "x", y: "y", fill: "value" }}>
      <GeomTile />
    </SitePlot>
  ),
};

export const residentTileStrip: DocExample = {
  id: "ResidentTileStrip",
  title: "GPU-resident binned tile strip",
  description:
    "The same iris sepal-length binning as the grouped histogram, laid out as a dense cell grid with one row per species.",
  visualSummary:
    "Three stacked rows of tiles, one row per iris species, each row a twenty-bin strip across sepal length.",
  whatChanged:
    "<GeomTile stat=\"bin\"> with a numeric x, a factor fill and NO y mapping selects the dense [group, bin] tile product. The kernel writes every cell into its own tileVertices buffer, so no count crosses back to the CPU — and unlike the bar products this one reads nothing back at all, because the y range is simply the group-row count. Each cell shades by its OWN count, not its row's palette color: a fixed five-stop ramp baked into the color pass reads the same resident counts grid and the same stacked-maximum summary slot the bar products already compute, normalizes on the GPU, and writes a per-cell RGBA — so a species' peak bin is visibly darker than its sparse ones, with no fill scale evaluated on the shader and no readback added.",
  executionDetail:
    "The combination is an explicit opt-in: no geom defaults a tile layer to stat \"bin\", so its `bins` goes through `params`. It is offered only for a lone layer, because the root trains the strip's y range as the statically known [0, groups], which another layer's y would fight. With <Execution resident={false} /> the same plot routes through statBin into lowerTile and draws (bin center, count) cells instead of a per-group strip, so the resident path is the authoritative renderer for this plot rather than an optimization of it.",
  jsxSource: `<GGData load={loadIris}>
  <GGPlot mapping={{ x: "Sepal.Length", fill: "Species" }}>
    <GeomTile stat="bin" params={{ bins: 20 }} />
  </GGPlot>
</GGData>`,
  dataSource: { id: "iris" },
  chart: () => (
    <GGData load={loadIris}>
      <SitePlot mapping={{ x: "Sepal.Length", fill: "Species" }}>
        <GeomTile stat="bin" params={{ bins: 20 }} />
      </SitePlot>
    </GGData>
  ),
};

export const annotationComposite: DocExample = {
  id: "AnnotationComposite",
  title: "Annotations and reference lines",
  description:
    "Annotations are literal layers that do not inherit the plot mapping, while reference lines span the trained domain.",
  whatChanged:
    "Each annotation becomes a tiny synthetic layer; hline/vline/abline are lowered after scale training.",
  dataPreview: scatterData,
  jsxSource: `<GGPlot data={scatterData} mapping={{ x: "wt", y: "mpg" }}>
  <GeomPoint size={6} color="#2563eb" />
  <GeomHline yintercept={20} color="#ef4444" />
  <GeomVline xintercept={3} color="#0f766e" />
  <GeomAbline slope={-4} intercept={32} color="#7c3aed" />
  <Annotate geom="rect" xmin={2.4} xmax={3.6} ymin={17} ymax={23} fill="#f59e0b" />
  <Annotate geom="text" x={3.7} y={24} label="target band" color="#f8fafc" />
</GGPlot>`,
  chart: () => (
    <SitePlot data={scatterData} mapping={{ x: "wt", y: "mpg" }}>
      <GeomPoint size={6} color="#2563eb" />
      <GeomHline yintercept={20} color="#ef4444" />
      <GeomVline xintercept={3} color="#0f766e" />
      <GeomAbline slope={-4} intercept={32} color="#7c3aed" />
      <Annotate
        geom="rect"
        xmin={2.4}
        xmax={3.6}
        ymin={17}
        ymax={23}
        fill="#f59e0b"
      />
      <Annotate
        geom="text"
        x={3.7}
        y={24}
        label="target band"
        color="#f8fafc"
      />
    </SitePlot>
  ),
};

export const scaleTransforms: DocExample = {
  id: "ScaleTransforms",
  title: "Scale transforms",
  description:
    "A transformed x scale trains and maps values through log10 or sqrt before marks are emitted.",
  whatChanged:
    "The x domain and every x position are transformed consistently; y remains on the original continuous scale.",
  dataPreview: transformData,
  jsxSource:
    `<GGPlot data={transformData} mapping={{ x: "size", y: "latency" }}>
  <GeomPoint size={8} color="#2563eb" />
  <GeomLine color="#0f766e" />
  <ScaleXLog10 />
</GGPlot>`,
  chart: () => (
    <SitePlot data={transformData} mapping={{ x: "size", y: "latency" }}>
      <GeomPoint size={8} color="#2563eb" />
      <GeomLine color="#0f766e" />
      <ScaleXLog10 />
    </SitePlot>
  ),
};

const scaledData = {
  ...groupedData,
  size: [8, 12, 16, 9, 18, 10, 14, 13],
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
    size: scaledData.size,
  },
  jsxSource: `<GGPlot
  data={scaledData}
  mapping={{ x: "wt", y: "mpg", size: "size", shape: "cyl" }}
>
  <GeomPoint />
  <ScaleSize range={[4, 12]} />
  <ScaleShape />
</GGPlot>`,
  chart: () => (
    <SitePlot
      data={scaledData}
      mapping={{ x: "wt", y: "mpg", size: "size", shape: "cyl" }}
    >
      <GeomPoint />
      <ScaleSize range={[4, 12]} />
      <ScaleShape />
    </SitePlot>
  ),
};

export const facetGridStats: DocExample = {
  id: "FacetGridStats",
  title: "Facet grid with per-panel stats",
  description:
    "Facets partition rows before stats, so each panel gets its own counted bars.",
  whatChanged:
    "facet_grid crosses drive and class levels, slices panel data, then runs stat_count inside each panel.",
  dataPreview: countData,
  jsxSource: `<GGPlot data={countData} mapping={{ x: "drive" }}>
  <GeomBar fill="#3b82f6" />
  <FacetGrid rows={["class"]} cols={["drive"]} />
</GGPlot>`,
  chart: () => (
    <SitePlot data={countData} mapping={{ x: "drive" }}>
      <GeomBar fill="#3b82f6" />
      <FacetGrid rows={["class"]} cols={["drive"]} />
    </SitePlot>
  ),
};

export const polarThetaY: DocExample = {
  id: "PolarThetaY",
  title: "Polar theta y",
  description:
    "coord_polar can reassign the angle to y, sharing the same projection model as coord_flip.",
  whatChanged:
    "The coord stores a yx projection, so the polar view reads y as the angular axis.",
  dataPreview: rankedData,
  jsxSource: `<GGPlot data={rankedData} mapping={{ x: "tier", y: "score" }}>
  <GeomCol color="#0f766e" />
  <CoordPolar theta="y" />
</GGPlot>`,
  chart: () => (
    <SitePlot data={rankedData} mapping={{ x: "tier", y: "score" }}>
      <GeomCol color="#0f766e" />
      <CoordPolar theta="y" />
    </SitePlot>
  ),
};

export const themeComparison: DocExample = {
  id: "ThemeComparison",
  title: "Theme comparison",
  description:
    "Theme presets set panel, grid, axis, and text defaults without changing data or scales.",
  whatChanged:
    "The same point layer is drawn under theme_grey, with its text color overridden.",
  dataPreview: scatterData,
  jsxSource: `<GGPlot data={scatterData} mapping={{ x: "wt", y: "mpg" }}>
  <GeomPoint size={7} color="#111827" />
  <ThemeGrey textColor="#111827" />
</GGPlot>`,
  chart: () => (
    <SitePlot data={scatterData} mapping={{ x: "wt", y: "mpg" }}>
      <GeomPoint size={7} color="#111827" />
      <ThemeGrey textColor="#111827" />
    </SitePlot>
  ),
};

export const classicTheme: DocExample = {
  id: "ClassicTheme",
  title: "Classic theme",
  description:
    "<ThemeClassic> removes grid lines while keeping axes and marks unchanged.",
  whatChanged:
    "Only guide/theme marks change; the Point positions are identical to the default theme.",
  dataPreview: scatterData,
  jsxSource: `<GGPlot data={scatterData} mapping={{ x: "wt", y: "mpg" }}>
  <GeomPoint size={7} color="#2563eb" />
  <ThemeClassic />
</GGPlot>`,
  chart: () => (
    <SitePlot data={scatterData} mapping={{ x: "wt", y: "mpg" }}>
      <GeomPoint size={7} color="#2563eb" />
      <ThemeClassic />
    </SitePlot>
  ),
};

export const sqrtScale: DocExample = {
  id: "SqrtScale",
  title: "Sqrt x scale",
  description:
    "A sqrt scale is another position transform over the same source rows.",
  whatChanged:
    "The transform path is shared with log scales: domains and mark positions are both projected through the scale.",
  dataPreview: transformData,
  jsxSource:
    `<GGPlot data={transformData} mapping={{ x: "size", y: "latency" }}>
  <GeomPoint size={8} color="#7c3aed" />
  <ScaleXSqrt />
</GGPlot>`,
  chart: () => (
    <SitePlot data={transformData} mapping={{ x: "size", y: "latency" }}>
      <GeomPoint size={8} color="#7c3aed" />
      <ScaleXSqrt />
    </SitePlot>
  ),
};

export const filledTiles: DocExample = {
  id: "FilledTiles",
  title: "Custom fill range",
  description:
    "A continuous fill mapping can use an explicit color range while the tile grid stays the same.",
  whatChanged:
    "Only fill scale interpolation changes; tile positions and domain widening are unchanged.",
  dataPreview: heatmapData,
  jsxSource:
    `<GGPlot data={heatmapData} mapping={{ x: "x", y: "y", fill: "value" }}>
  <GeomTile />
  <ScaleFill range={["#dbeafe", "#1d4ed8"]} />
</GGPlot>`,
  chart: () => (
    <SitePlot data={heatmapData} mapping={{ x: "x", y: "y", fill: "value" }}>
      <GeomTile />
      <ScaleFill range={["#dbeafe", "#1d4ed8"]} />
    </SitePlot>
  ),
};
