/** @jsxRuntime classic */
/** @jsx createElement */
import * as Live from "@use-gpu/live";
import * as Plot from "@use-gpu/plot";
import type { LiveElement } from "@use-gpu/live";
import type { TypedDataFrame } from "../data/mod.ts";
import type { Theme } from "../ir/types.ts";
import type { MountedCountSourceOptions } from "./resident.ts";
import { GPUDataProvider } from "./live.tsx";
import {
  type ResidentCountProduct,
  ResidentCountProvider,
} from "./resident_count_live.tsx";
import { ResidentHistogramBars } from "./resident_bar.tsx";

type Component = (props: Record<string, unknown>) => LiveElement;
type CreateElement = (
  type: Component,
  props: Record<string, unknown>,
  ...children: unknown[]
) => LiveElement;
type UseAwait = <T>(
  callback: ((cancelled: () => boolean) => Promise<T>) | null,
  dependencies: readonly unknown[],
) => [T | undefined, Error | undefined, boolean];
const createElement =
  (Live as unknown as { createElement: CreateElement }).createElement;
const useAwait = (Live as unknown as { useAwait: UseAwait }).useAwait;
const Cartesian = (Plot as unknown as { Cartesian: Component }).Cartesian;
const Grid = (Plot as unknown as { Grid: Component }).Grid;
const Axis = (Plot as unknown as { Axis: Component }).Axis;

export interface ResidentCountViewProps {
  data: TypedDataFrame;
  x: string;
  group?: string;
  options: MountedCountSourceOptions;
  color: string;
  opacity?: number;
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
    createElement(ResidentHistogramBars as unknown as Component, {
      product,
      color,
      opacity,
    }),
  ].filter(Boolean);
  return createElement(Cartesian, {
    range: [[-0.5, Math.max(0.5, options.valuesCount - 0.5)], [0, yMax]],
    axes,
  }, ...guides);
};
export const ResidentCountView = (
  { data, x, group, options, color, opacity, axes, theme }:
    ResidentCountViewProps,
): LiveElement => {
  const fields = [
    { name: x, dtype: "u32", shape: "row", dimensions: ["row"] },
    ...(group
      ? [{ name: group, dtype: "u32", shape: "row", dimensions: ["row"] }]
      : []),
  ];
  return createElement(GPUDataProvider as unknown as Component, {
    data,
    fields,
    children: (sources: Record<string, unknown>) =>
      createElement(ResidentCountProvider as unknown as Component, {
        x: sources[x],
        group: group ? sources[group] : undefined,
        options,
        children: (product: ResidentCountProduct) =>
          createElement(AwaitCountSummary as unknown as Component, {
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
