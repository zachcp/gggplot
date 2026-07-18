import type { Guide, Scale } from "../ir/types.ts";
import { GRADIENT2_RAMP, VIRIDIS_RAMP } from "../scale/palette.ts";
import type { SpecPart } from "./base.ts";

export const scaleXContinuous = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "x", kind: "continuous", ...opts },
});
export const scaleYContinuous = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "y", kind: "continuous", ...opts },
});
export const scaleXDiscrete = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "x", kind: "discrete", ...opts },
});
export const scaleYDiscrete = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "y", kind: "discrete", ...opts },
});
export const scaleXLog10 = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "x", kind: "log", ...opts },
});
export const scaleYLog10 = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "y", kind: "log", ...opts },
});
export const scaleXSqrt = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "x", kind: "sqrt", ...opts },
});
export const scaleYSqrt = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "y", kind: "sqrt", ...opts },
});
export const scaleColor = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "color", kind: "color", ...opts },
});
export const scaleFill = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "fill", kind: "color", ...opts },
});
/** Continuous viridis ramp for a mapped color aesthetic. */
export const scaleColorViridis = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "color", kind: "color", range: [...VIRIDIS_RAMP], ...opts },
});
/** Continuous viridis ramp for a mapped fill aesthetic. */
export const scaleFillViridis = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "fill", kind: "color", range: [...VIRIDIS_RAMP], ...opts },
});
/** Blue-white-red diverging ramp for a mapped color aesthetic. */
export const scaleColorGradient2 = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "color", kind: "color", range: [...GRADIENT2_RAMP], ...opts },
});
/** Blue-white-red diverging ramp for a mapped fill aesthetic. */
export const scaleFillGradient2 = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "fill", kind: "color", range: [...GRADIENT2_RAMP], ...opts },
});
export const scaleSize = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "size", kind: "continuous", ...opts },
});
export const scaleAlpha = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "alpha", kind: "continuous", ...opts },
});
export const scaleShape = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "shape", kind: "discrete", ...opts },
});
/** Map discrete levels onto dash patterns for connected line marks. */
export const scaleLinetype = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "linetype", kind: "discrete", ...opts },
});
/** Map a continuous data column onto line width in device pixels. */
export const scaleLinewidth = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "linewidth", kind: "continuous", ...opts },
});
/** Map a continuous data column onto point outline width. */
export const scaleStroke = (opts: Partial<Scale> = {}): SpecPart => ({
  tag: "scale",
  value: { aes: "stroke", kind: "continuous", ...opts },
});

export const guideColourbar = (opts: Omit<Guide, "kind"> = {}): Guide => ({
  kind: "colorbar",
  ...opts,
});
export const guideColorbar = guideColourbar;
export const guideColoursteps = (opts: Omit<Guide, "kind"> = {}): Guide => ({
  kind: "colorsteps",
  ...opts,
});
export const guideColorsteps = guideColoursteps;
export const guideBins = (opts: Omit<Guide, "kind"> = {}): Guide => ({
  kind: "bins",
  ...opts,
});
