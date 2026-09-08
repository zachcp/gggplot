/** @jsxRuntime classic */
/** @jsx createElement */
// A standalone auto-domain Cartesian view for the first resident histogram.

import type { LiveElement } from "@use-gpu/live";
import type { ResidentDomain1DResult } from "@gggplot/reductions";
import type { TypedDataFrame } from "../data/mod.ts";
import type { Theme } from "../ir/types.ts";
import type { ResidentHistogramOptions } from "../compile/resident.ts";
import { GPUDataProvider } from "./live.tsx";
import {
  type ResidentDomainProduct,
  ResidentDomainProvider,
} from "./resident_domain_live.tsx";
import { paletteToRgbaF32, ResidentHistogramBars } from "./resident_bar.tsx";
import {
  type ResidentHistogramProduct,
  ResidentHistogramProvider,
} from "./resident_live.tsx";
import { useHoistedProduct } from "./resident_host.tsx";
import type { GPUStorageSource } from "./types.ts";
import {
  Axis,
  Cartesian,
  createElement,
  Grid,
  useAwait,
  useMemo,
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
  return createElement(ResidentHistogramProvider, {
    x: xSource,
    group: groupSource,
    options: resolved,
    children: (product: ResidentHistogramProduct) =>
      createElement(AwaitSummaryView, {
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
  {
    data,
    x,
    group,
    options,
    color,
    opacity,
    paletteColors,
    axes,
    theme,
    residentId,
  }: ResidentHistogramViewProps,
): LiveElement => {
  // Runs unconditionally to keep hook order stable; null when not hoisted, and
  // also null on the first frame of a hoisted node, while its x bounds are
  // still being read back off the GPU.
  const hoisted = useHoistedProduct<
    ResidentHistogramProduct & { hoistedBounds: ResidentDomain1DResult }
  >(residentId);
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
    { name: x, dtype: "f32", shape: "row", dimensions: ["row"] },
    ...(group
      ? [{ name: group, dtype: "u32", shape: "row", dimensions: ["row"] }]
      : []),
  ];
  if (typeof residentId === "number") {
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
  }
  return createElement(GPUDataProvider, {
    data,
    fields,
    children: (sources: Record<string, GPUStorageSource>) =>
      createElement(ResidentDomainProvider, {
        x: sources[x],
        children: (domain: ResidentDomainProduct) =>
          createElement(AwaitDomainView, {
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
