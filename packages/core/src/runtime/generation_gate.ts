// Marks and guides render the same generation (gggplot-wkc, vnh.15 decision 4).
//
// A resident product redispatches when its data version moves, so its GPU
// buffers hold generation N at once, while anything read back (a stacked
// maximum sizing the y range, the x bounds sizing a bin grid) arrives a few
// frames later. useAwait keeps the previous answer meanwhile. Drawing the
// live marks inside a range sized from the previous answer is the skew this
// module rules out: every read-back value carries the version it describes,
// and marks draw only when it is the product's own.
//
// The one exception is a mark that binds the live summary slot on the GPU
// directly, never through a readback, and is allowed only where no guide
// shows that domain: LIVE_DOMAIN_KERNELS.

/** A read-back value and the data version it describes. */
export interface Generation<T> {
  version: number;
  value: T;
}

/** Wraps a versioned read so its answer is stamped with that version. */
export function stamped<T>(
  version: number,
  read: (version: number) => Promise<T>,
): () => Promise<Generation<T>> {
  return async () => ({ version, value: await read(version) });
}

/** What a view may draw from the latest read-back value it has. */
export interface ViewGeneration<T> {
  /** The latest value read back, for guides; null before the first. */
  domain: T | null;
  /** Whether the live marks belong to the same generation as `domain`. */
  drawMarks: boolean;
}

/**
 * Pairs the latest read-back value with the product's version. Guides may
 * keep showing the previous generation's domain while the next is in flight;
 * marks may not, since their buffers already hold the next.
 */
export function viewGeneration<T>(
  awaited: Generation<T> | null | undefined,
  productVersion: number,
): ViewGeneration<T> {
  if (!awaited) return { domain: null, drawMarks: false };
  return {
    domain: awaited.value,
    drawMarks: awaited.version === productVersion,
  };
}

/**
 * The version a sized product dispatches at: the data's, once the sizing read
 * back for that version is in; until then the version it last dispatched, so
 * its buffers keep one whole generation. The first dispatch never waits:
 * there is no earlier generation to hold.
 */
export function dispatchVersion(
  held: number | null,
  dataVersion: number,
  sizingCurrent: boolean,
): number {
  return held === null || sizingCurrent ? dataVersion : held;
}

/**
 * Kernels that read a product's live DOMAIN slot (the summary's maximum) on
 * the GPU instead of through a readback, by explicit opt-in.
 *
 * grid_heatmap_colors normalizes tile colors by the grid maximum in the same
 * dispatch that computed it, so the colors can never be a generation behind.
 * It is allowed because no guide reads that domain: the tile strip view
 * awaits nothing (runtime/resident_tile_view.tsx). A kernel joins this list
 * only on the same terms.
 */
export const LIVE_DOMAIN_KERNELS: ReadonlySet<string> = new Set([
  "@gggplot/reductions:grid_heatmap_colors@1",
]);
