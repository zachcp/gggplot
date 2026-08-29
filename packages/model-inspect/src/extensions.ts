import type { ExtensionDefinition, FieldSpec } from "@gggplot/core/plan";
import type { ModelDocument } from "./types.ts";
import type { TensorSource } from "./residency.ts";
import {
  buildGeometryProduct,
  buildTensorContentProduct,
  type TensorViewRequest,
} from "./products.ts";
import { buildModelScene3D } from "./scene3d.ts";

/**
 * Extension definitions for model inspection.
 *
 * The taxonomy question this answers is which products are ordinary charts and
 * which are specialized scene views:
 *
 * | Extension | Class | Why |
 * | --- | --- | --- |
 * | `model_tensor_inventory` | ordinary | One row per tensor. It is a bar chart over a table and needs no special renderer. |
 * | `model_graph` | specialized | Topology, not rows: nodes, ports, and routed edges have no tabular equivalent. |
 * | `model_tensor_matrix` | specialized | A bounded grid whose content policy decides the representation before anything is drawn. |
 * | `model_scene_3d` | specialized | Slabs, modules, and connectors positioned in space. |
 *
 * `model_embedding`, `model_activation`, and `model_attention` are named in the
 * design but are deliberately NOT registered here. An embedding is an ordinary
 * point chart once something produces the coordinates, and activations and
 * attention both require runtime capture, which is not wired up. Registering
 * them now would declare capability the package cannot honour.
 *
 * Every definition declares `cpu` only. This package computes products; it does
 * not render. A host that draws them registers `live`/`emit` adapters over
 * these same definitions, which keeps framework-specific rendering out of both
 * core and this package.
 */

const tensorField = (name: string, dtype: FieldSpec["dtype"]): FieldSpec => ({
  name,
  dtype,
  shape: "row",
  dimensions: ["tensor"],
  role: "output",
});

export const MODEL_GRAPH_EXTENSION: ExtensionDefinition = {
  id: "@gggplot/model-inspect:model_graph@1",
  kind: "geom",
  requiredAes: ["x", "y"],
  optionalAes: ["color", "label", "group"],
  missingValues: "error",
  scope: "plot",
  outputFields: [
    { name: "x", dtype: "f32", shape: "row", dimensions: ["node"] },
    { name: "y", dtype: "f32", shape: "row", dimensions: ["node"] },
    {
      name: "edges",
      dtype: "u32",
      shape: "topology",
      dimensions: ["edge"],
      role: "topology",
    },
  ],
  capabilities: ["cpu"],
};

export const MODEL_TENSOR_MATRIX_EXTENSION: ExtensionDefinition = {
  id: "@gggplot/model-inspect:model_tensor_matrix@1",
  kind: "geom",
  requiredAes: ["x", "y", "fill"],
  missingValues: "propagate",
  scope: "plot",
  parameters: {
    // The representation is a policy outcome, not a user preference: "auto"
    // lets the budget decide, and naming a mode still cannot exceed it.
    mode: {
      type: "enum",
      default: "auto",
      values: ["auto", "exact", "tile", "downsample", "summary", "metadata"],
    },
  },
  outputFields: [
    { name: "value", dtype: "f32", shape: "grid", dimensions: ["row", "col"] },
  ],
  capabilities: ["cpu"],
};

export const MODEL_TENSOR_INVENTORY_EXTENSION: ExtensionDefinition = {
  id: "@gggplot/model-inspect:model_tensor_inventory@1",
  kind: "geom",
  requiredAes: ["x", "y"],
  optionalAes: ["fill"],
  missingValues: "drop",
  scope: "plot",
  parameters: {
    limit: { type: "number", default: 12 },
  },
  outputFields: [
    tensorField("tensor", "factor"),
    tensorField("bytes", "f32"),
  ],
  capabilities: ["cpu"],
};

export const MODEL_SCENE_3D_EXTENSION: ExtensionDefinition = {
  id: "@gggplot/model-inspect:model_scene_3d@1",
  kind: "geom",
  requiredAes: ["x", "y", "z"],
  optionalAes: ["color", "label"],
  missingValues: "error",
  scope: "plot",
  outputFields: [
    { name: "x", dtype: "f32", shape: "row", dimensions: ["slab"] },
    { name: "y", dtype: "f32", shape: "row", dimensions: ["slab"] },
    { name: "z", dtype: "f32", shape: "row", dimensions: ["slab"] },
    {
      name: "connectors",
      dtype: "u32",
      shape: "topology",
      dimensions: ["connector"],
      role: "topology",
    },
  ],
  capabilities: ["cpu"],
};

export const MODEL_EXTENSIONS: readonly ExtensionDefinition[] = [
  MODEL_GRAPH_EXTENSION,
  MODEL_TENSOR_MATRIX_EXTENSION,
  MODEL_TENSOR_INVENTORY_EXTENSION,
  MODEL_SCENE_3D_EXTENSION,
];

/** Tabular rows for the inventory extension; no payload read is required. */
export function modelTensorInventoryRows(
  document: ModelDocument,
  limit = 12,
): { tensor: string; bytes: number }[] {
  return Object.values(document.tensors)
    .filter((tensor) =>
      tensor.role === "parameter" && (tensor.byteLength ?? 0) > 0
    )
    .map((tensor) => ({
      tensor: tensor.name ?? tensor.id,
      bytes: tensor.byteLength ?? 0,
    }))
    .sort((a, b) => b.bytes - a.bytes || a.tensor.localeCompare(b.tensor))
    .slice(0, limit);
}

/** The context every model CPU adapter is invoked with. */
export interface ModelAdapterContext {
  document: ModelDocument;
  limit?: number;
  /** Required only by the matrix adapter, which reads a bounded range. */
  sources?: TensorSource | ReadonlyMap<string, TensorSource>;
  request?: TensorViewRequest;
}

function modelContext(context: unknown): ModelAdapterContext {
  const candidate = context as Partial<ModelAdapterContext> | null;
  if (!candidate?.document) {
    throw new TypeError("model extension adapters require a { document }");
  }
  return candidate as ModelAdapterContext;
}

/**
 * CPU adapters keyed by extension id, ready to hand to an ExtensionRegistry.
 *
 * The registry types adapters as `(context: unknown) => unknown` because core
 * cannot know any package's context shape, so each adapter validates its own
 * input rather than trusting an unchecked cast.
 */
export const MODEL_CPU_ADAPTERS: Readonly<
  Partial<Record<string, (context: unknown) => unknown>>
> = {
  [MODEL_GRAPH_EXTENSION.id]: (context) =>
    buildGeometryProduct(modelContext(context).document),
  [MODEL_SCENE_3D_EXTENSION.id]: (context) =>
    buildModelScene3D(modelContext(context).document),
  [MODEL_TENSOR_INVENTORY_EXTENSION.id]: (context) => {
    const resolved = modelContext(context);
    return modelTensorInventoryRows(resolved.document, resolved.limit);
  },
  [MODEL_TENSOR_MATRIX_EXTENSION.id]: (context) => {
    const resolved = modelContext(context);
    // Unlike the others this one reads bytes, so it cannot be invoked from a
    // document alone. Saying so beats returning an empty product.
    if (!resolved.sources || !resolved.request) {
      throw new TypeError(
        "model_tensor_matrix requires { sources, request } beside the document",
      );
    }
    return buildTensorContentProduct(
      resolved.document,
      resolved.sources,
      resolved.request,
    );
  },
};
