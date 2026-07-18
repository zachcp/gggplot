import type {
  Aes,
  AesName,
  GeomKind,
  PositionKind,
  StatKind,
} from "../ir/types.ts";
import { ingest, type IngestOptions, type InputData } from "../data/mod.ts";
import type { SpecPart } from "./base.ts";

interface GeomOpts {
  mapping?: Aes;
  data?: InputData;
  dataOptions?: IngestOptions;
  stat?: StatKind;
  position?: PositionKind;
  /** ggplot2's inherit.aes — set false to ignore the plot's top-level aes() mapping. */
  inheritAes?: boolean;
  [param: string]: unknown;
}

function geom(
  kind: GeomKind,
  defaultStat: StatKind,
  opts: GeomOpts = {},
  defaultPosition: PositionKind = "identity",
): SpecPart {
  const { mapping, data, dataOptions, stat, position, inheritAes, ...params } =
    opts;
  return {
    tag: "layer",
    value: {
      geom: kind,
      stat: stat ?? defaultStat,
      position: position ?? defaultPosition,
      mapping,
      data: data ? ingest(data, dataOptions) : undefined,
      inheritAes,
      params,
    },
  };
}

export const geomPoint = (opts: GeomOpts = {}): SpecPart =>
  geom("point", "identity", opts);
export const geomLine = (opts: GeomOpts = {}): SpecPart =>
  geom("line", "identity", opts);
export const geomPath = (opts: GeomOpts = {}): SpecPart =>
  geom("path", "identity", opts);
export const geomBar = (opts: GeomOpts = {}): SpecPart =>
  geom("bar", "count", opts, "stack");
export const geomHistogram = (opts: GeomOpts = {}): SpecPart =>
  geom("bar", "bin", { ...opts, stat: "bin" }, "stack");
export const geomCol = (opts: GeomOpts = {}): SpecPart =>
  geom("col", "identity", opts, "stack");
export const geomArea = (opts: GeomOpts = {}): SpecPart =>
  geom("area", "identity", opts);
export const geomRibbon = (opts: GeomOpts = {}): SpecPart =>
  geom("ribbon", "identity", opts);
export const geomPolygon = (opts: GeomOpts = {}): SpecPart =>
  geom("polygon", "identity", opts);
export const geomTile = (opts: GeomOpts = {}): SpecPart =>
  geom("tile", "identity", opts);
/** Like geomTile, but always at full axis resolution — pass no width/height. */
export const geomRaster = (opts: GeomOpts = {}): SpecPart =>
  geom("tile", "identity", opts);
export const geomText = (opts: GeomOpts = {}): SpecPart =>
  geom("text", "identity", opts);
export const geomLabel = (opts: GeomOpts = {}): SpecPart =>
  geom("label", "identity", opts);
export const geomBoxplot = (opts: GeomOpts = {}): SpecPart =>
  geom("boxplot", "boxplot", opts);
export const geomErrorbar = (opts: GeomOpts = {}): SpecPart =>
  geom("errorbar", "identity", opts);
export const geomErrorbarh = (opts: GeomOpts = {}): SpecPart =>
  geom("errorbar", "identity", { ...opts, orientation: "y" });
export const geomLinerange = (opts: GeomOpts = {}): SpecPart =>
  geom("linerange", "identity", opts);
export const geomPointrange = (opts: GeomOpts = {}): SpecPart =>
  geom("pointrange", "identity", opts);
export const geomCrossbar = (opts: GeomOpts = {}): SpecPart =>
  geom("crossbar", "identity", opts);
/** Fits a trend line plus an optional SE ribbon. Core methods: lm (default), loess (span/robustIterations), and binomial-logit glm; gam requires an extension adapter. */
export const geomSmooth = (opts: GeomOpts = {}): SpecPart =>
  geom("smooth", "smooth", opts);
/** Kernel density estimate rendered as a line. */
export const geomDensity = (opts: GeomOpts = {}): SpecPart =>
  geom("line", "density", opts);
/** Mirrored kernel-density polygon from raw y observations. */
export const geomViolin = (opts: GeomOpts = {}): SpecPart =>
  geom("violin", "ydensity", opts);
/** Deterministic binned and stacked dots. */
export const geomDotplot = (opts: GeomOpts = {}): SpecPart =>
  geom("dotplot", "dotplot", opts);
/** Rectangular 2D count bins, mapped to fill. */
export const geomBin2d = (opts: GeomOpts = {}): SpecPart =>
  geom("tile", "bin2d", opts);
/** Hexagonal 2D count bins, mapped to fill. */
export const geomHex = (opts: GeomOpts = {}): SpecPart =>
  geom("hex", "binhex", opts);
/** Expand integer group counts into column-major unit tiles. */
export const statWaffle = (opts: GeomOpts = {}): SpecPart =>
  geom("tile", "waffle", opts);
/** Waffle chart convenience geom backed by statWaffle and ordinary tile lowering. */
export const geomWaffle = (opts: GeomOpts = {}): SpecPart =>
  geom("tile", "waffle", { ...opts, stat: "waffle" });
/** Rectangular 2D bins that summarize mapped z values (default mean). */
export const statSummary2d = (opts: GeomOpts = {}): SpecPart =>
  geom("tile", "summary2d", opts);
/** Hexagonal bins that summarize mapped z values (default mean). */
export const statSummaryHex = (opts: GeomOpts = {}): SpecPart =>
  geom("hex", "summaryhex", { ...opts, hex: true });
/** Alias for rectangular statSummary2d, matching the summary-bin vocabulary. */
export const statSummaryBin = (opts: GeomOpts = {}): SpecPart =>
  geom("tile", "summarybin", opts);
export const geomQq = (opts: GeomOpts = {}): SpecPart =>
  geom("point", "qq", opts);
export const geomQqLine = (opts: GeomOpts = {}): SpecPart =>
  geom("line", "qqline", opts);
export const statEllipse = (opts: GeomOpts = {}): SpecPart =>
  geom("line", "ellipse", opts);
export const statFunction = (
  fun: (x: number) => number,
  opts: GeomOpts = {},
): SpecPart => geom("line", "function", { ...opts, fun });
export const geomContour = (opts: GeomOpts = {}): SpecPart =>
  geom("segment", "contour", opts);
export const geomContourFilled = (opts: GeomOpts = {}): SpecPart =>
  geom("tile", "contourfilled", opts);
/** Frequency polygon: binned counts connected through ascending bin centers. */
export const geomFreqpoly = (opts: GeomOpts = {}): SpecPart =>
  geom("line", "bin", opts);
/** Train scales and facets without emitting marks or legend keys. */
export const geomBlank = (opts: GeomOpts = {}): SpecPart =>
  geom("blank", "identity", opts);
/** Connect sorted observations with horizontal/vertical steps; direction is hv, vh, or mid. */
export const geomStep = (opts: GeomOpts = {}): SpecPart =>
  geom("step", "identity", opts);
/** Expand grouped points with linear, stepped, midpoint, or sigmoid connectors. */
export const statConnect = (opts: GeomOpts = {}): SpecPart =>
  geom("line", "connect", opts);
/** Approximate a curved x/y to xend/yend segment with deterministic quadratic tessellation. */
export const geomCurve = (opts: GeomOpts = {}): SpecPart =>
  geom("curve", "identity", opts);
/** Draw rays from x/y using angle (radians) and radius aesthetics. */
export const geomSpoke = (opts: GeomOpts = {}): SpecPart =>
  geom("spoke", "identity", opts);
/** Draw short observations ticks along panel edges. */
export const geomRug = (opts: GeomOpts = {}): SpecPart =>
  geom("rug", "identity", opts);
/** Public geom spelling for a line evaluated from a function. */
export const geomFunction = (
  fun: (x: number) => number,
  opts: GeomOpts = {},
): SpecPart => statFunction(fun, opts);
/** Point sugar whose default position is deterministic jitter. */
export const geomJitter = (opts: GeomOpts = {}): SpecPart =>
  geom("point", "identity", opts, "jitter");
/** Aggregate duplicate x/y tuples and size their points by count/weight. */
export const geomCount = (opts: GeomOpts = {}): SpecPart => {
  const mapping = opts.mapping?.size || opts.size !== undefined
    ? opts.mapping
    : { ...opts.mapping, size: "n" };
  return geom("point", "sum", { ...opts, mapping });
};
/** Explicit stat_sum layer; point is the default geom. */
export const statSum = (opts: GeomOpts = {}): SpecPart =>
  geom("point", "sum", opts);
/** Contour a grouped two-dimensional Gaussian KDE. */
export const geomDensity2d = (opts: GeomOpts = {}): SpecPart =>
  geom("segment", "density2d", opts);
/** Render filled bands from a grouped two-dimensional Gaussian KDE. */
export const geomDensity2dFilled = (opts: GeomOpts = {}): SpecPart =>
  geom("tile", "density2dfilled", opts);
export const statDensity2d = (opts: GeomOpts = {}): SpecPart =>
  geom("segment", "density2d", opts);
export const statDensity2dFilled = (opts: GeomOpts = {}): SpecPart =>
  geom("tile", "density2dfilled", opts);
export const geomQuantile = (opts: GeomOpts = {}): SpecPart =>
  geom("line", "quantile", {
    ...opts,
    mapping: opts.mapping?.color
      ? opts.mapping
      : { ...opts.mapping, color: "quantile" },
  });
export const statQuantile = (opts: GeomOpts = {}): SpecPart =>
  geom("line", "quantile", opts);
/** Empirical cumulative distribution rendered as an hv step function. */
export const geomEcdf = (opts: GeomOpts = {}): SpecPart =>
  geom("step", "ecdf", { direction: "hv", ...opts });
export const statEcdf = (opts: GeomOpts = {}): SpecPart =>
  geom("step", "ecdf", opts);
/** Stable all-column row deduplication with the selected geom (point by default). */
export const statUnique = (opts: GeomOpts = {}): SpecPart =>
  geom("point", "unique", opts);

// --- annotations -----------------------------------------------------------
//
// Annotations are literal, non-data marks (ggsql's PLACE layers / ggplot2's
// annotate()): their positions are fixed values passed at call time, not
// columns mapped from `data`. They never inherit the plot's aes() mapping and
// never train a legend, since there is no data column behind them — just a
// single synthetic row carrying the literal values through the same geom
// lowering every data-driven layer uses.

export type AnnotateGeom = "segment" | "rect" | "text" | "point";

export interface AnnotateOpts {
  x?: number;
  y?: number;
  xend?: number;
  yend?: number;
  xmin?: number;
  xmax?: number;
  ymin?: number;
  ymax?: number;
  label?: string;
  [param: string]: unknown;
}

const ANNOTATE_AES: AesName[] = [
  "x",
  "y",
  "xend",
  "yend",
  "xmin",
  "xmax",
  "ymin",
  "ymax",
  "label",
];

/**
 * A literal, non-data-bound layer: reference lines, segments, labels, points,
 * and rectangles placed at fixed coordinates (ggplot2's `annotate()`). Any
 * other option (e.g. `color`, `fill`, `size`) is a literal visual setting,
 * exactly like a geom's fixed params.
 */
export const annotate = (
  geomKind: AnnotateGeom,
  opts: AnnotateOpts = {},
): SpecPart => {
  const values: Record<string, unknown[]> = {};
  const mapping: Aes = {};
  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(opts)) {
    if ((ANNOTATE_AES as string[]).includes(key) && value !== undefined) {
      values[key] = [value];
      mapping[key as AesName] = key;
    } else if (value !== undefined) {
      params[key] = value;
    }
  }
  return {
    tag: "layer",
    value: {
      geom: geomKind,
      stat: "identity",
      position: "identity",
      mapping,
      data: ingest(values),
      inheritAes: false,
      params,
    },
  };
};

/** One or more full-width horizontal reference lines at yintercept(s) (ggplot2's geom_hline). */
export const geomHline = (
  opts: { yintercept: number | number[] } & Record<string, unknown>,
): SpecPart => {
  const { yintercept, ...params } = opts;
  const values = Array.isArray(yintercept) ? yintercept : [yintercept];
  return {
    tag: "layer",
    value: {
      geom: "hline",
      stat: "identity",
      position: "identity",
      mapping: { y: "y" },
      data: ingest({ y: values }),
      inheritAes: false,
      params,
    },
  };
};

/** One or more full-height vertical reference lines at xintercept(s) (ggplot2's geom_vline). */
export const geomVline = (
  opts: { xintercept: number | number[] } & Record<string, unknown>,
): SpecPart => {
  const { xintercept, ...params } = opts;
  const values = Array.isArray(xintercept) ? xintercept : [xintercept];
  return {
    tag: "layer",
    value: {
      geom: "vline",
      stat: "identity",
      position: "identity",
      mapping: { x: "x" },
      data: ingest({ x: values }),
      inheritAes: false,
      params,
    },
  };
};

/** A diagonal reference line y = slope*x + intercept, spanning the panel's full x range (ggplot2's geom_abline). */
export const geomAbline = (
  opts: { slope?: number; intercept?: number } & Record<string, unknown> = {},
): SpecPart => ({
  tag: "layer",
  value: {
    geom: "abline",
    stat: "identity",
    position: "identity",
    mapping: {},
    data: ingest({}),
    inheritAes: false,
    params: opts,
  },
});
