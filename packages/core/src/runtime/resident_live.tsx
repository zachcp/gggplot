/** @jsxRuntime classic */
/** @jsx createElement */
// The hook-owning mounted execution boundary for resident histogram products.

import * as Live from "@use-gpu/live";
import * as Workbench from "@use-gpu/workbench";
import type { LiveElement } from "@use-gpu/live";
import type {
  ResidentHistogram1D,
  ResidentHistogramSummary,
} from "@gggplot/reductions";
import {
  createMountedResidentHistogram1D,
  type MountedHistogramSourceOptions,
} from "./resident.ts";
import type { GPUStorageSource } from "./types.ts";

type UseDeviceContext = () => GPUDevice;
type UseResource = <T>(
  create: (dispose: (cleanup: () => void) => void) => T,
  dependencies: readonly unknown[],
) => T;
type UseMemo = <T>(create: () => T, dependencies: readonly unknown[]) => T;

// Vite resolves Use.GPU's ESM surface; Deno sees its CJS declaration surface.
const useDeviceContext =
  (Workbench as unknown as { useDeviceContext: UseDeviceContext })
    .useDeviceContext;
const useResource =
  (Live as unknown as { useResource: UseResource }).useResource;
const useMemo = (Live as unknown as { useMemo: UseMemo }).useMemo;

export interface ResidentHistogramProduct {
  readonly counts: GPUStorageSource;
  readonly barVertices: GPUStorageSource;
  /** Dense [group, bin] tile-grid vertices; counts remain GPU-resident. */
  readonly tileVertices: GPUStorageSource;
  /** [group totals..., stacked maximum], for explicit bounded feedback only. */
  readonly summary: GPUStorageSource;
  readonly bins: number;
  readonly groupsCount: number;
  readSummary(): Promise<ResidentHistogramSummary>;
}

export interface ResidentHistogramProviderProps {
  x: GPUStorageSource;
  group?: GPUStorageSource;
  options: MountedHistogramSourceOptions;
  children: (product: ResidentHistogramProduct) => LiveElement;
}

function productFrom(
  resident: ResidentHistogram1D,
  version: number,
): ResidentHistogramProduct {
  const cells = resident.bins * resident.groupsCount;
  return {
    counts: {
      buffer: resident.counts,
      format: "u32",
      length: cells,
      size: [resident.groupsCount, resident.bins],
      version,
    },
    barVertices: {
      buffer: resident.barVertices,
      format: "vec2<f32>",
      length: cells * 4,
      size: [resident.groupsCount, resident.bins, 4],
      version,
    },
    tileVertices: {
      buffer: resident.tileVertices,
      format: "vec2<f32>",
      length: cells * 4,
      size: [resident.groupsCount, resident.bins, 4],
      version,
    },
    summary: {
      buffer: resident.summary,
      format: "u32",
      length: resident.groupsCount + 1,
      size: [resident.groupsCount + 1],
      version,
    },
    bins: resident.bins,
    groupsCount: resident.groupsCount,
    readSummary: () => resident.readbackSummary(),
  };
}

/**
 * Runs stat_bin from RawData storage on the mounted Use.GPU device. Source
 * content changes re-dispatch into persistent outputs; changing a buffer,
 * device, or bin shape safely replaces and destroys only derived resources.
 */
export const ResidentHistogramProvider = (
  { x, group, options, children }: ResidentHistogramProviderProps,
): LiveElement => {
  const device = useDeviceContext();
  const resident = useResource((dispose) => {
    const result = createMountedResidentHistogram1D(device, x, group, options);
    dispose(() => result.destroy());
    return result;
  }, [
    device,
    x.buffer,
    group?.buffer,
    options.lo,
    options.hi,
    options.bins,
    options.binwidth,
    options.groupsCount,
    options.position,
  ]);
  const version = Math.max(x.version, group?.version ?? 0);
  const product = useMemo(() => {
    resident.dispatch();
    return productFrom(resident, version);
  }, [resident, version]);
  return children(product);
};
