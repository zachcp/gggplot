import type { Facet } from "../ir/types.ts";
import type { SpecPart } from "./base.ts";

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

/**
 * Cartesian coordinates, optionally zoomed.
 *
 * `xlim`/`ylim`/`zlim` are ggplot2's coord_cartesian limits: they narrow the
 * VIEW without removing rows, so stats keep seeing every observation. That is
 * the whole distinction from a scale `domain`, which censors before the stat
 * runs -- the canonical example being a boxplot where zooming must not silently
 * recompute the summary from the surviving rows (gggplot-b06).
 *
 * Marks outside the zoomed view are clipped to the panel rather than dropped.
 */
export const coordCartesian = (
  options: Record<string, unknown> = {},
): SpecPart => {
  const { axes, xlim, ylim, zlim, ...rest } = options;
  const params: Record<string, unknown> = { ...rest };
  const limits = {
    ...(coordLimit(xlim, "xlim") ? { x: coordLimit(xlim, "xlim") } : {}),
    ...(coordLimit(ylim, "ylim") ? { y: coordLimit(ylim, "ylim") } : {}),
    ...(coordLimit(zlim, "zlim") ? { z: coordLimit(zlim, "zlim") } : {}),
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
};
/** `theta: "y"` reassigns the angle to the y aesthetic instead of x (ggplot2's coord_polar(theta = "y")); any other opts pass through to the Polar view unchanged. */
export const coordPolar = (opts: Record<string, unknown> = {}): SpecPart => {
  const { theta, ...params } = opts;
  const axes = theta === "y" ? "yx" : undefined;
  return {
    tag: "coord",
    value: { kind: "polar", params, ...(axes ? { axes } : {}) },
  };
};
/** Partial-circle/donut polar coordinate system (ggplot2's coord_radial). */
export const coordRadial = (opts: {
  start?: number;
  end?: number;
  donut?: number;
  rotateAngle?: boolean;
  theta?: "x" | "y";
} = {}): SpecPart => {
  const { theta, ...params } = opts;
  return {
    tag: "coord",
    value: {
      kind: "polar",
      params: { start: 0, end: Math.PI * 2, donut: 0, ...params, radial: true },
      ...(theta === "y" ? { axes: "yx" } : {}),
    },
  };
};
/** Cartesian coordinates with a locked y:x unit aspect ratio. */
export const coordFixed = (ratio = 1): SpecPart => ({
  tag: "coord",
  value: { kind: "cartesian", params: { ratio, fixed: true } },
});
/** Swaps rendered x/y axes without touching mark positions or trained domains. */
export const coordFlip = (): SpecPart => ({
  tag: "coord",
  value: { kind: "cartesian", axes: "yx" },
});

export const facetWrap = (
  vars: string[],
  ncol?: number,
  scales: Facet["scales"] = "fixed",
): SpecPart => ({
  tag: "facet",
  value: { kind: "wrap", rows: vars, ncol, scales },
});
export const facetGrid = (
  rows: string[],
  cols: string[],
  scales: Facet["scales"] = "fixed",
): SpecPart => ({
  tag: "facet",
  value: { kind: "grid", rows, cols, scales },
});
