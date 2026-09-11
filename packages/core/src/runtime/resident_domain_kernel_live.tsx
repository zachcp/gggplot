/** @jsxRuntime classic */
/** @jsx createElement */
// The finite-domain reduction as real Use.GPU <Kernel>s (gggplot-vs7.5).
//
// This replaces the hand-rolled pipeline in @gggplot/reductions for the MOUNTED
// path only; the standalone executor there is untouched and still backs the
// headless CPU/GPU parity tests. Both compile from the same pass bodies — see
// render/resident_domain_kernel.ts for the two binding preambles.

import type { LiveElement } from "@use-gpu/live";
import {
  floatFromOrdered,
  isEmptyDomain,
  type ResidentDomain1DResult,
} from "@gggplot/reductions";
import {
  DOMAIN_CLEAR_KERNEL,
  FINITE_DOMAIN_1D_KERNEL,
} from "../render/resident_domain_kernel.ts";
import { abandonedReadback } from "./resident_grid_pending.ts";
import {
  createElement,
  Fragment,
  Kernel,
  Stage,
  yeet,
} from "./usegpu_compat.ts";

/** The two-word ordered-bit accumulator both passes share. */
export const DOMAIN_ACCUMULATOR_LENGTH = 2;

const USAGE_MAP_READ = 0x0001;
const USAGE_COPY_DST = 0x0008;

/**
 * Copies the accumulator back and decodes it.
 *
 * The decode helpers come from @gggplot/reductions rather than being rewritten
 * here: they must stay in lockstep with `orderedBits` in the shared WGSL body.
 */
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

export async function readDomainBuffer(
  device: GPUDevice,
  buffer: GPUBuffer,
): Promise<PendingDomainResult> {
  const byteLength = DOMAIN_ACCUMULATOR_LENGTH * 4;
  const staging = device.createBuffer({
    size: byteLength,
    usage: USAGE_COPY_DST | USAGE_MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(buffer, 0, staging, 0, byteLength);
  device.queue.submit([encoder.finish()]);
  await staging.mapAsync(USAGE_MAP_READ);
  const words = new Uint32Array(staging.getMappedRange().slice(0));
  staging.unmap();
  staging.destroy();
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
 * Reads the accumulator once the kernels have actually produced it.
 *
 * Waiting for the compute PASS to run is not enough: <Kernel> compiles its
 * pipeline asynchronously and contributes no dispatch at all until that
 * finishes, so the first pass after mount can run with the kernels absent. That
 * is invisible from outside — the pass ran, the callbacks fired, and the buffer
 * is simply still untouched. So poll the unambiguous all-zero sentinel instead
 * of trusting the pass, backing off a frame at a time. Unlike a grid summary
 * this sentinel is free and exact: the clear pass SEEDS slot 0 with 0xffffffff,
 * so all-zero can only mean "these kernels have not dispatched".
 *
 * `alive` is checked before EVERY read, and it is not optional. This poll spans
 * frames by design, and the accumulator is a <ComputeBuffer> that Use.GPU
 * destroys when the subtree unmounts — so a route change lands a
 * copyBufferToBuffer on a destroyed buffer, which Dawn reports as "used in
 * submit while destroyed". That is a console-level validation error rather than
 * an exception, so it fails the visual gate and nothing else; the grid summary
 * hit it for real in gggplot-vs7.8. Callers pass `useAwait`'s own `cancelled`
 * predicate, which Live flips on unmount or a dependency change.
 */
export async function awaitDomain(
  device: GPUDevice,
  buffer: GPUBuffer,
  alive: () => boolean,
  frames = 600,
): Promise<ResidentDomain1DResult> {
  for (let attempt = 0; attempt < frames; attempt++) {
    if (!alive()) return abandonedReadback<ResidentDomain1DResult>();
    const { result, pending } = await readDomainBuffer(device, buffer);
    if (!pending) return result;
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  }
  throw new Error(
    "[gggplot] the resident domain kernels never produced bounds",
  );
}

export interface DomainKernelsProps {
  /** The <ComputeBuffer> target, created by the caller outside <Compute>. */
  target: unknown;
  /** The mounted x column this reduces. */
  source: unknown;
  rows: number;
  version: number;
  /** Opened once this version's passes have been encoded. */
  onEncoded: (version: number) => void;
}

/**
 * Mounts the clear and reduce passes against a caller-owned accumulator.
 *
 * `initial` + `version` is what makes this dispatch ONCE PER VERSION rather than
 * every frame: <Kernel> routes them through useInitialDispatch, whose guard
 * re-arms only when its deps change. Without `initial` a Kernel redispatches on
 * every frame the pass runs.
 */
export const DomainKernels = (
  { target, source, rows, version, onEncoded }: DomainKernelsProps,
): LiveElement =>
  createElement(
    Fragment,
    {},
    createElement(
      Stage,
      { target },
      createElement(Kernel, {
        shader: DOMAIN_CLEAR_KERNEL,
        size: [DOMAIN_ACCUMULATOR_LENGTH],
        initial: true,
        version,
      }),
      createElement(Kernel, {
        shader: FINITE_DOMAIN_1D_KERNEL,
        source,
        size: [rows],
        initial: true,
        version,
      }),
    ),
    // Declared AFTER the Stage on purpose. ComputePass runs every gathered
    // `compute` callback in tree order into ONE pass encoder, so this runs
    // after both kernels have been encoded; a readback awaiting this signal
    // then enqueues its copy behind the whole submit. Intra-pass
    // read-after-write visibility is what makes that sound, and it is pinned by
    // packages/core/tests/usegpu_kernel_link_test.ts.
    createElement(DomainEncoded, { version, onEncoded }),
  ) as LiveElement;

const DomainEncoded = (
  { version, onEncoded }: { version: number; onEncoded: (v: number) => void },
): LiveElement =>
  yeet({
    compute: () => {
      onEncoded(version);
    },
  });
