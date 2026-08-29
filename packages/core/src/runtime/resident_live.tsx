/** @jsxRuntime classic */
/** @jsx createElement */
// stat_bin (histogram) configuration of the generic resident grid. The
// provider is the hook-owning mounted execution boundary; the mark is the
// direct composable lowering target for an eligible stat_bin/geom_histogram
// layer, including the optional auto-domain pass. All shared plumbing lives in
// resident_grid.tsx.

import type {
  ResidentHistogram1D,
  ResidentHistogramSummary,
} from "@gggplot/reductions";
import {
  createMountedResidentHistogram1D,
  type MountedHistogramSourceOptions,
} from "./resident.ts";
import {
  createResidentGrid,
  type ResidentGrid,
  type ResidentGridMarkProps,
  type ResidentGridProduct,
  type ResidentGridProviderProps,
} from "./resident_grid.tsx";

/** stat_bin mark options: bounds may be resolved on-GPU via auto-domain. */
export type ResidentHistogramMarkOptions =
  & Omit<MountedHistogramSourceOptions, "lo" | "hi">
  & {
    lo?: number;
    hi?: number;
    autoDomain?: boolean;
  };

export type ResidentHistogramProduct = ResidentGridProduct<
  ResidentHistogramSummary
>;
export type ResidentHistogramProviderProps = ResidentGridProviderProps<
  ResidentHistogramMarkOptions,
  ResidentHistogramSummary
>;
export type ResidentHistogramMarkProps = ResidentGridMarkProps<
  ResidentHistogramMarkOptions
>;

const grid: ResidentGrid<
  ResidentHistogramMarkOptions,
  ResidentHistogramSummary
> = createResidentGrid<
  ResidentHistogram1D,
  ResidentHistogramMarkOptions,
  ResidentHistogramSummary
>({
  create: (device, x, group, options) =>
    createMountedResidentHistogram1D(
      device,
      x,
      group,
      options as MountedHistogramSourceOptions,
    ),
  binsOf: (resident) => resident.bins,
  tileVerticesOf: (resident) => resident.tileVertices,
  readSummary: (resident) => resident.readbackSummary(),
  optionKeys: (options) => [
    options.lo,
    options.hi,
    options.bins,
    options.binwidth,
    options.groupsCount,
    options.position,
    options.palette,
  ],
  xDtype: "f32",
  resolveAutoDomain: (options, bounds) => ({
    ...options,
    lo: bounds.min,
    hi: bounds.max,
    autoDomain: undefined,
  }),
});

/**
 * Runs stat_bin from RawData storage on the mounted Use.GPU device. Source
 * content changes re-dispatch into persistent outputs; changing a buffer,
 * device, or bin shape safely replaces and destroys only derived resources.
 */
export const ResidentHistogramProvider = grid.Provider;

/** Direct composable lowering target for an eligible stat_bin/geom_histogram layer. */
export const ResidentHistogramMark = grid.Mark;
