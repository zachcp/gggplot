import type {
  Dimension,
  ModelDocument,
  ModelGraph,
  TensorDescriptor,
} from "./types.ts";

export type Scene3DSlabKind =
  | "input"
  | "output"
  | "activation"
  | "parameter"
  | "constant";

export interface Scene3DModule {
  id: string;
  nodeId: string;
  kind: string;
  label: string;
  center: [number, number, number];
  size: [number, number, number];
}

export interface Scene3DTensorSlab {
  id: string;
  entityIndex: number;
  tensorId?: string;
  valueId?: string;
  moduleId?: string;
  kind: Scene3DSlabKind;
  center: [number, number, number];
  size: [number, number, number];
  displayShape: [number, number];
  source?: {
    sourceId: string;
    byteOffset: number;
    byteLength: number;
    cacheKey?: string;
  };
}

export interface Scene3DConnector {
  id: string;
  entityIndex: number;
  edgeId: string;
  fromModuleId: string;
  toModuleId: string;
  tensorId?: string;
  valueId?: string;
  points: Array<[number, number, number]>;
}

export interface ModelScene3D {
  kind: "model_scene_3d";
  documentId: string;
  graphId: string;
  entities: Array<
    {
      index: number;
      kind: "module" | "slab" | "connector";
      id: string;
      tensorId?: string;
      nodeId?: string;
    }
  >;
  modules: Scene3DModule[];
  slabs: Scene3DTensorSlab[];
  connectors: Scene3DConnector[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
}

export interface ModelScene3DOptions {
  graphId?: string;
  maxTileRows?: number;
  maxTileColumns?: number;
  layerGap?: number;
  laneGap?: number;
}

function graphFor(document: ModelDocument, graphId?: string): ModelGraph {
  const graph = graphId
    ? document.graphs.find((item) => item.id === graphId)
    : document.graphs[0];
  if (!graph) throw new RangeError(`Unknown graph ${graphId ?? "<first>"}`);
  return graph;
}

function staticShape(shape: Dimension[] | undefined): number[] | undefined {
  return shape?.every((item) => typeof item === "number")
    ? shape as number[]
    : undefined;
}

function displayShape(
  descriptor: TensorDescriptor | undefined,
  rows: number,
  columns: number,
): [number, number] {
  const shape = staticShape(descriptor?.shape);
  if (!shape?.length) return [2, 4];
  const sourceRows = shape.length === 1 ? shape[0] : shape[shape.length - 2];
  const sourceColumns = shape.length === 1 ? 1 : shape[shape.length - 1];
  return [
    Math.max(1, Math.min(rows, sourceRows)),
    Math.max(1, Math.min(columns, sourceColumns)),
  ];
}

function depths(graph: ModelGraph): Map<string, number> {
  const result = new Map(
    graph.nodes.map((
      node,
    ) => [node.id, node.kind === "input" || node.kind === "constant" ? 0 : 1]),
  );
  for (let pass = 0; pass < graph.nodes.length; pass++) {
    let changed = false;
    for (const edge of graph.edges) {
      const next = Math.max(
        result.get(edge.to) ?? 1,
        (result.get(edge.from) ?? 0) + 1,
      );
      if (next !== result.get(edge.to)) {
        result.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return result;
}

/**
 * Convert model topology into a renderer-neutral, bbycroft-style spatial scene.
 * X is data flow, Y is module/tensor lanes, and Z is slab depth plus routing.
 */
export function buildModelScene3D(
  document: ModelDocument,
  options: ModelScene3DOptions = {},
): ModelScene3D {
  const graph = graphFor(document, options.graphId);
  const maxTileRows = options.maxTileRows ?? 10;
  const maxTileColumns = options.maxTileColumns ?? 16;
  const layerGap = options.layerGap ?? 4;
  const laneGap = options.laneGap ?? 3;
  if (
    ![maxTileRows, maxTileColumns, layerGap, laneGap].every((value) =>
      Number.isSafeInteger(value) && value > 0
    )
  ) {
    throw new RangeError("3D scene layout limits must be positive integers");
  }
  const entities: ModelScene3D["entities"] = [];
  const entity = (
    kind: "module" | "slab" | "connector",
    id: string,
    extra: { tensorId?: string; nodeId?: string } = {},
  ) => {
    const result = { index: entities.length, kind, id, ...extra };
    entities.push(result);
    return result.index;
  };
  const layerDepth = depths(graph);
  const lanes = new Map<number, number>();
  const modules: Scene3DModule[] = graph.nodes.map((node) => {
    const depth = layerDepth.get(node.id) ?? 0;
    const lane = lanes.get(depth) ?? 0;
    lanes.set(depth, lane + 1);
    const id = `scene:${node.id}`;
    entity("module", id, { nodeId: node.id });
    return {
      id,
      nodeId: node.id,
      kind: node.kind,
      label: node.name ?? node.op ?? node.id,
      center: [depth * layerGap, lane * laneGap, 0],
      size: [1.0, 1.1, 1.1],
    };
  });
  const byNode = new Map(modules.map((module) => [module.nodeId, module]));
  const slabs: Scene3DTensorSlab[] = [];
  const slabByTensor = new Map<string, Scene3DTensorSlab>();
  const makeSlab = (
    id: string,
    descriptor: TensorDescriptor | undefined,
    kind: Scene3DSlabKind,
    center: [number, number, number],
    moduleId?: string,
    valueId?: string,
  ) => {
    const shape = displayShape(descriptor, maxTileRows, maxTileColumns);
    const slab: Scene3DTensorSlab = {
      id,
      entityIndex: entity("slab", id, { tensorId: descriptor?.id }),
      tensorId: descriptor?.id,
      valueId,
      moduleId,
      kind,
      center,
      size: [
        0.16,
        Math.max(0.7, shape[0] * 0.14),
        Math.max(0.7, shape[1] * 0.11),
      ],
      displayShape: shape,
      source: descriptor?.payload
        ? {
          sourceId: descriptor.payload.sourceId,
          byteOffset: descriptor.payload.byteOffset,
          byteLength: descriptor.payload.byteLength,
          cacheKey: descriptor.residency?.cacheKey,
        }
        : undefined,
    };
    slabs.push(slab);
    if (descriptor) slabByTensor.set(descriptor.id, slab);
    return slab;
  };
  for (const node of graph.nodes) {
    const module = byNode.get(node.id)!;
    node.parameters?.forEach((tensorId, index) => {
      const descriptor = document.tensors[tensorId];
      if (!descriptor || slabByTensor.has(tensorId)) return;
      makeSlab(`scene:param:${tensorId}`, descriptor, "parameter", [
        module.center[0],
        module.center[1] + 1.3 + index * 1.15,
        -1.2,
      ], module.id);
    });
  }
  const connectors: Scene3DConnector[] = [];
  for (const [edgeIndex, edge] of graph.edges.entries()) {
    const from = byNode.get(edge.from);
    const to = byNode.get(edge.to);
    if (!from || !to) continue;
    const descriptor = edge.tensorId
      ? document.tensors[edge.tensorId]
      : undefined;
    const kind: Scene3DSlabKind = descriptor?.role === "parameter"
      ? "parameter"
      : from.kind === "input"
      ? "input"
      : to.kind === "output"
      ? "output"
      : "activation";
    const slab = descriptor && slabByTensor.get(descriptor.id)
      ? slabByTensor.get(descriptor.id)!
      : makeSlab(
        `scene:edge:${edge.id}`,
        descriptor,
        kind,
        [
          (from.center[0] + to.center[0]) / 2,
          (from.center[1] + to.center[1]) / 2,
          0,
        ],
        undefined,
        edge.valueId,
      );
    const elevated = Math.abs(to.center[0] - from.center[0]) > layerGap * 1.25;
    const zLane = elevated
      ? 0.9 + (edgeIndex % 4) * 0.35
      : 0.35 + (edgeIndex % 3) * 0.08;
    const id = `scene:connector:${edge.id}`;
    const fromPort = from.center[0] + from.size[0] / 2;
    const toPort = to.center[0] - to.size[0] / 2;
    const slabStart = slab.center[0] - slab.size[0] / 2;
    const slabEnd = slab.center[0] + slab.size[0] / 2;
    // Use axis-aligned elbows rather than direct diagonals. This deliberately
    // keeps the data-flow route legible while the camera orbits a dense model.
    const fromElbow = (fromPort + slabStart) / 2;
    const toElbow = (slabEnd + toPort) / 2;
    connectors.push({
      id,
      entityIndex: entity("connector", id, { tensorId: descriptor?.id }),
      edgeId: edge.id,
      fromModuleId: from.id,
      toModuleId: to.id,
      tensorId: descriptor?.id,
      valueId: edge.valueId,
      points: [
        [fromPort, from.center[1], 0],
        [fromElbow, from.center[1], 0],
        [fromElbow, from.center[1], zLane],
        [fromElbow, slab.center[1], zLane],
        [slabStart, slab.center[1], zLane],
        [slabEnd, slab.center[1], zLane],
        [toElbow, slab.center[1], zLane],
        [toElbow, to.center[1], zLane],
        [toElbow, to.center[1], 0],
        [toPort, to.center[1], 0],
      ],
    });
  }
  const points = [
    ...modules.flatMap((item) => [item.center]),
    ...slabs.flatMap((item) => [item.center]),
    ...connectors.flatMap((item) => item.points),
  ];
  const min = [0, 1, 2].map((axis) =>
    Math.min(...points.map((point) => point[axis])) - 1
  ) as [number, number, number];
  const max = [0, 1, 2].map((axis) =>
    Math.max(...points.map((point) => point[axis])) + 1
  ) as [number, number, number];
  return {
    kind: "model_scene_3d",
    documentId: document.id,
    graphId: graph.id,
    entities,
    modules,
    slabs,
    connectors,
    bounds: { min, max },
  };
}
