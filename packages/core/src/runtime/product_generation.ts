// A product's generation lifecycle (gggplot-euh, vnh.15 finding 2).
//
// A resident product's answer (its summary) is produced asynchronously and
// may take many frames: each <Kernel> compiles its pipeline independently, so
// a chain is NOT ready all at once, and a pass having run proves nothing about
// the passes after it (vs7 traps 1-2). The generation tracks, per version:
//
//   pending  -> armed for this version; copies are offered and decided by the
//               product's NAMED predicate, which only a complete chain can
//               satisfy (decideGridSummary / decideDomain).
//   ready    -> the predicate accepted a copy for exactly this version.
//   failed   -> the predicate gave up (frame budget spent).
//   disposed -> the buffers are gone; nothing may copy out of them.
//
// A new version invalidates the old one: an answer offered for a version that
// is no longer current is dropped, so this version's bars are never drawn
// against the last version's range.
import type { ReadbackDecision } from "./resident_readback.tsx";

export type GenerationPhase = "pending" | "ready" | "failed" | "disposed";

export class ProductGeneration<T> {
  #version = -1;
  #phase: GenerationPhase = "pending";
  #value: T | undefined;
  #reason: string | undefined;

  get version(): number {
    return this.#version;
  }

  get phase(): GenerationPhase {
    return this.#phase;
  }

  /** The accepted answer, only while `phase` is "ready". */
  get value(): T | undefined {
    return this.#phase === "ready" ? this.#value : undefined;
  }

  get reason(): string | undefined {
    return this.#reason;
  }

  /**
   * Start `version`. Returns true when it is new, which is the caller's cue to
   * arm the summary's pending marker BEFORE this version dispatches. A repeat
   * call for the current version is a no-op, so this can run on every render.
   */
  begin(version: number): boolean {
    if (this.#phase === "disposed") return false;
    if (version === this.#version) return false;
    this.#version = version;
    this.#phase = "pending";
    this.#value = undefined;
    this.#reason = undefined;
    return true;
  }

  /**
   * Offer one decided copy. Accepted only for the current version while still
   * pending; a stale version's copy, or any copy after disposal, is ignored.
   * Returns whether it changed the phase.
   */
  offer(version: number, decision: ReadbackDecision<T>): boolean {
    if (this.#phase !== "pending" || version !== this.#version) return false;
    if (decision.status === "ready") {
      this.#phase = "ready";
      this.#value = decision.value;
      return true;
    }
    if (decision.status === "failed") {
      this.#phase = "failed";
      this.#reason = decision.reason;
      return true;
    }
    return false;
  }

  /** The buffers are being destroyed: stop every further copy. */
  dispose(): void {
    this.#phase = "disposed";
    this.#value = undefined;
  }

  /** Whether the product's buffers still exist (a readback's `alive`). */
  alive(): boolean {
    return this.#phase !== "disposed";
  }
}
