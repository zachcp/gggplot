/** @jsxRuntime classic */
/** @jsx createElement */
// A standalone auto-domain Cartesian view for the first resident histogram.

import type { LiveElement } from "@use-gpu/live";
import type { ResidentDomain1DResult } from "@gggplot/reductions";
import type { TypedDataFrame } from "../data/mod.ts";
import type { Theme } from "../ir/types.ts";
import type { ResidentHistogramOptions } from "../compile/resident.ts";
import { ResidentHistogramBars } from "./resident_bar.tsx";
import type { ResidentHistogramProduct } from "./resident_live.tsx";
import { useHoistedProduct } from "./resident_products.ts";
import {
  Axis,
  Cartesian,
  createElement,
  Grid,
  useAwait,
} from "./usegpu_compat.ts";

export function histogramRange(min: number, max: number): [number, number] {
  return min === max ? [min - 0.5, max + 0.5] : [min, max];
}

export interface ResidentHistogramViewProps {
  data: TypedDataFrame;
  x: string;
  group?: string;
  options: ResidentHistogramOptions;
  color: string;
  opacity?: number;
  /** Factor-level hex colors (level order) for a fill/color-mapped bar layer. */
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

interface AwaitSummaryProps extends Omit<ResidentHistogramViewProps, "data"> {
  product: ResidentHistogramProduct;
  xRange: [number, number];
}

const AwaitSummaryView = (
  { product, xRange, color, opacity, axes, theme }: AwaitSummaryProps,
): LiveElement => {
  const [summary, error] = useAwait(() => product.readSummary(), [
    product.summary.version,
  ]);
  if (error) throw error;
  if (!summary) return null as never;
  const yRange: [number, number] = [0, Math.max(1, summary.stackedMaximum)];
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
      zBias: 0,
      ...(theme.axisColor ? { color: theme.axisColor } : {}),
    }),
    createElement(Axis, {
      axis: "y",
      width: theme.axisWidth ?? 2,
      zBias: 0,
      ...(theme.axisColor ? { color: theme.axisColor } : {}),
    }),
    createElement(ResidentHistogramBars, {
      product,
      color,
      opacity,
      colors: product.barColors,
    }),
  ].filter(Boolean);
  return createElement(Cartesian, { range: [xRange, yRange], axes }, ...guides);
};

/** Awaits bounded domain/summary products before mounting Cartesian and guides. */
export const ResidentHistogramView = (
  { color, opacity, axes, theme, residentId }: ResidentHistogramViewProps,
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
    // failing here beats rendering an empty chart — which is exactly how the
    // tile product hid two bugs (gggplot-vs7.12).
    throw new Error(
      "[gggplot] a resident view was mounted without a hoisted product; " +
        "add its product id to HOISTED_PRODUCTS in runtime/resident_host.tsx",
    );
  }
  if (!hoisted) return null as never;
  return createElement(AwaitSummaryView, {
    product: hoisted,
    xRange: histogramRange(
      hoisted.hoistedBounds.min,
      hoisted.hoistedBounds.max,
    ),
    color,
    opacity,
    axes,
    theme,
  });
};
