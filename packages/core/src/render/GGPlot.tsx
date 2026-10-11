/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
// <GGPlot>: the public plot root. With children it is the component-first
// root (components/gg_plot_root.ts, ADR-007); with `spec` it compiles a GGSpec
// and interprets the RenderTree (render/render_tree.tsx) until vnh.18 removes
// that form.

import {
  createElement,
  type LiveElement,
  useAwait,
  useContext,
  useMemo,
  useOne,
} from "@use-gpu/live";
import {
  FontLoader,
  LayoutContext,
  useDeviceContext,
  useFontContext,
  useNoDeviceContext,
} from "@use-gpu/workbench";
import type { GGSpec } from "../ir/types.ts";
import { compile, createPackCache } from "../compile/mod.ts";
import {
  getGpuMarkCounters,
  installGpuInstrumentation,
  isInstrumentFlagSet,
  resetGpuMarkCounters,
} from "./gpu_instrument.ts";
import {
  createFontResources,
  createGlyphTextMeasurer,
  type FontFaceResource,
  type FontResources,
  validateFontRequests,
} from "./font_resources.ts";
import { renderTree } from "./render_tree.tsx";
import {
  GGPlotRoot,
  type GGPlotRootProps,
} from "../components/gg_plot_root.ts";

export * from "./render_tree.tsx";
/** The legacy form: compile a GGSpec (removed by gggplot-vnh.18). */
export interface GGPlotSpecProps {
  spec: GGSpec;
  /** Disable runtime controls for static export hosts that have no event context. */
  interactive?: boolean;
  /** Compatibility shorthand; prefer fontResources for readiness/validation. */
  fonts?: FontFaceResource[];
  fontResources?: FontResources;
  children?: never;
}

/** The component form: plot parts as children (ADR-007). */
export interface GGPlotComponentProps extends GGPlotRootProps {
  spec?: never;
  fonts?: FontFaceResource[];
  fontResources?: FontResources;
}

export type GGPlotProps = GGPlotSpecProps | GGPlotComponentProps;

const GlyphMeasuredPlot = (
  {
    spec,
    interactive = true,
  }: { spec: GGSpec; interactive?: boolean },
) => {
  const rustText = useFontContext();
  const measureText = useMemo(
    () => createGlyphTextMeasurer(rustText),
    [rustText],
  );
  const [left, top, right, bottom] = useContext(LayoutContext) as [
    number,
    number,
    number,
    number,
  ];
  const width = Math.max(right - left, 1);
  const height = Math.max(bottom - top, 1);
  // ONE staged geometry cache (gggplot-tzc.5) for the lifetime of this
  // mounted plot: useOne's default (null) dependency never changes across
  // re-renders, so this is created exactly once per mount, letting an
  // unchanged spec's re-render (or a DSL-rebuilt structurally-identical
  // spec over the same data) reuse the exact same renderer-ready tensors
  // instead of re-uploading them. See compile/pack_cache.ts.
  const packCache = useOne(() => createPackCache());
  // gggplot-tzc.8: dev-only GPU mark-data upload instrumentation, gated
  // behind ?instrument (isInstrumentFlagSet). useDeviceContext/
  // useNoDeviceContext is the same paired-hook-and-no-op idiom
  // render/chunked_line.tsx's useOptionalTensorSource documents — the branch
  // itself is invariant for the lifetime of one mounted instance (the query
  // flag doesn't change mid-session), so calling exactly one side of the
  // pair every render stays hook-order-stable. installGpuInstrumentation is
  // idempotent per device and window.__gggplotGpuInstrument is the probe
  // surface a route (or a Playwright/deno-level driver) reads counters from.
  if (isInstrumentFlagSet()) {
    const device = useDeviceContext();
    useOne(() => {
      installGpuInstrumentation(device);
      if (typeof window !== "undefined") {
        (window as unknown as Record<string, unknown>).__gggplotGpuInstrument =
          {
            getCounters: getGpuMarkCounters,
            reset: resetGpuMarkCounters,
          };
      }
      return true;
    });
  } else {
    useNoDeviceContext();
  }
  const tree = useMemo(
    () =>
      compile(spec, {
        packCache,
        layout: { width, height, measureText },
      }),
    [spec, width, height, measureText],
  );
  const interactiveTree = tree.component === "Scene3D"
    ? { ...tree, props: { ...tree.props, interactive } }
    : tree;
  // The spec path takes every stat on the CPU: GPU-resident products are the
  // component root's (gggplot-vnh.5.1).
  return renderTree(interactiveTree) as LiveElement;
};

/**
 * <GGPlot spec={...} /> — compile a spec and render it as a Live subtree.
 * Mount inside a UseGPU <WebGPU><AutoCanvas><FlatCamera><Pass> host (see
 * apps/site): FlatCamera supplies the pixel-space layout that compile()'s
 * root <Embedded normalize> bridges into Cartesian's normalized coordinates.
 * Wrapped in a host-configurable FontLoader: @use-gpu/plot's <Plot>
 * (established internally by Embedded) always wraps its children in an
 * SDFFontProvider, which throws if no FontContext ancestor exists. Text
 * renders visibly when the host supplies real font sources.
 */
/**
 * Returns a real `LiveElement` (gggplot-05w). Hosts render it from Live JSX
 * with the qualified pragma from `@gggplot/core/jsx`, or with its typed
 * `createElement`. An unqualified JSX pragma checks against React's JSX
 * namespace and rejects any Live component. (Never write the pragma itself in
 * a comment here: esbuild reads it from any comment, and a stray one breaks
 * this file's real factory.)
 */
export const GGPlot = (props: GGPlotProps): LiveElement => {
  const { fonts, fontResources } = props;
  const spec = props.spec;
  const resources = useMemo(
    () => fontResources ?? (fonts?.length ? createFontResources(fonts) : null),
    [fontResources, fonts],
  );
  const [ready, error] = useAwait(
    resources
      ? async () => {
        await resources.ready();
        // The component form checks its theme's fonts once its parts resolve.
        if (spec) validateFontRequests(spec, resources);
        return true;
      }
      : null,
    [resources, spec],
  );
  if (error) throw error;
  if (resources && !ready) return null;
  const content = spec
    ? createElement(GlyphMeasuredPlot, {
      spec,
      interactive: props.interactive,
    })
    : createElement(GGPlotRoot, {
      ...(props as GGPlotComponentProps),
      fontResources: resources,
    });
  return createElement(
    FontLoader,
    { fonts: resources?.faces ?? fonts },
    content as LiveElement,
  );
};
