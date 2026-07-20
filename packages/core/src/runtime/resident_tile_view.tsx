/** @jsxRuntime classic */
/** @jsx createElement */
// A standalone auto-x-domain Cartesian view for the resident tile grid: a dense
// [group, bin] heatmap strip (x = binned continuous axis, y = factor group
// row). Unlike the histogram view it needs no stacked-maximum summary — the y
// range is simply the group-row count the tile kernel emits (y0=group,
// y1=group+1) — so it resolves only the x domain before mounting.

import type { LiveElement } from "@use-gpu/live";
import type { TypedDataFrame } from "../data/mod.ts";
import type { Theme } from "../ir/types.ts";
import type { ResidentHistogramOptions } from "../compile/resident.ts";
import { GPUDataProvider } from "./live.tsx";
import {
  type ResidentDomainProduct,
  ResidentDomainProvider,
} from "./resident_domain_live.tsx";
import { paletteToRgbaF32 } from "./resident_bar.tsx";
import { ResidentHistogramTiles } from "./resident_tile.tsx";
import {
  type ResidentHistogramProduct,
  ResidentHistogramProvider,
} from "./resident_live.tsx";
import { histogramRange } from "./resident_view.tsx";
import type { GPUStorageSource } from "./types.ts";
import {
  Axis,
  Cartesian,
  createElement,
  Grid,
  useAwait,
  useMemo,
} from "./usegpu_compat.ts";

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
}

interface AwaitTileDomainProps extends Omit<ResidentTileViewProps, "data"> {
  xSource: GPUStorageSource;
  groupSource?: GPUStorageSource;
  domain: ResidentDomainProduct;
}

const AwaitTileDomainView = (
  { domain, xSource, groupSource, options, color, opacity, axes, theme }:
    AwaitTileDomainProps,
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
  const groupsCount = Math.max(1, options.groupsCount ?? 1);
  const xRange = histogramRange(bounds.min, bounds.max);
  const yRange: [number, number] = [0, groupsCount];
  return createElement(ResidentHistogramProvider, {
    x: xSource,
    group: groupSource,
    options: resolved,
    children: (product: ResidentHistogramProduct) => {
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
          colors: product.barColors,
        }),
      ].filter(Boolean);
      return createElement(Cartesian, { range: [xRange, yRange], axes }, ...guides);
    },
  });
};

/** Awaits the bounded x domain before mounting the tile grid and guides. */
export const ResidentTileView = (
  { data, x, group, options, color, opacity, paletteColors, axes, theme }:
    ResidentTileViewProps,
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
  const fields = [
    { name: x, dtype: "f32", shape: "row", dimensions: ["row"] },
    ...(group
      ? [{ name: group, dtype: "u32", shape: "row", dimensions: ["row"] }]
      : []),
  ];
  return createElement(GPUDataProvider, {
    data,
    fields,
    children: (sources: Record<string, GPUStorageSource>) =>
      createElement(ResidentDomainProvider, {
        x: sources[x],
        children: (domain: ResidentDomainProduct) =>
          createElement(AwaitTileDomainView, {
            domain,
            xSource: sources[x],
            groupSource: group ? sources[group] : undefined,
            options: viewOptions,
            color,
            opacity,
            axes,
            theme,
          }),
      }),
  });
};
