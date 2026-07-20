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
): RenderNode {
  return node("Label", {
    positions: labels.map((_, i): [number, number] => [x, y + i * 0.11]),
    labels,
    color: theme.textColor ?? "#0b0b0b",
    size: size ?? theme.fontSize ?? 13,
    zBias: 2,
    ...(angle ? { angle } : {}),
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
