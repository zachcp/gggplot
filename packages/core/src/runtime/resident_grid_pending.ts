// Readiness and lifetime for the mounted grid kernels' readbacks
// (gggplot-vs7.7/vs7.8/vs7.17).
//
// WHY THIS EXISTS. A pass having RUN is not the same as a <Kernel> having
// dispatched: <Kernel> compiles its pipeline asynchronously and contributes no
// dispatch at all until that finishes, so the frame's compute pass can run with
// some or all of a chain's kernels simply absent and their buffers untouched.
// Nothing about that is visible from outside — the pass ran, the callbacks
// fired, and the dispatch gate in resident_host.tsx opens all the same.
//
// For the count and histogram grids that is not a cosmetic timing issue, it is
// a wrong chart: the view sizes its y-range from `Math.max(1, stackedMaximum)`,
// so a summary that has not been produced collapses the range to 1 and the bars
// overflow the plot area. It is also invisible to the pixel floors, because a
// collapsed range makes coverage go UP, not down — measured at 70.4% -> 73.9%
// on residentCategoricalCount and 27.4% -> 65.8% on groupedHistogram.
//
// EACH KERNEL COMPILES INDEPENDENTLY, which is the trap inside the trap.
// `useComputePipelineAsync` caches per device by shader hash and resolves each
// pipeline on its own promise, so a chain does NOT become ready all at once:
// its small u32 clear is ready frames before its big accumulation shader. A
// marker that the CLEAR pass wipes therefore proves nothing about the passes
// that fill the buffer — the first version of this module made exactly that
// mistake and the histogram read a cleared-but-unsummarized [0,0,0,0].
//
// So readiness is taken from a predicate over the DATA that only a COMPLETE
// chain can satisfy, and the marker's job is narrowed to ruling out a stale
// answer from a previous version.

/**
 * The "no answer for this version yet" marker in the summary's last word.
 *
 * Armed from the CPU before each version's dispatch. Its real job is to make a
 * PREVIOUS version's summary unmistakable: without it, a re-dispatch leaves the
 * old (plausible, nonzero) answer sitting in the buffer and the readback below
 * would accept it immediately. It cannot be confused with a real value —
 * a stacked maximum of 0xffffffff needs four billion rows.
 *
 * Note what it does NOT prove: the summary clear can wipe it while the passes
 * that fill the buffer are still compiling. Hence the second condition below.
 */
export const GRID_SUMMARY_PENDING = 0xffffffff;

/**
 * How long to keep waiting for a nonzero summary before accepting a zero.
 *
 * Only reached by a grid that has rows but lands NONE of them in a cell — every
 * value non-finite or every group id out of range. At 60fps this is several
 * seconds, which is far longer than pipeline compilation takes and short enough
 * that a pathological grid is not a hang. The ordinary empty case (no rows at
 * all) never gets here; see `expectNonEmpty`.
 */
const DEFAULT_FRAME_BUDGET = 300;

/** The compact summary shape both grid kernels read back. */
export interface GridSummary {
  readonly stackedMaximum: number;
}

/** @see abandonedReadback */
const NEVER: Promise<never> = new Promise(() => {});

/**
 * A promise for a readback that will never happen.
 *
 * Returned when the buffers a reader was polling are gone — the product was
 * disposed, or its `useAwait` was cancelled — before it produced a value.
 * Resolving with a synthetic one would be worse: the view would render a chart
 * from a made-up number. Leaving the await pending means a view whose kernel no
 * longer exists renders nothing, which is what it does before its first read
 * arrives anyway, and Live drops the await along with the component.
 */
export function abandonedReadback<T>(): Promise<T> {
  return NEVER;
}

/** How to wait for one grid's summary. */
export interface GridSummaryWait {
  /**
   * Whether a nonzero summary is still possible for this grid — false when it
   * has no rows or no cells, which skips the wait entirely for the ordinary
   * degenerate case.
   */
  readonly expectNonEmpty: boolean;
  /**
   * Whether the kernel that owns the summary buffer is still mounted.
   *
   * Checked before EVERY read, including the first: this wait can begin behind
   * a dispatch gate that itself spans frames, and copying out of a destroyed
   * buffer is a Dawn validation error ("used in submit while destroyed") that
   * the visual gate reports as a console failure. Route changes make that a
   * routine event, not a corner case.
   */
  alive(): boolean;
  readonly frames?: number;
}

/**
 * Writes the pending marker into a summary buffer's stacked-maximum word.
 *
 * Call this during reconciliation, which always precedes the frame's compute
 * submit on the same queue, and once per kernel version — a version that has
 * not dispatched yet must not be readable as the previous one's answer.
 */
export function armGridSummary(
  device: GPUDevice,
  summary: GPUBuffer,
  groupsCount: number,
): void {
  device.queue.writeBuffer(
    summary,
    groupsCount * Uint32Array.BYTES_PER_ELEMENT,
    new Uint32Array([GRID_SUMMARY_PENDING]),
  );
}

/**
 * Reads a summary once its whole kernel chain has actually produced it.
 *
 * The predicate is "the stacked maximum is neither the pending marker nor
 * zero", which is what makes it sound against partial readiness rather than
 * merely against no readiness:
 *
 *  - marker intact  -> nothing has written the summary, or the clear has not
 *                      run yet (its atomicMax cannot lower the marker).
 *  - zero           -> the summary was cleared but not filled, or it was filled
 *                      from a grid the accumulation had not written yet. Both
 *                      are indistinguishable from a genuinely empty grid, and
 *                      that is exactly why zero is not accepted while a nonzero
 *                      answer is still possible.
 *  - anything else  -> every pass in the chain ran. Each position mode makes
 *                      the stacked maximum nonzero as soon as ANY row lands in
 *                      a cell (identity and stack take a maximum over counts,
 *                      fill takes 1), so a complete chain over a non-empty grid
 *                      cannot report zero.
 *
 * The asymmetry is deliberate and is the whole reason this is correct: the only
 * harmful outcome is reporting zero when the truth is nonzero, so waiting costs
 * nothing when the truth really is zero — that answer is still returned, just
 * later, and `Math.max(1, 0)` is the right y-range for an empty chart anyway.
 *
 * `expectNonEmpty` is false when the grid cannot produce a nonzero summary at
 * all (no rows, or no cells), which skips the wait entirely for the ordinary
 * degenerate case. A caller whose grid mounts no passes at all must not call
 * this: the marker would never be cleared.
 */
export async function awaitGridSummary<S extends GridSummary>(
  read: () => Promise<S>,
  { expectNonEmpty, alive, frames = DEFAULT_FRAME_BUDGET }: GridSummaryWait,
): Promise<S> {
  let last: S | undefined;
  for (let attempt = 0; attempt <= frames; attempt++) {
    if (!alive()) return last ?? NEVER;
    last = await read();
    const pending = last.stackedMaximum === GRID_SUMMARY_PENDING ||
      (expectNonEmpty && last.stackedMaximum === 0);
    if (!pending) return last;
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  }
  if (!last || last.stackedMaximum === GRID_SUMMARY_PENDING) {
    throw new Error(
      "[gggplot] a resident grid kernel never produced a summary",
    );
  }
  // A grid with rows that lands none of them in a cell. Zero is the answer.
  return last;
}
