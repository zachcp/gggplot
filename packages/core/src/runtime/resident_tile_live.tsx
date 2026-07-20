/** @jsxRuntime classic */
/** @jsx createElement */
// Dense [group, bin] tile-grid configuration of the generic resident grid. It
// reuses the stat_bin kernel (the only kernel that emits a dedicated dense tile
// buffer) but renders ResidentHistogramTiles — a heatmap strip where x is the
// binned continuous axis and y is the factor group row — instead of bars. All
// shared plumbing lives in resident_grid.tsx.

import type {
  ResidentHistogram1D,
  ResidentHistogramSummary,
} from "@gggplot/reductions";
import {
  createMountedResidentHistogram1D,
  type MountedHistogramSourceOptions,
} from "./resident.ts";
import type { LiveComponent } from "./usegpu_compat.ts";
import { ResidentHistogramTiles } from "./resident_tile.tsx";
import {
  createResidentGrid,
  type ResidentGridMarkProps,
  type ResidentGridProviderProps,
} from "./resident_grid.tsx";
import type { ResidentHistogramMarkOptions } from "./resident_live.tsx";

export type ResidentTileProviderProps = ResidentGridProviderProps<
  ResidentHistogramMarkOptions,
  ResidentHistogramSummary
>;
export type ResidentTileMarkProps = ResidentGridMarkProps<
  ResidentHistogramMarkOptions
>;

const grid = createResidentGrid<
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
  leaf: ResidentHistogramTiles as unknown as LiveComponent,
});

/** Mounted stat_bin execution boundary shared by the tile mark and view. */
export const ResidentTileProvider = grid.Provider;

/** Direct composable lowering target for an eligible tile-grid layer. */
export const ResidentTileMark = grid.Mark;
