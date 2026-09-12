/** @jsxRuntime classic */
/** @jsx createElement */
// A standalone auto-x-domain Cartesian view for the resident tile grid: a dense
// [group, bin] heatmap strip (x = binned continuous axis, y = factor group
// row). Unlike the histogram view it needs no stacked-maximum summary — the y
// range is simply the group-row count the tile kernel emits (y0=group,
// y1=group+1) — so it resolves only the x domain before mounting.

import type { LiveElement } from "@use-gpu/live";
import type { ResidentDomain1DResult } from "@gggplot/reductions";
import type { TypedDataFrame } from "../data/mod.ts";
import type { Theme } from "../ir/types.ts";
import type { ResidentHistogramOptions } from "../compile/resident.ts";
import { ResidentHistogramTiles } from "./resident_tile.tsx";
import type { ResidentHistogramProduct } from "./resident_live.tsx";
import { useHoistedProduct } from "./resident_products.ts";
import { histogramRange } from "./resident_view.tsx";
import { Axis, Cartesian, createElement, Grid } from "./usegpu_compat.ts";

export interface ResidentTileViewProps {
  data: TypedDataFrame;
  x: string;
  group?: string;
  options: ResidentHistogramOptions;
  color: string;
  opacity?: number;
  /** Factor-level hex colors (level order) for a fill/color-mapped group axis. */
  paletteColors?: string[];
  axes: string;
  theme: Theme;
  /**
   * Set by GGPlot when this node's kernels were built above the plot
   * (runtime/resident_host.tsx). When present the product — already sized to
   * GPU-resolved x bounds — comes from context and this component only renders.
   */
  residentId?: number;
}

/**
 * The strip itself: guides plus the dense tile mark over a ready product.
 *
 * Shared verbatim by the hoisted and in-place paths, and it awaits NOTHING —
 * alone among the resident views. The other two size their y range from a
 * stacked-maximum summary and so have to read one back off the GPU; this one's
 * y range is the group-row count the tile kernel already encodes (y0=group,
 * y1=group+1), so there is no round trip to sequence and nothing to race.
 */
const TileStripView = (
  { product, xRange, groupsCount, color, opacity, axes, theme }: {
    product: ResidentHistogramProduct;
    xRange: [number, number];
    groupsCount: number;
    color: string;
    opacity?: number;
    axes: string;
    theme: Theme;
  },
): LiveElement => {
  const guides = [
    theme.grid === false ? null : createElement(Grid, {
      axes,
      width: theme.gridWidth ?? 1,
      zBias: -1,
      ...(theme.gridColor ? { color: theme.gridColor } : {}),
    }),
    createElement(Axis, {
      axis: "x",
      width: theme.axisWidth ?? 2,
      ...(theme.axisColor ? { color: theme.axisColor } : {}),
    }),
    createElement(Axis, {
      axis: "y",
      width: theme.axisWidth ?? 2,
      ...(theme.axisColor ? { color: theme.axisColor } : {}),
    }),
    createElement(ResidentHistogramTiles, {
      product,
      color,
      opacity,
      colors: product.heatmapColors,
    }),
  ].filter(Boolean);
  return createElement(
    Cartesian,
    { range: [xRange, [0, groupsCount] as [number, number]], axes },
    ...guides,
  );
};

/** Awaits the bounded x domain before mounting the tile grid and guides. */
export const ResidentTileView = (
  { options, color, opacity, axes, theme, residentId }: ResidentTileViewProps,
): LiveElement => {
  // Runs unconditionally to keep hook order stable; null on the first frame of
  // a hoisted node, while its x bounds are still being read back off the GPU.
  const hoisted = useHoistedProduct<
    ResidentHistogramProduct & { hoistedBounds: ResidentDomain1DResult }
  >(residentId);
  if (typeof residentId !== "number") {
    // Not hoisted, which for a resident product now means misconfigured: its id
    // is missing from resident_host.tsx's HOISTED_PRODUCTS, so nothing built
    // its kernel and nothing will dispatch it. This used to fall back to
    // building the kernel in place; that path is gone with gggplot-vs7.1, and
    // failing here beats rendering an empty chart — which is exactly how this
    // very product hid two bugs (gggplot-vs7.12).
    throw new Error(
      "[gggplot] a resident view was mounted without a hoisted product; " +
        "add its product id to HOISTED_PRODUCTS in runtime/resident_host.tsx",
    );
  }
  if (!hoisted) return null as never;
  return createElement(TileStripView, {
    product: hoisted,
    xRange: histogramRange(
      hoisted.hoistedBounds.min,
      hoisted.hoistedBounds.max,
    ),
    groupsCount: Math.max(1, options.groupsCount ?? 1),
    color,
    opacity,
    axes,
    theme,
  });
};
