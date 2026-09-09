/** @jsxRuntime classic */
/** @jsx createElement */
// Hook-owned finite-domain reduction for mounted f32 sources.

import type { LiveElement } from "@use-gpu/live";
import type { ResidentDomain1DResult } from "@gggplot/reductions";
import { createMountedDomain1D } from "./resident.ts";
import type { GPUStorageSource } from "./types.ts";
import { useDeviceContext, useMemo, useResource } from "./usegpu_compat.ts";

export interface ResidentDomainProduct {
  readonly domain: GPUStorageSource;
  readDomain(): Promise<ResidentDomain1DResult>;
  /** Records this kernel's work for a caller that owns submission. */
  encode(): GPUCommandBuffer | null;
  /** The input version this product was built for. */
  readonly version: number;
}

export interface ResidentDomainProviderProps {
  x: GPUStorageSource;
  children: (product: ResidentDomainProduct) => LiveElement;
  /**
   * Leave the dispatch to the caller, so the commands can go into the frame's
   * compute pass instead of being submitted during reconciliation. The caller
   * then owns sequencing readDomain() after them.
   */
  defer?: boolean;
}

/** Re-dispatches on source-version changes and reads back only its two words on request. */
export const ResidentDomainProvider = (
  { x, children, defer }: ResidentDomainProviderProps,
): LiveElement => {
  const device = useDeviceContext();
  const resident = useResource((dispose) => {
    const result = createMountedDomain1D(device, x);
    dispose(() => result.destroy());
    return result;
  }, [device, x.buffer]);
  const product = useMemo(() => {
    if (!defer) resident.dispatch();
    return {
      domain: {
        buffer: resident.domain,
        format: "u32",
        length: 2,
        size: [2],
        version: x.version,
      },
      readDomain: () => resident.readback(),
      encode: () => resident.encode(),
      version: x.version,
    } satisfies ResidentDomainProduct;
  }, [resident, x.version, defer]);
  return children(product);
};
