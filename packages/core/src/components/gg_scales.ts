// What a <GGPlot> root provides to everything rendered inside it.
//
// GGScalesContext carries the trained scales as an IMMUTABLE value with a
// revision (vnh.15 decision (1), finding 3): a CPU consumer such as a guide
// re-renders when the revision moves, and sees one consistent set. The value
// keeps its identity while the scales are unchanged, so a resize does not
// re-render what reads it. Stable GPU refs for shaders join this value with
// the production scale-binding adapter (gggplot-fbq).
//
// Leaf module: types and the Live compatibility surface only.
import type { AesName } from "../ir/types.ts";
import type { TrainedScale } from "../scale/types.ts";
import { makeContext, useContext } from "../runtime/usegpu_compat.ts";

export interface GGScalesValue {
  /** Every trained scale by aesthetic; x/y carry the guide (widened) domains. */
  scales: Partial<Record<AesName, TrainedScale>>;
  /** Moves exactly when `scales` changes in value. */
  revision: number;
}

/** The plotting panel as laid out. */
export interface GGPanelValue {
  /** The panel's normalized bounds within the chart, [x0, y0, x1, y1]. */
  bounds: [number, number, number, number];
  dimensions: 2 | 3;
}

export const GGScalesContext = makeContext<GGScalesValue | null>(
  null,
  "GGScalesContext",
);

export const GGPanelContext = makeContext<GGPanelValue | null>(
  null,
  "GGPanelContext",
);

/** The nearest <GGPlot>'s trained scales, or null outside one. */
export function useGGScales(): GGScalesValue | null {
  return useContext<GGScalesValue | null>(GGScalesContext);
}

/** The nearest <GGPlot>'s panel layout, or null outside one. */
export function useGGPanel(): GGPanelValue | null {
  return useContext<GGPanelValue | null>(GGPanelContext);
}
