// The ggplot-style DSL. Mirrors ggplot2's grammar: a base ggplot() plus
// composable geom_*/scale_*/coord_*/facet_*/theme_* parts, combined here with a
// fluent `.add()` in place of R's `+` operator.

import type {
  Aes,
  Coord,
  DataFrame,
  Facet,
  GeomKind,
  GGSpec,
  Layer,
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
  | { tag: "theme"; value: Theme };

function defaultSpec(data: DataFrame, mapping: Aes): GGSpec {
  return {
    data,
    mapping,
    layers: [],
    scales: [],
    coord: { kind: "cartesian" },
    facet: { kind: "none" },
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
        case "theme":
          this.spec.theme = part.value;
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
  [param: string]: unknown;
}

function geom(
  kind: GeomKind,
  defaultStat: StatKind,
  opts: GeomOpts = {},
): SpecPart {
  const { mapping, data, stat, position, ...params } = opts;
  return {
    tag: "layer",
    value: {
      geom: kind,
      stat: stat ?? defaultStat,
      position: position ?? "identity",
      mapping,
      data,
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
  geom("bar", "count", opts);
export const geomCol = (opts: GeomOpts = {}): SpecPart =>
  geom("col", "identity", opts);
export const geomArea = (opts: GeomOpts = {}): SpecPart =>
  geom("area", "identity", opts);
export const geomPolygon = (opts: GeomOpts = {}): SpecPart =>
  geom("polygon", "identity", opts);
export const geomText = (opts: GeomOpts = {}): SpecPart =>
  geom("text", "identity", opts);

// --- scales --------------------------------------------------------------

export const scaleXContinuous = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "x", kind: "continuous", ...opts },
});
export const scaleYContinuous = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "y", kind: "continuous", ...opts },
});
export const scaleColor = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "color", kind: "color", ...opts },
});

// --- coords / facets / themes -------------------------------------------

export const coordCartesian = (params?: Record<string, unknown>): SpecPart => ({
  tag: "coord",
  value: { kind: "cartesian", params },
});
export const coordPolar = (params?: Record<string, unknown>): SpecPart => ({
  tag: "coord",
  value: { kind: "polar", params },
});
export const coordFlip = (): SpecPart => ({
  tag: "coord",
  value: { kind: "flip" },
});

export const facetWrap = (vars: string[], ncol?: number): SpecPart => ({
  tag: "facet",
  value: { kind: "wrap", rows: vars, ncol },
});
export const facetGrid = (rows: string[], cols: string[]): SpecPart => ({
  tag: "facet",
  value: { kind: "grid", rows, cols },
});

export const themeMinimal = (): SpecPart => ({
  tag: "theme",
  value: { name: "minimal" },
});
