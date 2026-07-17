/** @jsxRuntime classic */
/** @jsx createElement */
// A direct Use.GPU Face mark over dense resident histogram-grid tile vertices.

import * as Live from "@use-gpu/live";
import * as Plot from "@use-gpu/plot";
import * as Workbench from "@use-gpu/workbench";
import type { LiveElement } from "@use-gpu/live";
import type { ResidentHistogramProduct } from "./resident_live.tsx";
import { histogramBarChunks } from "./resident_bar.tsx";

type UseOne = <T>(create: () => T, dependency?: unknown) => T;
type UseSource = (definition: unknown, source: unknown) => unknown;
type FaceComponent = (props: {
  positions: unknown;
  count: number;
  segments: unknown;
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
const useFaceSegmentsSource = (Workbench as unknown as {
  useFaceSegmentsSource: (chunks: readonly number[]) => {
    count: number;
    segments: unknown;
  };
}).useFaceSegmentsSource;
const Face = (Plot as unknown as { Face: FaceComponent }).Face;
const createElement =
  (Live as unknown as { createElement: CreateElement }).createElement;

export interface ResidentHistogramTilesProps {
  product: ResidentHistogramProduct;
  color?: string;
  opacity?: number;
}

/** Binds dense GPU tile geometry; no count grid crosses the CPU boundary. */
export const ResidentHistogramTiles = (
  { product, color, opacity }: ResidentHistogramTilesProps,
): LiveElement => {
  const sourceDefinition = useOne(
    () => ({ name: "getHistogramTileVertex", format: "vec2<f32>" }),
    "histogram-tile-vertex",
  );
  const positions = useSource(sourceDefinition, product.tileVertices);
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
    color,
    opacity,
  });
};
