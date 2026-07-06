// GG Spec IR — the "AST" that the transpiler consumes.
//
// A ggplot() DSL expression builds a GGSpec; the compiler lowers a GGSpec onto
// a RenderTree of UseGPU/plot components. Everything here is plain, serializable
// data with no UseGPU or DOM dependencies.

/** Column-oriented data frame: named columns of equal length. */
export type DataFrame = Record<string, unknown[]>;

/** Aesthetics we understand. Extend as geoms/scales grow. */
export type AesName =
  | "x"
  | "y"
  | "color"
  | "fill"
  | "size"
  | "alpha"
  | "shape"
  | "group"
  | "label"
  | "xmin"
  | "xmax"
  | "ymin"
  | "ymax";

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
  | "polygon"
  | "tile"
  | "text";

export type StatKind = "identity" | "count" | "bin" | "smooth" | "summary";

export type PositionKind = "identity" | "stack" | "dodge" | "jitter" | "fill";

/** One drawing layer: a geom + its stat + position + params/data overrides. */
export interface Layer {
  geom: GeomKind;
  stat: StatKind;
  position: PositionKind;
  /** Layer-level aesthetic overrides, merged over the plot mapping. */
  mapping?: Aes;
  /** Layer-level data override; defaults to the plot data. */
  data?: DataFrame;
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
  range?: [number, number] | string[];
  name?: string;
}

export type CoordKind = "cartesian" | "polar" | "flip" | "fixed";
export interface Coord {
  kind: CoordKind;
  params?: Record<string, unknown>;
}

export type FacetKind = "none" | "wrap" | "grid";
export interface Facet {
  kind: FacetKind;
  /** Faceting variables (row/col for grid, single list for wrap). */
  rows?: string[];
  cols?: string[];
  ncol?: number;
}

export interface Theme {
  name?: string;
  [key: string]: unknown;
}

/** The complete plot specification — input to compile(). */
export interface GGSpec {
  data: DataFrame;
  mapping: Aes;
  layers: Layer[];
  scales: Scale[];
  coord: Coord;
  facet: Facet;
  theme: Theme;
}
