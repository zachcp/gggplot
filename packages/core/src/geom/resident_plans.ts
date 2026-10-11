// What a geom's residentPlan hands the component root (gggplot-vnh.5.1): the
// GPU product it asks for and the props that product and its mark read. The
// root mounts each distinct product once (runtime/product_host.tsx) and draws
// it with a ProductMark inside the panel; it trains the axes itself, reading
// the y range back off the GPU when the plan asks (`autoYDomain`).
import type { TypedDataFrame } from "../data/mod.ts";

/** stat_bin's grid, drawn as bars. */
export const RESIDENT_STAT_BIN_PRODUCT = "@gggplot/core:stat_bin@1";
/** stat_count's grid, drawn as bars. */
export const RESIDENT_STAT_COUNT_PRODUCT = "@gggplot/core:stat_count@1";
/** stat_bin's grid drawn as a dense [group, bin] tile strip. */
export const RESIDENT_STAT_BIN_TILES_PRODUCT = "@gggplot/core:stat_bin_tiles@1";

export type BarPosition = "identity" | "stack" | "dodge" | "fill";

/** A stat_bin grid's options: explicit bounds, or bounds read off the GPU. */
export interface ResidentHistogramOptions {
  lo?: number;
  hi?: number;
  /** Resolve the x bounds with the on-GPU domain stage. */
  autoDomain?: boolean;
  bins?: number;
  binwidth?: number;
  position?: BarPosition;
  groupsCount?: number;
}

/** Props for the stat_bin products (bars, and the tile strip). */
export interface ResidentHistogramPlanProps {
  data: TypedDataFrame;
  x: string;
  group?: string;
  options: ResidentHistogramOptions;
  color: string;
  opacity?: number;
  /** Factor-level hex colors (level order) for a fill/color-mapped group. */
  paletteColors?: string[];
  /** The root reads the y range (the stacked maximum) back off the GPU. */
  autoYDomain?: boolean;
}

/** Props for the stat_count product. */
export interface ResidentCountPlanProps {
  data: TypedDataFrame;
  x: string;
  group?: string;
  options: {
    valuesCount: number;
    groupsCount: number;
    position: BarPosition;
  };
  color: string;
  opacity?: number;
  paletteColors?: string[];
  autoYDomain?: boolean;
}
