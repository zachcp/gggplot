// Plot parts: what a <GGPlot>'s children report to it (ADR-007, vnh.15 (5)).
//
// ggplot2 builds a plot by adding parts to it: layers, scales, a coord, a
// facet, a theme, labels. Here each part is a child component that reports a
// value through Live Capture and renders nothing. The root's continuation
// receives every part in tree order and assembles the plot from them.
//
// Kept leaf-ward: grammar types and the Live compatibility surface only.
import type { LiveElement } from "@use-gpu/live";
import type { SpecPart } from "../dsl/base.ts";
import type { Layer } from "../ir/types.ts";
import {
  makeCapture,
  useCapture,
  useFiberId,
  useMemo,
  useOne,
} from "../runtime/usegpu_compat.ts";
import { componentProbe } from "./probe.ts";

/** One reported part. A layer carries the fiber id that keys its marks. */
export type PlotPart =
  | { kind: "layer"; id: number; layer: Layer; pending?: boolean }
  | { kind: "spec"; part: Exclude<SpecPart, { tag: "layer" }> }
  | { kind: "panel"; id: number; content: unknown };

/** The capture a <GGPlot> root opens; parts report into it. */
export const PlotPartCapture = makeCapture("GGPlotParts");

/**
 * Reports one layer. `layer` should keep its identity while its inputs are
 * unchanged: the root memoizes the layer's stat and lowering on it, and every
 * report re-runs the root's continuation.
 *
 * `pending` declares that the layer's domain contribution is not known yet (a
 * GPU summary still in flight). The root trains nothing while any layer is
 * pending, rather than training a missing contribution as empty (vs7 trap 2).
 */
export const GGLayerPart = (
  { layer, pending }: { layer: Layer; pending?: boolean },
): LiveElement => {
  const id = useFiberId();
  useOne(() => componentProbe.layerMounts++);
  const part = useMemo(
    (): PlotPart => ({ kind: "layer", id, layer, pending }),
    [id, layer, pending],
  );
  useCapture(PlotPartCapture, part);
  return null;
};

/** Reports any grammar part: a layer, scale, coord, facet, theme, labels... */
export const GGPart = ({ part }: { part: SpecPart }): LiveElement => {
  const id = useFiberId();
  const reported = useMemo(
    (): PlotPart =>
      part.tag === "layer"
        ? { kind: "layer", id, layer: part.value }
        : { kind: "spec", part },
    [id, part],
  );
  useCapture(PlotPartCapture, reported);
  return null;
};

/**
 * <GGPanel>: Live children drawn inside the plot's panel, in its data
 * coordinates, after the marks (gggplot-7j9). Any Use.GPU primitive works,
 * and can bind the trained scales on the GPU (components/gg_panel.ts's
 * useGGColors) or read their CPU revision (useGGScales). In a faceted plot
 * the children draw in every panel; in 3D, in the scene's data space.
 */
export const GGPanel = (
  { children }: { children?: unknown },
): LiveElement => {
  const id = useFiberId();
  const part = useMemo(
    (): PlotPart => ({ kind: "panel", id, content: children }),
    [id, children],
  );
  useCapture(PlotPartCapture, part);
  return null;
};
