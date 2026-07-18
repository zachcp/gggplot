import type { ExtensionCapability, ExtensionDefinition } from "./types.ts";
import { validateExtension } from "./validate.ts";

export interface ExtensionId {
  id: string;
  contract: string;
  major: number;
}

export type CpuExtensionAdapter<Context = unknown, Output = unknown> = (
  context: Context,
) => Output | Promise<Output>;

export interface GpuExtensionAdapter<Plan = unknown> {
  createPlan(input: unknown): Plan;
}

/** Live values remain opaque to core; packages may provide a component/function. */
export interface LiveExtensionAdapter<Value = unknown> {
  value: Value;
}

/** Emitted source resolves a static package import, never a serialized closure. */
export interface EmitExtensionAdapter {
  importFrom: string;
  exportName: string;
}

export interface ExtensionAdapters {
  cpu?: CpuExtensionAdapter;
  gpu?: GpuExtensionAdapter;
  live?: LiveExtensionAdapter;
  emit?: EmitExtensionAdapter;
}

export interface RegisteredExtension {
  definition: ExtensionDefinition;
  adapters: ExtensionAdapters;
}

const ID_PATTERN =
  /^(?:(?:@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*:)?[a-z0-9][a-z0-9_-]*)@([1-9][0-9]*)$/;

export function parseExtensionId(id: string): ExtensionId | undefined {
  const match = ID_PATTERN.exec(id);
  if (!match) return undefined;
  return {
    id,
    contract: id.slice(0, id.lastIndexOf("@")),
    major: Number(match[1]),
  };
}

function serializableError(
  value: unknown,
  path = "definition",
  seen = new Set<object>(),
): string | undefined {
  if (
    value === null || typeof value === "string" || typeof value === "boolean"
  ) return;
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? undefined
      : `${path} contains a non-finite number`;
  }
  if (typeof value !== "object") {
    return `${path} contains non-JSON value ${typeof value}`;
  }
  if (seen.has(value)) return `${path} contains a cycle`;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const error = serializableError(value[i], `${path}[${i}]`, seen);
      if (error) return error;
    }
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return `${path} contains a non-plain object`;
    }
    for (const [key, child] of Object.entries(value)) {
      const error = serializableError(child, `${path}.${key}`, seen);
      if (error) return error;
    }
  }
  seen.delete(value);
}

function adapterCapabilities(
  adapters: ExtensionAdapters,
): ExtensionCapability[] {
  return (["cpu", "gpu", "live", "emit"] as const).filter((key) =>
    adapters[key] !== undefined
  );
}

function adapterErrors(adapters: ExtensionAdapters): string[] {
  const errors: string[] = [];
  if (adapters.cpu !== undefined && typeof adapters.cpu !== "function") {
    errors.push("cpu adapter must be a function");
  }
  if (
    adapters.gpu !== undefined &&
    typeof adapters.gpu.createPlan !== "function"
  ) {
    errors.push("gpu adapter must provide createPlan");
  }
  if (adapters.live !== undefined && !("value" in adapters.live)) {
    errors.push("live adapter must provide a value");
  }
  if (
    adapters.emit !== undefined &&
    (!adapters.emit.importFrom || !adapters.emit.exportName)
  ) {
    errors.push("emit adapter requires importFrom and exportName");
  }
  return errors;
}

/**
 * Host-owned static registry. Portable specs carry only definition ids;
 * executable adapters enter through explicit package imports and registration.
 */
export class ExtensionRegistry {
  readonly #entries = new Map<string, RegisteredExtension>();

  register(definition: ExtensionDefinition, adapters: ExtensionAdapters): this {
    const errors = validateExtension(definition);
    if (errors.length) {
      throw new Error(
        `Invalid extension ${definition.id}: ${errors.join("; ")}`,
      );
    }
    const serializable = serializableError(definition);
    if (serializable) {
      throw new Error(`Invalid extension ${definition.id}: ${serializable}`);
    }
    if (this.#entries.has(definition.id)) {
      throw new Error(`Duplicate extension id: ${definition.id}`);
    }

    const declared = [...(definition.capabilities ?? [])].sort();
    const supplied = adapterCapabilities(adapters).sort();
    if (declared.join("\0") !== supplied.join("\0")) {
      throw new Error(
        `Extension ${definition.id} adapter mismatch: declared [${
          declared.join(", ")
        }], supplied [${supplied.join(", ")}]`,
      );
    }
    const invalidAdapters = adapterErrors(adapters);
    if (invalidAdapters.length) {
      throw new Error(
        `Invalid extension ${definition.id}: ${invalidAdapters.join("; ")}`,
      );
    }
    const storedDefinition = structuredClone(definition);
    this.#entries.set(definition.id, {
      definition: storedDefinition,
      adapters: { ...adapters },
    });
    return this;
  }

  has(id: string): boolean {
    return this.#entries.has(id);
  }

  resolve(id: string): RegisteredExtension {
    const parsed = parseExtensionId(id);
    if (!parsed) throw new Error(`Invalid extension id: ${id}`);
    const exact = this.#entries.get(id);
    if (exact) return exact;
    const available = [...this.#entries.keys()].map(parseExtensionId).filter((
      value,
    ): value is ExtensionId => value?.contract === parsed.contract);
    if (available.length) {
      throw new Error(
        `Incompatible extension version: requested ${id}; available ${
          available.map((item) => item.id).sort().join(", ")
        }`,
      );
    }
    throw new Error(`Missing extension: ${id}`);
  }

  resolveLive(
    id: string,
  ): RegisteredExtension & {
    adapters: ExtensionAdapters & { live: LiveExtensionAdapter };
  } {
    const entry = this.resolve(id);
    if (!entry.adapters.live) {
      throw new Error(`Extension ${id} has no live adapter`);
    }
    return entry as RegisteredExtension & {
      adapters: ExtensionAdapters & { live: LiveExtensionAdapter };
    };
  }

  resolveEmit(
    id: string,
  ): RegisteredExtension & {
    adapters: ExtensionAdapters & { emit: EmitExtensionAdapter };
  } {
    const entry = this.resolve(id);
    if (!entry.adapters.emit) {
      throw new Error(`Extension ${id} has no emit adapter`);
    }
    return entry as RegisteredExtension & {
      adapters: ExtensionAdapters & { emit: EmitExtensionAdapter };
    };
  }

  /** Serializable registry manifest suitable for persistence and diagnostics. */
  manifest(): ExtensionDefinition[] {
    return [...this.#entries.values()].map(({ definition }) =>
      structuredClone(definition)
    );
  }
}
