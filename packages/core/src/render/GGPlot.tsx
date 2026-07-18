/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
// Runtime Live backend — interprets a RenderTree into UseGPU Live elements.
//
// This is the other backend to emitSource(): instead of emitting text, it
// resolves component names to real @use-gpu/plot components and builds the Live
// tree in-memory, so a spec can be rendered directly in the browser.

import {
  createElement,
  Fragment,
  provide,
  useAwait,
  useContext,
  useMemo,
} from "@use-gpu/live";
import {
  Axis,
  Cartesian,
  Embedded,
  Grid,
  Label,
  Line,
  Plot,
  Point,
  Polar,
  Polygon,
} from "@use-gpu/plot";
import {
  FontLoader,
  LayoutContext,
  MatrixContext,
  TransformContext,
  useCombinedMatrixTransform,
  useFontContext,
} from "@use-gpu/workbench";
import { RangeContext } from "@use-gpu/plot/mjs/providers/range-provider.mjs";
import { mat4 } from "gl-matrix";
import {
  ResidentHistogramMark,
  ResidentHistogramView,
} from "../runtime/mod.ts";
import type { ComponentName, RenderNode } from "../compile/rendertree.ts";
import type { GGSpec } from "../ir/types.ts";
import { compile } from "../compile/mod.ts";
import { RotatedLabel } from "./rotated_label.tsx";
import {
  createFontResources,
  createGlyphTextMeasurer,
  type FontFaceResource,
  type FontResources,
  validateFontRequests,
} from "./font_resources.ts";
import { facetCellLayouts } from "../compile/facet_layout.ts";

export interface FacetGridProps {
  nrow: number;
  ncol: number;
  gap?: number;
  stripHeight?: number;
  /** Documents shared versus panel-local axis semantics for backend parity. */
  axisPolicy?: "fixed" | "free" | "free_x" | "free_y";
  /** Normalized guide-layout bounds occupied by the complete facet grid. */
  bounds?: [number, number, number, number];
  // Live's createElement collapses a single child to a bare value instead of
  // a 1-element array (see jsx.mjs's toChildren), so this may arrive as
  // either shape.
  children?: unknown[] | unknown;
}

export interface FacetPanelProps {
  layout: [number, number, number, number];
  children?: unknown[] | unknown;
}

export interface PanelViewportProps {
  bounds: [number, number, number, number];
  children?: unknown[] | unknown;
}

/**
 * Mount a facet against its concrete rectangle without nesting another Plot.
 * Embedded always starts a VirtualLayers reconciler; facets need their panel
 * transform, but must submit all marks to the one reconciler owned by the
 * outer chart Embedded.
 */
export const FacetPanel = ({ layout, children }: FacetPanelProps) => {
  const [range, matrix] = useMemo(() => {
    const [left, top, right, bottom] = layout;
    const width = right - left;
    const height = bottom - top;
    return [
      [[-1, 1], [-1, 1], [-1, 1], [-1, 1]],
      mat4.fromValues(
        width / 2,
        0,
        0,
        0,
        0,
        height / 2,
        0,
        0,
        0,
        0,
        1,
        0,
        left + width / 2,
        top + height / 2,
        0,
        1,
      ),
    ];
  }, [layout]);
  const [context, combined] = useCombinedMatrixTransform(matrix);
  return provide(
    MatrixContext,
    combined,
    provide(
      TransformContext,
      context,
      provide(RangeContext, range, children as never),
    ),
  );
};

/** Convert normalized outer-chart bounds into an inset pixel-space panel. */
export const PanelViewport = ({ bounds, children }: PanelViewportProps) => {
  const [x0, y0, x1, y1] = bounds;
  const matrix = useMemo(
    () =>
      mat4.fromValues(
        (x1 - x0) / 2,
        0,
        0,
        0,
        0,
        (y1 - y0) / 2,
        0,
        0,
        0,
        0,
        1,
        0,
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        0,
        1,
      ),
    [x0, y0, x1, y1],
  );
  const [context, combined] = useCombinedMatrixTransform(matrix);
  return provide(
    MatrixContext,
    combined,
    provide(TransformContext, context, children as never),
  );
};

/** Keep a polar chart circular within a rectangular host canvas. */
export const RadialViewport = (
  { children }: { children?: unknown[] | unknown },
) => {
  const [left, top, right, bottom] = useContext(LayoutContext) as [
    number,
    number,
    number,
    number,
  ];
  const aspect = (bottom - top) / (right - left);
  const matrix = useMemo(
    () =>
      new Float32Array([
        aspect,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
      ]),
    [aspect],
  );
  const [context, combined] = useCombinedMatrixTransform(matrix);
  return provide(
    MatrixContext,
    combined,
    provide(TransformContext, context, children as never),
  );
};

/**
 * Not a real @use-gpu/plot export (see rendertree.ts) — divides the ambient
 * ancestor LayoutContext pixel rect ([left, top, right, bottom]) into an
 * nrow x ncol grid with `gap` px between cells. All cells remain inside the
 * one outer Embedded/Plot reconciler; each child gets a normalized
 * PanelViewport matrix so its marks participate in the same virtual-layer
 * submission while rendering into a distinct rectangle.
 */
export const FacetGrid = (props: FacetGridProps) => {
  const {
    nrow,
    ncol,
    gap = 24,
    stripHeight = 24,
    bounds = [-1, -1, 1, 1],
    children,
  } = props;
  const kids = Array.isArray(children)
    ? children
    : children != null
    ? [children]
    : [];
  const [left, top, right, bottom] = useContext(LayoutContext) as [
    number,
    number,
    number,
    number,
  ];
  const hostWidth = Math.max(right - left, 1);
  const hostHeight = Math.max(bottom - top, 1);
  const width = hostWidth * (bounds[2] - bounds[0]) / 2;
  const height = hostHeight * (bounds[3] - bounds[1]) / 2;
  const layouts = facetCellLayouts(width, height, nrow, ncol, gap, stripHeight);

  const cells = createElement(
    Fragment,
    {},
    ...kids.map((child, i) => {
      const panel = layouts[i].panel;
      const cellBounds: [number, number, number, number] = [
        bounds[0] + panel[0] / width * (bounds[2] - bounds[0]),
        bounds[1] + panel[1] / height * (bounds[3] - bounds[1]),
        bounds[0] + panel[2] / width * (bounds[2] - bounds[0]),
        bounds[1] + panel[3] / height * (bounds[3] - bounds[1]),
      ];
      return createElement(
        PanelViewport,
        { bounds: cellBounds },
        child as never,
      );
    }),
  );
  return cells;
};

// deno-lint-ignore no-explicit-any
const REGISTRY: Partial<Record<ComponentName, any>> = {
  Plot,
  Embedded,
  Cartesian,
  Polar,
  Axis,
  Grid,
  Point,
  Line,
  Polygon,
  Label: (props: Record<string, unknown>) =>
    typeof props.angle === "number" && props.angle !== 0
      ? createElement(RotatedLabel, props)
      : createElement(Label, props),
  ResidentHistogram: ResidentHistogramMark,
  ResidentHistogramView,
  FacetGrid,
  // FacetGrid consumes this transparent grouping and mounts a normalized
  // PanelViewport around each group inside the outer Embedded.
  FacetPanel: Fragment,
  PanelViewport,
  RadialViewport,
};

/** Recursively turn a RenderNode into a Live element. */
export function renderTree(n: RenderNode): unknown {
  const Component = REGISTRY[n.component];
  if (!Component) {
    console.warn(`[gggplot] no Live component for "${n.component}"`);
    return null;
  }
  const children = n.children.map(renderTree);
  return createElement(Component, n.props, ...children);
}

export interface GGPlotProps {
  spec: GGSpec;
  /** Compatibility shorthand; prefer fontResources for readiness/validation. */
  fonts?: FontFaceResource[];
  fontResources?: FontResources;
}

const GlyphMeasuredPlot = ({ spec }: { spec: GGSpec }) => {
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
  const tree = compile(spec, {
    resident: true,
    layout: {
      width: Math.max(right - left, 1),
      height: Math.max(bottom - top, 1),
      measureText,
    },
  });
  // deno-lint-ignore no-explicit-any
  return renderTree(tree) as any;
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
export const GGPlot = ({ spec, fonts, fontResources }: GGPlotProps) => {
  const resources = useMemo(
    () => fontResources ?? (fonts?.length ? createFontResources(fonts) : null),
    [fontResources, fonts],
  );
  const [ready, error] = useAwait(
    resources
      ? async () => {
        await resources.ready();
        validateFontRequests(spec, resources);
        return true;
      }
      : null,
    [resources, spec],
  );
  if (error) throw error;
  if (resources && !ready) return null;
  // deno-lint-ignore no-explicit-any
  return createElement(
    FontLoader,
    { fonts: resources?.faces ?? fonts },
    createElement(GlyphMeasuredPlot, { spec }) as any,
  );
};
