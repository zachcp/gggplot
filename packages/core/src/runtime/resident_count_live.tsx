/** @jsxRuntime classic */
/** @jsx createElement */
// stat_count configuration of the generic resident grid. Categorical x arrives
// already integer-indexed, so (unlike stat_bin) there is no auto-domain pass;
// `tileVertices` reuses the bar grid and `bins` reads `valuesCount`. All shared
// plumbing lives in resident_grid.tsx.

import type {
  ResidentCount1D,
  ResidentCountSummary,
} from "@gggplot/reductions";
import {
  createMountedResidentCount1D,
  type MountedCountSourceOptions,
} from "./resident.ts";
import {
  createResidentGrid,
  type ResidentGridMarkProps,
  type ResidentGridProduct,
  type ResidentGridProviderProps,
} from "./resident_grid.tsx";

export type ResidentCountProduct = ResidentGridProduct<ResidentCountSummary>;
export type ResidentCountProviderProps = ResidentGridProviderProps<
  MountedCountSourceOptions,
  ResidentCountSummary
>;
export type ResidentCountMarkProps = ResidentGridMarkProps<
  MountedCountSourceOptions
>;

const grid = createResidentGrid<
  ResidentCount1D,
  MountedCountSourceOptions,
  ResidentCountSummary
>({
  create: (device, x, group, options) =>
    createMountedResidentCount1D(device, x, group, options),
  binsOf: (resident) => resident.valuesCount,
  tileVerticesOf: (resident) => resident.barVertices,
  readSummary: (resident) => resident.readbackSummary(),
  optionKeys: (options) => [
    options.valuesCount,
    options.groupsCount,
    options.position,
    options.palette,
  ],
  xDtype: "u32",
});

export const ResidentCountProvider = grid.Provider;
export const ResidentCountMark = grid.Mark;
