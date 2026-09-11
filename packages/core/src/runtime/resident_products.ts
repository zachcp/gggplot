// The channel that carries hoisted resident products down to their consumers.
//
// A LEAF module on purpose. resident_host.tsx builds the products, but its
// consumers are the marks and views — and the mark lives in resident_grid.tsx,
// which resident_host.tsx itself depends on through the three product modules
// (resident_count_live / resident_live / resident_tile_live). Importing the
// context straight from the host therefore closes a cycle
//   resident_grid -> resident_host -> resident_count_live -> resident_grid
// and Vite resolves one side of it to undefined. That failure is not subtle but
// it is unattributable: every canvas on every route silently fails to mount,
// including ones with no resident product in them at all (gggplot-vs7.1).
//
// So the context lives here, where it imports nothing from the resident family
// and both sides can reach it.

import { makeContext, useContext } from "./usegpu_compat.ts";

/** Products built above the plot, keyed by the id stamped on their node. */
export type ResidentProducts = ReadonlyMap<number, unknown>;

const EMPTY: ResidentProducts = new Map();

export const ResidentProductsContext = makeContext<ResidentProducts>(
  EMPTY,
  "ResidentProductsContext",
);

/** The prop name stamped onto a hoisted node so its consumer finds its product. */
export const RESIDENT_ID_PROP = "residentId";

/** Reads the product built for this node, or null when it was not hoisted. */
export function useHoistedProduct<T>(residentId: unknown): T | null {
  const products = useContext<ResidentProducts>(ResidentProductsContext);
  if (typeof residentId !== "number") return null;
  return (products.get(residentId) as T) ?? null;
}
