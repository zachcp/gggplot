import type { Aes, GGSpec, Layer } from "../ir/types.ts";
import type { GeomDefinition, GeomMode, PlotDimension } from "./types.ts";

const DEFAULT_2D_MODE: GeomMode = {
  dimensions: 2,
  requiredPosition: [],
};

export interface ResolvedLayerMode {
  layer: Layer;
  mapping: Aes;
  mode: GeomMode;
}

export interface PlotDimensionResolution {
  dimensions: PlotDimension;
  layers: ResolvedLayerMode[];
}

/** Effective layer mapping, shared by dimension selection and compilation. */
export function effectiveLayerMapping(spec: GGSpec, layer: Layer): Aes {
  return layer.inheritAes === false
    ? (layer.mapping ?? {})
    : { ...spec.mapping, ...layer.mapping };
}

function allowedValue(values: readonly unknown[], value: unknown): boolean {
  return values.some((candidate) => Object.is(candidate, value));
}

/** Select and validate one geom realization from an already-effective mapping. */
export function selectGeomMode(
  layer: Layer,
  mapping: Aes,
  definition: GeomDefinition,
): GeomMode {
  const modes = definition.modes ?? [DEFAULT_2D_MODE];
  const two = modes.find((mode) => mode.dimensions === 2);
  const three = modes.find((mode) => mode.dimensions === 3);
  const mode = mapping.z != null && three?.requiredPosition.includes("z")
    ? three
    : two ?? three;
  if (!mode) {
    throw new Error(
      `[gggplot] geom_${layer.geom} declares no dimensional mode`,
    );
  }

  // Non-identity stats may synthesize their geom's required positions (QQ is
  // the current point example), so input-mapping validation belongs only to
  // identity lowering. Mode stat validation above/below still constrains 3D
  // point to identity before any stat work can run.
  const missing = layer.stat === "identity"
    ? mode.requiredPosition.filter((aes) => mapping[aes] == null)
    : [];
  if (missing.length) {
    throw new Error(
      `[gggplot] ${mode.dimensions}D geom_${layer.geom} requires mapped position aesthetic(s): ${
        missing.join(", ")
      }`,
    );
  }
  if (mode.stats && !mode.stats.includes(layer.stat)) {
    throw new Error(
      `[gggplot] ${mode.dimensions}D geom_${layer.geom} does not support stat "${layer.stat}"`,
    );
  }
  if (mode.positions && !mode.positions.includes(layer.position)) {
    throw new Error(
      `[gggplot] ${mode.dimensions}D geom_${layer.geom} does not support position "${layer.position}"`,
    );
  }
  for (const param of definition.dimensionalParams ?? []) {
    const value = layer.params[param];
    if (value == null) continue;
    const values = mode.params?.[param];
    if (!values) {
      throw new Error(
        `[gggplot] ${mode.dimensions}D geom_${layer.geom} does not support parameter "${param}"`,
      );
    }
    if (!allowedValue(values, value)) {
      throw new Error(
        `[gggplot] ${mode.dimensions}D geom_${layer.geom} parameter "${param}" must be one of: ${
          values.join(", ")
        }`,
      );
    }
  }
  return mode;
}

/** Resolve one plot dimension before stats/scales/lowering. */
export function resolvePlotDimension(
  spec: GGSpec,
  registry: Readonly<Record<string, GeomDefinition>>,
): PlotDimensionResolution {
  const layers = spec.layers.map((layer) => {
    const definition = registry[layer.geom];
    if (!definition) {
      throw new Error(
        `[gggplot] no geom definition registered for "${layer.geom}"`,
      );
    }
    const mapping = effectiveLayerMapping(spec, layer);
    return { layer, mapping, mode: selectGeomMode(layer, mapping, definition) };
  });
  const contributing = layers.filter(({ layer }) =>
    registry[layer.geom].contributesDimension !== false
  );
  const dimensions = contributing[0]?.mode.dimensions ?? 2;
  const mixed = contributing.find(({ mode }) => mode.dimensions !== dimensions);
  if (mixed) {
    throw new Error(
      `[gggplot] mixed 2D/3D layers are not supported; geom_${
        contributing[0].layer.geom
      } resolved to ${dimensions}D while geom_${mixed.layer.geom} resolved to ${mixed.mode.dimensions}D`,
    );
  }
  if (dimensions === 2 && spec.camera) {
    throw new Error("[gggplot] camera3d() requires at least one 3D geom layer");
  }
  if (dimensions === 3 && spec.facet.kind !== "none") {
    throw new Error("[gggplot] faceting 3D plots is not implemented");
  }
  if (dimensions === 3 && spec.coord.kind !== "cartesian") {
    throw new Error(
      "[gggplot] 3D plots currently require cartesian coordinates",
    );
  }
  return { dimensions, layers };
}
