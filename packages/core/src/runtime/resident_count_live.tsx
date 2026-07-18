/** @jsxRuntime classic */
/** @jsx createElement */
import * as Live from "@use-gpu/live";
import * as Workbench from "@use-gpu/workbench";
import type { LiveElement } from "@use-gpu/live";
import type {
  ResidentCount1D,
  ResidentCountSummary,
} from "@gggplot/reductions";
import type { GPUStorageSource } from "./types.ts";
import {
  createMountedResidentCount1D,
  type MountedCountSourceOptions,
} from "./resident.ts";
import type { ResidentHistogramProduct } from "./resident_live.tsx";

type UseDeviceContext = () => GPUDevice;
type UseResource = <T>(
  create: (dispose: (cleanup: () => void) => void) => T,
  dependencies: readonly unknown[],
) => T;
type UseMemo = <T>(create: () => T, dependencies: readonly unknown[]) => T;
const useDeviceContext =
  (Workbench as unknown as { useDeviceContext: UseDeviceContext })
    .useDeviceContext;
const useResource =
  (Live as unknown as { useResource: UseResource }).useResource;
const useMemo = (Live as unknown as { useMemo: UseMemo }).useMemo;

export interface ResidentCountProduct
  extends Omit<ResidentHistogramProduct, "readSummary"> {
  readSummary(): Promise<ResidentCountSummary>;
}
export interface ResidentCountProviderProps {
  x: GPUStorageSource;
  group?: GPUStorageSource;
  options: MountedCountSourceOptions;
  children: (product: ResidentCountProduct) => LiveElement;
}
function productFrom(
  resident: ResidentCount1D,
  version: number,
): ResidentCountProduct {
  const cells = resident.valuesCount * resident.groupsCount;
  return {
    counts: {
      buffer: resident.counts,
      format: "u32",
      length: cells,
      size: [resident.groupsCount, resident.valuesCount],
      version,
    },
    barVertices: {
      buffer: resident.barVertices,
      format: "vec2<f32>",
      length: cells * 4,
      size: [resident.groupsCount, resident.valuesCount, 4],
      version,
    },
    tileVertices: {
      buffer: resident.barVertices,
      format: "vec2<f32>",
      length: cells * 4,
      size: [resident.groupsCount, resident.valuesCount, 4],
      version,
    },
    summary: {
      buffer: resident.summary,
      format: "u32",
      length: resident.groupsCount + 1,
      size: [resident.groupsCount + 1],
      version,
    },
    bins: resident.valuesCount,
    groupsCount: resident.groupsCount,
    readSummary: () => resident.readbackSummary(),
  };
}
export const ResidentCountProvider = (
  { x, group, options, children }: ResidentCountProviderProps,
): LiveElement => {
  const device = useDeviceContext();
  const resident = useResource((dispose) => {
    const result = createMountedResidentCount1D(device, x, group, options);
    dispose(() => result.destroy());
    return result;
  }, [
    device,
    x.buffer,
    group?.buffer,
    options.valuesCount,
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
