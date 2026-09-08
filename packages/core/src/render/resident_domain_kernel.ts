// The <Kernel>-linkable form of the finite-domain reduction (gggplot-vs7.5).
//
// DUAL SURFACE: @gggplot/reductions owns the pass bodies and their
// hand-numbered preamble, because that package deliberately has no @use-gpu
// dependency — it runs headless in Deno against a bare GPUDevice, which is what
// backs the CPU/GPU parity rule in docs/ARCHITECTURE.md §4. This module adds the
// second preamble, the one Use.GPU's shader linker consumes, over the SAME body
// text. Neither form re-states the logic.
//
// The two forms are not expected to have identical bindings: scalar parameters
// that the raw form passes in a uniform buffer become <Kernel> `args` refs here,
// so the link form has one fewer binding. Identical OUTPUT for identical input
// is the invariant, and packages/core/tests/resident_domain_link_test.ts asserts
// exactly that on a real device.
import { DOMAIN_CLEAR_BODY, FINITE_DOMAIN_1D_BODY } from "@gggplot/reductions";
import { wgsl } from "@use-gpu/shader/wgsl";

/**
 * DECLARATION ORDER IS THE BINDING ORDER.
 *
 * <Kernel> builds its value list as
 *   [dataSize, ...args, ...sources, source, ...targets, ...history]
 * and pairs it positionally against the bundle's attributes in the order they
 * are declared. `getSize` consumes dataSize, so it MUST come first; the storage
 * target follows. Getting this backwards fails at link time with
 * "Virtual module '@access [...]' has unresolved data bindings", which does not
 * name the ordering as the cause — hence this comment.
 *
 * EVERY kernel must declare getSize, even one that has no natural use for it:
 * <Kernel> ALWAYS passes dataSize as value 0, so a bundle without it binds its
 * first real link to a size lambda instead of a buffer. That is why the clear
 * pass is written size-driven rather than hardcoding two atomicStores.
 *
 * `@link` on a `var` (rather than a `fn`) is what makes an ATOMIC target
 * expressible: the linker emits a raw whole-buffer binding for a link whose
 * attribute resolves with `args === null`, and `atomicMin`/`atomicMax` need
 * that. A function accessor could not be written against.
 */
export const DOMAIN_CLEAR_KERNEL = wgsl`
@link fn getSize() -> vec2<u32>;
@link var<storage, read_write> domain: array<atomic<u32>>;

${DOMAIN_CLEAR_BODY}
`;

export const FINITE_DOMAIN_1D_KERNEL = wgsl`
@link fn getSize() -> vec2<u32>;
@link var<storage, read_write> domain: array<atomic<u32>>;
@link fn getValue(i: u32) -> f32;

${FINITE_DOMAIN_1D_BODY}
`;
