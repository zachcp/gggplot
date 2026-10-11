// Plot-part components: scales, coords, facets, themes, labels, camera and
// execution as children of <GGPlot> (gggplot-vnh.7.1, ADR-007).
//
// Each is the JSX form of one DSL constructor: <ScaleXLog10/> reports the part
// scaleXLog10() builds, through GGPart, and the root applies parts in tree
// order with the DSL's `add` semantics (a later coord replaces an earlier one;
// themes and labels merge). Props are typed, so a wrong prop fails deno check.
//
// Every component also carries `part`, its pure props -> SpecPart mapping, so
// the DSL-equivalence test needs no Live tree.
import type { LiveElement } from "@use-gpu/live";
import type { SpecPart } from "../dsl/base.ts";
import {
  camera3DFromLookAt,
  type CameraBounds3D,
  type CameraFit3DOptions,
  fitCamera3D,
  type LookAtCamera3D,
  resolveCamera3D,
} from "../ir/camera.ts";
import type {
  AesName,
  Camera3DOptions,
  ExecutionPolicy,
  Facet,
  PlotLabels,
  Scale,
  Theme,
} from "../ir/types.ts";
import { GRADIENT2_RAMP, VIRIDIS_RAMP } from "../scale/palette.ts";
import { createElement, useMemo } from "../runtime/usegpu_compat.ts";
import { GGPart } from "./parts.ts";
import { useStableProps } from "./stable_props.ts";

/** A plot-part component and the part it reports. */
export type PartComponent<P> = ((props: P) => LiveElement) & {
  part: (props: P) => SpecPart;
};

function partComponent<P extends object>(
  toPart: (props: P) => SpecPart,
): PartComponent<P> {
  const part = (props: P): SpecPart => {
    // Live leaves `key` and `children` on props; neither is a part option.
    const { key: _key, children: _children, ...rest } = props as
      & P
      & Record<string, unknown>;
    return toPart(rest as P);
  };
  return Object.assign(
    (props: P): LiveElement => {
      const stable = useStableProps(props as Record<string, unknown>) as P;
      const reported = useMemo(() => part(stable), [stable]);
      return createElement(GGPart, { part: reported });
    },
    { part },
  );
}

// --- scales ----------------------------------------------------------------

/** A scale's options; the aesthetic is the component's. */
export type ScaleProps = Omit<Partial<Scale>, "aes">;

const scale = (
  aes: AesName,
  kind: Scale["kind"],
  defaults: Partial<Scale> = {},
): PartComponent<ScaleProps> =>
  partComponent<ScaleProps>((props) => ({
    tag: "scale",
    value: { aes, kind, ...defaults, ...props },
  }));

export const ScaleXContinuous: PartComponent<ScaleProps> = scale(
  "x",
  "continuous",
);
export const ScaleYContinuous: PartComponent<ScaleProps> = scale(
  "y",
  "continuous",
);
export const ScaleZContinuous: PartComponent<ScaleProps> = scale(
  "z",
  "continuous",
);
export const ScaleXDiscrete: PartComponent<ScaleProps> = scale(
  "x",
  "discrete",
);
export const ScaleYDiscrete: PartComponent<ScaleProps> = scale(
  "y",
  "discrete",
);
export const ScaleZDiscrete: PartComponent<ScaleProps> = scale(
  "z",
  "discrete",
);
export const ScaleXLog10: PartComponent<ScaleProps> = scale("x", "log");
export const ScaleYLog10: PartComponent<ScaleProps> = scale("y", "log");
export const ScaleZLog10: PartComponent<ScaleProps> = scale("z", "log");
export const ScaleXSqrt: PartComponent<ScaleProps> = scale("x", "sqrt");
export const ScaleYSqrt: PartComponent<ScaleProps> = scale("y", "sqrt");
export const ScaleZSqrt: PartComponent<ScaleProps> = scale("z", "sqrt");
export const ScaleColor: PartComponent<ScaleProps> = scale("color", "color");
export const ScaleFill: PartComponent<ScaleProps> = scale("fill", "color");
/** Continuous viridis ramp for a mapped color. */
export const ScaleColorViridis: PartComponent<ScaleProps> = scale(
  "color",
  "color",
  { range: [...VIRIDIS_RAMP] },
);
/** Continuous viridis ramp for a mapped fill. */
export const ScaleFillViridis: PartComponent<ScaleProps> = scale(
  "fill",
  "color",
  { range: [...VIRIDIS_RAMP] },
);
/** Blue-white-red diverging ramp for a mapped color. */
export const ScaleColorGradient2: PartComponent<ScaleProps> = scale(
  "color",
  "color",
  { range: [...GRADIENT2_RAMP] },
);
/** Blue-white-red diverging ramp for a mapped fill. */
export const ScaleFillGradient2: PartComponent<ScaleProps> = scale(
  "fill",
  "color",
  { range: [...GRADIENT2_RAMP] },
);
export const ScaleSize: PartComponent<ScaleProps> = scale("size", "continuous");
export const ScaleAlpha: PartComponent<ScaleProps> = scale(
  "alpha",
  "continuous",
);
export const ScaleShape: PartComponent<ScaleProps> = scale("shape", "discrete");
/** Discrete levels onto dash patterns. */
export const ScaleLinetype: PartComponent<ScaleProps> = scale(
  "linetype",
  "discrete",
);
/** A continuous column onto line width in device pixels. */
export const ScaleLinewidth: PartComponent<ScaleProps> = scale(
  "linewidth",
  "continuous",
);
/** A continuous column onto point outline width. */
export const ScaleStroke: PartComponent<ScaleProps> = scale(
  "stroke",
  "continuous",
);

// --- coords ----------------------------------------------------------------

/** A coord limit: two finite numbers, low first. */
function coordLimit(
  value: unknown,
  name: string,
): [number, number] | undefined {
  if (value == null) return undefined;
  if (
    !Array.isArray(value) || value.length !== 2 ||
    !value.every((n) => typeof n === "number" && Number.isFinite(n))
  ) {
    throw new TypeError(
      `[gggplot] coordCartesian ${name} must be [min, max] of two finite numbers`,
    );
  }
  const [lo, hi] = value as [number, number];
  if (!(lo < hi)) {
    throw new RangeError(
      `[gggplot] coordCartesian ${name} must have min < max, received [${lo}, ${hi}]`,
    );
  }
  return [lo, hi];
}

export interface CoordCartesianProps {
  /** Zoom limits: narrow the view without removing rows (ggplot2's xlim). */
  xlim?: [number, number];
  ylim?: [number, number];
  zlim?: [number, number];
  /** Axis assignment, e.g. "yx" to swap the rendered axes. */
  axes?: string;
  /** Options passed through to the view untyped. */
  params?: Record<string, unknown>;
}

/**
 * Cartesian coordinates, optionally zoomed. Limits narrow the VIEW; stats
 * still see every row, unlike a scale `domain`, which censors first.
 */
export const CoordCartesian: PartComponent<CoordCartesianProps> = partComponent<
  CoordCartesianProps
>(({ axes, xlim, ylim, zlim, params: extra }) => {
  const params: Record<string, unknown> = { ...extra };
  const x = coordLimit(xlim, "xlim");
  const y = coordLimit(ylim, "ylim");
  const z = coordLimit(zlim, "zlim");
  const limits = {
    ...(x ? { x } : {}),
    ...(y ? { y } : {}),
    ...(z ? { z } : {}),
  };
  if (Object.keys(limits).length) params.limits = limits;
  return {
    tag: "coord",
    value: {
      kind: "cartesian",
      ...(typeof axes === "string" ? { axes } : {}),
      ...(Object.keys(params).length ? { params } : {}),
    },
  };
});

export interface CoordPolarProps {
  /** "y" puts the angle on y instead of x (ggplot2's theta = "y"). */
  theta?: "x" | "y";
  /** Start and end angles, radians. */
  start?: number;
  end?: number;
  /** Options passed through to the Polar view untyped. */
  params?: Record<string, unknown>;
}

export const CoordPolar: PartComponent<CoordPolarProps> = partComponent<
  CoordPolarProps
>(({ theta, params: extra, ...params }) => ({
  tag: "coord",
  value: {
    kind: "polar",
    params: { ...extra, ...params },
    ...(theta === "y" ? { axes: "yx" } : {}),
  },
}));

export interface CoordRadialProps {
  start?: number;
  end?: number;
  /** Inner radius as a fraction of the outer. */
  donut?: number;
  rotateAngle?: boolean;
  theta?: "x" | "y";
}

/** Partial-circle / donut polar coordinates (ggplot2's coord_radial). */
export const CoordRadial: PartComponent<CoordRadialProps> = partComponent<
  CoordRadialProps
>(({ theta, ...params }) => ({
  tag: "coord",
  value: {
    kind: "polar",
    params: { start: 0, end: Math.PI * 2, donut: 0, ...params, radial: true },
    ...(theta === "y" ? { axes: "yx" } : {}),
  },
}));

/** Cartesian coordinates with a locked y:x unit aspect ratio. */
export const CoordFixed: PartComponent<{ ratio?: number }> = partComponent<
  { ratio?: number }
>(({ ratio = 1 }) => ({
  tag: "coord",
  value: { kind: "cartesian", params: { ratio, fixed: true } },
}));

/** Swaps the rendered axes without touching positions or trained domains. */
export const CoordFlip: PartComponent<Record<never, never>> = partComponent(
  () => ({ tag: "coord", value: { kind: "cartesian", axes: "yx" } }),
);

// --- facets ----------------------------------------------------------------

export interface FacetWrapProps {
  /** Columns whose combinations become panels. */
  vars: string[];
  ncol?: number;
  scales?: Facet["scales"];
}

export const FacetWrap: PartComponent<FacetWrapProps> = partComponent<
  FacetWrapProps
>(({ vars, ncol, scales = "fixed" }) => ({
  tag: "facet",
  value: { kind: "wrap", rows: vars, ncol, scales },
}));

export interface FacetGridProps {
  rows: string[];
  cols: string[];
  scales?: Facet["scales"];
}

export const FacetGrid: PartComponent<FacetGridProps> = partComponent<
  FacetGridProps
>(({ rows, cols, scales = "fixed" }) => ({
  tag: "facet",
  value: { kind: "grid", rows, cols, scales },
}));

// --- labels and themes -----------------------------------------------------

/** Plot, axis and legend titles (ggplot2's labs()). */
export const Labs: PartComponent<PlotLabels> = partComponent<PlotLabels>(
  (value) => ({ tag: "labels", value }),
);

/**
 * Theme overrides, merged over any earlier theme (ggplot2's theme()). Named
 * apart from the `Theme` type it takes.
 */
export const ThemeOverrides: PartComponent<Partial<Theme>> = partComponent<
  Partial<Theme>
>((value) => ({ tag: "theme", value }));

/** A complete theme; props override its fields. */
const preset = (base: Theme): PartComponent<Partial<Theme>> =>
  partComponent<Partial<Theme>>((overrides) => ({
    tag: "theme",
    value: { ...base, ...overrides },
  }));

export const ThemeMinimal: PartComponent<Partial<Theme>> = preset({
  name: "minimal",
});
/** Axes only: no panel background, no grid (ggplot2's theme_classic). */
export const ThemeClassic: PartComponent<Partial<Theme>> = preset({
  name: "classic",
  grid: false,
});
/** Grey panel, white grid (ggplot2's default theme_grey). */
export const ThemeGrey: PartComponent<Partial<Theme>> = preset({
  name: "grey",
  background: "#ebebeb",
  gridColor: "#ffffff",
});
export const ThemeBw: PartComponent<Partial<Theme>> = preset({
  name: "bw",
  background: "#ffffff",
  gridColor: "#d9d9d9",
  axisColor: "#000000",
});
export const ThemeLinedraw: PartComponent<Partial<Theme>> = preset({
  name: "linedraw",
  background: "#ffffff",
  gridColor: "#d0d0d0",
  gridWidth: 0.5,
  axisColor: "#000000",
  axisWidth: 0.5,
});
export const ThemeLight: PartComponent<Partial<Theme>> = preset({
  name: "light",
  background: "#ffffff",
  gridColor: "#dedede",
  axisColor: "#8a8a8a",
});
export const ThemeDark: PartComponent<Partial<Theme>> = preset({
  name: "dark",
  background: "#303030",
  gridColor: "#666666",
  axisColor: "#ffffff",
  textColor: "#ffffff",
});
export const ThemeVoid: PartComponent<Partial<Theme>> = preset({
  name: "void",
  background: null,
  grid: false,
  axes: false,
});
export const ThemeTest: PartComponent<Partial<Theme>> = preset({
  name: "test",
  background: "#ffffff",
  gridColor: "#c8c8c8",
  axisColor: "#000000",
  fontSize: 11,
});

// --- camera and execution --------------------------------------------------

/** The plot's initial 3D view, resolved against stable defaults. */
export const Camera3d: PartComponent<Camera3DOptions> = partComponent<
  Camera3DOptions
>((options) => ({ tag: "camera", value: resolveCamera3D(options) }));

/** A camera framed to fit `bounds` rather than the unit cube. */
export const Camera3dFit: PartComponent<
  CameraFit3DOptions & { bounds: CameraBounds3D }
> = partComponent<CameraFit3DOptions & { bounds: CameraBounds3D }>(
  ({ bounds, ...options }) => ({
    tag: "camera",
    value: fitCamera3D(bounds, options),
  }),
);

/** A look-at camera, converted to the canonical orbit camera. */
export const Camera3dFromLookAt: PartComponent<LookAtCamera3D> = partComponent<
  LookAtCamera3D
>((input) => ({ tag: "camera", value: camera3DFromLookAt(input) }));

/** Plot-level execution policy, e.g. <Execution resident={false}/>. */
export const Execution: PartComponent<ExecutionPolicy> = partComponent<
  ExecutionPolicy
>((value) => ({ tag: "execution", value }));
