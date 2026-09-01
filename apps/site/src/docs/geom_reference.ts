import { GEOM_REGISTRY } from "../../../../packages/core/src/geom/mod.ts";
import type { GeomKind } from "../../../../packages/core/src/ir/types.ts";
import {
  geomConstructorDefaults,
  geomConstructorKinds,
  geomExampleCoverage,
} from "./geom_coverage.ts";
import type { GeomReferenceEntry } from "./types.ts";

export const geomReferenceEntries: GeomReferenceEntry[] = Object.entries(
  geomConstructorKinds,
).map(([constructor, geom]) => {
  const definition = GEOM_REGISTRY[geom as GeomKind];
  const defaults = geomConstructorDefaults[constructor] ?? {};
  return {
    constructor,
    geom,
    summary: definition.doc.summary,
    defaultStat: defaults.stat ?? definition.defaultStat,
    defaultPosition: defaults.position ?? definition.defaultPosition ??
      "identity",
    requiredAesthetics: definition.doc.aesthetics.required,
    optionalAesthetics: definition.doc.aesthetics.optional,
    params: definition.doc.params ?? {},
    residency: definition.residentPlan
      ? constructor === "geomBar"
        ? "GPU-resident for unweighted factor x; default-scale factor fill/color can supply the optional group. Weights, custom fill scales, and facets use CPU."
        : constructor === "geomHistogram"
        ? "GPU-resident for unweighted numeric x; default-scale factor fill/color can supply the optional group. Weights, custom fill scales, and facets use CPU."
        : "GPU-resident when the geom capability gate accepts the layer."
      : "CPU statistic/lowering; marks render through WebGPU.",
    exampleIds: geomExampleCoverage[constructor].exampleIds,
  };
}).sort((a, b) => a.constructor.localeCompare(b.constructor));
