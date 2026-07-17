/** @jsxRuntime classic */
/** @jsx createElement */
// A direct Use.GPU Face mark over resident histogram bar vertices.

import * as Live from "@use-gpu/live";
import * as Workbench from "@use-gpu/workbench";
import type { LiveElement } from "@use-gpu/live";
import type { ResidentHistogramProduct } from "./resident_live.tsx";

type UseOne = <T>(create: () => T, dependency?: unknown) => T;
type UseSource = (definition: unknown, source: unknown) => unknown;
type FaceComponent = (props: {
  positions: unknown;
  count: number;
  segments: unknown;
  chunks: readonly number[];
  color?: number[];
  side?: "front" | "back" | "both";
}) => LiveElement;
type CreateElement = (
  type: FaceComponent,
  props: Parameters<FaceComponent>[0],
) => LiveElement;

const useOne = (Live as unknown as { useOne: UseOne }).useOne;
const useSource = (Workbench as unknown as { useSource: UseSource }).useSource;
const useFaceSegmentsSource = (Workbench as unknown as {
  useFaceSegmentsSource: (chunks: readonly number[]) => {
    count: number;
    segments: unknown;
  };
}).useFaceSegmentsSource;
const Face = (Workbench as unknown as { FaceLayer: FaceComponent }).FaceLayer;
const createElement =
  (Live as unknown as { createElement: CreateElement }).createElement;

/** One four-corner face per logical [group, bin] cell. */
export function histogramBarChunks(
  product: ResidentHistogramProduct,
): number[] {
  return Array.from({ length: product.bins * product.groupsCount }, () => 4);
}

/** Two triangles per four-corner resident bar, without cross-bin segments. */
export function histogramBarIndices(
  product: ResidentHistogramProduct,
): Uint32Array {
  const cells = product.bins * product.groupsCount;
  const indices = new Uint32Array(cells * 6);
  for (let cell = 0; cell < cells; cell++) {
    const vertex = cell * 4;
    const index = cell * 6;
    indices.set([
      vertex,
      vertex + 1,
      vertex + 2,
      vertex,
      vertex + 2,
      vertex + 3,
    ], index);
  }
  return indices;
}

export interface ResidentHistogramBarsProps {
  product: ResidentHistogramProduct;
  color?: string;
  opacity?: number;
}

function rgba(color = "#3b82f6", opacity = 1): number[] {
  const hex = color.startsWith("#") ? color.slice(1) : color;
  const value = Number.parseInt(
    hex.length === 3
      ? hex.split("").map((digit) => digit + digit).join("")
      : hex.slice(0, 6),
    16,
  );
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
    opacity,
  ];
}

/**
 * Binds the provider's `vec2<f32>` storage output as a vertex source. Only
 * fixed topology is CPU-created; bar positions and counts never leave GPU.
 */
export const ResidentHistogramBars = (
  { product, color, opacity }: ResidentHistogramBarsProps,
): LiveElement => {
  const sourceDefinition = useOne(
    () => ({ name: "getHistogramBarVertex", format: "vec2<f32>" }),
    "histogram-bar-vertex",
  );
  const positions = useSource(sourceDefinition, product.barVertices);
  const chunks = useOne(
    () => histogramBarChunks(product),
    `${product.groupsCount}:${product.bins}`,
  );
  const { count, segments } = useFaceSegmentsSource(chunks);
  return createElement(Face, {
    positions,
    count,
    segments,
    chunks,
    color: rgba(color, opacity),
    side: "both",
  });
};
