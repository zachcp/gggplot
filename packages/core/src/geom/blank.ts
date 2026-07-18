// geom_blank — trains scales and facets without emitting any marks.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import type { RenderNode } from "../compile/rendertree.ts";
import type { LayerContext } from "./types.ts";

export function lowerBlank(
  _layer: Layer,
  _mapping: Aes,
  _data: DataFrame,
  _ctx: LayerContext,
): RenderNode[] {
  return [];
}
