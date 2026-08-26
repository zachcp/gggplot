import type { PlotLabels, Theme } from "../ir/types.ts";
import { node, type RenderNode } from "./rendertree.ts";
import { normalizeFontface } from "../geom/shared.ts";

export function labelFor(
  labels: PlotLabels,
  key: string,
  fallback: string,
): string {
  return labels[key] ?? fallback;
}

export function labelNode(
  x: number,
  y: number,
  labels: string[],
  theme: Theme,
  size?: number,
  angle = 0,
  // Multi-label stacks stride by the caller's row height. Guides that must stay
  // legible on short canvases widen this; the default reproduces the historical
  // normalized rhythm.
  step = 0.11,
  /**
   * Which part of the text sits on the anchor. use.GPU's Label defaults to
   * 'center', which is right for a tick label straddling its tick but wrong
   * for anything anchored near an edge: the label vertex shader offsets by
   * `(placement - 1) * 0.5 * shape`, so a centred label reaches half its
   * PIXEL width past the anchor in both directions while the anchor itself is
   * a fixed fraction of the canvas. A long title anchored 4% in therefore
   * hangs off the left edge (gggplot-5ze). 'left' zeroes that offset, so the
   * text starts at the anchor and grows rightward.
   */
  placement?: string,
): RenderNode {
  return node("Label", {
    positions: labels.map((_, i): [number, number] => [x, y + i * step]),
    labels,
    color: theme.textColor ?? "#0b0b0b",
    size: size ?? theme.fontSize ?? 13,
    zBias: 2,
    ...(angle ? { angle } : {}),
    ...(placement ? { placement } : {}),
    ...themeFaceProps(theme),
  });
}

export function themeFaceProps(theme: Theme): Record<string, unknown> {
  const face = normalizeFontface(
    undefined,
    theme.fontWeight,
    theme.fontStyle,
  );
  return {
    weight: face.weight,
    style: face.style,
    ...(theme.fontFamily ? { family: theme.fontFamily } : {}),
    ...(theme.lineHeight != null ? { lineHeight: theme.lineHeight } : {}),
  };
}

export interface TextExtent {
  width: number;
  height: number;
}

export type TextMeasurer = (
  text: string,
  size: number,
  family?: string,
  weight?: string | number,
  style?: string,
) => TextExtent;
