// <GeomLayer>: any registered geom as a plot part (gggplot-b7f).
//
// Builds the layer every GeomDefinition already lowers (geom/mod.ts
// GEOM_REGISTRY: lower(), domainContribution, residentPlan) from props and
// reports it to the enclosing <GGPlot> through GGLayerPart. The root runs its
// stat, trains across layers, and lowers it with the per-layer memo, binding
// eligible scaled aesthetics on the GPU (gggplot-fbq) and CPU-packing the
// rest. Tree order is z-order; `inheritAes={false}`, a layer `data` override
// and `showLegend` behave as their ggplot2 counterparts.
//
// Named geoms (<GeomPoint>, <GeomBar>, ..., gggplot-8hz) are thin wrappers
// over this.
import type { LiveElement } from "@use-gpu/live";
import { ingest, type IngestOptions, type InputData } from "../data/mod.ts";
import { GEOM_REGISTRY } from "../geom/mod.ts";
import type {
  Aes,
  GeomKind,
  Layer,
  PositionKind,
  StatKind,
} from "../ir/types.ts";
import { createElement, useMemo, useOne } from "../runtime/usegpu_compat.ts";
import { GGLayerPart } from "./parts.ts";

export interface GeomLayerProps {
  geom: GeomKind;
  /** This layer's aesthetics, over the plot's unless `inheritAes` is false. */
  mapping?: Aes;
  /** Rows for this layer only (ggplot2's layer `data`). */
  data?: InputData;
  /** How `data` is ingested (column types, factor levels). */
  dataOptions?: IngestOptions;
  stat?: StatKind;
  position?: PositionKind;
  /** ggplot2's inherit.aes. */
  inheritAes?: boolean;
  /** Everything else is a geom/stat parameter: color, size, bins, ... */
  [param: string]: unknown;
}

/**
 * Returns `value` unless it is shallow-equal to the previous one, in which
 * case the previous one comes back, so inline JSX objects keep identity.
 */
function useShallowStable<T extends Record<string, unknown>>(value: T): T {
  const ref = useOne(() => ({ current: value }));
  const prev = ref.current;
  const keys = Object.keys(value);
  const same = keys.length === Object.keys(prev).length &&
    keys.every((k) => prev[k] === value[k]);
  if (!same) ref.current = value;
  return ref.current;
}

/** The layer a GeomLayer's props describe, with the registry's defaults. */
export function layerFromProps(props: GeomLayerProps): Layer {
  // Live leaves `key` (as undefined) and `children` on props; neither is a
  // geom parameter.
  const {
    geom,
    mapping,
    data,
    dataOptions,
    stat,
    position,
    inheritAes,
    key: _key,
    children: _children,
    ...params
  } = props;
  const def = GEOM_REGISTRY[geom];
  if (!def) throw new Error(`[gggplot] no geom "${geom}"`);
  return {
    geom,
    stat: stat ?? def.defaultStat,
    position: position ?? def.defaultPosition ?? "identity",
    mapping,
    data: data ? ingest(data, dataOptions) : undefined,
    inheritAes,
    params,
  };
}

export const GeomLayer = (props: GeomLayerProps): LiveElement => {
  const { mapping, data, ...rest } = props;
  // Stable inputs: the mapping by shallow value, the data by identity (ingest
  // passes an already-typed frame through), every param by value.
  const stableMapping = useShallowStable(
    (mapping ?? {}) as Record<string, unknown>,
  );
  const stableRest = useShallowStable(rest as Record<string, unknown>);
  const layer = useMemo(
    () =>
      layerFromProps({
        ...(stableRest as GeomLayerProps),
        ...(mapping ? { mapping: stableMapping as Aes } : {}),
        ...(data ? { data } : {}),
      }),
    [stableRest, stableMapping, data],
  );
  return createElement(GGLayerPart, { layer });
};
