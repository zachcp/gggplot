export type * from "./types.ts";
// @experimental — test-only contracts landed ahead of the GPU-native plan's
// Phase 2; see the module docs on runtime.ts and streaming.ts (gggplot-btd).
export { GPUPlotRuntime } from "./runtime.ts";
export { rawArrayForColumn } from "./raw.ts";
export {
  GPUStreamingSourceAdapter,
  type StreamingGPUStorageSource,
  type StreamingRange,
} from "./streaming.ts";
export { GPUDataProvider, type GPUDataProviderProps } from "./live.tsx";
export {
  createMountedDomain1D,
  createMountedResidentHistogram1D,
  histogramSourceInput,
  type MountedHistogramSourceOptions,
} from "./resident.ts";
export {
  type ResidentDomainProduct,
  ResidentDomainProvider,
  type ResidentDomainProviderProps,
} from "./resident_domain_live.tsx";
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
  ResidentTileProvider,
  type ResidentTileProviderProps,
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
