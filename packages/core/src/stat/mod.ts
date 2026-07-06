// Stat transforms — stage ① of the pipeline.
//
// A stat consumes a layer's data + resolved mapping and returns a (possibly
// new) DataFrame plus any mapping additions the stat computed (e.g. stat_count
// adds a "count" column mapped to y). Only `identity` is implemented; the rest
// are registered stubs so the pipeline is wired end to end.

import type { Aes, DataFrame, Layer } from "../ir/types.ts";

export interface StatResult {
  data: DataFrame;
  /** Aesthetics the stat produced (merged over the layer mapping). */
  mapping: Aes;
}

export type StatFn = (
  data: DataFrame,
  mapping: Aes,
  params: Record<string, unknown>,
) => StatResult;

const statIdentity: StatFn = (data, mapping) => ({ data, mapping });

// TODO(gggplot): implement count/bin/smooth/summary.
const notImplemented = (name: string): StatFn => (data, mapping) => {
  console.warn(`[gggplot] stat "${name}" not implemented; falling back to identity`);
  return { data, mapping };
};

const REGISTRY: Record<Layer["stat"], StatFn> = {
  identity: statIdentity,
  count: notImplemented("count"),
  bin: notImplemented("bin"),
  smooth: notImplemented("smooth"),
  summary: notImplemented("summary"),
};

export function applyStat(layer: Layer, mapping: Aes, data: DataFrame): StatResult {
  return REGISTRY[layer.stat](data, mapping, layer.params);
}
