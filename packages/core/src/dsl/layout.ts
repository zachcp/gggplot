import type { Facet } from "../ir/types.ts";
import type { SpecPart } from "./base.ts";

export const coordCartesian = (
  options: Record<string, unknown> = {},
): SpecPart => {
  const { axes, ...params } = options;
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
