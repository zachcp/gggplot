/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// Interval, smoothing, label, distribution, area and waffle geoms, written as
// component JSX (gggplot-vnh.10.1); see examples_basics.tsx for the
// chart convention.
import * as Jsx from "@gggplot/core/jsx";
import {
  GeomArea,
  GeomCrossbar,
  GeomEcdf,
  GeomErrorbar,
  GeomErrorbarh,
  GeomJitter,
  GeomLabel,
  GeomLinerange,
  GeomPoint,
  GeomPointrange,
  GeomQuantile,
  GeomSmooth,
  GeomWaffle,
  StatAlign,
  StatConnect,
  StatSummary2d,
  StatSummaryBin,
  StatSummaryHex,
  StatUnique,
  ThemeDark,
} from "@gggplot/core";
import { SitePlot } from "../site_plot.tsx";
import type { DocExample } from "./types.ts";
import { scatterData } from "./data/demo.ts";

export const intervalFamilyData = {
  x: [1, 2, 3, 4],
  y: [2.2, 3.4, 2.8, 4.1],
  ymin: [1.4, 2.5, 2, 3.2],
  ymax: [3.1, 4.2, 3.7, 5],
};

export const intervalFamily: DocExample = {
  id: "IntervalFamily",
  title: "Shared interval geometry",
  description:
    "Linerange, pointrange, errorbar, horizontal errorbar, and crossbar use one orientation-aware interval contract.",
  visualSummary:
    "Five offset interval forms showing stems, caps, center points, and crossbars.",
  whatChanged:
    "Endpoint domains and orientation inference are shared; each component only selects the additional caps, point, or box topology.",
  dataPreview: intervalFamilyData,
  chart: () => (
    <SitePlot
      data={intervalFamilyData}
      mapping={{ x: "x", y: "y", ymin: "ymin", ymax: "ymax" }}
    >
      <GeomLinerange color="#64748b" />
      <GeomPointrange color="#2563eb" size={6} />
      <GeomErrorbar width={0.35} color="#dc2626" />
      <GeomCrossbar width={0.55} color="#7c3aed" />
      <GeomErrorbarh
        mapping={{ y: "y", xmin: "ymin", xmax: "ymax" }}
        inheritAes={false}
        width={0.18}
        color="#059669"
      />
    </SitePlot>
  ),
};

export const quantileRegression: DocExample = {
  id: "QuantileRegression",
  title: "Linear quantile regression",
  description:
    "<GeomQuantile> fits grouped linear pinball-loss regressions at selected probabilities.",
  visualSummary:
    "Three regression lines summarize the lower, median, and upper response trends.",
  whatChanged:
    "Each quantile emits a separate two-endpoint group and maps its probability through the color scale.",
  dataPreview: scatterData,
  chart: () => (
    <SitePlot data={scatterData} mapping={{ x: "wt", y: "mpg" }}>
      <GeomQuantile quantiles={[0.25, 0.5, 0.75]} linewidth={3} />
    </SitePlot>
  ),
};

export const loessData = {
  x: [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2],
  y: [4.2, 2.1, 1.2, 0.4, 0.1, 0.5, 1.1, 2.4, 4.1],
};

export const loessSmooth: DocExample = {
  id: "LoessSmooth",
  title: "Robust local quadratic smoothing",
  description:
    "Explicit method loess uses tricube-weighted local quadratic fits and robust residual iterations.",
  visualSummary:
    "A smooth curved fit and local confidence ribbon following a noisy parabola.",
  whatChanged:
    "span controls each local neighborhood; level controls covariance-derived confidence limits.",
  dataPreview: loessData,
  chart: () => (
    <SitePlot data={loessData} mapping={{ x: "x", y: "y" }}>
      <GeomPoint color="#475569" />
      <GeomSmooth
        method="loess"
        span={0.75}
        robustIterations={2}
        level={0.9}
        color="#7c3aed"
      />
    </SitePlot>
  ),
};

export const logisticData = {
  x: [-2, -2, -1, -1, 0, 0, 1, 1, 2, 2],
  y: [0, 0, 0, 1, 0, 1, 0, 1, 1, 1],
};

export const logisticSmooth: DocExample = {
  id: "LogisticSmooth",
  title: "Binomial logistic smoothing",
  description:
    "Explicit method glm fits a binomial response with the supported logit link.",
  visualSummary:
    "A bounded probability curve and link-scale confidence ribbon over binary points.",
  whatChanged:
    "Deterministic IRLS fits the serializable family/link contract; unsupported GAM models belong in an extension adapter.",
  dataPreview: logisticData,
  chart: () => (
    <SitePlot data={logisticData} mapping={{ x: "x", y: "y" }}>
      <GeomJitter width={0.04} height={0.025} color="#475569" />
      <GeomSmooth method="glm" family="binomial" link="logit" color="#059669" />
    </SitePlot>
  ),
};

export const labelData = {
  x: [1, 2, 3],
  y: [1, 2, 1.4],
  label: ["plain", "two\nlines", "rotated"],
};

export const labelBackgrounds: DocExample = {
  id: "LabelBackgrounds",
  title: "Measured label backgrounds",
  description:
    "<GeomLabel> measures each resolved glyph run and places a padded rounded box and border behind it.",
  visualSummary:
    "Rotated multiline labels with contrasting boxes on a dark panel.",
  whatChanged:
    "Box, border, and text share font metrics, rotation center, missing-row alignment, and compositional alpha.",
  dataPreview: labelData,
  chart: () => (
    <SitePlot data={labelData} mapping={{ x: "x", y: "y", label: "label" }}>
      <GeomLabel
        fill="#f8fafc"
        color="#0f172a"
        borderColor="#38bdf8"
        labelPadding={4}
        labelR={3}
        angle={20}
      />
      <ThemeDark />
    </SitePlot>
  ),
};

export const ecdfData = {
  value: [1, 1, 1.5, 2, 2.2, 2.2, 3, 3.4, 4],
  group: ["a", "a", "a", "a", "a", "b", "b", "b", "b"],
};

export const empiricalCdf: DocExample = {
  id: "EmpiricalCdf",
  title: "Grouped empirical distributions",
  description:
    "<GeomEcdf> collapses ties and renders cumulative proportions as clipped step functions.",
  visualSummary: "Two monotone step curves ending at probability one.",
  whatChanged:
    "Semantic infinite padding reaches the trained panel edges without leaking into scale domains; weighted ECDFs are deferred.",
  dataPreview: ecdfData,
  chart: () => (
    <SitePlot data={ecdfData} mapping={{ x: "value", color: "group" }}>
      <GeomEcdf linewidth={3} />
    </SitePlot>
  ),
};

export const duplicateData = { x: [1, 1, 2, 2, 3], y: [2, 2, 3, 4, 4] };

export const uniqueRows: DocExample = {
  id: "UniqueRows",
  title: "Stable unique-row transform",
  description:
    "<StatUnique> keeps the first occurrence of each exact all-column tuple before rendering.",
  visualSummary:
    "A point set where repeated identical records appear only once.",
  whatChanged:
    "Deduplication preserves source order and mappings and runs independently within each facet panel.",
  dataPreview: duplicateData,
  chart: () => (
    <SitePlot data={duplicateData} mapping={{ x: "x", y: "y" }}>
      <StatUnique color="#7c3aed" size={7} />
    </SitePlot>
  ),
};

export const summaryCellData = {
  x: [0.1, 0.2, 0.8, 0.9, 1.1, 1.2, 1.8, 1.9],
  y: [0.1, 0.2, 0.8, 0.9, 1.1, 1.2, 1.8, 1.9],
  score: [2, 4, 8, 12, 18, 22, 28, 34],
};

export const summaryHexCells: DocExample = {
  id: "SummaryHexCells",
  title: "Two-dimensional value summaries",
  description:
    "Rectangular, summary-bin, and staggered hex products aggregate z values with one reducer contract.",
  visualSummary:
    "Observed rectangular and hex cells colored by z-value reducers instead of row count.",
  whatChanged:
    "The shared 2D summary contract supports mean, median, sum, min, and max; custom functions remain a CPU/reference feature and weights are intentionally unsupported in V1.",
  dataPreview: summaryCellData,
  chart: () => (
    <SitePlot data={summaryCellData} mapping={{ x: "x", y: "y", z: "score" }}>
      <StatSummary2d binwidth={[0.75, 0.75]} fun="mean" opacity={0.35} />
      <StatSummaryBin bins={4} fun="max" opacity={0.25} />
      <StatSummaryHex binwidth={[0.75, 0.75]} fun="median" />
    </SitePlot>
  ),
};

export const streamgraphData = {
  month: [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4],
  titles: [8, 12, 10, 14, 5, 9, 13, 8, 4, 6, 9, 12],
  genre: [
    "drama",
    "drama",
    "drama",
    "drama",
    "comedy",
    "comedy",
    "comedy",
    "comedy",
    "action",
    "action",
    "action",
    "action",
  ],
};

export const streamgraph: DocExample = {
  id: "Streamgraph",
  title: "Centered streamgraph",
  description:
    "A reusable silhouette stack offset centers grouped area thickness around zero.",
  visualSummary: "Three flowing area bands sharing a centered baseline.",
  whatChanged:
    'This is ordinary <GeomArea> topology with position "stack" and offset "silhouette", not a streamgraph-specific geom.',
  dataPreview: streamgraphData,
  chart: () => (
    <SitePlot
      data={streamgraphData}
      mapping={{ x: "month", y: "titles", fill: "genre" }}
    >
      <GeomArea position="stack" offset="silhouette" />
    </SitePlot>
  ),
};

export const stackedArea: DocExample = {
  id: "StackedArea",
  title: "Cumulative stacked areas",
  description:
    "Aligned grouped series accumulate into non-overlapping area bands.",
  visualSummary:
    "Three positive area bands stacked from a shared zero baseline.",
  whatChanged:
    "position stack carries each group's lower boundary forward at every x value and trains the y scale on cumulative totals.",
  dataPreview: streamgraphData,
  chart: () => (
    <SitePlot
      data={streamgraphData}
      mapping={{ x: "month", y: "titles", fill: "genre" }}
    >
      <GeomArea position="stack" />
    </SitePlot>
  ),
};

export const mismatchedAreaData = {
  x: [0, 2, 4, 1, 3, 5],
  y: [3, 7, 4, 5, 2, 6],
  series: ["A", "A", "A", "B", "B", "B"],
};
export const alignedStackedArea: DocExample = {
  id: "AlignedStackedArea",
  title: "Shared-grid stacked areas",
  description:
    "<StatAlign> resamples mismatched grouped x values before cumulative stacking.",
  visualSummary:
    "Two area series aligned onto one union grid and stacked without crossed boundaries.",
  whatChanged:
    "Each group is linearly interpolated on the sorted union of x values; outside support is zero and the resulting rows feed ordinary position stack.",
  dataPreview: mismatchedAreaData,
  chart: () => (
    <SitePlot
      data={mismatchedAreaData}
      mapping={{ x: "x", y: "y", fill: "series" }}
    >
      <StatAlign />
    </SitePlot>
  ),
};

export const bumpData = {
  round: [1, 2, 3, 4, 1, 2, 3, 4],
  rank: [3, 2, 1, 2, 1, 1, 3, 1],
  team: ["A", "A", "A", "A", "B", "B", "B", "B"],
};

export const bumpChart: DocExample = {
  id: "BumpChart",
  title: "Sigmoid bump connectors",
  description:
    "<StatConnect> inserts deterministic logistic vertices between grouped rank observations.",
  visualSummary: "Two team rank paths easing smoothly between rounds.",
  whatChanged:
    "Bump charts compose a reusable sigmoid connection stat with ordinary line rendering; groups and facets never connect across boundaries.",
  dataPreview: bumpData,
  chart: () => (
    <SitePlot
      data={bumpData}
      mapping={{ x: "round", y: "rank", color: "team" }}
    >
      <StatConnect connection="sigmoid" samples={24} steepness={8} />
    </SitePlot>
  ),
};

export const waffleData = {
  status: ["resolved", "progress", "blocked", "new"],
  count: [58, 27, 9, 6],
};

export const waffleChart: DocExample = {
  id: "WaffleChart",
  title: "Waffle chart",
  description:
    "<GeomWaffle> expands integer group weights into bounded, column-major unit tiles.",
  visualSummary: "One hundred colored cells grouped by issue status.",
  whatChanged:
    "Waffle charts are a regular core geom: fill mappings train ordinary scales and guides, while stat_waffle supplies tile positions.",
  dataPreview: waffleData,
  chart: () => (
    <SitePlot data={waffleData} mapping={{ fill: "status" }}>
      <GeomWaffle weight="count" rows={10} maxCells={100} />
    </SitePlot>
  ),
};
