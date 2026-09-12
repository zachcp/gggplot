/** @jsxRuntime classic */
/** @jsx createElement */
// A direct Use.GPU Face mark over dense resident histogram-grid tile vertices.

import type { LiveElement } from "@use-gpu/live";
import type { ResidentHistogramProduct } from "./resident_live.tsx";
import type { GPUStorageSource } from "./types.ts";
import { parseColorRGBA } from "../color/mod.ts";
import { histogramBarChunks } from "./resident_bar.tsx";
import {
  createElement,
  // The WORKBENCH layer, not @use-gpu/plot's <Face>. They are different
  // components with the same name: plot's parses its props through FaceTraits
  // and quotes them into the plot layer tree, so handing it a `useSource`
  // shader source (which is what a resident buffer is) draws NOTHING and
  // reports nothing — this mark shipped that way until gggplot-vs7.12 put it on
  // a page and the pixel floor measured 3.7%, i.e. axes only. resident_bar.tsx
  // binds FaceLayer for the same reason.
  FaceLayer as Face,
  useFaceSegmentsSource,
  useOne,
  useSource,
} from "./usegpu_compat.ts";

export interface ResidentHistogramTilesProps {
  product: ResidentHistogramProduct;
  color?: string;
  opacity?: number;
  /**
   * Per-vertex RGBA color source (the resident `heatmapColors` product
   * buffer, one color per CELL, shaded by that cell's own count through a
   * fixed ramp). When present the Face binds it instead of the scalar
   * `color`, giving each [group,bin] tile a heatmap shade rather than a flat
   * per-group color.
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
    // The scalar form must be PARSED RGBA, not the hex string: FaceLayer draws
    // an unparsed string as pure black, which is the sentinel mark_pixel_check
    // watches for.
    ...(colors
      ? { colors: colorSource }
      : { color: parseColorRGBA(color ?? "#3b82f6", opacity ?? 1) }),
    // Draw both windings. Without this the quads are back-face culled and the
    // strip is invisible — the same reason ResidentHistogramBars passes it.
    side: "both",
  });
};
