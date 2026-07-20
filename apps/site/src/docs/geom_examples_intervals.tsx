import {
  geomArea,
  geomCrossbar,
  geomEcdf,
  geomErrorbar,
  geomErrorbarh,
  geomJitter,
  geomLabel,
  geomLinerange,
  geomPoint,
  geomPointrange,
  geomQuantile,
  geomSmooth,
  geomWaffle,
  ggplot,
  statAlign,
  statConnect,
  statSummary2d,
  statSummaryBin,
  statSummaryHex,
  statUnique,
  themeDark,
} from "@gggplot/core";
import type { DocExample } from "./types.ts";
import { scatterData } from "./data/demo.ts";

const intervalFamilyData = {
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
    "Endpoint domains and orientation inference are shared; each constructor only selects the additional caps, point, or box topology.",
  dataPreview: intervalFamilyData,
  dslSource: `ggplot(data, { x: "x", y: "y", ymin: "ymin", ymax: "ymax" })
  .add(geomLinerange({ color: "#64748b" }))
  .add(geomPointrange({ color: "#2563eb", size: 6 }))
  .add(geomErrorbar({ width: 0.35, color: "#dc2626" }))
  .add(geomCrossbar({ width: 0.55, color: "#7c3aed" }))
  .add(geomErrorbarh({ mapping: { y: "y", xmin: "ymin", xmax: "ymax" }, inheritAes: false, width: 0.18, color: "#059669" }))
  .build();`,
  spec: ggplot(intervalFamilyData, {
    x: "x",
    y: "y",
    ymin: "ymin",
    ymax: "ymax",
  }).add(
    geomLinerange({ color: "#64748b" }),
    geomPointrange({ color: "#2563eb", size: 6 }),
    geomErrorbar({ width: 0.35, color: "#dc2626" }),
    geomCrossbar({ width: 0.55, color: "#7c3aed" }),
    geomErrorbarh({
      mapping: { y: "y", xmin: "ymin", xmax: "ymax" },
      inheritAes: false,
      width: 0.18,
      color: "#059669",
    }),
  ).build(),
};

export const quantileRegression: DocExample = {
  id: "QuantileRegression",
  title: "Linear quantile regression",
  description:
    "geomQuantile fits grouped linear pinball-loss regressions at selected probabilities.",
  visualSummary:
    "Three regression lines summarize the lower, median, and upper response trends.",
  whatChanged:
    "Each quantile emits a separate two-endpoint group and maps its probability through the color scale.",
  dataPreview: scatterData,
  dslSource: `ggplot(data, { x: "wt", y: "mpg" })
  .add(geomQuantile({ quantiles: [0.25, 0.5, 0.75], linewidth: 3 }))
  .build();`,
  spec: ggplot(scatterData, { x: "wt", y: "mpg" }).add(
    geomQuantile({ quantiles: [0.25, 0.5, 0.75], linewidth: 3 }),
  ).build(),
};

const loessData = {
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
  dslSource: `ggplot(data, { x: "x", y: "y" })
  .add(geomPoint({ color: "#475569" }))
  .add(geomSmooth({ method: "loess", span: 0.75, robustIterations: 2, level: 0.9, color: "#7c3aed" }))
  .build();`,
  spec: ggplot(loessData, { x: "x", y: "y" }).add(
    geomPoint({ color: "#475569" }),
    geomSmooth({
      method: "loess",
      span: 0.75,
      robustIterations: 2,
      level: 0.9,
      color: "#7c3aed",
    }),
  ).build(),
};

const logisticData = {
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
  dslSource: `ggplot(data, { x: "x", y: "y" })
  .add(geomJitter({ width: 0.04, height: 0.025, color: "#475569" }))
  .add(geomSmooth({ method: "glm", family: "binomial", link: "logit", color: "#059669" }))
  .build();`,
  spec: ggplot(logisticData, { x: "x", y: "y" }).add(
    geomJitter({ width: 0.04, height: 0.025, color: "#475569" }),
    geomSmooth({
      method: "glm",
      family: "binomial",
      link: "logit",
      color: "#059669",
    }),
  ).build(),
};

export const labelBackgrounds: DocExample = {
  id: "LabelBackgrounds",
  title: "Measured label backgrounds",
  description:
    "geomLabel measures each resolved glyph run and places a padded rounded box and border behind it.",
  visualSummary:
    "Rotated multiline labels with contrasting boxes on a dark panel.",
  whatChanged:
    "Box, border, and text share font metrics, rotation center, missing-row alignment, and compositional alpha.",
  dataPreview: {
    x: [1, 2, 3],
    y: [1, 2, 1.4],
    label: ["plain", "two\nlines", "rotated"],
  },
  dslSource: `ggplot(data, { x: "x", y: "y", label: "label" })
  .add(geomLabel({ fill: "#f8fafc", color: "#0f172a", borderColor: "#38bdf8", labelPadding: 4, labelR: 3, angle: 20 }))
  .add(themeDark())
  .build();`,
  spec: ggplot(
    { x: [1, 2, 3], y: [1, 2, 1.4], label: ["plain", "two\nlines", "rotated"] },
    { x: "x", y: "y", label: "label" },
  ).add(
    geomLabel({
      fill: "#f8fafc",
      color: "#0f172a",
      borderColor: "#38bdf8",
      labelPadding: 4,
      labelR: 3,
      angle: 20,
    }),
    themeDark(),
  ).build(),
};

const ecdfData = {
  value: [1, 1, 1.5, 2, 2.2, 2.2, 3, 3.4, 4],
  group: ["a", "a", "a", "a", "a", "b", "b", "b", "b"],
};

export const empiricalCdf: DocExample = {
  id: "EmpiricalCdf",
  title: "Grouped empirical distributions",
  description:
    "geomEcdf collapses ties and renders cumulative proportions as clipped step functions.",
  visualSummary: "Two monotone step curves ending at probability one.",
  whatChanged:
    "Semantic infinite padding reaches the trained panel edges without leaking into scale domains; weighted ECDFs are deferred.",
  dataPreview: ecdfData,
  dslSource: `ggplot(data, { x: "value", color: "group" })
  .add(geomEcdf({ linewidth: 3 }))
  .build();`,
  spec: ggplot(ecdfData, { x: "value", color: "group" }).add(
    geomEcdf({ linewidth: 3 }),
  ).build(),
};

export const uniqueRows: DocExample = {
  id: "UniqueRows",
  title: "Stable unique-row transform",
  description:
    "statUnique keeps the first occurrence of each exact all-column tuple before rendering.",
  visualSummary:
    "A point set where repeated identical records appear only once.",
  whatChanged:
    "Deduplication preserves source order and mappings and runs independently within each facet panel.",
  dataPreview: { x: [1, 1, 2, 2, 3], y: [2, 2, 3, 4, 4] },
  dslSource: `ggplot(data, { x: "x", y: "y" })
  .add(statUnique({ color: "#7c3aed", size: 7 }))
  .build();`,
  spec: ggplot(
    { x: [1, 1, 2, 2, 3], y: [2, 2, 3, 4, 4] },
    { x: "x", y: "y" },
  ).add(statUnique({ color: "#7c3aed", size: 7 })).build(),
};

const summaryCellData = {
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
  dslSource: `ggplot(data, { x: "x", y: "y", z: "score" })
  .add(statSummary2d({ binwidth: [0.75, 0.75], fun: "mean", opacity: 0.35 }))
  .add(statSummaryBin({ bins: 4, fun: "max", opacity: 0.25 }))
  .add(statSummaryHex({ binwidth: [0.75, 0.75], fun: "median" }))
  .build();`,
  spec: ggplot(summaryCellData, { x: "x", y: "y", z: "score" }).add(
    statSummary2d({
      binwidth: [0.75, 0.75],
      fun: "mean",
      opacity: 0.35,
    }),
    statSummaryBin({ bins: 4, fun: "max", opacity: 0.25 }),
    statSummaryHex({ binwidth: [0.75, 0.75], fun: "median" }),
  ).build(),
};

const streamgraphData = {
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
    "This is ordinary geomArea topology with position stack offset silhouette, not a streamgraph-specific geom.",
  dataPreview: streamgraphData,
  dslSource: `ggplot(data, { x: "month", y: "titles", fill: "genre" })
  .add(geomArea({ position: "stack", offset: "silhouette" }))
  .build();`,
  spec: ggplot(streamgraphData, {
    x: "month",
    y: "titles",
    fill: "genre",
  }).add(geomArea({ position: "stack", offset: "silhouette" })).build(),
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
  dslSource: `ggplot(data, { x: "month", y: "titles", fill: "genre" })
  .add(geomArea({ position: "stack" }))
  .build();`,
  spec: ggplot(streamgraphData, { x: "month", y: "titles", fill: "genre" })
    .add(geomArea({ position: "stack" }))
    .build(),
};

const mismatchedAreaData = {
  x: [0, 2, 4, 1, 3, 5],
  y: [3, 7, 4, 5, 2, 6],
  series: ["A", "A", "A", "B", "B", "B"],
};
export const alignedStackedArea: DocExample = {
  id: "AlignedStackedArea",
  title: "Shared-grid stacked areas",
  description:
    "statAlign resamples mismatched grouped x values before cumulative stacking.",
  visualSummary:
    "Two area series aligned onto one union grid and stacked without crossed boundaries.",
  whatChanged:
    "Each group is linearly interpolated on the sorted union of x values; outside support is zero and the resulting rows feed ordinary position stack.",
  dataPreview: mismatchedAreaData,
  dslSource: `ggplot(data, { x: "x", y: "y", fill: "series" })
  .add(statAlign())
  .build();`,
  spec: ggplot(mismatchedAreaData, { x: "x", y: "y", fill: "series" })
    .add(statAlign()).build(),
};

const bumpData = {
  round: [1, 2, 3, 4, 1, 2, 3, 4],
  rank: [3, 2, 1, 2, 1, 1, 3, 1],
  team: ["A", "A", "A", "A", "B", "B", "B", "B"],
};

export const bumpChart: DocExample = {
  id: "BumpChart",
  title: "Sigmoid bump connectors",
  description:
    "statConnect inserts deterministic logistic vertices between grouped rank observations.",
  visualSummary: "Two team rank paths easing smoothly between rounds.",
  whatChanged:
    "Bump charts compose a reusable sigmoid connection stat with ordinary line rendering; groups and facets never connect across boundaries.",
  dataPreview: bumpData,
  dslSource: `ggplot(data, { x: "round", y: "rank", color: "team" })
  .add(statConnect({ connection: "sigmoid", samples: 24, steepness: 8 }))
  .build();`,
  spec: ggplot(bumpData, { x: "round", y: "rank", color: "team" }).add(
    statConnect({ connection: "sigmoid", samples: 24, steepness: 8 }),
  ).build(),
};

const waffleData = {
  status: ["resolved", "progress", "blocked", "new"],
  count: [58, 27, 9, 6],
};

export const waffleChart: DocExample = {
  id: "WaffleChart",
  title: "Waffle chart",
  description:
    "geomWaffle expands integer group weights into bounded, column-major unit tiles.",
  visualSummary: "One hundred colored cells grouped by issue status.",
  whatChanged:
    "Waffle charts are a regular core geom: fill mappings train ordinary scales and guides, while statWaffle supplies tile positions.",
  dataPreview: waffleData,
  dslSource: `ggplot(data, { fill: "status" })
  .add(geomWaffle({ weight: "count", rows: 10, maxCells: 100 }))
  .build();`,
  spec: ggplot(waffleData, { fill: "status" }).add(
    geomWaffle({ weight: "count", rows: 10, maxCells: 100 }),
  ).build(),
};
