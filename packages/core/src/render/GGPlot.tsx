/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
// <GGPlot>: the public plot root (ADR-007). Its children are plot parts and
// layers; the component root (components/gg_plot_root.ts) assembles them.
// There is no spec form (gggplot-vnh.18).

import * as UseGpuLive from "@use-gpu/live";
import type { LiveElement } from "@use-gpu/live";
import * as UseGpuWorkbench from "@use-gpu/workbench";
import {
  createFontResources,
  type FontFaceResource,
  type FontResources,
} from "./font_resources.ts";
import {
  GGPlotRoot,
  type GGPlotRootProps,
} from "../components/gg_plot_root.ts";
import { esm } from "../runtime/usegpu_compat.ts";
const { createElement, useAwait, useMemo } = esm(UseGpuLive, "useMemo");
const { FontLoader } = esm(UseGpuWorkbench, "LayoutContext");

/** <GGPlot>'s props: plot parts as children (ADR-007). */
export interface GGPlotComponentProps extends GGPlotRootProps {
  /** Compatibility shorthand; prefer fontResources for readiness/validation. */
  fonts?: FontFaceResource[];
  fontResources?: FontResources;
}

export type GGPlotProps = GGPlotComponentProps;

/**
 * Mount inside a UseGPU <WebGPU><AutoCanvas><FlatCamera><Pass> host (see
 * apps/site); a 3D plot owns its camera and passes. Wrapped in a
 * host-configurable FontLoader: @use-gpu/plot's <Plot> wraps its children in
 * an SDFFontProvider, which throws if no FontContext ancestor exists. Text
 * renders visibly when the host supplies real font sources.
 *
 * Returns a real `LiveElement` (gggplot-05w). Hosts render it from Live JSX
 * with the qualified pragma from `@gggplot/core/jsx`, or with its typed
 * `createElement`. An unqualified JSX pragma checks against React's JSX
 * namespace and rejects any Live component. (Never write the pragma itself in
 * a comment here: esbuild reads it from any comment, and a stray one breaks
 * this file's real factory.)
 */
export const GGPlot = (props: GGPlotProps): LiveElement => {
  const { fonts, fontResources } = props;
  const resources = useMemo(
    () => fontResources ?? (fonts?.length ? createFontResources(fonts) : null),
    [fontResources, fonts],
  );
  const [ready, error] = useAwait(
    resources
      ? async () => {
        await resources.ready();
        // The root checks its theme's fonts once its parts resolve.
        return true;
      }
      : null,
    [resources],
  );
  if (error) throw error;
  if (resources && !ready) return null;
  const content = createElement(GGPlotRoot, {
    ...props,
    fontResources: resources,
  });
  return createElement(
    FontLoader,
    { fonts: resources?.faces ?? fonts },
    content as LiveElement,
  );
};
