/** @jsxRuntime classic */
/** @jsx createElement */
// Hook-owned finite-domain reduction for mounted f32 sources.
//
// NO IN-TREE CONSUMER as of gggplot-vs7.1. Every resident product now resolves
// its x bounds through runtime/resident_domain_kernel_live.tsx's <Kernel>s,
// mounted by resident_host.tsx inside the frame's <Compute>; this provider was
// the in-place path that ran alongside them, and that path is gone. It is still
// re-exported from runtime/mod.ts, so retiring it is a public-surface decision
// rather than a deletion — tracked with the same question on
// runtime/streaming.ts in gggplot-vs7.2. Do not wire it back in without a
// <Compute> above it: its dispatch() submits during reconciliation, which is
// exactly what that epic set out to remove.

import type { LiveElement } from "@use-gpu/live";
import type { ResidentDomain1DResult } from "@gggplot/reductions";
import { createMountedDomain1D } from "./resident.ts";
import type { GPUStorageSource } from "./types.ts";
import { useDeviceContext, useMemo, useResource } from "./usegpu_compat.ts";

export interface ResidentDomainProduct {
  readonly domain: GPUStorageSource;
  /**
   * Copies the accumulator back ONCE.
   *
   * Deliberately not the frame-spanning poll `awaitDomain` runs, and it needs no
   * liveness guard for the same reason: the copy is encoded and submitted
   * SYNCHRONOUSLY, inside the `useAwait` callback that runs while the component
   * is mounted, and only the mapAsync afterwards suspends. So there is no window
   * in which this can submit against a destroyed buffer — the failure mode
   * gggplot-vs7.17 guards `awaitDomain` against. Anything that turns this into a
   * repeated read across frames must take a liveness predicate first.
   */
  readDomain(): Promise<ResidentDomain1DResult>;
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
      version: x.version,
    } satisfies ResidentDomainProduct;
  }, [resident, x.version, defer]);
  return children(product);
};
