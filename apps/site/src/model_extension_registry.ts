import { ExtensionRegistry } from "@gggplot/core/plan";
import type { ExtensionDefinition } from "@gggplot/core/plan";
import {
  MODEL_CPU_ADAPTERS,
  MODEL_EXTENSIONS,
  MODEL_GRAPH_EXTENSION,
  MODEL_SCENE_3D_EXTENSION,
  MODEL_TENSOR_INVENTORY_EXTENSION,
  MODEL_TENSOR_MATRIX_EXTENSION,
} from "@gggplot/model-inspect";
import { modelGraphSpec } from "./model_graph.ts";
import { modelScene3dSpec } from "./model_scene_3d.ts";
import { tensorInventorySpec, tensorMatrixSpec } from "./model_tensor_views.ts";

/**
 * Where the portable definitions meet a renderer.
 *
 * @gggplot/model-inspect declares `cpu` only — it computes products and does
 * not draw them. The spec builders that turn those products into a gggplot
 * chart live here, in the host, so neither core nor the inspection package
 * carries framework-specific rendering. Registering them as `live`/`emit`
 * adapters is what makes that boundary explicit rather than conventional.
 *
 * `emit` names a static import rather than a serialized closure, so emitted
 * source can resolve the same builder without this module being present.
 */
const LIVE_BUILDERS: Record<string, unknown | undefined> = {
  [MODEL_GRAPH_EXTENSION.id]: modelGraphSpec,
  [MODEL_SCENE_3D_EXTENSION.id]: modelScene3dSpec,
  [MODEL_TENSOR_INVENTORY_EXTENSION.id]: tensorInventorySpec,
  [MODEL_TENSOR_MATRIX_EXTENSION.id]: tensorMatrixSpec,
};

const EMIT_EXPORTS: Record<
  string,
  { importFrom: string; exportName: string } | undefined
> = {
  [MODEL_GRAPH_EXTENSION.id]: {
    importFrom: "./model_graph.ts",
    exportName: "modelGraphSpec",
  },
  [MODEL_SCENE_3D_EXTENSION.id]: {
    importFrom: "./model_scene_3d.ts",
    exportName: "modelScene3dSpec",
  },
  [MODEL_TENSOR_INVENTORY_EXTENSION.id]: {
    importFrom: "./model_tensor_views.ts",
    exportName: "tensorInventorySpec",
  },
  [MODEL_TENSOR_MATRIX_EXTENSION.id]: {
    importFrom: "./model_tensor_views.ts",
    exportName: "tensorMatrixSpec",
  },
};

/**
 * A render extension must declare live and emit together, so the host
 * republishes each package definition with both capabilities rather than
 * mutating what the package exported.
 */
export function renderableDefinition(
  definition: ExtensionDefinition,
): ExtensionDefinition {
  const capabilities = new Set(definition.capabilities ?? []);
  capabilities.add("live");
  capabilities.add("emit");
  return { ...definition, capabilities: [...capabilities] };
}

export function createModelExtensionRegistry(): ExtensionRegistry {
  const registry = new ExtensionRegistry();
  for (const definition of MODEL_EXTENSIONS) {
    const live = LIVE_BUILDERS[definition.id];
    const emit = EMIT_EXPORTS[definition.id];
    const cpu = MODEL_CPU_ADAPTERS[definition.id];
    if (!live || !emit) {
      // No renderer for this definition yet: register it as the package
      // declared it rather than claiming a capability the host cannot honour.
      registry.register(definition, cpu ? { cpu } : {});
      continue;
    }
    registry.register(renderableDefinition(definition), {
      ...(cpu ? { cpu } : {}),
      live: { value: live },
      emit,
    });
  }
  return registry;
}
