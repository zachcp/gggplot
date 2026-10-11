// The named-port kernel adapter (gggplot-euh, ADR-007 decision 7.2).
//
// Mounts any ProductSpec (@gggplot/reductions) as Use.GPU <Kernel>s, in place
// of the hand wiring each resident product used to carry: positional linking,
// identity-sensitive binding memos, hand-built read/write/atomic views,
// order-as-schedule by comment, and a second hand-kept preamble.
//
// - useProductAllocation allocates the spec's owned buffers once per SHAPE
//   (never per version) and destroys them when the shape changes or the
//   product unmounts. Mount it outside <Compute>, where the marks that read
//   the buffers can reach them too.
// - <ProductKernels> goes inside the frame's <Compute>. Per pass it builds the
//   target and source views BY PORT NAME, memoized on the buffers so they are
//   identity-stable (<Kernel> relinks when a binding's identity changes), links
//   the generated `@link` source, and dispatches once per version in the
//   spec's pass order. It also owns the generation lifecycle: it arms the
//   summary's pending marker before each version dispatches, and mounts the
//   summary readback with the spec's NAMED readiness predicate.
import type { LiveElement } from "@use-gpu/live";
import {
  evalSize,
  type KernelSpec,
  linkSource,
  productPassPlan,
  type ProductSpec,
  type Symbols,
  validateProductSpec,
} from "@gggplot/reductions";
import { wgsl } from "@use-gpu/shader/wgsl";
import { ProductGeneration } from "./product_generation.ts";
import { storageSource, storageTarget } from "./resident_grid_bindings.ts";
import {
  armGridSummary,
  decideGridSummary,
  type GridSummary,
} from "./resident_grid_pending.ts";
import { decideDomain } from "./resident_domain_kernel_live.tsx";
import {
  type ReadbackChannel,
  type ReadbackDecision,
  ResidentReadback,
} from "./resident_readback.tsx";
import type { GPUStorageSource } from "./types.ts";
import {
  createElement,
  Fragment,
  Kernel,
  Stage,
  useDeviceContext,
  useMemo,
  useOne,
  useResource,
} from "./usegpu_compat.ts";

const STORAGE = 0x0080;
const COPY_SRC = 0x0004;
const COPY_DST = 0x0008;

const ELEMENT_BYTES: Record<string, number> = {
  "u32": 4,
  "f32": 4,
  "vec2<f32>": 8,
  "vec4<f32>": 16,
};

/** One linked shader per kernel spec, for every product that uses it. */
const linked = new Map<string, unknown>();
function linkedShader(kernel: KernelSpec): unknown {
  let shader = linked.get(kernel.id);
  if (!shader) {
    // wgsl`` is a tagged template; one interpolation is the whole source.
    shader = wgsl`${linkSource(kernel)}`;
    linked.set(kernel.id, shader);
  }
  return shader;
}

/** A product's owned buffers and its generation. */
export interface ProductAllocation<T = unknown> {
  spec: ProductSpec;
  /** Owned buffers by port name, as storage sources. */
  buffers: Record<string, GPUStorageSource>;
  /** Element lengths by port name (owned buffers). */
  lengths: Record<string, number>;
  generation: ProductGeneration<T>;
}

/**
 * Allocates `spec`'s owned buffers for `symbols`, once per shape. A version
 * bump re-dispatches into the same buffers; only a shape change reallocates.
 */
export function useProductAllocation<T = unknown>(
  spec: ProductSpec,
  symbols: Symbols,
): ProductAllocation<T> {
  const device = useDeviceContext();
  const lengths = useMemo(
    () =>
      Object.fromEntries(
        spec.buffers.map((port) => [port.name, evalSize(port.length, symbols)]),
      ),
    [spec, ...spec.buffers.map((port) => evalSize(port.length, symbols))],
  );
  return useResource((dispose) => {
    validateProductSpec(spec);
    const generation = new ProductGeneration<T>();
    const buffers: Record<string, GPUStorageSource> = {};
    const owned: GPUBuffer[] = [];
    for (const port of spec.buffers) {
      const length = lengths[port.name];
      const buffer = device.createBuffer({
        label: `${spec.id}:${port.name}`,
        size: Math.max(4, length * ELEMENT_BYTES[port.format]),
        usage: STORAGE | COPY_SRC | COPY_DST,
      });
      owned.push(buffer);
      buffers[port.name] = storageSource(buffer, port.format, length);
    }
    dispose(() => {
      // Stop readbacks before the buffers go (a copy out of a destroyed buffer
      // is a validation error that only the visual gate would see).
      generation.dispose();
      for (const buffer of owned) buffer.destroy();
    });
    return { spec, buffers, lengths, generation };
  }, [device, spec, lengths]);
}

/** The readiness predicate a spec names, bound to this instance's shape. */
function decideFor(
  spec: ProductSpec,
  symbols: Symbols,
):
  | ((data: Uint32Array, exhausted: boolean) => ReadbackDecision<unknown>)
  | null {
  switch (spec.summary?.decide) {
    case "gridSummary":
      return (data, exhausted) =>
        decideGridSummary(data, {
          groupsCount: symbols.groups,
          expectNonEmpty: symbols.rows > 0 && symbols.bins * symbols.groups > 0,
        }, exhausted);
    case "domain":
      return (data, exhausted) =>
        decideDomain(data, { expectNonEmpty: symbols.rows > 0 }, exhausted);
    default:
      return null;
  }
}

export interface ProductKernelsProps {
  allocation: ProductAllocation;
  /** Input ports by name (mounted columns). */
  inputs: Readonly<Record<string, GPUStorageSource>>;
  symbols: Symbols;
  /** The data version: each new one dispatches the passes once. */
  version: number;
  /** Where the summary readback publishes; absent costs no readback at all. */
  summary?: ReadbackChannel<unknown>;
  /** Names the product in a failed readback's error. */
  label?: string;
  /** Frames the summary readback waits before deciding with `exhausted`. */
  frames?: number;
}

/** The passes and summary readback of one product. Mount inside <Compute>. */
export const ProductKernels = (props: ProductKernelsProps): LiveElement => {
  const { allocation, inputs, symbols, version, summary } = props;
  const { spec, buffers, lengths, generation } = allocation;
  const device = useDeviceContext();

  // One resolved plan per shape: sizes, args in kernel order, and ports by
  // name (productPassPlan, shared with the link tests).
  const symbolKey = JSON.stringify(symbols);
  const plan = useMemo(() => productPassPlan(spec, symbols), [spec, symbolKey]);
  const sizes = useMemo(() => plan.map((p) => [p.size, 1]), [plan]);

  // Views per pass, by port name. Keyed on the buffers and input buffers so
  // they are identity-stable across versions (a version bump re-dispatches,
  // never relinks).
  const inputKey = spec.inputs.map((port) => inputs[port.name]?.buffer);
  const passes = useMemo(() => {
    const portOf = (name: string): GPUStorageSource => {
      const owned = buffers[name];
      if (owned) return owned;
      const input = inputs[name];
      if (!input) {
        throw new Error(`[gggplot] ${spec.id}: input ${name} unbound`);
      }
      return input;
    };
    return plan.map((pass) => {
      const target = portOf(pass.write.port);
      return {
        shader: linkedShader(pass.kernel),
        target: storageTarget(
          target.buffer,
          pass.write.format,
          lengths[pass.write.port] ?? target.length,
        ),
        sources: pass.reads.map((read) => {
          const port = portOf(read.port);
          return storageSource(port.buffer, read.format, port.length);
        }),
      };
    });
  }, [plan, buffers, lengths, ...inputKey]);

  // Pending init: arm the summary's marker once per version, before this
  // version dispatches (reconciliation precedes the frame's submit).
  useMemo(() => {
    if (!generation.begin(version)) return;
    if (spec.summary?.decide === "gridSummary") {
      armGridSummary(device, buffers[spec.summary.port].buffer, symbols.groups);
    }
  }, [generation, version]);

  const decide = useMemo(() => decideFor(spec, symbols), [spec, symbolKey]);
  const alive = useOne(() => () => generation.alive(), generation);
  const offer = useMemo(
    () =>
      decide
        ? (data: Uint32Array, exhausted: boolean) => {
          const decision = decide(data, exhausted);
          generation.offer(version, decision);
          return decision;
        }
        : null,
    [decide, generation, version],
  );

  const kernels = plan.flatMap((pass, i) =>
    pass.size === 0 ? [] : [
      createElement(
        Stage,
        { target: passes[i].target },
        createElement(Kernel, {
          shader: passes[i].shader,
          args: pass.args,
          sources: passes[i].sources,
          size: sizes[i],
          initial: true,
          version,
        }),
      ),
    ]
  );
  const readback = summary && offer && spec.summary
    ? [createElement(ResidentReadback, {
      source: buffers[spec.summary.port],
      version,
      channel: summary as ReadbackChannel<GridSummary>,
      decide: offer,
      alive,
      label: props.label ?? spec.id,
      ...(props.frames ? { frames: props.frames } : {}),
    })]
    : [];
  return createElement(Fragment, {}, ...kernels, ...readback) as LiveElement;
};
