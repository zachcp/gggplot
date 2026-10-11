// <GGLayer>: a custom layer that takes part in the grammar (gggplot-4ot).
//
// A <GGPanel> draws inside the plot but trains nothing. A <GGLayer> also
// declares the rows and aesthetics its primitive shows, as a geom would: they
// train the plot's scales (widening its position domains, and adding the
// color/fill/size/... scale whose guide is the legend), and they are censored
// and faceted like any layer's. Its children draw in the panel, in data
// coordinates, after the marks, and bind those same scales through
// useGGColors / useGGSizes, so the primitive, the axes and the legend agree.
//
// Underneath it is a geom_blank layer (trains, draws nothing) plus the
// children as panel content.
import type { LiveElement } from "@use-gpu/live";
import type { IngestOptions, InputData } from "../data/mod.ts";
import type { Aes } from "../ir/types.ts";
import { createElement, Fragment } from "../runtime/usegpu_compat.ts";
import { GeomLayer } from "./geom_layer.ts";
import { GGPanel } from "./parts.ts";

export interface GGLayerProps {
  /** The aesthetics the primitive shows, over the plot's unless inheritAes is false. */
  mapping?: Aes;
  /** The primitive's rows, if not the plot's. */
  data?: InputData;
  dataOptions?: IngestOptions;
  /** ggplot2's inherit.aes. */
  inheritAes?: boolean;
  /** The primitive itself: Live elements drawn in the panel. */
  children?: unknown;
}

export const GGLayer = (
  { mapping, data, dataOptions, inheritAes, children }: GGLayerProps,
): LiveElement =>
  createElement(
    Fragment,
    {},
    createElement(GeomLayer, {
      geom: "blank",
      ...(mapping ? { mapping } : {}),
      ...(data ? { data } : {}),
      ...(dataOptions ? { dataOptions } : {}),
      ...(inheritAes !== undefined ? { inheritAes } : {}),
    }),
    children == null ? null : createElement(GGPanel, { children }),
  ) as LiveElement;
