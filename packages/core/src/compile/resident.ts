import type { TypedDataFrame } from "../data/mod.ts";
import type { Aes, GGSpec, Layer } from "../ir/types.ts";
import type { MountedHistogramSourceOptions } from "../runtime/resident.ts";

/** Runtime-only props for the first direct stat_bin → GPU mark lowering. */
export interface ResidentHistogramNodeProps {
  data: TypedDataFrame;
  x: string;
  group?: string;
  options: ResidentHistogramOptions;
  color: string;
  opacity?: number;
  /** This standalone view may await the compact stacked maximum for y range. */
  autoYDomain?: boolean;
}

export type ResidentHistogramOptions =
  & Omit<MountedHistogramSourceOptions, "lo" | "hi">
  & {
    lo?: number;
    hi?: number;
    /** Resolve x bounds through ResidentDomainProvider rather than CPU scanning. */
    autoDomain?: boolean;
  };

function explicitDomain(
  spec: GGSpec,
  aes: "x" | "y",
): [number, number] | undefined {
  const scale = spec.scales.find((candidate) => candidate.aes === aes);
  return scale && Array.isArray(scale.domain) &&
      typeof scale.domain[0] === "number" && typeof scale.domain[1] === "number"
    ? scale.domain as [number, number]
    : undefined;
}

/**
 * Returns the first safe resident lowering contract, or undefined when the
 * CPU compiler must remain authoritative. Automatic y-domains deliberately
 * wait for the bounded-summary executor rather than materializing stat rows.
 */
export function residentHistogramProps(
  spec: GGSpec,
  layer: Layer,
  mapping: Aes,
  data: TypedDataFrame,
  allowAutomaticY = false,
): ResidentHistogramNodeProps | undefined {
  if (
    spec.theme.resident === false ||
    spec.coord.kind !== "cartesian" || spec.facet.kind !== "none" ||
    layer.geom !== "bar" || layer.stat !== "bin" ||
    !["identity", "stack", "dodge", "fill"].includes(layer.position) ||
    mapping.y || mapping.color || mapping.fill || "weight" in layer.params ||
    (!allowAutomaticY && !explicitDomain(spec, "y"))
  ) return undefined;
  const position = layer.position as "identity" | "stack" | "dodge" | "fill";

  const x = mapping.x;
  const xColumn = x ? data[x] : undefined;
  if (!x || !xColumn || xColumn.type !== "numeric") return undefined;

  const group = mapping.group;
  const groupColumn = group ? data[group] : undefined;
  if (group && groupColumn?.type !== "factor") return undefined;
  const groupsCount = groupColumn?.type === "factor"
    ? groupColumn.levels.length
    : 1;
  const requestedBinwidth = layer.params.binwidth;
  const requestedBins = layer.params.bins;
  if (
    requestedBinwidth != null &&
      (typeof requestedBinwidth !== "number" || requestedBinwidth <= 0) ||
    requestedBins != null &&
      (typeof requestedBins !== "number" || requestedBins <= 0)
  ) return undefined;

  const bins = (requestedBins as number | undefined) ?? 30;
  const xDomain = explicitDomain(spec, "x");
  return {
    data,
    x,
    group,
    options: xDomain
      ? {
        lo: xDomain[0],
        hi: xDomain[1],
        binwidth: requestedBinwidth as number | undefined,
        bins: requestedBinwidth == null ? bins : undefined,
        groupsCount,
        position,
      }
      : {
        autoDomain: true,
        binwidth: requestedBinwidth as number | undefined,
        bins: requestedBinwidth == null ? bins : undefined,
        groupsCount,
        position,
      },
    color: (layer.params.fill as string) ?? (layer.params.color as string) ??
      "#3b82f6",
    opacity: layer.params.alpha as number | undefined,
    autoYDomain: allowAutomaticY && !explicitDomain(spec, "y"),
  };
}
