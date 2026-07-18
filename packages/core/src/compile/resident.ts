import type { TypedDataFrame } from "../data/mod.ts";
import type { MountedHistogramSourceOptions } from "../runtime/resident.ts";

/**
 * Plan id for the resident stat_bin histogram product. Shared by the bar geom's
 * residentPlan hook (which stamps it onto the ResidentProduct node) and the
 * runtime resident registry (which resolves it back to a live component). It is
 * intentionally the same id createHistogramBarTopologyPlan depends on.
 */
export const RESIDENT_STAT_BIN_PRODUCT = "@gggplot/core:stat_bin@1";
export const RESIDENT_STAT_COUNT_PRODUCT = "@gggplot/core:stat_count@1";

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

export interface ResidentCountNodeProps {
  data: TypedDataFrame;
  x: string;
  group?: string;
  options: {
    valuesCount: number;
    groupsCount: number;
    position: "identity" | "stack" | "dodge" | "fill";
  };
  color: string;
  opacity?: number;
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
