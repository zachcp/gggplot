// Readiness for the finite-domain reduction (gggplot-vs7.5): decoding its
// ordered-float accumulator and deciding when a copy of it is the answer.
// The reduction itself is DOMAIN_1D_PRODUCT, mounted through the ProductSpec
// adapter (runtime/histogram_product.ts, gggplot-0rv).

import {
  floatFromOrdered,
  isEmptyDomain,
  type ResidentDomain1DResult,
} from "@gggplot/reductions";
import type { ReadbackDecision } from "./resident_readback.tsx";

/** The two-word ordered-bit accumulator both passes share. */
export const DOMAIN_ACCUMULATOR_LENGTH = 2;

/**
 * A domain result that may not have been computed yet.
 *
 * `pending` means the accumulator is still all-zero, which is the state a fresh
 * <ComputeBuffer> is allocated in and one the kernels can never leave it in:
 * the clear pass seeds slot 0 with 0xffffffff before anything else runs. So
 * all-zero is an unambiguous "these kernels have not dispatched yet", and it is
 * distinct from `empty` (they ran and found no finite values).
 */
export interface PendingDomainResult {
  result: ResidentDomain1DResult;
  pending: boolean;
}

/**
 * Decodes one copy of the accumulator.
 *
 * The decode helpers come from @gggplot/reductions rather than being rewritten
 * here: they must stay in lockstep with `orderedBits` in the shared WGSL body.
 */
export function decodeDomainWords(words: Uint32Array): PendingDomainResult {
  const empty = isEmptyDomain(words);
  return {
    pending: words[0] === 0 && words[1] === 0,
    result: {
      min: empty ? Number.NaN : floatFromOrdered(words[0]),
      max: empty ? Number.NaN : floatFromOrdered(words[1]),
      empty,
      // The contract fixes this at the accumulator's size; a literal type.
      byteLength: 8,
    },
  };
}

/**
 * Decides whether one frame's copy of the accumulator is a real answer.
 *
 * Two sentinels, and only the first one is free.
 *
 * ALL-ZERO means nothing has dispatched. A fresh <ComputeBuffer> is allocated
 * that way and the kernels can never leave it that way, because the clear pass
 * seeds slot 0 with 0xffffffff before anything else runs. That test is exact.
 *
 * THE CLEARED SEED IS NOT. [0xffffffff, 0] is precisely what `isEmptyDomain`
 * reads as an empty domain, so "the clear ran and the reduction did not" and
 * "the reduction ran and found no finite value" are bit-identical. They cannot
 * be told apart from the buffer, and they are not rare: each <Kernel> compiles
 * its pipeline on its own promise, so the small clear is routinely ready frames
 * before the reduction it precedes. Accepting that state cost the resident tile
 * strip its whole chart — bounds came back empty, the bin grid was never sized,
 * and the view mounted nothing at all (0.9% coverage against a 62.9% figure).
 * Nothing was logged, because nothing went wrong: the copy succeeded and the
 * bytes were real.
 *
 * So the empty answer waits while a non-empty one is still possible, on the
 * same asymmetry the grid summaries use (resident_grid_pending.ts): the only
 * harmful outcome is reporting empty when the truth is a real domain, so
 * waiting costs nothing when the data really is all non-finite — that answer is
 * still returned, just later, once `exhausted` says no better one is coming.
 * `expectNonEmpty` is false when the column has no rows at all, which is the
 * ordinary degenerate case and skips the wait entirely.
 */
export function decideDomain(
  words: Uint32Array,
  { expectNonEmpty }: { expectNonEmpty: boolean },
  exhausted: boolean,
): ReadbackDecision<ResidentDomain1DResult> {
  const { result, pending } = decodeDomainWords(words);
  if (pending) {
    return exhausted
      ? {
        status: "failed",
        reason: "the resident domain kernels never produced bounds",
      }
      : { status: "wait" };
  }
  if (result.empty && expectNonEmpty && !exhausted) return { status: "wait" };
  return { status: "ready", value: result };
}

/**
 * Frames to wait for the domain accumulator.
 *
 * Longer than a grid summary's budget because this reduction gates the bin grid
 * that follows it: nothing downstream mounts until it resolves, so it is the
 * one readback whose slowness is a blank chart rather than a late one.
 */
export const DOMAIN_FRAME_BUDGET = 600;
