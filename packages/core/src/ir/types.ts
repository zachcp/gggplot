// GG Spec IR — the "AST" that the transpiler consumes.
//
// A ggplot() DSL expression builds a GGSpec; the compiler lowers a GGSpec onto
// a RenderTree of UseGPU/plot components. Everything here is plain, serializable
// data with no UseGPU or DOM dependencies.

import type { TypedDataFrame } from "../data/mod.ts";
import type { Camera3D } from "./camera.ts";
export {
  camera3DFromLookAt,
  DEFAULT_CAMERA_3D,
  resolveCamera3D,
} from "./camera.ts";
export type {
  Camera3D,
  Camera3DOptions,
  CameraVec3,
  LookAtCamera3D,
} from "./camera.ts";

/**
 * Column-oriented data frame carried through the semantic pipeline. Numeric
 * and factor types are structural, so every stage can preserve factor levels
 * and lower numeric data to typed GPU buffers without metadata sidecars.
 */
export type DataFrame = TypedDataFrame;

/** Aesthetics we understand. Extend as geoms/scales grow. */
export type AesName =
  | "x"
  | "y"
  | "color"
  | "fill"
  | "size"
  | "alpha"
  | "shape"
  | "linetype"
  | "linewidth"
  | "stroke"
  | "density"
  | "z"
  | "group"
  | "label"
  | "family"
  | "fontface"
  | "xmin"
  | "xmax"
  | "ymin"
  | "ymax"
  | "xend"
  | "yend"
  | "zend"
  | "angle"
  | "radius"
  | "lower"
  | "middle"
  | "upper";

/**
 * Aesthetic mapping: aesthetic -> column name.
 * Fixed (non-data) aesthetics live in Layer.params instead (e.g. color: "red").
 */
export type Aes = Partial<Record<AesName, string>>;

export type GeomKind =
  | "point"
  | "line"
  | "path"
  | "bar"
  | "col"
  | "area"
  | "ribbon"
  | "polygon"
  | "tile"
  | "text"
  | "label"
  | "boxplot"
  | "errorbar"
  | "linerange"
  | "pointrange"
  | "crossbar"
  | "smooth"
  | "violin"
  | "dotplot"
  | "hex"
  | "segment"
  | "rect"
  | "hline"
  | "vline"
  | "abline"
  | "blank"
  | "step"
  | "curve"
  | "spoke"
  | "rug";

export type StatKind =
  | "identity"
  | "count"
  | "bin"
  | "smooth"
  | "summary"
  | "boxplot"
  | "density"
  | "ydensity"
  | "dotplot"
  | "bin2d"
  | "binhex"
  | "summary2d"
  | "summaryhex"
  | "summarybin"
  | "qq"
  | "qqline"
  | "ellipse"
  | "function"
  | "sum"
  | "contour"
  | "contourfilled"
  | "density2d"
  | "density2dfilled"
  | "quantile"
  | "ecdf"
  | "unique"
  | "connect"
  | "align"
  | "waffle";

export type PositionKind =
  | "identity"
  | "stack"
  | "dodge"
  | "dodge2"
  | "jitter"
  | "jitterdodge"
  | "nudge"
  | "fill";

/** One drawing layer: a geom + its stat + position + params/data overrides. */
export interface Layer {
  geom: GeomKind;
  stat: StatKind;
  position: PositionKind;
  /** Layer-level aesthetic overrides, merged over the plot mapping. */
  mapping?: Aes;
  /** Layer-level data override; defaults to the plot data. */
  data?: DataFrame;
  /**
   * Whether this layer inherits the plot's top-level aes() mapping at all
   * (ggplot2's inherit.aes). Default true; false uses only this layer's own
   * `mapping`, ignoring the plot's — for layers plotting unrelated data.
   */
  inheritAes?: boolean;
  /** Fixed aesthetics and stat/geom parameters (e.g. { size: 3, method: "lm" }). */
  params: Record<string, unknown>;
}

export type ScaleKind =
  | "continuous"
  | "discrete"
  | "log"
  | "sqrt"
  | "color"
  | "identity";

/** A scale for one aesthetic. Domain/range are filled in by scale training. */
export interface Scale {
  aes: AesName;
  kind: ScaleKind;
  /** Data-space extent. [min,max] for continuous, level list for discrete. */
  domain?: [number, number] | string[];
  /** Visual-space extent (pixels, unit interval, palette, ...). */
  range?: [number, number] | string[] | number[][];
  name?: string;
  /**
   * Padding around the trained domain, as [multiplicative, additive] — e.g.
   * [0.05, 0] pads by 5% of the domain's span on each side. Mirrors ggplot2's
   * expansion(mult, add). Off (no padding) unless set.
   */
  expand?: [number, number];
  /** Explicit guide breaks in data space. These take precedence over nBreaks. */
  breaks?: unknown[];
  /** Preferred number of automatically generated guide breaks. */
  nBreaks?: number;
  guide?: Guide;
}

export interface Guide {
  kind: "colorbar" | "colorsteps" | "bins" | "none";
  title?: string;
  bins?: number;
}

export type CoordKind = "cartesian" | "polar";

/** A grammar-visible position aesthetic; homogeneous w is never exposed. */
export type PositionAxis = "x" | "y" | "z";

export interface Coord {
  kind: CoordKind;
  /**
   * Output-axis swizzle. 2D specs use "xy"/"yx"; 3D widening accepts a
   * permutation of "xyz" and pins homogeneous w internally. `coordFlip()` and
   * `coordPolar({theta:"y"})` are sugar for axes:"yx".
   */
  axes?: string;
  params?: Record<string, unknown>;
}

export type FacetKind = "none" | "wrap" | "grid";
export interface Facet {
  kind: FacetKind;
  /** Faceting variables (row/col for grid, single list for wrap). */
  rows?: string[];
  cols?: string[];
  ncol?: number;
  /** Whether panels share position domains or train x/y independently. */
  scales?: "fixed" | "free" | "free_x" | "free_y";
}

/**
 * Theming knobs the compiler maps onto UseGPU props. All fields are optional
 * and additive over the default (no-op) rendering — e.g. an unset `grid`
 * still draws grid lines, an unset `background` still renders no panel fill.
 * `[key: string]: unknown` keeps the type open for forward-compatible fields
 * a future theme_*() might add before the compiler understands them.
 */
export interface Theme {
  name?: string;
  /** Panel fill color drawn behind the grid/marks; unset/null means no fill (the default, matching ggplot2's theme_minimal). */
  background?: string | null;
  /** Set false to omit grid lines entirely (ggplot2's theme_classic/theme_void). Default true. */
  grid?: boolean;
  gridColor?: string;
  gridWidth?: number;
  axisColor?: string;
  axisWidth?: number;
  /** Set false to omit axis rules, ticks, and tick labels. Default true. */
  axes?: boolean;
  /** Set false to omit axis titles while retaining axes/ticks. Default true. */
  axisTitles?: boolean;
  /** CSS-pixel gap between facet cells. */
  panelSpacing?: number;
  /** CSS-pixel height reserved for each facet strip. */
  stripHeight?: number;
  /** Defaults for geom_text/geom_label's Label nodes, used unless a layer sets its own size/color param. */
  fontFamily?: string;
  fontWeight?: number | "normal" | "bold";
  fontStyle?: "normal" | "italic" | "oblique";
  fontSize?: number;
  lineHeight?: number;
  textColor?: string;
  /** Tick/title rotation in degrees. */
  axisTextXAngle?: number;
  axisTextYAngle?: number;
  axisTitleXAngle?: number;
  axisTitleYAngle?: number;
  [key: string]: unknown;
}

/** Human-facing plot and guide labels. Aesthetic keys name axes/legends. */
export interface PlotLabels {
  title?: string;
  subtitle?: string;
  caption?: string;
  /** Short plot-corner label, kept opt-in like ggplot2's plot.tag. */
  tag?: string;
  x?: string;
  y?: string;
  z?: string;
  color?: string;
  fill?: string;
  size?: string;
  shape?: string;
  linetype?: string;
  linewidth?: string;
  [key: string]: string | undefined;
}

/**
 * Spec-level execution policy — how the plot may be executed, not how it
 * looks. Typed home for what was previously a stringly `theme.resident` key
 * smuggled through Theme's index signature (gggplot-4se).
 */
export interface ExecutionPolicy {
  /**
   * false → never lower eligible layers to GPU-resident products; the CPU
   * compiler stays authoritative (e.g. to keep computed stat rows
   * inspectable). Host-level gating lives on CompileOptions.resident;
   * this is the per-spec opt-out, serialized with the spec.
   */
  resident?: boolean;
}

/** The complete plot specification — input to compile(). */
export interface GGSpec {
  data: DataFrame;
  mapping: Aes;
  layers: Layer[];
  scales: Scale[];
  coord: Coord;
  facet: Facet;
  labels: PlotLabels;
  theme: Theme;
  /** One plot-wide serialized initial view; meaningful only for a 3D plot. */
  camera?: Camera3D;
  execution?: ExecutionPolicy;
}
