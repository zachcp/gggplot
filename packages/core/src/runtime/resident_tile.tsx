/** @jsxRuntime classic */
/** @jsx createElement */
// A direct Use.GPU Face mark over dense resident histogram-grid tile vertices.

import type { LiveElement } from "@use-gpu/live";
import type { ResidentHistogramProduct } from "./resident_live.tsx";
import type { GPUStorageSource } from "./types.ts";
import { histogramBarChunks } from "./resident_bar.tsx";
import {
  createElement,
  Face,
  useFaceSegmentsSource,
  useOne,
  useSource,
} from "./usegpu_compat.ts";

export interface ResidentHistogramTilesProps {
  product: ResidentHistogramProduct;
  color?: string;
  opacity?: number;
  /**
   * Per-vertex RGBA color source (the resident `barColors` product buffer, one
   * palette color per group row). When present the Face binds it instead of the
   * scalar `color`, giving each [group,bin] tile its group's palette color.
   */
  colors?: GPUStorageSource;
}

/** Binds dense GPU tile geometry; no count grid crosses the CPU boundary. */
export const ResidentHistogramTiles = (
  { product, color, opacity, colors }: ResidentHistogramTilesProps,
): LiveElement => {
  const sourceDefinition = useOne(
    () => ({ name: "getHistogramTileVertex", format: "vec2<f32>" }),
    "histogram-tile-vertex",
  );
  const positions = useSource(sourceDefinition, product.tileVertices);
  const colorDefinition = useOne(
    () => ({ name: "getHistogramTileColor", format: "vec4<f32>" }),
    "histogram-tile-color",
  );
  // Hook order stays stable; the null source is unread on the scalar-color path.
  const colorSource = useSource(colorDefinition, colors ?? null);
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
    // Per-group palette when present; otherwise the single scalar fill color.
    ...(colors ? { colors: colorSource } : { color, opacity }),
  });
};
