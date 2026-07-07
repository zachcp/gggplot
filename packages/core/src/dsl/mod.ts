// The ggplot-style DSL. Mirrors ggplot2's grammar: a base ggplot() plus
// composable geom_*/scale_*/coord_*/facet_*/theme_* parts, combined here with a
// fluent `.add()` in place of R's `+` operator.

import type {
  Aes,
  AesName,
  Coord,
  DataFrame,
  Facet,
  GeomKind,
  GGSpec,
  Layer,
  PlotLabels,
  PositionAxis,
  PositionKind,
  Scale,
  StatKind,
  Theme,
} from "../ir/types.ts";

/** Identity helper — `aes({ x: "wt", y: "mpg" })` reads like ggplot. */
export const aes = (mapping: Aes): Aes => mapping;

/** A tagged spec fragment produced by a geom/scale/coord/facet/theme builder. */
export type SpecPart =
  | { tag: "layer"; value: Layer }
  | { tag: "scale"; value: Scale }
  | { tag: "coord"; value: Coord }
  | { tag: "facet"; value: Facet }
  | { tag: "labels"; value: PlotLabels }
  | { tag: "theme"; value: Theme };

function defaultSpec(data: DataFrame, mapping: Aes): GGSpec {
  return {
    data,
    mapping,
    layers: [],
    scales: [],
    coord: { kind: "cartesian" },
    facet: { kind: "none" },
    labels: {},
    theme: { name: "default" },
  };
}

/** Fluent plot builder. `ggplot(data, aes(...)).add(geomPoint()).build()`. */
export class GG {
  readonly spec: GGSpec;

  constructor(data: DataFrame, mapping: Aes = {}) {
    this.spec = defaultSpec(data, mapping);
  }

  /** Apply a spec part (ggplot's `+`). Accepts multiple for convenience. */
  add(...parts: SpecPart[]): this {
    for (const part of parts) {
      switch (part.tag) {
        case "layer":
          this.spec.layers.push(part.value);
          break;
        case "scale":
          this.spec.scales.push(part.value);
          break;
        case "coord":
          this.spec.coord = part.value;
          break;
        case "facet":
          this.spec.facet = part.value;
          break;
        case "labels":
          this.spec.labels = { ...this.spec.labels, ...part.value };
          break;
        case "theme":
          // Additive, like ggplot2's theme_minimal() + theme(...): later
          // calls layer new fields over earlier ones instead of replacing
          // the whole theme object.
          this.spec.theme = { ...this.spec.theme, ...part.value };
          break;
      }
    }
    return this;
  }

  build(): GGSpec {
    return this.spec;
  }
}

export const ggplot = (data: DataFrame, mapping: Aes = {}): GG =>
  new GG(data, mapping);

// --- geoms ---------------------------------------------------------------

interface GeomOpts {
  mapping?: Aes;
  data?: DataFrame;
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
  const { mapping, data, stat, position, inheritAes, ...params } = opts;
  return {
    tag: "layer",
    value: {
      geom: kind,
      stat: stat ?? defaultStat,
      position: position ?? defaultPosition,
      mapping,
      data,
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
/** Like geomText; the background box behind the text isn't rendered (needs real text metrics). */
export const geomLabel = (opts: GeomOpts = {}): SpecPart =>
  geom("text", "identity", opts);
export const geomBoxplot = (opts: GeomOpts = {}): SpecPart =>
  geom("boxplot", "identity", opts);
export const geomErrorbar = (opts: GeomOpts = {}): SpecPart =>
  geom("errorbar", "identity", opts);
/** Fits a trend line (stat_smooth) plus an optional SE ribbon; params: method ("lm", default), se (default true), n (fitted points, default 80), level. */
export const geomSmooth = (opts: GeomOpts = {}): SpecPart =>
  geom("smooth", "smooth", opts);

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

const ANNOTATE_AES: AesName[] = ["x", "y", "xend", "yend", "xmin", "xmax", "ymin", "ymax", "label"];

/**
 * A literal, non-data-bound layer: reference lines, segments, labels, points,
 * and rectangles placed at fixed coordinates (ggplot2's `annotate()`). Any
 * other option (e.g. `color`, `fill`, `size`) is a literal visual setting,
 * exactly like a geom's fixed params.
 */
export const annotate = (geomKind: AnnotateGeom, opts: AnnotateOpts = {}): SpecPart => {
  const data: DataFrame = {};
  const mapping: Aes = {};
  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(opts)) {
    if ((ANNOTATE_AES as string[]).includes(key) && value !== undefined) {
      data[key] = [value];
      mapping[key as AesName] = key;
    } else if (value !== undefined) {
      params[key] = value;
    }
  }
  return {
    tag: "layer",
    value: { geom: geomKind, stat: "identity", position: "identity", mapping, data, inheritAes: false, params },
  };
};

/** One or more full-width horizontal reference lines at yintercept(s) (ggplot2's geom_hline). */
export const geomHline = (opts: { yintercept: number | number[] } & Record<string, unknown>): SpecPart => {
  const { yintercept, ...params } = opts;
  const values = Array.isArray(yintercept) ? yintercept : [yintercept];
  return {
    tag: "layer",
    value: {
      geom: "hline",
      stat: "identity",
      position: "identity",
      mapping: { y: "y" },
      data: { y: values },
      inheritAes: false,
      params,
    },
  };
};

/** One or more full-height vertical reference lines at xintercept(s) (ggplot2's geom_vline). */
export const geomVline = (opts: { xintercept: number | number[] } & Record<string, unknown>): SpecPart => {
  const { xintercept, ...params } = opts;
  const values = Array.isArray(xintercept) ? xintercept : [xintercept];
  return {
    tag: "layer",
    value: {
      geom: "vline",
      stat: "identity",
      position: "identity",
      mapping: { x: "x" },
      data: { x: values },
      inheritAes: false,
      params,
    },
  };
};

/** A diagonal reference line y = slope*x + intercept, spanning the panel's full x range (ggplot2's geom_abline). */
export const geomAbline = (opts: { slope?: number; intercept?: number } & Record<string, unknown> = {}): SpecPart => ({
  tag: "layer",
  value: {
    geom: "abline",
    stat: "identity",
    position: "identity",
    mapping: {},
    data: {},
    inheritAes: false,
    params: opts,
  },
});

// --- scales --------------------------------------------------------------

export const scaleXContinuous = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "x", kind: "continuous", ...opts },
});
export const scaleYContinuous = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "y", kind: "continuous", ...opts },
});
export const scaleXDiscrete = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "x", kind: "discrete", ...opts },
});
export const scaleYDiscrete = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "y", kind: "discrete", ...opts },
});
export const scaleXLog10 = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "x", kind: "log", ...opts },
});
export const scaleYLog10 = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "y", kind: "log", ...opts },
});
export const scaleXSqrt = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "x", kind: "sqrt", ...opts },
});
export const scaleYSqrt = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "y", kind: "sqrt", ...opts },
});
export const scaleColor = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "color", kind: "color", ...opts },
});
export const scaleFill = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "fill", kind: "color", ...opts },
});
export const scaleSize = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "size", kind: "continuous", ...opts },
});
export const scaleAlpha = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "alpha", kind: "continuous", ...opts },
});
export const scaleShape = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "shape", kind: "discrete", ...opts },
});

// --- coords / facets / themes -------------------------------------------

export const coordCartesian = (params?: Record<string, unknown>): SpecPart => ({
  tag: "coord",
  value: { kind: "cartesian", params },
});
/** `theta: "y"` reassigns the angle to the y aesthetic instead of x (ggplot2's coord_polar(theta = "y")); any other opts pass through to the Polar view unchanged. */
export const coordPolar = (opts: Record<string, unknown> = {}): SpecPart => {
  const { theta, ...params } = opts;
  const project: [PositionAxis, PositionAxis] | undefined = theta === "y" ? ["y", "x"] : undefined;
  return { tag: "coord", value: { kind: "polar", params, ...(project ? { project } : {}) } };
};
/** Swaps rendered x/y axes without touching mark positions or trained domains (ggplot2's coord_flip()) — sugar for a cartesian coord with an x/y projection swap. */
export const coordFlip = (): SpecPart => ({
  tag: "coord",
  value: { kind: "cartesian", project: ["y", "x"] },
});

export const facetWrap = (vars: string[], ncol?: number): SpecPart => ({
  tag: "facet",
  value: { kind: "wrap", rows: vars, ncol },
});
export const facetGrid = (rows: string[], cols: string[]): SpecPart => ({
  tag: "facet",
  value: { kind: "grid", rows, cols },
});

export const labels = (value: PlotLabels = {}): SpecPart => ({
  tag: "labels",
  value,
});

export const themeMinimal = (): SpecPart => ({
  tag: "theme",
  value: { name: "minimal" },
});
/** No panel background, no grid lines — just axes (ggplot2's theme_classic). */
export const themeClassic = (): SpecPart => ({
  tag: "theme",
  value: { name: "classic", grid: false },
});
/** Grey panel background with white grid lines (ggplot2's default theme_grey). */
export const themeGrey = (): SpecPart => ({
  tag: "theme",
  value: { name: "grey", background: "#ebebeb", gridColor: "#ffffff" },
});
/** Arbitrary theme overrides, mergeable on top of themeMinimal()/themeClassic()/themeGrey() — mirrors ggplot2's theme(...). */
export const theme = (overrides: Partial<Theme> = {}): SpecPart => ({
  tag: "theme",
  value: overrides,
});
