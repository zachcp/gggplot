import type { TypedDataFrame } from "../data/mod.ts";
import type { FieldSpec, ProductPlan } from "../plan/mod.ts";
import type {
  GPUFieldSourceFactory,
  GPUPlotRuntimeOptions,
  ResolvedCPUField,
  ResolvedGPUField,
  ResolvedProduct,
} from "./types.ts";

/**
 * Lifecycle owner for mounted source bindings. It has no Live hooks itself:
 * a Use.GPU component creates it once and supplies a hook-safe source factory.
 *
 * @experimental Contract landed ahead of use (gggplot-btd): no production
 * consumer exists yet — the mounted render path currently manages resources
 * through PackCache + typedArrayForColumn + GPUDataProvider/RawData. This
 * class is the planned source owner for the GPU-native trajectory's Phase-2
 * "persistent source-backed general marks" (see docs/ARCHITECTURE.md §4–§5);
 * until that lands it is exercised only by tests/runtime_test.ts. Wire it in
 * or delete it when Phase 2 is scheduled — do not grow a third mechanism.
 */
export class GPUPlotRuntime {
  #data: TypedDataFrame;
  #factory: GPUFieldSourceFactory;
  #gpu: Record<string, ResolvedGPUField> = {};
  #versions: Record<string, number> = {};

  constructor(options: GPUPlotRuntimeOptions) {
    this.#data = options.data;
    this.#factory = options.sourceFactory;
  }

  /** Binding the same typed column is stable; replacing it advances its version. */
  setData(data: TypedDataFrame): void {
    for (const [name, next] of Object.entries(data)) {
      if (this.#data[name] !== next) {
        this.#versions[name] = (this.#versions[name] ?? 0) + 1;
      }
    }
    for (const name of Object.keys(this.#data)) {
      if (!(name in data)) this.release(name);
    }
    this.#data = data;
  }

  /** View updates deliberately do nothing: they must not cause data uploads. */
  updateView(): void {}

  resolve(plan: ProductPlan): ResolvedProduct {
    const cpu: Record<string, ResolvedCPUField> = {};
    const gpu: Record<string, ResolvedGPUField> = {};
    for (const field of plan.outputs) {
      const column = this.#data[field.name];
      if (!column) continue;
      const version = this.#versions[field.name] ?? 0;
      cpu[field.name] = { ...field, column, contentVersion: version };
      gpu[field.name] = this.resolveGPUField(field, version);
    }
    return { plan, cpu, gpu };
  }

  deviceLost(): void {
    for (const name of Object.keys(this.#gpu)) this.release(name);
  }

  private resolveGPUField(field: FieldSpec, version: number): ResolvedGPUField {
    const cached = this.#gpu[field.name];
    if (cached && cached.contentVersion === version) return cached;
    if (cached) this.release(field.name);
    const source = this.#factory.create(field, this.#data[field.name]);
    const resolved = { ...field, source, contentVersion: version };
    this.#gpu[field.name] = resolved;
    return resolved;
  }

  private release(name: string): void {
    const cached = this.#gpu[name];
    if (cached) this.#factory.release?.(cached.source);
    delete this.#gpu[name];
  }
}
