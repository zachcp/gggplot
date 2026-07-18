// Geom lowering dispatch. Mirrors the stat side's Record<StatKind, StatFn>
// registry (stat/mod.ts): each GeomKind maps to a GeomDefinition carrying its
// DSL defaults plus a uniform lower(layer, mapping, data, ctx) function. The
// per-geom implementations live in focused modules, one file per geom family,
// like ggplot2's geom-*.R layout.
import type { Aes, DataFrame, GeomKind, Layer } from "../ir/types.ts";
import type { RenderNode } from "../compile/rendertree.ts";
import type { GeomDefinition, GeomDocMeta, LayerContext } from "./types.ts";

import { lowerPoint } from "./point.ts";
import { lowerLine } from "./line.ts";
import { barDomainContribution, barResidentPlan, lowerBar } from "./bar.ts";
import { areaDomainContribution, lowerArea } from "./area.ts";
import { lowerPolygon } from "./polygon.ts";
import { lowerTile, tileDomainContribution } from "./tile.ts";
import { lowerHex } from "./hex.ts";
import { lowerInterval } from "./errorbar.ts";
import { lowerBoxplot } from "./boxplot.ts";
import { lowerViolin } from "./violin.ts";
import { lowerText } from "./text.ts";
import { lowerSegment } from "./segment.ts";
import { lowerRect } from "./rect.ts";
import { lowerAbline, lowerHline, lowerVline } from "./refline.ts";
import { lowerCurve } from "./curve.ts";
import { lowerSpoke } from "./spoke.ts";
import { lowerRug } from "./rug.ts";
import { lowerBlank } from "./blank.ts";
import { lowerSmooth } from "./smooth.ts";

export type { GeomDefinition, GeomDocMeta, LayerContext } from "./types.ts";
// Helpers consumed by compile/mod.ts, compile/guides.ts, and compile/coordinates.ts.
export {
  colorWithAlpha,
  normalizeFontface,
  resolutionOf,
  valuesOf,
} from "./shared.ts";
export {
  createHistogramBarTopologyPlan,
  type HistogramBarTopologyOptions,
} from "./bar.ts";

const visual = ["color", "fill", "alpha"] as const;
const lineVisual = ["color", "alpha", "linetype", "linewidth"] as const;
const doc = (
  summary: string,
  required: GeomDocMeta["aesthetics"]["required"],
  optional: GeomDocMeta["aesthetics"]["optional"] = [],
  params?: Record<string, string>,
): GeomDocMeta => ({ summary, aesthetics: { required, optional }, params });

/** Every GeomKind maps to exactly one definition; several kinds may share a lower fn. */
export const GEOM_REGISTRY: Record<GeomKind, GeomDefinition> = {
  point: {
    defaultStat: "identity",
    lower: lowerPoint,
    doc: doc("Draw points at x/y positions.", ["x", "y"], [
      ...visual,
      "size",
      "shape",
      "stroke",
      "group",
    ]),
  },
  dotplot: {
    defaultStat: "dotplot",
    lower: lowerPoint,
    doc: doc("Bin observations into stacked dots.", ["x"], [
      "y",
      ...visual,
      "size",
      "group",
    ], {
      binwidth: "Width of each dot bin.",
      stackratio: "Vertical spacing between dots.",
    }),
  },
  line: {
    defaultStat: "identity",
    lower: lowerLine,
    doc: doc("Connect observations in ascending x order.", ["x", "y"], [
      ...lineVisual,
      "group",
    ]),
  },
  path: {
    defaultStat: "identity",
    lower: lowerLine,
    doc: doc("Connect observations in input order.", ["x", "y"], [
      ...lineVisual,
      "group",
    ]),
  },
  step: {
    defaultStat: "identity",
    lower: lowerLine,
    doc: doc(
      "Connect observations with horizontal and vertical steps.",
      ["x", "y"],
      [...lineVisual, "group"],
      { direction: "Step order: hv, vh, or mid." },
    ),
  },
  bar: {
    defaultStat: "count",
    defaultPosition: "stack",
    lower: lowerBar,
    domainContribution: barDomainContribution,
    residentPlan: barResidentPlan,
    doc: doc("Count observations into categorical bars.", ["x"], [
      "group",
      ...visual,
    ], {
      width: "Bar width in x units.",
      weight: "Optional count weight; uses the CPU path.",
    }),
  },
  col: {
    defaultStat: "identity",
    defaultPosition: "stack",
    lower: lowerBar,
    domainContribution: barDomainContribution,
    doc: doc("Draw bars from explicit x/y values.", ["x", "y"], [
      "group",
      ...visual,
    ], { width: "Bar width in x units." }),
  },
  area: {
    defaultStat: "identity",
    lower: lowerArea,
    domainContribution: areaDomainContribution,
    doc: doc(
      "Draw filled bands from a baseline to grouped y series.",
      ["x", "y"],
      ["group", ...visual],
      { offset: "Use silhouette to center stacked bands." },
    ),
  },
  ribbon: {
    defaultStat: "identity",
    lower: lowerArea,
    doc: doc("Draw a band between ymin and ymax.", ["x", "ymin", "ymax"], [
      "group",
      ...visual,
    ]),
  },
  polygon: {
    defaultStat: "identity",
    lower: lowerPolygon,
    doc: doc("Draw closed grouped polygon loops.", ["x", "y"], [
      "group",
      ...visual,
    ]),
  },
  tile: {
    defaultStat: "identity",
    lower: lowerTile,
    domainContribution: tileDomainContribution,
    doc: doc("Draw rectangular cells centered on x/y.", ["x", "y"], [
      "fill",
      "color",
      "alpha",
      "z",
    ], { width: "Cell width.", height: "Cell height." }),
  },
  hex: {
    defaultStat: "binhex",
    lower: lowerHex,
    doc: doc("Aggregate observations into hexagonal cells.", ["x", "y"], [
      "fill",
      "color",
      "alpha",
      "group",
    ], { bins: "Number of bins per axis.", binwidth: "Hex bin width." }),
  },
  text: {
    defaultStat: "identity",
    lower: lowerText,
    doc: doc("Draw text labels at x/y positions.", ["x", "y", "label"], [
      "color",
      "alpha",
      "size",
      "angle",
      "family",
      "fontface",
      "group",
    ], { hjust: "Horizontal alignment.", vjust: "Vertical alignment." }),
  },
  label: {
    defaultStat: "identity",
    lower: lowerText,
    doc: doc("Draw text with padded background boxes.", ["x", "y", "label"], [
      "color",
      "fill",
      "alpha",
      "size",
      "angle",
      "family",
      "fontface",
      "group",
    ], { padding: "Padding around text.", radius: "Corner radius." }),
  },
  boxplot: {
    defaultStat: "boxplot",
    lower: lowerBoxplot,
    doc: doc(
      "Summarize grouped distributions with boxes and whiskers.",
      ["x", "y"],
      ["group", ...visual],
      { coef: "Whisker length as an IQR multiple.", width: "Box width." },
    ),
  },
  errorbar: {
    defaultStat: "identity",
    lower: lowerInterval,
    doc: doc("Draw capped uncertainty intervals.", ["x", "ymin", "ymax"], [
      ...lineVisual,
    ], { width: "Cap width.", orientation: "Use y for horizontal intervals." }),
  },
  linerange: {
    defaultStat: "identity",
    lower: lowerInterval,
    doc: doc("Draw vertical or horizontal interval stems.", [
      "x",
      "ymin",
      "ymax",
    ], [...lineVisual]),
  },
  pointrange: {
    defaultStat: "identity",
    lower: lowerInterval,
    doc: doc("Draw an interval stem with a central point.", [
      "x",
      "y",
      "ymin",
      "ymax",
    ], [...lineVisual, "size", "shape"]),
  },
  crossbar: {
    defaultStat: "identity",
    lower: lowerInterval,
    doc: doc(
      "Draw an interval box with a central crossbar.",
      ["x", "y", "ymin", "ymax"],
      [...lineVisual, "fill"],
      { width: "Crossbar width." },
    ),
  },
  smooth: {
    defaultStat: "smooth",
    lower: lowerSmooth,
    doc: doc(
      "Fit and draw a smooth trend with an optional interval.",
      ["x", "y"],
      ["group", ...lineVisual, "fill"],
      {
        method: "lm, loess, or glm.",
        se: "Draw the confidence interval.",
        span: "Loess neighborhood fraction.",
      },
    ),
  },
  violin: {
    defaultStat: "ydensity",
    lower: lowerViolin,
    doc: doc("Draw mirrored grouped density distributions.", ["x", "y"], [
      "group",
      ...visual,
    ], { bandwidth: "Kernel bandwidth.", width: "Maximum violin width." }),
  },
  segment: {
    defaultStat: "identity",
    lower: lowerSegment,
    doc: doc("Draw straight segments between endpoints.", [
      "x",
      "y",
      "xend",
      "yend",
    ], [...lineVisual]),
  },
  rect: {
    defaultStat: "identity",
    lower: lowerRect,
    doc: doc("Draw rectangles from explicit bounds.", [
      "xmin",
      "xmax",
      "ymin",
      "ymax",
    ], [...visual]),
  },
  hline: {
    defaultStat: "identity",
    lower: lowerHline,
    doc: doc("Draw full-width horizontal reference lines.", ["y"], [
      ...lineVisual,
    ]),
  },
  vline: {
    defaultStat: "identity",
    lower: lowerVline,
    doc: doc("Draw full-height vertical reference lines.", ["x"], [
      ...lineVisual,
    ]),
  },
  abline: {
    defaultStat: "identity",
    lower: lowerAbline,
    doc: doc("Draw slope/intercept reference lines.", [], [...lineVisual], {
      slope: "Line slope.",
      intercept: "Y intercept.",
    }),
  },
  curve: {
    defaultStat: "identity",
    lower: lowerCurve,
    doc: doc(
      "Draw tessellated curves between endpoints.",
      ["x", "y", "xend", "yend"],
      [...lineVisual, "group"],
      { curvature: "Signed curve bend.", segments: "Tessellation resolution." },
    ),
  },
  spoke: {
    defaultStat: "identity",
    lower: lowerSpoke,
    doc: doc("Draw rays from angle and radius values.", [
      "x",
      "y",
      "angle",
      "radius",
    ], [...lineVisual]),
  },
  rug: {
    defaultStat: "identity",
    lower: lowerRug,
    doc: doc("Draw short observation ticks on panel edges.", [], [
      "x",
      "y",
      ...lineVisual,
    ], {
      sides: "Panel sides receiving ticks.",
      length: "Tick length in CSS pixels.",
    }),
  },
  blank: {
    defaultStat: "identity",
    lower: lowerBlank,
    doc: doc("Train scales without drawing marks.", [], ["x", "y", "group"]),
  },
};

/** Map one geom layer to its RenderNode(s) — one per group for connected geoms. */
export function lowerLayer(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  return GEOM_REGISTRY[layer.geom].lower(layer, mapping, data, ctx);
}
