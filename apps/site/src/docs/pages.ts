import type { DocPage } from "./types.ts";
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
  polarBars,
  polarThetaY,
  scaledAesthetics,
  scaleTransforms,
  scatterLine,
  smoothLm,
  sqrtScale,
  summaryMean,
  themeComparison,
  themedChart,
  tileHeatmap,
} from "./examples.tsx";

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
    examples: [scatterLine, mtcarsLineStyles, tileHeatmap, themedChart],
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
    examples: [flippedBars, polarBars, polarThetaY],
  },
  {
    slug: "annotations",
    section: "annotations",
    title: "Annotations",
    summary:
      "Literal non-inherited layers and reference lines are compiled alongside data-driven marks.",
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
          "A direct mark can consume typed columns without a reducer. Resident histogram products stay on the GPU only when their source, count grid, bounded scale metadata, and mark consumer all support that path. Other stats are named CPU-reference fallbacks; the site never labels them GPU-native merely because their final mark renders with WebGPU.",
      },
      {
        heading: "Adding a geom or stat",
        body:
          "Define the semantic IR and product shape first, implement the CPU reference behavior, then add a resident executor only when it has explicit source handles, bounded metadata, and a direct mark consumer. Add a DocExample beside its data module and describe the execution boundary in What changed.",
      },
    ],
    examples: [histogramStatBin, groupedHistogram, smoothLm],
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
          "Add a typed or lazily loaded dataset module, declare a DocExample with DSL text and a spec or buildSpec, place it on its owning page, then run the core and site checks. Real-data examples load only when mounted, so ordinary additions do not create eager page-wide data transfers.",
      },
      {
        heading: "Where is the architecture reference?",
        body:
          "The repository's docs/ARCHITECTURE.md remains the normative contributor reference for the IR, compiler, RenderTree, and backend boundary. This Internals page is the reader-facing complement and states the same residency rules in the context of live examples.",
      },
    ],
    examples: [mtcarsLineStyles, histogramStatBin],
  },
];

export const examples = docPages.flatMap((page) => page.examples);
