/** @jsxRuntime classic */
/** @jsx createElement */
import type { LiveElement } from "@use-gpu/live";
import type { TypedDataFrame } from "../data/mod.ts";
import type { Theme } from "../ir/types.ts";
import type { MountedCountSourceOptions } from "./resident.ts";
import type { ResidentCountProduct } from "./resident_count_live.tsx";
import { ResidentHistogramBars } from "./resident_bar.tsx";
import { useHoistedProduct } from "./resident_products.ts";
import {
  Axis,
  Cartesian,
  createElement,
  Grid,
  useAwait,
} from "./usegpu_compat.ts";

export interface ResidentCountViewProps {
  data: TypedDataFrame;
  x: string;
  group?: string;
  options: MountedCountSourceOptions;
  color: string;
  opacity?: number;
  /** Factor-level hex colors (level order) for a fill/color-mapped bar layer. */
  paletteColors?: string[];
  axes: string;
  theme: Theme;
  /**
   * Set by GGPlot when this node's kernel was built above the plot
   * (runtime/resident_host.tsx). When present the product comes from context
   * and this component only renders; when absent it builds its own kernel, the
   * path every non-hoisted resident product still takes.
   */
  residentId?: number;
}
const AwaitCountSummary = (
  { product, options, color, opacity, axes, theme }:
    & Omit<ResidentCountViewProps, "data" | "x" | "group">
    & { product: ResidentCountProduct },
): LiveElement => {
  const [summary, error] = useAwait(() => product.readSummary(), [
    product.summary.version,
  ]);
  if (error) throw error;
  if (!summary) return null as never;
  const yMax = options.position === "fill"
    ? 1
    : Math.max(1, summary.stackedMaximum);
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
    createElement(ResidentHistogramBars, {
      product,
      color,
      opacity,
      colors: product.barColors,
    }),
  ].filter(Boolean);
  return createElement(Cartesian, {
    range: [[-0.5, Math.max(0.5, options.valuesCount - 0.5)], [0, yMax]],
    axes,
  }, ...guides);
};
export const ResidentCountView = (
  { options, color, opacity, axes, theme, residentId }: ResidentCountViewProps,
): LiveElement => {
  // Runs unconditionally to keep hook order stable.
  const hoisted = useHoistedProduct<ResidentCountProduct>(residentId);
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
  return createElement(AwaitCountSummary, {
    product: hoisted,
    options,
    color,
    opacity,
    axes,
    theme,
  });
};
