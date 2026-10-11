// Kernels and products as plain data (gggplot-euh, ADR-007 decision 7.2).
//
// Each WGSL pass body is written against ACCESSORS (getSize(), getValues(),
// getValueId(i), ...) plus one written storage variable. A KernelSpec names
// those, and both preambles are generated from it:
//
// - linkPreamble: `@link` declarations for Use.GPU's <Kernel>, in the order
//   <Kernel> pairs values with them: [size, ...args, ...reads, target].
// - rawPreamble: `@group/@binding` storage plus a params uniform, for the
//   headless executor (gpu/product.ts) that keeps CPU/GPU parity testable in
//   Deno without a mounted tree.
//
// Before this, every pass carried two hand-kept preambles that had to agree
// on names and order, and every product re-derived its buffer views, binding
// order and schedule by hand (~200-330 LOC each). A ProductSpec names its
// ports, owned buffers and ordered passes once; ports bind BY NAME.

/** Scalar formats a param can take. */
export type ScalarFormat = "u32" | "f32";
/** Element formats a port or accessor can take. */
export type ElementFormat = "u32" | "f32" | "vec2<f32>" | "vec4<f32>";

/** One kernel: its body and the accessors and storage the body expects. */
export interface KernelSpec {
  /** Stable id, also the pipeline cache key. */
  id: string;
  /** The pass body: `@compute ... fn main`, written against the accessors. */
  body: string;
  /** Scalar params, each read through `get<Name>()`. */
  args: readonly { name: string; format: ScalarFormat }[];
  /** Per-element inputs, each read through `get<Name>(i: u32)`. */
  reads: readonly { name: string; format: ElementFormat }[];
  /** The one storage variable the body writes, by its WGSL name. */
  write: { name: string; format: ElementFormat; atomic?: boolean };
}

/** A length or dispatch size: a literal, a symbol, or a product/sum of them. */
export type SizeExpr =
  | number
  | string
  | { mul: readonly SizeExpr[] }
  | { add: readonly SizeExpr[] };

/** A named buffer: a product input or an allocation the product owns. */
export interface PortSpec {
  name: string;
  format: ElementFormat;
  length: SizeExpr;
}

/** One dispatch: a kernel with its accessors bound to ports by name. */
export interface PassSpec {
  kernel: KernelSpec;
  /** Kernel read name -> port name. */
  reads?: Readonly<Record<string, string>>;
  /** The port the kernel's write variable binds to. */
  write: string;
  /** Kernel arg name -> its value, as a size expression over symbols. */
  args?: Readonly<Record<string, SizeExpr>>;
  /** Elements to dispatch over (getSize().x). */
  size: SizeExpr;
}

/** Which readiness predicate decides a product's summary readback. */
export type SummaryDecision = "gridSummary" | "domain";

export interface ProductSpec {
  id: string;
  /** Buffers supplied from outside (mounted columns). */
  inputs: readonly PortSpec[];
  /** Buffers the product allocates and owns. */
  buffers: readonly PortSpec[];
  /** Dispatched in this order, once per version. Order is the schedule. */
  passes: readonly PassSpec[];
  /**
   * The port read back to the CPU, and the named predicate that decides when
   * a copy of it is this version's finished answer (vs7 traps 1-2).
   */
  summary?: { port: string; decide: SummaryDecision };
}

/** Symbol values a product is instantiated with: rows, bins, groups, ... */
export type Symbols = Readonly<Record<string, number>>;

const accessor = (name: string) =>
  `get${name.charAt(0).toUpperCase()}${name.slice(1)}`;

/** Evaluates a size expression against the product's symbols. */
export function evalSize(expr: SizeExpr, symbols: Symbols): number {
  if (typeof expr === "number") return expr;
  if (typeof expr === "string") {
    const value = symbols[expr];
    if (value === undefined) {
      throw new Error(`[gggplot] unknown symbol ${expr}`);
    }
    return value;
  }
  if ("mul" in expr) {
    return expr.mul.reduce<number>((p, e) => p * evalSize(e, symbols), 1);
  }
  return expr.add.reduce<number>((s, e) => s + evalSize(e, symbols), 0);
}

function storageType(format: ElementFormat, atomic?: boolean): string {
  return atomic ? `array<atomic<${format}>>` : `array<${format}>`;
}

/** `@link` preamble for <Kernel>: size, args, reads, then the target. */
export function linkPreamble(kernel: KernelSpec): string {
  return [
    "@link fn getSize() -> vec2<u32>;",
    ...kernel.args.map((a) => `@link fn ${accessor(a.name)}() -> ${a.format};`),
    ...kernel.reads.map((r) =>
      `@link fn ${accessor(r.name)}(i: u32) -> ${r.format};`
    ),
    `@link var<storage, read_write> ${kernel.write.name}: ${
      storageType(kernel.write.format, kernel.write.atomic)
    };`,
  ].join("\n");
}

/** Full linkable source: the generated preamble plus the body. */
export function linkSource(kernel: KernelSpec): string {
  return `${linkPreamble(kernel)}\n\n${kernel.body}`;
}

/**
 * Binding layout of the raw form: reads at 0..R-1, the target at R, and the
 * params uniform (size first, then args) at R+1. Every param is a 4-byte
 * scalar, so the struct packs without padding.
 */
export function rawPreamble(kernel: KernelSpec): string {
  const r = kernel.reads.length;
  const params = [
    "struct Params {",
    "  size: u32,",
    ...kernel.args.map((a) => `  ${a.name}: ${a.format},`),
    "};",
  ].join("\n");
  return [
    params,
    ...kernel.reads.map((read, i) =>
      `@group(0) @binding(${i}) var<storage, read> read_${read.name}: array<${read.format}>;`
    ),
    `@group(0) @binding(${r}) var<storage, read_write> ${kernel.write.name}: ${
      storageType(kernel.write.format, kernel.write.atomic)
    };`,
    `@group(0) @binding(${r + 1}) var<uniform> params: Params;`,
    "fn getSize() -> vec2<u32> { return vec2<u32>(params.size, 1u); }",
    ...kernel.args.map((a) =>
      `fn ${accessor(a.name)}() -> ${a.format} { return params.${a.name}; }`
    ),
    ...kernel.reads.map((read) =>
      `fn ${
        accessor(read.name)
      }(i: u32) -> ${read.format} { return read_${read.name}[i]; }`
    ),
  ].join("\n");
}

/** Full standalone source: the generated raw preamble plus the body. */
export function rawSource(kernel: KernelSpec): string {
  return `${rawPreamble(kernel)}\n\n${kernel.body}`;
}

/**
 * Checks a spec is internally consistent: every pass binds every read and
 * arg its kernel declares, to ports and symbols that exist, with matching
 * formats. Throws on the first problem.
 */
export function validateProductSpec(spec: ProductSpec): void {
  const ports = new Map(
    [...spec.inputs, ...spec.buffers].map((p) => [p.name, p]),
  );
  if (ports.size !== spec.inputs.length + spec.buffers.length) {
    throw new Error(`[gggplot] ${spec.id}: duplicate port names`);
  }
  for (const [i, pass] of spec.passes.entries()) {
    const where = `${spec.id} pass ${i} (${pass.kernel.id})`;
    for (const read of pass.kernel.reads) {
      const port = ports.get(pass.reads?.[read.name] ?? "");
      if (!port) {
        throw new Error(`[gggplot] ${where}: read ${read.name} unbound`);
      }
      if (port.format !== read.format) {
        throw new Error(
          `[gggplot] ${where}: read ${read.name} is ${read.format}, port ${port.name} is ${port.format}`,
        );
      }
    }
    const target = ports.get(pass.write);
    if (!target) throw new Error(`[gggplot] ${where}: write port missing`);
    if (spec.inputs.some((p) => p.name === pass.write)) {
      throw new Error(`[gggplot] ${where}: writes an input port`);
    }
    if (target.format !== pass.kernel.write.format) {
      throw new Error(`[gggplot] ${where}: write format mismatch`);
    }
    for (const arg of pass.kernel.args) {
      if (pass.args?.[arg.name] === undefined) {
        throw new Error(`[gggplot] ${where}: arg ${arg.name} unbound`);
      }
    }
  }
  if (spec.summary && !ports.has(spec.summary.port)) {
    throw new Error(`[gggplot] ${spec.id}: summary port missing`);
  }
}
