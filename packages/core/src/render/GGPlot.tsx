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
  makeContext,
  provide,
  useAwait,
  useContext,
  useMemo,
  useOne,
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
  Tick,
} from "@use-gpu/plot";
import {
  FlatCamera,
  FontLoader,
  LayoutContext,
  MatrixContext,
  OrbitCamera,
  Pass,
  TransformContext,
  useCombinedMatrixTransform,
  useDeviceContext,
  useFontContext,
  useNoDeviceContext,
} from "@use-gpu/workbench";
import { OrbitControls } from "@use-gpu/interact";
import { RangeContext } from "@use-gpu/plot/mjs/providers/range-provider.mjs";
import { mat4 } from "gl-matrix";
import { resolveResidentProduct } from "../runtime/mod.ts";
import type { ComponentName, RenderNode } from "../compile/rendertree.ts";
import type { FlatTensor } from "../compile/rendertree.ts";
import type { Camera3D, GGSpec } from "../ir/types.ts";
import { compile, createPackCache } from "../compile/mod.ts";
import { cameraNearOrigin3d } from "../compile/guides_3d.ts";
import { RotatedLabel } from "./rotated_label.tsx";
import { ChunkedLine } from "./chunked_line.tsx";
import { ChunkedFace } from "./chunked_face.tsx";
import {
  getGpuMarkCounters,
  installGpuInstrumentation,
  isInstrumentFlagSet,
  registerKnownMarkArray,
  resetGpuMarkCounters,
} from "./gpu_instrument.ts";
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

interface CameraOrbitState {
  bearing: number;
  pitch: number;
}

const CameraOrbitContext = makeContext<CameraOrbitState>(
  { bearing: 0, pitch: 0 },
  "CameraOrbitContext",
);

const axisIndex3d = (axis: string): 0 | 1 | 2 =>
  axis === "x" ? 0 : axis === "y" ? 1 : 2;

/** Keep the complete axis guide on the camera-near cube edge while orbiting. */
export const CameraAxis3D = (props: Record<string, unknown>) => {
  const { bearing, pitch } = useContext(CameraOrbitContext);
  const axis = props.axis as "x" | "y" | "z";
  const axisIndex = axisIndex3d(axis);
  const domains = props.domains as [
    [number, number],
    [number, number],
    [number, number],
  ];
  const range = props.range as [number, number];
  const values = props.values as number[];
  const origin = cameraNearOrigin3d(domains, bearing, pitch);
  const positions = values.map((value) => {
    const position: [number, number, number, number] = [...origin, 1];
    position[axisIndex] = value;
    return position;
  });
  const offsetIndex = axis === "y" ? 0 : 1;
  const offsetSign = origin[offsetIndex] === domains[offsetIndex][0] ? -1 : 1;
  const offset = [0, 0, 0, 0];
  offset[offsetIndex] = offsetSign;
  const spacing = positions.length > 1
    ? (range[1] - range[0]) / (positions.length - 1)
    : 1;
  const tangent = [0, 0, 0, 0];
  tangent[axisIndex] = spacing;
  const labelOffset = axis === "y" ? [offsetSign * 7, 0] : [0, offsetSign * 7];
  const titleDistance = 5 + Number(props.fontSize) * 2.5;
  const titleOffset = axis === "y"
    ? [offsetSign * titleDistance, 0]
    : [0, offsetSign * titleDistance];
  const labelFace = {
    ...(props.family ? { family: props.family } : {}),
    ...(props.weight ? { weight: props.weight } : {}),
    ...(props.style ? { style: props.style } : {}),
  };
  const titlePosition: [number, number, number, number] = [...origin, 1];
  titlePosition[axisIndex] = (range[0] + range[1]) / 2;
  return createElement(
    Fragment,
    {},
    createElement(Axis, {
      axis,
      origin,
      range,
      color: props.axisColor,
      width: props.axisWidth,
      zBias: 0,
    }),
    positions.length
      ? createElement(Tick, {
        positions,
        offset,
        tangent,
        size: 5,
        color: props.axisColor,
        width: props.axisWidth,
        depth: 0,
        zBias: 1,
      })
      : null,
    positions.length
      ? createElement(Label, {
        positions,
        labels: props.labels,
        color: props.textColor,
        size: props.tickSize,
        depth: 0,
        placement: props.placement,
        offset: labelOffset,
        zBias: 2,
        ...labelFace,
      })
      : null,
    props.title
      ? createElement(Label, {
        position: titlePosition,
        label: props.title,
        color: props.textColor,
        size: props.fontSize,
        depth: 0,
        placement: props.placement,
        offset: titleOffset,
        zBias: 2,
        ...labelFace,
      })
      : null,
  );
};

/** RenderTree's two-branch 3D wrapper: scene first, flat overlay second. */
export const Scene3D = (
  { camera, children, interactive = true }: {
    camera: Camera3D;
    interactive?: boolean;
    children?: unknown[] | unknown;
  },
) => {
  const kids = Array.isArray(children)
    ? children
    : children != null
    ? [children]
    : [];
  const scene = kids[0] ?? null;
  const overlay = kids[1] ?? null;
  const cameraScene = !interactive
    ? createElement(
      OrbitCamera,
      {
        radius: camera.radius,
        bearing: camera.bearing,
        pitch: camera.pitch,
        target: camera.target,
        fov: camera.fov,
        near: camera.near,
        far: camera.far,
      },
      createElement(
        Pass,
        {},
        provide(
          CameraOrbitContext,
          { bearing: camera.bearing, pitch: camera.pitch },
          scene as never,
        ),
      ),
    )
    : createElement(
      OrbitControls,
      {
        radius: camera.radius,
        bearing: camera.bearing,
        pitch: camera.pitch,
        target: camera.target,
      },
      (
        radius: number,
        bearing: number,
        pitch: number,
        target: ArrayLike<number>,
      ) =>
        createElement(
          OrbitCamera,
          {
            radius,
            bearing,
            pitch,
            target,
            fov: camera.fov,
            near: camera.near,
            far: camera.far,
          },
          createElement(
            Pass,
            {},
            provide(CameraOrbitContext, { bearing, pitch }, scene as never),
          ),
        ),
    );
  return createElement(
    Fragment,
    {},
    cameraScene,
    createElement(
      FlatCamera,
      {},
      createElement(Pass, { overlay: true }, overlay as never),
    ),
  );
};

/** vec4 point tensors need the explicit WGSL source format used by use.gpu. */
const PointNode = (props: Record<string, unknown>) => {
  const positions = props.positions as FlatTensor | undefined;
  const markSource = (tensor: FlatTensor): Record<string, unknown> => ({
    ...tensor,
    format: tensor.format === "vec4"
      ? "vec4<f32>"
      : tensor.format === "vec2"
      ? "vec2<f32>"
      : "f32",
  });
  return createElement(Point, {
    ...props,
    ...(positions?.dims === 4
      ? {
        positions: markSource(positions),
        ...(props.colors
          ? { colors: markSource(props.colors as FlatTensor) }
          : {}),
        ...(props.sizes
          ? { sizes: markSource(props.sizes as FlatTensor) }
          : {}),
      }
      : {}),
  });
};

// deno-lint-ignore no-explicit-any
const REGISTRY: Partial<Record<ComponentName, any>> = {
  Plot,
  Embedded,
  Cartesian,
  Polar,
  Axis,
  Tick,
  Grid,
  GuideLines: Line,
  CameraAxis3D,
  Point: PointNode,
  Line,
  Polygon,
  // ChunkedLine (gggplot-tzc.3) is NOT a @use-gpu/plot export — see
  // render/chunked_line.tsx for the spike finding and its LineLayer-based
  // realization. The 'Line' mapping directly above stays the untouched
  // plot Line delegate, so guide/axis/annotation/reference-line nodes
  // (which always use component 'Line') are unaffected by this addition.
  ChunkedLine,
  // ChunkedFace (gggplot-tzc.4) is NOT a @use-gpu/plot export — see
  // render/chunked_face.tsx for the concavity spike finding and its
  // FaceLayer-based realization. The 'Polygon' mapping directly above stays
  // the untouched plot Polygon delegate, so guide/legend and the
  // theme-background panel (which always use component 'Polygon') are
  // unaffected by this addition.
  ChunkedFace,
  Label: (props: Record<string, unknown>) =>
    typeof props.angle === "number" && props.angle !== 0
      ? createElement(RotatedLabel, props)
      : createElement(Label, props),
  // Generic resident node: resolve product id → live component through the
  // runtime registry, then mount it with the node's remaining (serializable)
  // props. `view` selects the standalone auto-domain form.
  ResidentProduct: (props: Record<string, unknown>) => {
    const { product, view, ...rest } = props;
    const component = resolveResidentProduct(product as string, view === true);
    // deno-lint-ignore no-explicit-any
    return createElement(component as any, rest);
  },
  FacetGrid,
  // FacetGrid consumes this transparent grouping and mounts a normalized
  // PanelViewport around each group inside the outer Embedded.
  FacetPanel: Fragment,
  PanelViewport,
  RadialViewport,
  Scene3D,
};

/** Mark-tensor prop names carried by Point-family RenderNodes (see
 * geom/point.ts/geom/errorbar.ts/geom/text.ts's Point-emitting paths). */
const POINT_TENSOR_PROPS = ["positions", "colors", "sizes", "widths", "alphas"];

/**
 * gggplot-tzc.8: Point (unlike ChunkedLine/ChunkedFace) is NOT our own
 * wrapper — it delegates straight to @use-gpu/plot's own <Point>, which
 * builds its raw GPU sources deep inside a deferred shape-reconciler
 * pipeline (see gpu_instrument.ts's module doc) that withMarkAttribution's
 * synchronous bracket cannot reach. As a documented, narrower fallback, this
 * registers each Point node's own FlatTensor arrays as "known mark data" at
 * RenderTree-to-Live-element construction time — BEFORE Live mounts/renders
 * anything — so gpu_instrument.ts's writeBuffer patch can corroborate a
 * later write against these array identities (optional corroboration; NEVER
 * used for create attribution, which stays unavailable for Point pending a
 * deeper @use-gpu/plot-internal spike — see the bd note on this bead).
 * No-op unless ?instrument is set.
 */
function registerPointMarkArrays(n: RenderNode): void {
  if (n.component !== "Point") return;
  for (const key of POINT_TENSOR_PROPS) {
    const value = n.props[key];
    if (
      value && typeof value === "object" &&
      (value as FlatTensor).array instanceof Float32Array
    ) {
      registerKnownMarkArray((value as FlatTensor).array);
    }
  }
}

/** Recursively turn a RenderNode into a Live element. */
export function renderTree(n: RenderNode): unknown {
  if (isInstrumentFlagSet()) registerPointMarkArrays(n);
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
  /** Disable runtime controls for static export hosts that have no event context. */
  interactive?: boolean;
  /** Compatibility shorthand; prefer fontResources for readiness/validation. */
  fonts?: FontFaceResource[];
  fontResources?: FontResources;
}

const GlyphMeasuredPlot = (
  { spec, interactive = true }: { spec: GGSpec; interactive?: boolean },
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
        resident: true,
        packCache,
        layout: { width, height, measureText },
      }),
    [spec, width, height, measureText],
  );
  // deno-lint-ignore no-explicit-any
  const renderedTree = tree.component === "Scene3D"
    ? { ...tree, props: { ...tree.props, interactive } }
    : tree;
  return renderTree(renderedTree) as any;
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
export const GGPlot = (
  { spec, interactive, fonts, fontResources }: GGPlotProps,
) => {
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
    createElement(GlyphMeasuredPlot, { spec, interactive }) as any,
  );
};
