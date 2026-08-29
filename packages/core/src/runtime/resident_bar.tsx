/** @jsxRuntime classic */
/** @jsx createElement */
// A direct Use.GPU Face mark over resident histogram bar vertices.

import type { LiveElement } from "@use-gpu/live";
import type { ResidentHistogramProduct } from "./resident_live.tsx";
import type { GPUStorageSource } from "./types.ts";
import { parseColorRGBA } from "../color/mod.ts";
import {
  createElement,
  FaceLayer as Face,
  useFaceSegmentsSource,
  useOne,
  useSource,
} from "./usegpu_compat.ts";

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
  /**
   * Per-vertex RGBA color source (the resident `barColors` product buffer).
   * When present the Face binds it instead of the scalar `color`, giving each
   * factor group its palette color; when absent behavior is unchanged.
   */
  colors?: GPUStorageSource;
}

/**
 * Flatten factor-level hex colors into a packed RGBA Float32Array (one vec4 per
 * group, `opacity` baked into every alpha). This is the exact shape the GPU
 * per-group palette buffer expects.
 */
export function paletteToRgbaF32(
  colors: readonly string[],
  opacity = 1,
): Float32Array {
  const out = new Float32Array(colors.length * 4);
  for (let i = 0; i < colors.length; i++) {
    out.set(parseColorRGBA(colors[i], opacity), i * 4);
  }
  return out;
}

/**
 * Binds the provider's `vec2<f32>` storage output as a vertex source. Only
 * fixed topology is CPU-created; bar positions and counts never leave GPU.
 */
export const ResidentHistogramBars = (
  { product, color, opacity, colors }: ResidentHistogramBarsProps,
): LiveElement => {
  const sourceDefinition = useOne(
    () => ({ name: "getHistogramBarVertex", format: "vec2<f32>" }),
    "histogram-bar-vertex",
  );
  const positions = useSource(sourceDefinition, product.barVertices);
  const colorDefinition = useOne(
    () => ({ name: "getHistogramBarColor", format: "vec4<f32>" }),
    "histogram-bar-color",
  );
  // useSource must run unconditionally (stable hook order); the null source is
  // harmless when the Face never reads it (scalar-color path).
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
    ...(colors
      ? { colors: colorSource }
      : { color: parseColorRGBA(color ?? "#3b82f6", opacity ?? 1) }),
    side: "both",
  });
};
