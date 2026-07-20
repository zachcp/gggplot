/** @jsxRuntime classic */
/** @jsx createElement */
import type { LiveElement } from "@use-gpu/live";
import type { TypedDataFrame } from "../data/mod.ts";
import type { Theme } from "../ir/types.ts";
import type { MountedCountSourceOptions } from "./resident.ts";
import { GPUDataProvider } from "./live.tsx";
import {
  type ResidentCountProduct,
  ResidentCountProvider,
} from "./resident_count_live.tsx";
import { paletteToRgbaF32, ResidentHistogramBars } from "./resident_bar.tsx";
import type { GPUStorageSource } from "./types.ts";
import {
  Axis,
  Cartesian,
  createElement,
  Grid,
  useAwait,
  useMemo,
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
  { data, x, group, options, color, opacity, paletteColors, axes, theme }:
    ResidentCountViewProps,
): LiveElement => {
  const palette = useMemo(
    () =>
      paletteColors ? paletteToRgbaF32(paletteColors, opacity ?? 1) : undefined,
    [paletteColors?.join(","), opacity],
  );
  const viewOptions = useMemo(
    () => (palette ? { ...options, palette } : options),
    [options, palette],
  );
  options = viewOptions;
  const fields = [
    { name: x, dtype: "u32", shape: "row", dimensions: ["row"] },
    ...(group
      ? [{ name: group, dtype: "u32", shape: "row", dimensions: ["row"] }]
      : []),
  ];
  return createElement(GPUDataProvider, {
    data,
    fields,
    children: (sources: Record<string, GPUStorageSource>) =>
      createElement(ResidentCountProvider, {
        x: sources[x],
        group: group ? sources[group] : undefined,
        options,
        children: (product: ResidentCountProduct) =>
          createElement(AwaitCountSummary, {
            product,
            options,
            color,
            opacity,
            axes,
            theme,
          }),
      }),
  });
};
