export type * from "./types.ts";
export { rawArrayForColumn } from "./raw.ts";
export {
  createResidentColumn,
  destroyResidentColumns,
  residentColumnFromColumn,
  type ResidentColumnOptions,
} from "./column_loader.ts";
export { isResidentColumn } from "./types.ts";
export {
  type ColumnMount,
  GPUDataProvider,
  type GPUDataProviderProps,
  planColumnMounts,
} from "./live.tsx";
export {
  createMountedDomain1D,
  createMountedResidentHistogram1D,
  histogramSourceInput,
  type MountedHistogramSourceOptions,
} from "./resident.ts";
export {
  ResidentHistogramMark,
  type ResidentHistogramMarkProps,
  type ResidentHistogramProduct,
  ResidentHistogramProvider,
  type ResidentHistogramProviderProps,
} from "./resident_live.tsx";
export {
  histogramBarChunks,
  ResidentHistogramBars,
  type ResidentHistogramBarsProps,
} from "./resident_bar.tsx";
export {
  ResidentHistogramTiles,
  type ResidentHistogramTilesProps,
} from "./resident_tile.tsx";
export {
  ResidentTileMark,
  type ResidentTileMarkProps,
} from "./resident_tile_live.tsx";
export {
  ResidentTileView,
  type ResidentTileViewProps,
} from "./resident_tile_view.tsx";
export {
  histogramRange,
  ResidentHistogramView,
  type ResidentHistogramViewProps,
} from "./resident_view.tsx";
export {
  type LiveComponent,
  RESIDENT_PRODUCT_REGISTRY,
  type ResidentProductComponents,
  resolveResidentProduct,
} from "./resident_registry.ts";
