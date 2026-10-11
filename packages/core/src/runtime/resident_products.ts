// The GPU-resident products the component root hosts, and the channel that
// carries them to their marks (gggplot-vnh.5.1).
//
// A LEAF module on purpose: the host (product_host.tsx) builds products and
// the mark (product_mark.tsx) reads them, and both reach this module without
// importing each other. A cycle between the two resolves one side to
// undefined under Vite, which fails every canvas silently (gggplot-vs7.1).

import type { ResidentDomain1DResult } from "@gggplot/reductions";
import type { GridSummary } from "./resident_grid_pending.ts";
import type { GPUStorageSource } from "./types.ts";
import { makeContext, useContext } from "./usegpu_compat.ts";

/** A resident [group, bin] grid: counts and mark geometry stay on the GPU. */
export interface ResidentGridProduct {
  readonly counts: GPUStorageSource;
  readonly barVertices: GPUStorageSource;
  /** Per-vertex RGBA bar colors, present when the product has a palette. */
  readonly barColors?: GPUStorageSource;
  /** The uploaded per-group palette, an input of the bar-color pass. */
  readonly palette?: GPUStorageSource;
  /** Per-vertex RGBA tile colors, each cell shaded by its own count. */
  readonly heatmapColors?: GPUStorageSource;
  /** Dense [group, bin] tile geometry. */
  readonly tileVertices: GPUStorageSource;
  /** [group totals..., stacked maximum]. */
  readonly summary: GPUStorageSource;
  readonly bins: number;
  readonly groupsCount: number;
  /** Input rows: tells a legitimate zero summary from an unfinished one. */
  readonly rows: number;
  /** stat_bin's resolved bin geometry. */
  readonly binGeometry?: { readonly lo: number; readonly binwidth: number };
  /** stat_bin's GPU-resolved x bounds, when they were read back. */
  readonly hoistedBounds?: ResidentDomain1DResult;
  /** Whether the buffers are still mounted (a readback spans frames). */
  alive(): boolean;
  /** This version's compact summary, once read back. */
  readSummary(): Promise<GridSummary>;
  /** The data version this product was dispatched for. */
  readonly version: number;
}

/** Products the root mounted, by product key (product_host.tsx). */
export type ResidentProducts = ReadonlyMap<string, ResidentGridProduct>;

const EMPTY: ResidentProducts = new Map();

export const ResidentProductsContext = makeContext<ResidentProducts>(
  EMPTY,
  "ResidentProductsContext",
);

/** The product mounted under `key`, or null while it is still resolving. */
export function useResidentProduct(key: string): ResidentGridProduct | null {
  const products = useContext<ResidentProducts>(ResidentProductsContext);
  return products.get(key) ?? null;
}
