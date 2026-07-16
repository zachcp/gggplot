/** @jsxRuntime classic */
/** @jsx createElement */
// A direct Use.GPU Face mark over resident histogram bar vertices.

import * as Live from "@use-gpu/live";
import * as Plot from "@use-gpu/plot";
import * as Workbench from "@use-gpu/workbench";
import type { LiveElement } from "@use-gpu/live";
import type { ResidentHistogramProduct } from "./resident_live.tsx";

type UseOne = <T>(create: () => T, dependency?: unknown) => T;
type UseSource = (definition: unknown, source: unknown) => unknown;
type FaceComponent = (props: {
  positions: unknown;
  chunks: readonly number[];
  color?: string;
  opacity?: number;
}) => LiveElement;
type CreateElement = (
  type: FaceComponent,
  props: Parameters<FaceComponent>[0],
) => LiveElement;

const useOne = (Live as unknown as { useOne: UseOne }).useOne;
const useSource = (Workbench as unknown as { useSource: UseSource }).useSource;
const Face = (Plot as unknown as { Face: FaceComponent }).Face;
const createElement =
  (Live as unknown as { createElement: CreateElement }).createElement;

/** One four-corner face per logical [group, bin] cell. */
export function histogramBarChunks(
  product: ResidentHistogramProduct,
): number[] {
  return Array.from({ length: product.bins * product.groupsCount }, () => 4);
}

export interface ResidentHistogramBarsProps {
  product: ResidentHistogramProduct;
  color?: string;
  opacity?: number;
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
  return createElement(Face, { positions, chunks, color, opacity });
};
