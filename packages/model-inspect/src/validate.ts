import type {
  Dimension,
  GraphEdge,
  GraphNode,
  ModelDocument,
  ModelGraph,
  PayloadRef,
  ResidencySpec,
  TensorDescriptor,
  TensorStorage,
  TensorSummary,
  ValueRef,
} from "./types.ts";

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function validateDimension(
  dimension: Dimension,
  path: string,
  errors: string[],
) {
  if (finite(dimension)) {
    if (!Number.isInteger(dimension) || dimension < 0) {
      errors.push(`${path} must be a non-negative integer`);
    }
    return;
  }
  if (typeof dimension !== "object" || dimension === null) {
    errors.push(`${path} must be a number, symbol, or unknown dimension`);
    return;
  }
  const record = dimension as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 1 && typeof record.symbol === "string" && record.symbol) {
    if (hasOwn(record, "value") && !positiveInteger(record.value)) {
      errors.push(`${path}.value must be a non-negative integer`);
    }
    return;
  }
  if (keys.length === 1 && record.unknown === true) return;
  errors.push(`${path} is not a valid dimension`);
}

function validatePayload(payload: PayloadRef, path: string, errors: string[]) {
  if (!payload.sourceId) errors.push(`${path}.sourceId is required`);
  if (!positiveInteger(payload.byteOffset)) {
    errors.push(`${path}.byteOffset must be a non-negative integer`);
  }
  if (!positiveInteger(payload.byteLength)) {
    errors.push(`${path}.byteLength must be a non-negative integer`);
  }
}

function validateStorage(
  storage: TensorStorage,
  path: string,
  errors: string[],
) {
  validatePayload(storage, path, errors);
  if (!Array.isArray(storage.shape)) {
    errors.push(`${path}.shape must be an array`);
  } else {storage.shape.forEach((value, i) => {
      if (!positiveInteger(value)) {
        errors.push(`${path}.shape[${i}] must be a non-negative integer`);
      }
    });}
  if (storage.strides && !storage.strides.every(positiveInteger)) {
    errors.push(`${path}.strides must contain non-negative integers`);
  }
  if (storage.order === "strided" && !storage.strides) {
    errors.push(`${path}.strides is required for strided storage`);
  }
  if (
    storage.physical && storage.physical.conversion === "dequantize" &&
    !["i8", "u8", "i16", "u16"].includes(storage.dtype)
  ) {
    errors.push(`${path}.physical dequantize requires an integer source dtype`);
  }
}

function validateResidency(
  residency: ResidencySpec,
  path: string,
  errors: string[],
) {
  if (!residency.cacheKey) errors.push(`${path}.cacheKey is required`);
  if (residency.policy === "metadata" && residency.upload !== "never") {
    errors.push(`${path} metadata policy must use upload=never`);
  }
  if (
    residency.maxBytes !== undefined && !positiveInteger(residency.maxBytes)
  ) {
    errors.push(`${path}.maxBytes must be a non-negative integer`);
  }
}

function validateSummary(
  summary: TensorSummary,
  path: string,
  errors: string[],
) {
  if (!positiveInteger(summary.count)) {
    errors.push(`${path}.count must be a non-negative integer`);
  }
  for (
    const key of [
      "finiteCount",
      "min",
      "max",
      "mean",
      "standardDeviation",
      "sparsity",
    ] as const
  ) {
    const value = summary[key];
    if (value !== undefined && !finite(value)) {
      errors.push(`${path}.${key} must be finite`);
    }
  }
  if (
    summary.finiteCount !== undefined && summary.finiteCount > summary.count
  ) {
    errors.push(`${path}.finiteCount cannot exceed count`);
  }
  if (
    summary.sparsity !== undefined &&
    (summary.sparsity < 0 || summary.sparsity > 1)
  ) {
    errors.push(`${path}.sparsity must be between 0 and 1`);
  }
  if (summary.histogram) {
    if (summary.histogram.bins.length !== summary.histogram.counts.length) {
      errors.push(`${path}.histogram bins and counts must have equal length`);
    }
    if (
      !summary.histogram.bins.every(finite) ||
      !summary.histogram.counts.every(positiveInteger)
    ) {
      errors.push(`${path}.histogram values are invalid`);
    }
  }
}

function validateValue(value: ValueRef, path: string, errors: string[]) {
  if (!value.id) errors.push(`${path}.id is required`);
  value.shape?.forEach((dimension, i) =>
    validateDimension(dimension, `${path}.shape[${i}]`, errors)
  );
}

function validateNode(node: GraphNode, path: string, errors: string[]) {
  if (!node.id) errors.push(`${path}.id is required`);
  node.inputs.forEach((value, i) =>
    validateValue(value, `${path}.inputs[${i}]`, errors)
  );
  node.outputs.forEach((value, i) =>
    validateValue(value, `${path}.outputs[${i}]`, errors)
  );
  node.parameters?.forEach((tensorId, i) => {
    if (!tensorId) errors.push(`${path}.parameters[${i}] must be non-empty`);
  });
}

function validateGraph(graph: ModelGraph, path: string, errors: string[]) {
  if (!graph.id) errors.push(`${path}.id is required`);
  graph.inputs.forEach((value, i) =>
    validateValue(value, `${path}.inputs[${i}]`, errors)
  );
  graph.outputs.forEach((value, i) =>
    validateValue(value, `${path}.outputs[${i}]`, errors)
  );
  graph.nodes.forEach((node, i) =>
    validateNode(node, `${path}.nodes[${i}]`, errors)
  );
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const valueIds = new Set([
    ...graph.inputs.map((value) => value.id),
    ...graph.outputs.map((value) => value.id),
    ...graph.nodes.flatMap((node) => node.outputs.map((value) => value.id)),
  ]);
  graph.edges.forEach((edge: GraphEdge, i) => {
    const edgePath = `${path}.edges[${i}]`;
    if (!edge.id) errors.push(`${edgePath}.id is required`);
    if (!nodeIds.has(edge.from)) {
      errors.push(`${edgePath}.from references an unknown node`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`${edgePath}.to references an unknown node`);
    }
    if (edge.valueId && !valueIds.has(edge.valueId)) {
      errors.push(`${edgePath}.valueId references an unknown value`);
    }
  });
}

function validateTensor(
  tensor: TensorDescriptor,
  path: string,
  errors: string[],
) {
  if (!tensor.id) errors.push(`${path}.id is required`);
  if (!tensor.dtype) errors.push(`${path}.dtype is required`);
  if (!Array.isArray(tensor.shape)) {
    errors.push(`${path}.shape must be an array`);
  } else {tensor.shape.forEach((dimension, i) =>
      validateDimension(dimension, `${path}.shape[${i}]`, errors)
    );}
  if (tensor.byteLength !== undefined && !positiveInteger(tensor.byteLength)) {
    errors.push(`${path}.byteLength must be a non-negative integer`);
  }
  if (tensor.payload) {
    validatePayload(tensor.payload, `${path}.payload`, errors);
  }
  if (tensor.storage) {
    validateStorage(tensor.storage, `${path}.storage`, errors);
  }
  if (tensor.residency) {
    validateResidency(tensor.residency, `${path}.residency`, errors);
  }
  if (tensor.summary) {
    validateSummary(tensor.summary, `${path}.summary`, errors);
  }
  if (tensor.storage && tensor.storage.shape.length !== tensor.shape.length) {
    errors.push(`${path}.storage.shape rank must match tensor.shape`);
  }
}

/** Return all structural errors without throwing, suitable for loader diagnostics. */
export function validateModelDocument(document: ModelDocument): string[] {
  const errors: string[] = [];
  if (document.schema !== "gggplot.model@1") {
    errors.push("schema must be gggplot.model@1");
  }
  if (!document.id) errors.push("id is required");
  if (!document.source?.id) errors.push("source.id is required");
  if (!document.source?.format) errors.push("source.format is required");
  const tensorIds = new Set(Object.keys(document.tensors ?? {}));
  document.graphs?.forEach((graph, i) =>
    validateGraph(graph, `graphs[${i}]`, errors)
  );
  for (const [id, tensor] of Object.entries(document.tensors ?? {})) {
    if (id !== tensor.id) {
      errors.push(`tensors.${id}.id must match its map key`);
    }
    validateTensor(tensor, `tensors.${id}`, errors);
  }
  for (const graph of document.graphs ?? []) {
    for (const node of graph.nodes) {
      for (const tensorId of node.parameters ?? []) {
        if (!tensorIds.has(tensorId)) {
          errors.push(`node ${node.id} references unknown tensor ${tensorId}`);
        }
      }
    }
  }
  return errors;
}

export function assertValidModelDocument(document: ModelDocument): void {
  const errors = validateModelDocument(document);
  if (errors.length) {
    throw new Error(`Invalid model document: ${errors.join("; ")}`);
  }
}
