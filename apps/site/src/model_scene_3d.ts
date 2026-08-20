import {
  aes,
  geomPath,
  type GGSpec,
  ggplot,
  theme,
} from "@gggplot/core/dsl";
// Type-only, so the renderer is erased at runtime and this module stays
// headless while still describing the prisms the host will draw.
import type { PrismInstance3D } from "@gggplot/core";
import { buildModelScene3D, type ModelDocument } from "@gggplot/model-inspect";

interface SceneRow extends Record<string, unknown> {
  x: number;
  y: number;
  z: number;
  kind: string;
  group?: number;
}

const CELL_COLORS = {
  input: "#fbbf24",
  output: "#a78bfa",
  activation: "#3b82f6",
  parameter: "#22c55e",
  constant: "#f87171",
} as const;

/** Twelve independently grouped paths outline one world-space rectangular prism. */
function prismEdges(
  center: [number, number, number],
  size: [number, number, number],
  groupOffset: number,
): SceneRow[] {
  const [x, y, z] = center;
  const [width, height, depth] = size;
  const corners: Array<[number, number, number]> = [
    [x - width / 2, y - height / 2, z - depth / 2],
    [x + width / 2, y - height / 2, z - depth / 2],
    [x + width / 2, y + height / 2, z - depth / 2],
    [x - width / 2, y + height / 2, z - depth / 2],
    [x - width / 2, y - height / 2, z + depth / 2],
    [x + width / 2, y - height / 2, z + depth / 2],
    [x + width / 2, y + height / 2, z + depth / 2],
    [x - width / 2, y + height / 2, z + depth / 2],
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  return edges.flatMap(([start, end], index) =>
    [corners[start], corners[end]].map(([x, y, z]) => ({
      x,
      y,
      z,
      kind: "frame",
      group: groupOffset + index,
    }))
  );
}

function modelScene(document: ModelDocument) {
  return buildModelScene3D(document);
}

/** Filled mini-prisms for the bounded tensor cells; no tensor values are copied. */
export function modelScene3dPrisms(document: ModelDocument): PrismInstance3D[] {
  return modelScene(document).slabs.flatMap((slab) => {
    const [rows, columns] = slab.displayShape;
    const cellSize: [number, number, number] = [
      // A little overscan in the thin axis makes the side faces visible as
      // the camera passes a slab. The in-plane gaps remain deliberately
      // small, so tiles read as a filled matrix rather than a point cloud.
      slab.size[0] * 1.35,
      slab.size[1] / rows * 0.94,
      slab.size[2] / columns * 0.94,
    ];
    return Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      return {
        center: [
          slab.center[0],
          slab.center[1] + (row - (rows - 1) / 2) * slab.size[1] / rows,
          slab.center[2] +
          (column - (columns - 1) / 2) * slab.size[2] / columns,
        ] as [number, number, number],
        size: cellSize,
        color: CELL_COLORS[slab.kind],
      };
    });
  });
}

/** Lower bounded 3D scene instances into the existing orbit-enabled WebGPU host. */
export function modelScene3dSpec(document: ModelDocument): GGSpec {
  const scene = modelScene(document);
  const slabFrames = scene.slabs.flatMap((slab, index) =>
    prismEdges(slab.center, slab.size, index * 12)
  );
  const moduleFrames = scene.modules.flatMap((module, index) =>
    prismEdges(module.center, module.size, index * 12)
  );
  const connectors: SceneRow[] = scene.connectors.flatMap((connector, group) =>
    connector.points.map(([x, y, z]) => ({ x, y, z, kind: "connector", group }))
  );
  return ggplot(slabFrames, aes({ x: "x", y: "y", z: "z" })).add(
    geomPath({
      data: slabFrames,
      mapping: aes({ x: "x", y: "y", z: "z", group: "group" }),
      inheritAes: false,
      color: "#93c5fd",
      linewidth: 1,
      alpha: 0.44,
    }),
    geomPath({
      data: moduleFrames,
      mapping: aes({ x: "x", y: "y", z: "z", group: "group" }),
      inheritAes: false,
      // Keep module frames quiet: category color belongs to the filled tensor
      // cells, while the frame only establishes the module boundary.
      color: "#64748b",
      linewidth: 1.25,
      alpha: 0.62,
    }),
    geomPath({
      data: connectors,
      mapping: aes({ x: "x", y: "y", z: "z", group: "group" }),
      inheritAes: false,
      color: "#2dd4bf",
      linewidth: 3,
      alpha: 0.9,
    }),
    theme({ grid: false }),
  ).build();
}
