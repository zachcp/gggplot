import type { DocPage } from "./types.ts";
import { geomReferenceEntries } from "./geom_reference.ts";
import { threeDShowcases } from "./example_3d.ts";
import {
  alignedStackedArea,
  areaAndRibbon,
  boxplotReference,
  bumpChart,
  connectedGeomVariants,
  contourBands,
  countedPoints,
  density2dContours,
  densityCurve,
  empiricalCdf,
  freqpolyAndJitter,
  functionAndBlank,
  intervalFamily,
  labelBackgrounds,
  labelsAndIntervals,
  loessSmooth,
  logisticSmooth,
  pathOrder,
  polygonShapes,
  qqDiagnostics,
  quantileRegression,
  rasterGrid,
  rectangularAndHexBins,
  rectBounds,
  stackedArea,
  streamgraph,
  summaryHexCells,
  uniqueRows,
  violinAndDots,
  violinReference,
  waffleChart,
} from "./geom_examples.tsx";
import {
  annotationComposite,
  classicTheme,
  colorMapped,
  countStackedBar,
  discreteX,
  facetedScatter,
  facetGridStats,
  filledTiles,
  flippedBars,
  groupedHistogram,
  histogramStatBin,
  irisMeasurements,
  mpgContinuousPalettes,
  mpgFuelEconomy,
  mtcarsLineStyles,
  packedTensorReuse,
  polarBars,
  polarThetaY,
  residentCategoricalCount,
  scaledAesthetics,
  scaleTransforms,
  scatterLine,
  smoothLm,
  sqrtScale,
  summaryMean,
  themeComparison,
  themedChart,
  tileHeatmap,
  weightedHistogramFallback,
  zoomedPanel,
} from "./examples.tsx";
import { tinyMlpInspection } from "./model_examples.ts";

export const docPages: DocPage[] = [
  {
    slug: "start",
    section: "start",
    title: "Getting started",
    summary:
      "Small plots that show the core grammar: data, aesthetic mappings, and additive layers.",
    examples: [scatterLine, mpgFuelEconomy, discreteX],
  },
  {
    slug: "representations",
    section: "representations",
    title: "Representations",
    summary:
      "How high-level geoms lower to points, lines, polygons, tiles, and labels in the RenderTree.",
    examples: [
      scatterLine,
      pathOrder,
      areaAndRibbon,
      polygonShapes,
      rectBounds,
      tileHeatmap,
      rasterGrid,
      labelsAndIntervals,
      intervalFamily,
      labelBackgrounds,
      logisticSmooth,
      loessSmooth,
      connectedGeomVariants,
      functionAndBlank,
      mtcarsLineStyles,
      themedChart,
    ],
  },
  {
    slug: "stats",
    section: "stats",
    title: "Statistics",
    summary:
      "Reducers and model-fitting stats that transform rows before marks are rendered.",
    examples: [
      countStackedBar,
      histogramStatBin,
      groupedHistogram,
      summaryMean,
      smoothLm,
      loessSmooth,
      logisticSmooth,
      densityCurve,
      empiricalCdf,
      density2dContours,
      violinAndDots,
      violinReference,
      boxplotReference,
      rectangularAndHexBins,
      summaryHexCells,
      streamgraph,
      stackedArea,
      alignedStackedArea,
      bumpChart,
      waffleChart,
      qqDiagnostics,
      quantileRegression,
      contourBands,
      countedPoints,
      freqpolyAndJitter,
      uniqueRows,
    ],
  },
  {
    slug: "aesthetics",
    section: "aesthetics",
    title: "Aesthetics",
    summary:
      "Mapped aesthetics train scales and guides; literal geom params become final visual values.",
    narrative: [
      {
        heading: "Mapped versus literal",
        body:
          "Put a column name in aes() when data should train a scale and participate in grouping or a guide. Put a fixed value on the geom when it is already the final visual setting. A mapped linetype is discrete and splits connected geometry into one Line per style; a mapped linewidth becomes a GPU-consumable per-vertex width input.",
      },
    ],
    examples: [
      colorMapped,
      mtcarsLineStyles,
      groupedHistogram,
      scaledAesthetics,
      themedChart,
    ],
  },
  {
    slug: "guides",
    section: "guides",
    title: "Guides and legends",
    summary:
      "Guides are derived from trained semantic scales, not copied from raw rows.",
    narrative: [
      {
        heading: "What a guide represents",
        body:
          "Categorical color, shape, and linetype scales use one compact swatch per level. Continuous size and linewidth scales show bounded representative values. The default sequential color ramp, viridis, and a diverging gradient2 ramp are serializable scale data. Changing a palette or guide invalidates scale and mark bindings, not an upstream statistic or resident source upload.",
      },
    ],
    examples: [colorMapped, scaledAesthetics, mtcarsLineStyles],
  },
  {
    slug: "data",
    section: "data",
    title: "Data typing and grouping",
    summary:
      "The typed ingestion layer infers numeric/factor columns and feeds effective grouping.",
    examples: [
      discreteX,
      mpgFuelEconomy,
      irisMeasurements,
      colorMapped,
      groupedHistogram,
    ],
  },
  {
    slug: "scales",
    section: "scales",
    title: "Scales",
    summary:
      "Scale training maps data values into positions, colors, sizes, shapes, and transformed domains.",
    examples: [
      scaleTransforms,
      sqrtScale,
      filledTiles,
      scaledAesthetics,
      mtcarsLineStyles,
      mpgContinuousPalettes,
    ],
  },
  {
    slug: "positions",
    section: "positions",
    title: "Positions",
    summary:
      "Position adjustments resolve stacked, filled, dodged, or jittered layers after stats.",
    examples: [countStackedBar, groupedHistogram, flippedBars],
  },
  {
    slug: "facets",
    section: "facets",
    title: "Facets",
    summary:
      "Facets split data into panels while preserving shared scales and plot-level legends.",
    examples: [facetedScatter, facetGridStats],
  },
  {
    slug: "coords",
    section: "coords",
    title: "Coordinates",
    summary:
      "Coordinate systems project already-computed marks into flipped cartesian or polar views.",
    narrative: [
      {
        heading: "Polar viewport and scope",
        body:
          "Polar charts are centered in a square viewport inside the available canvas, so pie, rose, and radar-style polygon fixtures remain circular on rectangular surfaces. coord_polar supports theta reassignment and polygon-edge munching; coord_radial features such as donut holes, partial arcs, rotated labels, and a full line/path muncher remain explicitly deferred.",
      },
    ],
    examples: [flippedBars, zoomedPanel, polarBars, polarThetaY],
  },
  {
    slug: "annotations",
    section: "annotations",
    title: "Annotations",
    summary:
      "Literal non-inherited layers and reference lines are compiled alongside data-driven marks.",
    narrative: [
      {
        heading: 'annotate("segment")',
        body:
          'annotate("segment", { x: 1, y: 1, xend: 4, yend: 3, color: "#ef4444" }) draws a literal endpoint segment.',
      },
      {
        heading: 'annotate("rect")',
        body:
          'annotate("rect", { xmin: 1, xmax: 2, ymin: 0, ymax: 4, fill: "#bfdbfe" }) draws a literal bounded rectangle.',
      },
      {
        heading: 'annotate("text")',
        body:
          'annotate("text", { x: 2, y: 4, label: "peak" }) places a literal label.',
      },
      {
        heading: 'annotate("point")',
        body:
          'annotate("point", { x: 2, y: 4, size: 8, color: "#2563eb" }) places a literal point.',
      },
    ],
    examples: [annotationComposite],
  },
  {
    slug: "themes",
    section: "themes",
    title: "Themes",
    summary:
      "Theme helpers style panel backgrounds, grid lines, axes, and text defaults.",
    examples: [themeComparison, classicTheme, themedChart],
  },
  {
    slug: "internals",
    section: "internals",
    title: "Internals",
    summary:
      "Trace examples through raw data, stat rows, RenderTree nodes, and emitted UseGPU Live source.",
    narrative: [
      {
        heading: "Resident execution boundary",
        body:
          "A direct mark can consume typed columns without a reducer. Resident histogram and categorical stat_count products stay on the GPU only when their source, count grid, bounded scale metadata, and mark consumer all support that path. Weighted counts remain a named CPU-reference fallback; factor-group fill or color can remain resident when it uses the grouping column and default scale, while other mappings fall back. The site never labels a stat GPU-native merely because its final mark renders with WebGPU.",
      },
      {
        heading: "Large generated-data demo is opt-in",
        body:
          "The performance route generates nothing until requested and never emits or previews its generated rows. Its million-row option demonstrates a resident histogram. The existing roughly five-second PERF_BASELINE measurement is different: it measures CPU packing of one million input bars, not resident histogram execution.",
        action: {
          href: "?performance",
          label: "Open the lazy generated-data route →",
        },
      },
      {
        heading: "Adding a geom or stat",
        body:
          "Define the semantic IR and product shape first, implement the CPU reference behavior, then add a resident executor only when it has explicit source handles, bounded metadata, and a direct mark consumer. Every public geom constructor must also be entered in geomExampleCoverage: mode 'dedicated' or 'comparison' for a DocExample placed on a page, or mode 'threeD' for a ThreeDShowcase on the 3D page when the geom has no 2D form. The coverage test rejects missing or stale entries either way.",
      },
    ],
    examples: [
      histogramStatBin,
      residentCategoricalCount,
      packedTensorReuse,
      weightedHistogramFallback,
      groupedHistogram,
      smoothLm,
    ],
  },
  {
    slug: "three-d",
    section: "internals",
    title: "3D (preview)",
    summary:
      "Map z on ordinary geomPoint, geomLine, or geomPath to select their 3D mode; x/y/z pack into vec4 tensors and the use.gpu camera projects them on the GPU.",
    narrative: [
      {
        heading: "Same pipeline, one more axis",
        body:
          "The shared compiler keeps positions in data space and hands the use.gpu Cartesian view a 3-axis range plus the plot's single camera. Projection stays on the GPU, and compile, GGPlot, and emitSource are the same entry points used for 2D.",
      },
    ],
    examples: [],
    threeD: threeDShowcases,
  },
  {
    slug: "model-inspection",
    section: "model-inspection",
    title: "Model inspection (preview)",
    summary:
      "Represent model graphs and tensor structure as serializable metadata, then choose bounded GPU residency for the views that need it.",
    narrative: [
      {
        heading: "Loader versus visualization storage",
        body:
          "The page parses a local ONNX artifact directly into static operator, tensor, and data-flow metadata—without executing the model. Its model scene lays those entities out in perspective: tensor tiles become bounded slabs, operators become modules, and data flow uses routed connectors. The resulting scene stays serializable and source-aware; runtime activations and validated runtime-shared buffers remain separate follow-up slices.",
      },
    ],
    examples: [],
    modelExamples: [tinyMlpInspection],
  },
  {
    slug: "faq",
    section: "faq",
    title: "FAQ and contributor notes",
    summary: "Short answers for common grammar and GPU-dataflow questions.",
    narrative: [
      {
        heading: "Why did one line become several?",
        body:
          "Connected geoms use an explicit group when supplied. Otherwise they group by the interaction of mapped discrete color, fill, shape, and linetype aesthetics. This prevents paths from joining unrelated series and lets each GPU Line receive one dash style.",
      },
      {
        heading: "How do I add an example?",
        body:
          "Add a typed or lazily loaded dataset module, declare a DocExample with synchronized DSL text and a spec or buildSpec, place it on its owning page, and map every public geom it teaches in geomExampleCoverage. Then run the core, site, coverage, and visual checks. Real-data examples load only when mounted, so ordinary additions do not create eager page-wide data transfers.",
      },
      {
        heading: "Where is the architecture reference?",
        body:
          "The repository's docs/ARCHITECTURE.md remains the normative contributor reference for the IR, compiler, RenderTree, and backend boundary. This Internals page is the reader-facing complement and states the same residency rules in the context of live examples.",
      },
    ],
    examples: [mtcarsLineStyles, histogramStatBin],
  },
  {
    slug: "geom-reference",
    section: "reference",
    title: "Geom reference",
    summary:
      "Generated constructor defaults, aesthetics, parameters, residency, and live-example links from the core geom registry.",
    geomReferences: geomReferenceEntries,
    examples: [boxplotReference],
  },
];

export const examples = docPages.flatMap((page) => page.examples);
