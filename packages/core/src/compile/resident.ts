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
/** Dense [group, bin] tile-grid rendering of the same resident stat_bin grid. */
export const RESIDENT_STAT_BIN_TILES_PRODUCT = "@gggplot/core:stat_bin_tiles@1";

/** Runtime-only props for the first direct stat_bin → GPU mark lowering. */
export interface ResidentHistogramNodeProps {
  data: TypedDataFrame;
  x: string;
  group?: string;
  options: ResidentHistogramOptions;
  color: string;
  opacity?: number;
  /**
   * Factor-level hex colors (level order) when fill/color maps the group
   * column; drives on-GPU per-group bar colors. Absent → scalar `color`.
   */
  paletteColors?: string[];
  /** This standalone view may await the compact stacked maximum for y range. */
  autoYDomain?: boolean;
}

/**
 * Runtime-only props for the resident tile-grid product. Identical to the
 * histogram props minus `autoYDomain`: the tile strip's y range is always the
 * statically-known group-row count, so only the x domain may be auto-resolved.
 */
export type ResidentTileNodeProps = Omit<
  ResidentHistogramNodeProps,
  "autoYDomain"
>;

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
  /**
   * Factor-level hex colors (level order) when fill/color maps the group
   * column; drives on-GPU per-group bar colors. Absent → scalar `color`.
   */
  paletteColors?: string[];
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
