/** @jsxRuntime classic */
/** @jsx createElement */
// A standalone auto-domain Cartesian view for the first resident histogram.

import * as Live from "@use-gpu/live";
import * as Plot from "@use-gpu/plot";
import type { LiveElement } from "@use-gpu/live";
import type { TypedDataFrame } from "../data/mod.ts";
import type { Theme } from "../ir/types.ts";
import type { ResidentHistogramOptions } from "../compile/resident.ts";
import { GPUDataProvider } from "./live.tsx";
import {
  type ResidentDomainProduct,
  ResidentDomainProvider,
} from "./resident_domain_live.tsx";
import { ResidentHistogramBars } from "./resident_bar.tsx";
import {
  type ResidentHistogramProduct,
  ResidentHistogramProvider,
} from "./resident_live.tsx";
import type { GPUStorageSource } from "./types.ts";

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
  axes: string;
  theme: Theme;
}

interface AwaitDomainProps extends Omit<ResidentHistogramViewProps, "data"> {
  xSource: GPUStorageSource;
  groupSource?: GPUStorageSource;
  domain: ResidentDomainProduct;
}

interface AwaitSummaryProps extends Omit<AwaitDomainProps, "domain"> {
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
      zBias: 1,
      ...(theme.gridColor ? { color: theme.gridColor } : {}),
    }),
    createElement(Axis, {
      axis: "x",
      width: theme.axisWidth ?? 2,
      zBias: 1,
      ...(theme.axisColor ? { color: theme.axisColor } : {}),
    }),
    createElement(Axis, {
      axis: "y",
      width: theme.axisWidth ?? 2,
      zBias: 1,
      ...(theme.axisColor ? { color: theme.axisColor } : {}),
    }),
    createElement(ResidentHistogramBars as unknown as Component, {
      product,
      color,
      opacity,
    }),
  ].filter(Boolean);
  return createElement(Cartesian, { range: [xRange, yRange], axes }, ...guides);
};

const AwaitDomainView = (
  { domain, xSource, groupSource, options, color, opacity, axes, theme }:
    AwaitDomainProps,
): LiveElement => {
  const [bounds, error] = useAwait(() => domain.readDomain(), [
    domain.domain.version,
  ]);
  if (error) throw error;
  if (!bounds || bounds.empty) return null as never;
  const resolved = {
    ...options,
    lo: bounds.min,
    hi: bounds.max,
    autoDomain: undefined,
  } as never;
  return createElement(ResidentHistogramProvider as unknown as Component, {
    x: xSource,
    group: groupSource,
    options: resolved,
    children: (product: ResidentHistogramProduct) =>
      createElement(AwaitSummaryView as unknown as Component, {
        product,
        xRange: histogramRange(bounds.min, bounds.max),
        color,
        opacity,
        axes,
        theme,
      }),
  });
};

/** Awaits bounded domain/summary products before mounting Cartesian and guides. */
export const ResidentHistogramView = (
  { data, x, group, options, color, opacity, axes, theme }:
    ResidentHistogramViewProps,
): LiveElement => {
  const fields = [
    { name: x, dtype: "f32", shape: "row", dimensions: ["row"] },
    ...(group
      ? [{ name: group, dtype: "u32", shape: "row", dimensions: ["row"] }]
      : []),
  ];
  return createElement(GPUDataProvider as unknown as Component, {
    data,
    fields,
    children: (sources: Record<string, GPUStorageSource>) =>
      createElement(ResidentDomainProvider as unknown as Component, {
        x: sources[x],
        children: (domain: ResidentDomainProduct) =>
          createElement(AwaitDomainView as unknown as Component, {
            domain,
            xSource: sources[x],
            groupSource: group ? sources[group] : undefined,
            options,
            color,
            opacity,
            axes,
            theme,
          }),
      }),
  });
};
