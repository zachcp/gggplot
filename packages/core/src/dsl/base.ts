// The ggplot-style DSL. Mirrors ggplot2's grammar: a base ggplot() plus
// composable geom_*/scale_*/coord_*/facet_*/theme_* parts, combined here with a
// fluent `.add()` in place of R's `+` operator.

import type {
  Aes,
  Coord,
  DataFrame,
  ExecutionPolicy,
  Facet,
  GGSpec,
  Layer,
  PlotLabels,
  Scale,
  Theme,
} from "../ir/types.ts";
import { ingest, type IngestOptions, type InputData } from "../data/mod.ts";

/** Identity helper — `aes({ x: "wt", y: "mpg" })` reads like ggplot. */
export const aes = (mapping: Aes): Aes => mapping;

/** A tagged spec fragment produced by a geom/scale/coord/facet/theme builder. */
export type SpecPart =
  | { tag: "layer"; value: Layer }
  | { tag: "scale"; value: Scale }
  | { tag: "coord"; value: Coord }
  | { tag: "facet"; value: Facet }
  | { tag: "labels"; value: PlotLabels }
  | { tag: "theme"; value: Theme }
  | { tag: "execution"; value: ExecutionPolicy };

/** Spec-level execution policy, e.g. `execution({ resident: false })`. */
export const execution = (value: ExecutionPolicy): SpecPart => ({
  tag: "execution",
  value,
});

function materializeInputData(
  data: InputData,
  options?: IngestOptions,
): DataFrame {
  return ingest(data, options);
}

function defaultSpec(
  data: InputData,
  mapping: Aes,
  options?: IngestOptions,
): GGSpec {
  return {
    data: materializeInputData(data, options),
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

  constructor(data: InputData, mapping: Aes = {}, options?: IngestOptions) {
    this.spec = defaultSpec(data, mapping, options);
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
        case "execution":
          this.spec.execution = { ...this.spec.execution, ...part.value };
          break;
      }
    }
    return this;
  }

  build(): GGSpec {
    return this.spec;
  }
}

export const ggplot = (
  data: InputData,
  mapping: Aes = {},
  options?: IngestOptions,
): GG => new GG(data, mapping, options);
