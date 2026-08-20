import { tensorRangeCacheKey, type TensorSource } from "./residency.ts";
import type {
  Dimension,
  ModelDocument,
  ModelDType,
  ModelGraph,
  RuntimeArtifact,
  TensorDescriptor,
  TensorSummary,
  ValueRef,
} from "./types.ts";

export type GeometryEntityKind = "graph" | "node" | "port" | "edge" | "tensor";

export interface GeometryEntityRef {
  index: number;
  kind: GeometryEntityKind;
  id: string;
  nodeId?: string;
  tensorId?: string;
  valueId?: string;
}

export interface GeometryBlock {
  id: string;
  entityIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  label: string;
  parameterCount: number;
}

export interface GeometryNodeInstance {
  id: string;
  entityIndex: number;
  nodeId: string;
  kind: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  label: string;
  op?: string;
  parameterCount: number;
}

export interface GeometryPortInstance {
  id: string;
  entityIndex: number;
  nodeId: string;
  valueId: string;
  tensorId?: string;
  direction: "input" | "output";
  index: number;
  x: number;
  y: number;
  z: number;
  byteLength?: number;
  dtype?: ModelDType;
  shape?: Dimension[];
}

export interface GeometryEdgeSegment {
  id: string;
  entityIndex: number;
  edgeId: string;
  valueId?: string;
  tensorId?: string;
  fromPortId: string;
  toPortId: string;
  /** A 2.5D elbow with a deterministic residual lane. */
  points: Array<{ x: number; y: number; z: number }>;
}

export interface GeometryLabel {
  id: string;
  entityIndex: number;
  text: string;
  x: number;
  y: number;
  z: number;
  targetId: string;
}

/** Serializable scene data: no GPU handles and no tensor values. */
export interface GeometryProduct {
  kind: "geom_loading";
  documentId: string;
  graphId: string;
  layoutKey: string;
  entities: GeometryEntityRef[];
  blocks: GeometryBlock[];
  nodes: GeometryNodeInstance[];
  ports: GeometryPortInstance[];
  edges: GeometryEdgeSegment[];
  labels: GeometryLabel[];
}

function graphFor(document: ModelDocument, graphId?: string): ModelGraph {
  const graph = graphId
    ? document.graphs.find((candidate) => candidate.id === graphId)
    : document.graphs[0];
  if (!graph) throw new RangeError(`Unknown graph ${graphId ?? "<first>"}`);
  return graph;
}

function staticElementCount(shape: Dimension[] | undefined): number {
  if (!shape || !shape.every((dimension) => typeof dimension === "number")) {
    return 0;
  }
  return shape.reduce((count, dimension) => count * (dimension as number), 1);
}

function parameterCount(
  document: ModelDocument,
  tensorIds: readonly string[] | undefined,
): number {
  return (tensorIds ?? []).reduce(
    (count, id) => count + staticElementCount(document.tensors[id]?.shape),
    0,
  );
}

function layerDepths(graph: ModelGraph): Map<string, number> {
  const depths = new Map(
    graph.nodes.map((
      node,
    ) => [node.id, node.kind === "input" || node.kind === "constant" ? 0 : 1]),
  );
  // ONNX nodes are normally topological. Iterate enough times to also make a
  // deterministic best effort for an unordered or partially cyclic graph.
  for (let pass = 0; pass < graph.nodes.length; pass++) {
    let changed = false;
    for (const edge of graph.edges) {
      const next = Math.max(
        depths.get(edge.to) ?? 1,
        (depths.get(edge.from) ?? 0) + 1,
      );
      if (next !== depths.get(edge.to)) {
        depths.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return depths;
}

/**
 * Build the small, GPU-friendly geometry vocabulary for a model graph.
 * The host may pack these instances into buffers or use a different renderer.
 */
export function buildGeometryProduct(
  document: ModelDocument,
  options: { graphId?: string; layerGap?: number; laneGap?: number } = {},
): GeometryProduct {
  const graph = graphFor(document, options.graphId);
  const layerGap = options.layerGap ?? 3;
  const laneGap = options.laneGap ?? 1.6;
  if (!(layerGap > 0) || !(laneGap > 0)) {
    throw new RangeError("Geometry gaps must be positive");
  }
  const entities: GeometryEntityRef[] = [];
  const entity = (
    kind: GeometryEntityKind,
    id: string,
    extra: Omit<GeometryEntityRef, "index" | "kind" | "id"> = {},
  ) => {
    const value = { index: entities.length, kind, id, ...extra };
    entities.push(value);
    return value.index;
  };
  const depths = layerDepths(graph);
  const lanes = new Map<number, number>();
  const nodes: GeometryNodeInstance[] = graph.nodes.map((node) => {
    const depth = depths.get(node.id) ?? 0;
    const lane = lanes.get(depth) ?? 0;
    lanes.set(depth, lane + 1);
    const count = parameterCount(document, node.parameters);
    return {
      id: `geometry:${node.id}`,
      entityIndex: entity("node", node.id, { nodeId: node.id }),
      nodeId: node.id,
      kind: node.kind,
      x: depth * layerGap,
      y: lane * laneGap,
      z: node.kind === "constant" ? -0.2 : node.kind === "output" ? 0.2 : 0,
      width: 1.6,
      height: Math.max(
        0.8,
        0.55 + Math.max(node.inputs.length, node.outputs.length) * 0.16,
      ),
      label: node.name ?? node.op ?? node.id,
      op: node.op,
      parameterCount: count,
    };
  });
  const byNodeId = new Map(nodes.map((node) => [node.nodeId, node]));
  const ports: GeometryPortInstance[] = [];
  const outputPort = new Map<string, string>();
  const inputPort = new Map<string, string>();
  const portFor = (
    node: GeometryNodeInstance,
    direction: "input" | "output",
    value: ValueRef,
    index: number,
  ) => {
    const descriptor = value.tensorId
      ? document.tensors[value.tensorId]
      : undefined;
    const id = `geometry:${node.nodeId}:${direction}:${index}`;
    const instance: GeometryPortInstance = {
      id,
      entityIndex: entity("port", id, {
        nodeId: node.nodeId,
        tensorId: value.tensorId,
        valueId: value.id,
      }),
      nodeId: node.nodeId,
      valueId: value.id,
      tensorId: value.tensorId,
      direction,
      index,
      x: node.x + (direction === "input" ? -node.width / 2 : node.width / 2),
      y: node.y +
        ((index + 1) /
              (direction === "input"
                ? Math.max(
                  1,
                  (graph.nodes.find((candidate) => candidate.id === node.nodeId)
                    ?.inputs.length ?? 0) + 1,
                )
                : Math.max(
                  1,
                  (graph.nodes.find((candidate) => candidate.id === node.nodeId)
                    ?.outputs.length ?? 0) + 1,
                )) - 0.5) * node.height,
      z: node.z + 0.05,
      byteLength: descriptor?.byteLength,
      dtype: descriptor?.dtype ?? value.dtype,
      shape: descriptor?.shape ?? value.shape,
    };
    ports.push(instance);
    (direction === "input" ? inputPort : outputPort).set(
      `${node.nodeId}:${value.id}`,
      id,
    );
  };
  for (const graphNode of graph.nodes) {
    const node = byNodeId.get(graphNode.id)!;
    graphNode.inputs.forEach((value, index) =>
      portFor(node, "input", value, index)
    );
    graphNode.outputs.forEach((value, index) =>
      portFor(node, "output", value, index)
    );
  }
  const portById = new Map(ports.map((port) => [port.id, port]));
  const edges: GeometryEdgeSegment[] = graph.edges.flatMap((edge, index) => {
    if (!edge.valueId) return [];
    const fromPortId = outputPort.get(`${edge.from}:${edge.valueId}`);
    const toPortId = inputPort.get(`${edge.to}:${edge.valueId}`);
    if (!fromPortId || !toPortId) return [];
    const from = portById.get(fromPortId)!;
    const to = portById.get(toPortId)!;
    const bendX = (from.x + to.x) / 2;
    const residualLane = Math.abs(to.x - from.x) > layerGap * 1.5
      ? (index % 4 + 1) * 0.14
      : 0;
    const id = `geometry:${edge.id}`;
    return [{
      id,
      entityIndex: entity("edge", edge.id, {
        tensorId: edge.tensorId,
        valueId: edge.valueId,
      }),
      edgeId: edge.id,
      valueId: edge.valueId,
      tensorId: edge.tensorId,
      fromPortId,
      toPortId,
      points: [
        { x: from.x, y: from.y, z: from.z },
        {
          x: bendX,
          y: from.y - residualLane,
          z: Math.max(from.z, to.z) - 0.05,
        },
        { x: bendX, y: to.y - residualLane, z: Math.max(from.z, to.z) - 0.05 },
        { x: to.x, y: to.y, z: to.z },
      ],
    }];
  });
  const maxX = Math.max(0, ...nodes.map((node) => node.x + node.width / 2));
  const maxY = Math.max(0, ...nodes.map((node) => node.y + node.height / 2));
  const blocks: GeometryBlock[] = [{
    id: `geometry:${graph.id}:block`,
    entityIndex: entity("graph", graph.id),
    x: -1.25,
    y: -0.9,
    width: maxX + 2.5,
    height: maxY + 1.8,
    depth: -0.5,
    label: graph.name ?? graph.id,
    parameterCount: Object.values(document.tensors).filter((tensor) =>
      tensor.role === "parameter"
    ).reduce((count, tensor) => count + staticElementCount(tensor.shape), 0),
  }];
  const scopedNodes = new Map<string, GeometryNodeInstance[]>();
  for (const graphNode of graph.nodes) {
    const scope = graphNode.scopePath?.join("/") ??
      (graphNode.parentId ? `parent:${graphNode.parentId}` : undefined);
    if (!scope) continue;
    const node = byNodeId.get(graphNode.id)!;
    // Create every scope prefix, so an adapter can provide a nested module
    // path without the geometry layer needing synthetic module nodes.
    const prefixes = scope.startsWith("parent:")
      ? [scope]
      : scope.split("/").map((_, index, parts) =>
        parts.slice(0, index + 1).join("/")
      );
    for (const prefix of prefixes) {
      const members = scopedNodes.get(prefix) ?? [];
      members.push(node);
      scopedNodes.set(prefix, members);
    }
  }
  for (const [scope, members] of scopedNodes) {
    const minX = Math.min(...members.map((node) => node.x - node.width / 2)) -
      0.22;
    const maxScopeX = Math.max(...members.map((node) =>
      node.x + node.width / 2
    )) + 0.22;
    const minY = Math.min(...members.map((node) => node.y - node.height / 2)) -
      0.22;
    const maxScopeY =
      Math.max(...members.map((node) => node.y + node.height / 2)) + 0.22;
    blocks.push({
      id: `geometry:${graph.id}:scope:${scope}`,
      entityIndex: entity("graph", `${graph.id}:scope:${scope}`),
      x: minX,
      y: minY,
      width: maxScopeX - minX,
      height: maxScopeY - minY,
      depth: -0.35,
      label: scope,
      parameterCount: members.reduce(
        (count, node) => count + node.parameterCount,
        0,
      ),
    });
  }
  const labels: GeometryLabel[] = nodes.map((node) => ({
    id: `geometry:${node.nodeId}:label`,
    entityIndex: entity("node", `${node.nodeId}:label`, {
      nodeId: node.nodeId,
    }),
    text: node.label,
    x: node.x,
    y: node.y + node.height / 2 + 0.16,
    z: node.z + 0.1,
    targetId: node.nodeId,
  }));
  return {
    kind: "geom_loading",
    documentId: document.id,
    graphId: graph.id,
    layoutKey: `${graph.id}:${nodes.length}:${edges.length}`,
    entities,
    blocks,
    nodes,
    ports,
    edges,
    labels,
  };
}

export type TensorTarget = { kind: "tensor"; tensorId: string } | {
  kind: "artifact";
  artifactId: string;
};
export type TensorContentRepresentation =
  | "exact"
  | "tile"
  | "downsample"
  | "summary"
  | "metadata";

export interface ContentBudget {
  maxResidentBytes: number;
  maxExactBytes: number;
  maxTileBytes: number;
  maxOverviewCells: number;
  maxDownsampleReadBytes: number;
  maxSummarySamples: number;
  maxExactRank: number;
  maxSliceRank: number;
  maxReadbackBytes: number;
}

export const DEFAULT_CONTENT_BUDGET: ContentBudget = {
  maxResidentBytes: 16 * 1024 * 1024,
  maxExactBytes: 4 * 1024 * 1024,
  maxTileBytes: 4 * 1024 * 1024,
  maxOverviewCells: 512 * 512,
  maxDownsampleReadBytes: 8 * 1024 * 1024,
  maxSummarySamples: 2048,
  maxExactRank: 2,
  maxSliceRank: 4,
  maxReadbackBytes: 0,
};

export interface TensorViewRequest {
  target: TensorTarget;
  axes?: [number] | [number, number];
  fixedIndices?: Record<number, number>;
  tile?: {
    rowStart: number;
    rowCount: number;
    columnStart?: number;
    columnCount?: number;
  };
  mode?: "auto" | TensorContentRepresentation;
  budget?: Partial<ContentBudget>;
}

export interface TensorViewLayout {
  sourceId: string;
  sourceVersion: string;
  byteOffset: number;
  byteLength: number;
  dtype: ModelDType;
  shape: number[];
  axes: number[];
  fixedIndices: Record<number, number>;
  cacheKey: string;
}

export interface TensorContentProduct {
  kind: "matrix_content";
  target: TensorTarget;
  representation: TensorContentRepresentation;
  descriptor: TensorDescriptor;
  layout?: TensorViewLayout;
  /** Exact/tile/downsample values, serialized separately from geometry. */
  values?: number[];
  gridShape?: [number, number];
  summary?: TensorSummary;
  diagnostics: string[];
}

function numericWidth(dtype: ModelDType): number | undefined {
  return ({
    f16: 2,
    f32: 4,
    f64: 8,
    bf16: 2,
    i8: 1,
    i16: 2,
    i32: 4,
    u8: 1,
    u16: 2,
    u32: 4,
    bool: 1,
  } as Record<string, number>)[dtype];
}

function resolvedDescriptor(
  document: ModelDocument,
  target: TensorTarget,
): TensorDescriptor | undefined {
  if (target.kind === "tensor") return document.tensors[target.tensorId];
  const artifact = document.artifacts?.find((candidate) =>
    candidate.id === target.artifactId
  );
  return artifact && descriptorFromArtifact(artifact);
}

function descriptorFromArtifact(artifact: RuntimeArtifact): TensorDescriptor {
  return {
    id: artifact.id,
    dtype: artifact.dtype ?? "unknown",
    shape: artifact.shape ?? [{ unknown: true }],
    role: artifact.kind === "activation"
      ? "activation"
      : artifact.kind === "embedding"
      ? "buffer"
      : "output",
    payload: artifact.payload,
    storage: artifact.storage,
    residency: artifact.residency,
    metadata: artifact.metadata,
  };
}

function staticShape(shape: Dimension[]): number[] | undefined {
  return shape.every((dimension) => typeof dimension === "number")
    ? shape as number[]
    : undefined;
}

function mergedBudget(
  overrides: Partial<ContentBudget> | undefined,
): ContentBudget {
  const budget = { ...DEFAULT_CONTENT_BUDGET, ...overrides };
  for (const [key, value] of Object.entries(budget)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(
        `Content budget ${key} must be a non-negative safe integer`,
      );
    }
  }
  return budget;
}

function sourceFor(
  sources: TensorSource | ReadonlyMap<string, TensorSource>,
  sourceId: string,
): TensorSource | undefined {
  if ("readRange" in sources) {
    return sources.id === sourceId ? sources : undefined;
  }
  return sources.get(sourceId);
}

function decodeValue(
  view: DataView,
  offset: number,
  dtype: ModelDType,
): number {
  switch (dtype) {
    case "f32":
      return view.getFloat32(offset, true);
    case "f64":
      return view.getFloat64(offset, true);
    case "i8":
      return view.getInt8(offset);
    case "u8":
    case "bool":
      return view.getUint8(offset);
    case "i16":
      return view.getInt16(offset, true);
    case "u16":
      return view.getUint16(offset, true);
    case "i32":
      return view.getInt32(offset, true);
    case "u32":
      return view.getUint32(offset, true);
    case "f16":
    case "bf16": {
      const bits = view.getUint16(offset, true);
      if (dtype === "bf16") {
        return new Float32Array(new Uint32Array([bits << 16]).buffer)[0];
      }
      const sign = bits & 0x8000 ? -1 : 1;
      const exponent = (bits >> 10) & 0x1f;
      const fraction = bits & 0x3ff;
      return exponent === 0
        ? sign * 2 ** -14 * (fraction / 1024)
        : exponent === 31
        ? (fraction ? NaN : sign * Infinity)
        : sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
    }
    default:
      throw new RangeError(
        `Tensor dtype ${dtype} is not supported for numeric inspection`,
      );
  }
}

function summary(values: readonly number[]): TensorSummary {
  const finite = values.filter(Number.isFinite);
  const mean = finite.length
    ? finite.reduce((total, value) => total + value, 0) / finite.length
    : undefined;
  return {
    count: values.length,
    finiteCount: finite.length,
    min: finite.length ? Math.min(...finite) : undefined,
    max: finite.length ? Math.max(...finite) : undefined,
    mean,
    standardDeviation: mean === undefined ? undefined : Math.sqrt(
      finite.reduce((total, value) => total + (value - mean) ** 2, 0) /
        finite.length,
    ),
    sparsity: values.length
      ? values.filter((value) => value === 0).length / values.length
      : undefined,
  };
}

function chooseRepresentation(
  descriptor: TensorDescriptor,
  shape: number[] | undefined,
  byteLength: number | undefined,
  source: TensorSource | undefined,
  request: TensorViewRequest,
  budget: ContentBudget,
): TensorContentRepresentation {
  if (request.mode === "metadata") return "metadata";
  const width = numericWidth(descriptor.dtype);
  if (
    !source || !descriptor.payload || !shape || !width ||
    byteLength === undefined
  ) return "metadata";
  if (request.mode && request.mode !== "auto") return request.mode;
  if (
    shape.length <= budget.maxExactRank &&
    byteLength <= Math.min(budget.maxExactBytes, budget.maxResidentBytes)
  ) return "exact";
  if (
    shape.length <= budget.maxSliceRank && request.axes &&
    byteLength > budget.maxExactBytes
  ) return "tile";
  if (
    shape.length <= budget.maxSliceRank &&
    byteLength <= budget.maxDownsampleReadBytes
  ) return "downsample";
  return "summary";
}

function selectedBaseElement(
  shape: number[],
  axes: number[],
  fixedIndices: Record<number, number>,
): { base: number } | { diagnostic: string } {
  if (
    new Set(axes).size !== axes.length ||
    axes.some((axis) =>
      !Number.isSafeInteger(axis) || axis < 0 || axis >= shape.length
    )
  ) {
    return {
      diagnostic: "Displayed tensor axes must be distinct, in-range integers.",
    };
  }
  const expected = shape.length === 1
    ? [0]
    : [shape.length - 2, shape.length - 1];
  if (
    axes.length !== expected.length ||
    axes.some((axis, index) => axis !== expected[index])
  ) {
    return {
      diagnostic:
        "The first bounded matrix view supports the trailing display axes only.",
    };
  }
  let base = 0;
  for (let axis = 0; axis < shape.length; axis++) {
    if (axes.includes(axis)) continue;
    const index = fixedIndices[axis];
    if (!Number.isSafeInteger(index) || index < 0 || index >= shape[axis]) {
      return {
        diagnostic: `Tensor axis ${axis} requires a fixed index in [0, ${
          shape[axis]
        }).`,
      };
    }
    base += index *
      shape.slice(axis + 1).reduce(
        (product, dimension) => product * dimension,
        1,
      );
  }
  return { base };
}

function viewLayout(
  descriptor: TensorDescriptor,
  source: TensorSource,
  shape: number[],
  axes: number[],
  fixedIndices: Record<number, number>,
  byteOffset: number,
  byteLength: number,
): TensorViewLayout {
  return {
    sourceId: source.id,
    sourceVersion: source.version,
    byteOffset,
    byteLength,
    dtype: descriptor.dtype,
    shape,
    axes,
    fixedIndices,
    cacheKey: tensorRangeCacheKey({
      sourceId: source.id,
      sourceVersion: source.version,
      byteOffset,
      byteLength,
      dtype: descriptor.dtype,
      shape,
    }),
  };
}

async function readValues(
  source: TensorSource,
  layout: TensorViewLayout,
): Promise<number[]> {
  const bytes = await source.readRange({
    sourceId: source.id,
    sourceVersion: source.version,
    byteOffset: layout.byteOffset,
    byteLength: layout.byteLength,
    dtype: layout.dtype,
    shape: layout.shape,
  });
  const width = numericWidth(layout.dtype)!;
  const view = new DataView(bytes);
  const result: number[] = [];
  for (let offset = 0; offset + width <= view.byteLength; offset += width) {
    result.push(decodeValue(view, offset, layout.dtype));
  }
  return result;
}

/** Select bounded tensor data; no GPU resource is created by this function. */
export async function buildTensorContentProduct(
  document: ModelDocument,
  sources: TensorSource | ReadonlyMap<string, TensorSource>,
  request: TensorViewRequest,
): Promise<TensorContentProduct> {
  const descriptor = resolvedDescriptor(document, request.target);
  if (!descriptor) {
    throw new RangeError(
      `Unknown ${request.target.kind} ${
        request.target.kind === "tensor"
          ? request.target.tensorId
          : request.target.artifactId
      }`,
    );
  }
  const budget = mergedBudget(request.budget);
  const shape = staticShape(descriptor.shape);
  const source = descriptor.payload
    ? sourceFor(sources, descriptor.payload.sourceId)
    : undefined;
  const byteLength = descriptor.payload?.byteLength ?? descriptor.byteLength;
  const representation = chooseRepresentation(
    descriptor,
    shape,
    byteLength,
    source,
    request,
    budget,
  );
  const diagnostics: string[] = [];
  if (!shape) {
    diagnostics.push(
      "Tensor has symbolic or unknown dimensions; content remains metadata-only.",
    );
  }
  if (!source || !descriptor.payload) {
    diagnostics.push(
      "Tensor payload source is unavailable; content remains metadata-only.",
    );
  }
  if (!numericWidth(descriptor.dtype)) {
    diagnostics.push(
      `Tensor dtype ${descriptor.dtype} is not numeric-inspectable.`,
    );
  }
  if (representation === "metadata") {
    return {
      kind: "matrix_content",
      target: request.target,
      representation,
      descriptor,
      diagnostics,
    };
  }
  const axes = request.axes ??
    (shape!.length === 1 ? [0] : [shape!.length - 2, shape!.length - 1]);
  const fixedIndices = request.fixedIndices ?? {};
  const selection = selectedBaseElement(shape!, axes, fixedIndices);
  if ("diagnostic" in selection) {
    return {
      kind: "matrix_content",
      target: request.target,
      representation: "metadata",
      descriptor,
      diagnostics: [...diagnostics, selection.diagnostic],
    };
  }
  const payload = descriptor.payload!;
  if (
    representation === "exact" &&
    payload.byteLength > Math.min(budget.maxExactBytes, budget.maxResidentBytes)
  ) {
    return {
      kind: "matrix_content",
      target: request.target,
      representation: "summary",
      descriptor,
      diagnostics: [
        ...diagnostics,
        "Exact content exceeds the configured residency budget.",
      ],
    };
  }
  if (representation === "exact") {
    const layout = viewLayout(
      descriptor,
      source!,
      shape!,
      axes,
      fixedIndices,
      payload.byteOffset,
      payload.byteLength,
    );
    return {
      kind: "matrix_content",
      target: request.target,
      representation,
      descriptor,
      layout,
      values: await readValues(source!, layout),
      gridShape: shape!.length === 1
        ? [shape![0], 1]
        : [shape![shape!.length - 2], shape![shape!.length - 1]],
      diagnostics,
    };
  }
  if (representation === "tile") {
    const rows = shape![axes[0]];
    const columns = axes.length === 2 ? shape![axes[1]] : 1;
    const tile = request.tile ?? {
      rowStart: 0,
      rowCount: Math.min(
        rows,
        Math.max(
          1,
          Math.floor(
            budget.maxTileBytes /
              (numericWidth(descriptor.dtype)! * Math.max(1, columns)),
          ),
        ),
      ),
      columnStart: 0,
      columnCount: columns,
    };
    const columnStart = tile.columnStart ?? 0;
    const columnCount = tile.columnCount ?? columns;
    if (
      !Number.isSafeInteger(tile.rowStart) ||
      !Number.isSafeInteger(tile.rowCount) ||
      !Number.isSafeInteger(columnStart) ||
      !Number.isSafeInteger(columnCount) || tile.rowStart < 0 ||
      tile.rowCount < 1 || columnStart < 0 || columnCount < 1 ||
      tile.rowStart + tile.rowCount > rows ||
      columnStart + columnCount > columns
    ) {
      throw new RangeError(
        "Tensor tile is outside the selected matrix dimensions",
      );
    }
    const width = numericWidth(descriptor.dtype)!;
    // A contiguous span includes row padding when selecting a partial width;
    // this keeps the source read bounded and lets the view stride on-GPU.
    const startElement = tile.rowStart * columns + columnStart;
    const endElement = (tile.rowStart + tile.rowCount - 1) * columns +
      columnStart + columnCount;
    const spanBytes = (endElement - startElement) * width;
    if (
      spanBytes > budget.maxTileBytes || spanBytes > budget.maxResidentBytes
    ) {
      return {
        kind: "matrix_content",
        target: request.target,
        representation: "summary",
        descriptor,
        diagnostics: [
          ...diagnostics,
          "Requested tile exceeds the content budget.",
        ],
      };
    }
    const layout = viewLayout(
      descriptor,
      source!,
      [tile.rowCount, columnCount],
      axes,
      fixedIndices,
      payload.byteOffset + (selection.base + startElement) * width,
      spanBytes,
    );
    const spanValues = await readValues(source!, layout);
    const values = Array.from(
      { length: tile.rowCount },
      (_, row) => spanValues.slice(row * columns, row * columns + columnCount),
    ).flat();
    return {
      kind: "matrix_content",
      target: request.target,
      representation,
      descriptor,
      layout,
      values,
      gridShape: [tile.rowCount, columnCount],
      diagnostics,
    };
  }
  if (representation === "downsample") {
    if (
      payload.byteLength > budget.maxDownsampleReadBytes ||
      payload.byteLength > budget.maxResidentBytes ||
      selection.base !== 0
    ) {
      return {
        kind: "matrix_content",
        target: request.target,
        representation: "summary",
        descriptor,
        diagnostics: [
          ...diagnostics,
          "Downsample input exceeds the bounded overview policy.",
        ],
      };
    }
    const layout = viewLayout(
      descriptor,
      source!,
      shape!,
      axes,
      fixedIndices,
      payload.byteOffset,
      payload.byteLength,
    );
    const values = await readValues(source!, layout);
    const rows = shape![axes[0]];
    const columns = axes.length === 2 ? shape![axes[1]] : 1;
    const targetRows = Math.min(
      rows,
      Math.max(1, Math.floor(Math.sqrt(budget.maxOverviewCells))),
    );
    const targetColumns = Math.min(
      columns,
      Math.max(1, Math.floor(budget.maxOverviewCells / targetRows)),
    );
    const overview: number[] = [];
    for (let row = 0; row < targetRows; row++) {
      for (let column = 0; column < targetColumns; column++) {
        overview.push(
          values[
            Math.min(
              values.length - 1,
              Math.floor(row * rows / targetRows) * columns +
                Math.floor(column * columns / targetColumns),
            )
          ],
        );
      }
    }
    return {
      kind: "matrix_content",
      target: request.target,
      representation,
      descriptor,
      layout,
      values: overview,
      gridShape: [targetRows, targetColumns],
      diagnostics,
    };
  }
  // Summary reads a bounded, evenly-spaced set of scalar elements rather than
  // reading a whole large tensor or performing implicit GPU readback.
  const width = numericWidth(descriptor.dtype)!;
  const elementCount = Math.floor(payload.byteLength / width);
  const sampleCount = Math.min(elementCount, budget.maxSummarySamples);
  const samples: number[] = [];
  for (let index = 0; index < sampleCount; index++) {
    const element = Math.floor(index * elementCount / sampleCount);
    const bytes = await source!.readRange({
      sourceId: source!.id,
      sourceVersion: source!.version,
      byteOffset: payload.byteOffset + element * width,
      byteLength: width,
      dtype: descriptor.dtype,
      shape: [1],
    });
    samples.push(decodeValue(new DataView(bytes), 0, descriptor.dtype));
  }
  return {
    kind: "matrix_content",
    target: request.target,
    representation: "summary",
    descriptor,
    summary: summary(samples),
    diagnostics: [
      ...diagnostics,
      `Summary uses ${sampleCount} evenly-spaced values.`,
    ],
  };
}
