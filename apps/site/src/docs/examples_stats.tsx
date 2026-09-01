import {
  annotate,
  applyStat,
  coordPolar,
  facetGrid,
  geomAbline,
  geomBar,
  geomCol,
  geomHistogram,
  geomHline,
  geomLine,
  geomPoint,
  geomSmooth,
  geomTile,
  geomVline,
  ggplot,
  ingest,
  scaleFill,
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
  groupedData,
  heatmapData,
  rankedData,
  scatterData,
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
    "stat_count keeps its u32 count grid resident; only bounded y-domain metadata crosses back for the standalone view.",
  executionDetail:
    "The live compiler emits a ResidentProduct for this eligible unweighted factor count. Default-scale factor fill or color grouping can use the same path.",
  dslSource: `ggplot(data, { x: "category" })
  .add(geomBar({ fill: "#2563eb" }))
  .build();`,
  spec: ggplot(residentCountData, { x: "category" })
    .add(geomBar({ fill: "#2563eb" }))
    .build(),
};

const packedReuseData = ingest({
  x: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  y: [1, 3, 2, 5, 4, 6, 3, 7, 5, 8],
});

export const packedTensorReuse: DocExample = {
  id: "PackedTensorReuse",
  title: "Stable packed tensors: zero re-upload",
  description:
    "A direct point-and-line plot ingests once and reuses the same typed columns across spec rebuilds.",
  whatChanged:
    "This is Flow B, not a resident histogram: the CPU packs renderer-ready tensors once, and stable column/pack identities let rerenders and linear-domain changes reuse those tensors.",
  executionDetail:
    "The companion browser probe measures mark-buffer creations and writes around five unchanged rerenders and one domain-only rebuild; both windows must remain zero while the frame redraws.",
  action: {
    href: "?instrument",
    label: "Open the browser-instrumented Flow B surface →",
  },
  dataPreview: {
    x: [0, 1, 2, 3, 4],
    y: [1, 3, 2, 5, 4],
  },
  dslSource: `const data = ingest(rawData); // once
ggplot(data, { x: "x", y: "y" })
  .add(geomPoint(), geomLine())
  .build();`,
  spec: ggplot(packedReuseData, { x: "x", y: "y" })
    .add(geomPoint({ size: 4 }), geomLine())
    .build(),
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
  dslSource: `ggplot(data, { x: "value" })
  .add(geomHistogram({ bins: 5, weight: "mass", fill: "#f59e0b" }))
  .build();`,
  computedDataPreview: previewStatRows(
    ggplot(weightedHistogramData, { x: "value" })
      .add(geomHistogram({ bins: 5, weight: "mass", fill: "#f59e0b" }))
      .build(),
  ),
  spec: ggplot(weightedHistogramData, { x: "value" })
    .add(geomHistogram({ bins: 5, weight: "mass", fill: "#f59e0b" }))
    .build(),
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

export const smoothLm: DocExample = {
  id: "SmoothLm",
  title: "Grouped local smooth",
  description:
    "geomSmooth fits robust loess curves for each drivetrain across all 234 mpg vehicles.",
  whatChanged:
    "Core smoothing supports lm, robust local-quadratic loess, and binomial-logit glm with serializable controls. GAM solvers attach through the extension registry rather than silently falling back.",
  dslSource: `const data = await loadStaticDataset("mpg");
ggplot(data, { x: "displ", y: "hwy", color: "drv" })
  .add(geomPoint({ size: 3, opacity: 0.55 }))
  .add(geomSmooth({ method: "loess", span: 0.75, se: false, n: 80 }))
  .build();`,
  dataSource: { id: "mpg" },
  buildSpec: (data) =>
    ggplot(data, { x: "displ", y: "hwy", color: "drv" })
      .add(geomPoint({ size: 3, opacity: 0.55 }))
      .add(geomSmooth({ method: "loess", span: 0.75, se: false, n: 80 }))
      .build(),
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
