/** @jsxRuntime classic */
/** @jsx createElement */
// GPU->CPU readback for the resident products, on Use.GPU's own <Readback>
// (gggplot-vs7.4).
//
// WHAT THIS REPLACES. Every resident read used to allocate, submit, map and
// destroy its own MAP_READ staging buffer per call
// (@gggplot/reductions plumbing.ts::readBuffer, and a hand-rolled copy of it in
// resident_domain_kernel_live.tsx), driven from a `useAwait` inside the view.
// That had two costs. A per-frame allocation while polling — and these polls
// span frames by design, because a <Kernel> contributes no dispatch until its
// pipeline finishes compiling. And an ORDERING PROBLEM: `useAwait` fires during
// reconciliation, so the copy was submitted BEFORE the frame's compute pass and
// read the buffer as it stood a frame ago. That was patched with a per-version
// dispatch gate the compute leaf opened; the gate is gone now because
// <Readback> makes the ordering structural — ReadbackPass is mounted by
// <Compute> AFTER ComputePass, so every copy is enqueued behind that frame's
// compute submit, on the same queue.
//
// WHAT IT DOES NOT REPLACE. Sequencing is not readiness. A compute pass can run
// with some or all of a chain's kernels still compiling, and it leaves no trace
// when it does: the pass ran, the callbacks fired, and the buffer is simply
// untouched. So each product still decides, from the DATA it read back, whether
// the answer belongs to a chain that actually finished — `decide` below, and
// see resident_grid_pending.ts for why that predicate is shaped the way it is.
// A frame whose data is not ready is not published, and `shouldDispatch` keeps
// asking for another copy until one is.
//
// THE CHANNEL EXISTS BECAUSE A READBACK CANNOT RENDER ITS READER. <Readback>'s
// `then` result is mounted inside ReadbackPass, in the queue tree — not in the
// plot's layer tree where the views live. So the value has to travel sideways:
// the leaf publishes into a channel, and the view awaits the channel with the
// same `useAwait` it always had. Nothing about the view's shape changes.

import type { LiveElement } from "@use-gpu/live";
import type { GPUStorageSource } from "./types.ts";
import { createElement, Readback, useMemo, useOne } from "./usegpu_compat.ts";

/**
 * One frame's verdict on a copy that came back off the GPU.
 *
 * `wait` is the interesting one: it means the bytes are real but they do not
 * belong to a finished computation yet, which is a routine state for the first
 * frames after a mount rather than an error.
 */
export type ReadbackDecision<T> =
  | { readonly status: "ready"; readonly value: T }
  | { readonly status: "wait" }
  | { readonly status: "failed"; readonly reason: string };

/**
 * A one-value-per-version pipe from a readback leaf to whoever is waiting.
 *
 * Strictly per version, with no retention of the previous answer — see
 * {@link ReadbackChannel.read}.
 */
export interface ReadbackChannel<T> {
  /**
   * The value for `version`, once a readback has accepted one.
   *
   * Resolves immediately when that version's answer is already in hand, so a
   * re-render does not stall, and NEVER resolves with an older version's — a
   * resident summary is the chart's y-range, and drawing this version's bars
   * against the last version's range is exactly the plausible-but-wrong output
   * that no pixel floor can see (gggplot-vs7.1 attempt 2). A reader with no
   * answer yet renders nothing, which is what it did before its first read
   * arrived anyway.
   *
   * Calling this is also what makes the leaf dispatch a copy at all: a product
   * nobody reads back (the tile strip sizes its y range from its group count)
   * costs no copy and no map.
   */
  read(version: number): Promise<T>;
  /** Whether a reader is waiting on `version` and has not been answered. */
  wanted(version: number): boolean;
  publish(version: number, value: T): void;
  fail(version: number, error: Error): void;
}

export function createReadbackChannel<T>(): ReadbackChannel<T> {
  let accepted: { version: number; value: T } | null = null;
  let waiter: {
    version: number;
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
  } | null = null;
  const waiterFor = (version: number) => {
    if (!waiter || waiter.version !== version) {
      let resolve!: (value: T) => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      // A version can be abandoned mid-flight (a route change, a new version)
      // while its promise is still rejectable; keep that from surfacing as an
      // unhandled rejection. Awaiters still see it.
      promise.catch(() => {});
      waiter = { version, promise, resolve, reject };
    }
    return waiter;
  };
  return {
    read(version) {
      if (accepted && accepted.version === version) {
        return Promise.resolve(accepted.value);
      }
      return waiterFor(version).promise;
    },
    wanted(version) {
      if (accepted && accepted.version === version) return false;
      return waiter?.version === version;
    },
    publish(version, value) {
      accepted = { version, value };
      if (waiter?.version === version) waiter.resolve(value);
    },
    fail(version, error) {
      if (waiter?.version === version) waiter.reject(error);
    },
  };
}

export interface ResidentReadbackProps<T> {
  /** The buffer to copy out, as the storage source its owner already exposes. */
  source: GPUStorageSource;
  /**
   * The DATA version this buffer's contents belong to.
   *
   * Passed rather than taken from `source.version` because the two differ for
   * the domain accumulator: it is a <ComputeBuffer>, whose version counts its
   * own history swaps and never moves, while the answer in it belongs to the
   * version of the column that was reduced into it.
   */
  version: number;
  channel: ReadbackChannel<T>;
  /**
   * Whether one frame's copy is this version's finished answer.
   *
   * `exhausted` is true once the frame budget is spent, which is the caller's
   * cue to stop waiting for something better and either accept what it has or
   * fail — the budget exists so a pathological product is slow, not a hang.
   */
  decide: (data: Uint32Array, exhausted: boolean) => ReadbackDecision<T>;
  /**
   * Whether the buffer still exists.
   *
   * Checked before EVERY copy, and not optional. This readback spans frames by
   * design, and a route change destroys the product underneath it; copying out
   * of a destroyed buffer is a Dawn validation error ("used in submit while
   * destroyed") that surfaces only as a console failure in the visual gate.
   */
  alive: () => boolean;
  /** Frames to keep asking before `decide` is called with `exhausted`. */
  frames?: number;
  /** Names this readback in the error a failed decision raises. */
  label: string;
}

/**
 * Frames to wait for a product before giving up on it.
 *
 * At 60fps this is several seconds — far longer than pipeline compilation
 * takes, and short enough that a product which will never resolve reports
 * itself instead of hanging.
 */
const DEFAULT_FRAME_BUDGET = 300;

/**
 * Copies one resident buffer back per frame until its answer is ready.
 *
 * Mount inside the frame's <Compute>: this is a `post`/`readback` pair, which
 * only ReadbackPass gathers, and <Compute> is what mounts ReadbackPass.
 */
export function ResidentReadback<T>(
  { source, version, channel, decide, alive, frames, label }:
    ResidentReadbackProps<T>,
): LiveElement {
  // Retained across frames, and re-armed per version rather than per mount: the
  // budget is per answer, so a new version gets a fresh one.
  const state = useOne(() => ({ version: -1, attempts: 0, dispatched: -1 }));
  const budget = frames ?? DEFAULT_FRAME_BUDGET;
  const props = useMemo(() => ({
    source,
    // `then` runs a frame's-worth later than `post`, so the version the data
    // belongs to is captured when the copy is enqueued, not when it lands.
    onDispatch: () => {
      state.dispatched = version;
    },
    shouldDispatch: () => alive() && channel.wanted(version),
    then: (data: Uint32Array) => {
      const dispatched = state.dispatched;
      if (state.version !== dispatched) {
        state.version = dispatched;
        state.attempts = 0;
      }
      const exhausted = ++state.attempts > budget;
      const decision = decide(data, exhausted);
      if (decision.status === "ready") {
        channel.publish(dispatched, decision.value);
      } else if (decision.status === "failed") {
        channel.fail(
          dispatched,
          new Error(`[gggplot] ${label}: ${decision.reason}`),
        );
      }
      // Nothing to mount: this leaf's output is the channel, not an element.
      return null;
    },
  }), [source, version, channel, decide, alive, budget, label, state]);
  return createElement(Readback, props) as LiveElement;
}
