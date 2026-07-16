/** @jsxRuntime classic */
/** @jsx createElement */
// Hook-owned finite-domain reduction for mounted f32 sources.

import * as Live from "@use-gpu/live";
import * as Workbench from "@use-gpu/workbench";
import type { LiveElement } from "@use-gpu/live";
import type { ResidentDomain1DResult } from "@gggplot/reductions";
import { createMountedDomain1D } from "./resident.ts";
import type { GPUStorageSource } from "./types.ts";

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

export interface ResidentDomainProduct {
  readonly domain: GPUStorageSource;
  readDomain(): Promise<ResidentDomain1DResult>;
}

export interface ResidentDomainProviderProps {
  x: GPUStorageSource;
  children: (product: ResidentDomainProduct) => LiveElement;
}

/** Re-dispatches on source-version changes and reads back only its two words on request. */
export const ResidentDomainProvider = (
  { x, children }: ResidentDomainProviderProps,
): LiveElement => {
  const device = useDeviceContext();
  const resident = useResource((dispose) => {
    const result = createMountedDomain1D(device, x);
    dispose(() => result.destroy());
    return result;
  }, [device, x.buffer]);
  const product = useMemo(() => {
    resident.dispatch();
    return {
      domain: {
        buffer: resident.domain,
        format: "u32",
        length: 2,
        size: [2],
        version: x.version,
      },
      readDomain: () => resident.readback(),
    } satisfies ResidentDomainProduct;
  }, [resident, x.version]);
  return children(product);
};
