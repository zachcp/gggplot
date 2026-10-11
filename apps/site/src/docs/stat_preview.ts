// The "computed stat rows" panel for component examples: run a named geom's
// stat on its rows exactly as the plot will, from the same props (no spec).
import {
  type Aes,
  applyStat,
  type DataFrame,
  ingest,
  type InputData,
  layerFromProps,
  type NamedGeom,
} from "@gggplot/core";

/** The rows `geom`'s stat produces from `data`, or undefined for identity. */
export function previewStatRows<P>(
  geom: NamedGeom<P>,
  props: P,
  data: InputData,
  mapping: Aes,
): DataFrame | undefined {
  const layer = layerFromProps(geom.layerProps(props));
  if (layer.stat === "identity") return undefined;
  const effective = layer.inheritAes === false
    ? (layer.mapping ?? {})
    : { ...mapping, ...layer.mapping };
  return applyStat(layer, effective, layer.data ?? ingest(data)).data;
}
