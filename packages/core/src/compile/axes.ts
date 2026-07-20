import type {
  Aes,
  AesName,
  PlotLabels,
  PositionAxis,
  Theme,
} from "../ir/types.ts";
import { node, type RenderNode } from "./rendertree.ts";
import type { TrainedScale } from "../scale/mod.ts";
import { linspace } from "./coordinates.ts";
import {
  labelFor,
  labelNode,
  type TextExtent,
  type TextMeasurer,
  themeFaceProps,
} from "./guide_text.ts";

const DEFAULT_PANEL_BOUNDS: [number, number, number, number] = [
  -0.72,
  -0.66,
  0.92,
  0.68,
];

function axisTickValues(
  scale: TrainedScale | undefined,
  count = 5,
): unknown[] {
  if (!scale) return [];
  if (scale.kind === "discrete") return scale.domain as string[];
  const [lo, hi] = scale.domain as [number, number];
  if (lo === hi) return [lo];
  return linspace([lo, hi], count);
}

export function guideLayout(
  width: number | undefined,
  height: number | undefined,
  measure: TextMeasurer | undefined,
  theme: Theme,
  labels: PlotLabels,
  mapping: Aes,
  scales: Partial<Record<AesName, TrainedScale>>,
): { bounds: [number, number, number, number]; tickCount: number } {
  const xScale = scales.x;
  const yScale = scales.y;
  const legendScales = [
    scales.color,
    scales.fill,
    scales.size,
    scales.alpha,
    scales.shape,
    scales.linetype,
    scales.linewidth,
  ];
  const legendLabels = legendScales.flatMap((scale) => {
    if (!scale || scale.guide?.kind === "none") return [];
    const domain = scale.domain;
    return [scale.name ?? scale.aes, ...domain.map(String)];
  });
  if (!width || !height || !measure) {
    return {
      bounds: legendLabels.length
        ? [
          DEFAULT_PANEL_BOUNDS[0],
          DEFAULT_PANEL_BOUNDS[1],
          0.58,
          DEFAULT_PANEL_BOUNDS[3],
        ]
        : DEFAULT_PANEL_BOUNDS,
      tickCount: 5,
    };
  }
  const tickSize = Math.max((theme.fontSize ?? 13) - 2, 8);
  const titleSize = theme.fontSize ?? 13;
  const tickCount = Math.max(2, Math.min(8, Math.floor(width / 90)));
  const rotated = (extent: TextExtent, angle: number): TextExtent => {
    const radians = angle * Math.PI / 180;
    return {
      width: Math.abs(extent.width * Math.cos(radians)) +
        Math.abs(extent.height * Math.sin(radians)),
      height: Math.abs(extent.width * Math.sin(radians)) +
        Math.abs(extent.height * Math.cos(radians)),
    };
  };
  const yLabels = axisTickValues(yScale, tickCount).map(tickLabel);
  const yTickWidth = Math.max(
    0,
    ...yLabels.map((label) =>
      rotated(
        measure(
          label,
          tickSize,
          theme.fontFamily,
          theme.fontWeight,
          theme.fontStyle,
        ),
        theme.axisTextYAngle ?? 0,
      ).width
    ),
  );
  const xTickHeight = Math.max(
    tickSize,
    ...axisTickValues(xScale, tickCount).map((value) =>
      rotated(
        measure(
          tickLabel(value),
          tickSize,
          theme.fontFamily,
          theme.fontWeight,
          theme.fontStyle,
        ),
        theme.axisTextXAngle ?? 0,
      ).height
    ),
  );
  const xTitle = labelFor(labels, "x", mapping.x ?? "x");
  const yTitle = labelFor(labels, "y", mapping.y ?? "y");
  const xTitleHeight = xTitle
    ? measure(
      xTitle,
      titleSize,
      theme.fontFamily,
      theme.fontWeight,
      theme.fontStyle,
    ).height
    : 0;
  const yTitleBand = yTitle
    ? rotated(
      measure(
        yTitle,
        titleSize,
        theme.fontFamily,
        theme.fontWeight,
        theme.fontStyle,
      ),
      theme.axisTitleYAngle ?? 0,
    ).width
    : 0;
  const topPx = labels.title || labels.subtitle ? 56 : 16;
  const leftPx = 14 + yTickWidth + yTitleBand;
  const bottomPx = 18 + xTickHeight + xTitleHeight;
  const legendWidth = Math.max(
    0,
    ...legendLabels.map((label) =>
      measure(
        label,
        titleSize,
        theme.fontFamily,
        theme.fontWeight,
        theme.fontStyle,
      ).width
    ),
  );
  const rightPx = legendLabels.length ? 44 + legendWidth : 16;
  return {
    bounds: [
      -1 + 2 * leftPx / width,
      -1 + 2 * topPx / height,
      1 - 2 * rightPx / width,
      1 - 2 * bottomPx / height,
    ],
    tickCount,
  };
}

function axisTickPosition(
  scale: TrainedScale | undefined,
  value: unknown,
  lo: number,
  hi: number,
): number {
  if (!scale) return (lo + hi) / 2;
  if (scale.kind === "discrete") {
    const levels = scale.domain as string[];
    const index = levels.indexOf(String(value));
    return levels.length <= 1
      ? (lo + hi) / 2
      : lo + index / (levels.length - 1) * (hi - lo);
  }
  const [domainLo, domainHi] = scale.domain as [number, number];
  return domainHi === domainLo
    ? (lo + hi) / 2
    : lo + (Number(value) - domainLo) / (domainHi - domainLo) * (hi - lo);
}

const tickLabel = (value: unknown): string =>
  typeof value === "number"
    ? String(Number(value.toPrecision(4)))
    : String(value);

/** Axis titles and ticks occupy the margins around the inset Cartesian panel. */
export function axisGuideOverlay(
  labels: PlotLabels,
  mapping: Aes,
  theme: Theme,
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  project: [PositionAxis, PositionAxis],
  panelBounds: [number, number, number, number],
  tickCount: number,
  options: {
    horizontalTicks?: boolean;
    verticalTicks?: boolean;
    titles?: boolean;
    width?: number;
    height?: number;
    tickSize?: number;
  } = {},
): RenderNode {
  const [left, bottom, right, top] = panelBounds;
  const horizontal = project[0];
  const vertical = project[1];
  const horizontalScale = horizontal === "x" ? xScale : yScale;
  const verticalScale = vertical === "y" ? yScale : xScale;
  const horizontalValues = axisTickValues(horizontalScale, tickCount);
  const verticalValues = axisTickValues(verticalScale, tickCount);
  const color = theme.textColor ?? "#0b0b0b";
  const face = themeFaceProps(theme);
  const horizontalTicks = options.horizontalTicks ?? true;
  const verticalTicks = options.verticalTicks ?? true;
  const titles = options.titles ?? true;
  const tickSize = options.tickSize ?? Math.max((theme.fontSize ?? 13) - 2, 8);
  const xOffset = options.height ? 16 / options.height : (1 - top) * 0.2;
  const yOffset = options.width ? 16 / options.width : (left + 1) * 0.2;
  // The chart already has one outer Embedded/Plot reconciler. Keep the guide
  // labels as a transparent sibling group; nesting Embedded here creates a
  // second virtual-layer/font layout and silently drops its glyph bindings.
  return node("FacetPanel", {}, [
    ...(horizontalTicks
      ? [node("Label", {
        positions: horizontalValues.map((value): [number, number] => [
          axisTickPosition(horizontalScale, value, left, right),
          top + xOffset,
        ]),
        labels: horizontalValues.map(tickLabel),
        color,
        size: tickSize,
        zBias: 2,
        ...(theme.axisTextXAngle ? { angle: theme.axisTextXAngle } : {}),
        ...face,
      })]
      : []),
    ...(verticalTicks
      ? [node("Label", {
        positions: verticalValues.map((value): [number, number] => [
          left - yOffset,
          axisTickPosition(verticalScale, value, top, bottom),
        ]),
        labels: verticalValues.map(tickLabel),
        color,
        size: tickSize,
        zBias: 2,
        ...(theme.axisTextYAngle ? { angle: theme.axisTextYAngle } : {}),
        ...face,
      })]
      : []),
    ...(titles
      ? [
        labelNode(
          (left + right) / 2,
          top + (1 - top) * 0.7,
          [labelFor(labels, horizontal, mapping[horizontal] ?? horizontal)],
          theme,
          undefined,
          theme.axisTitleXAngle ?? 0,
        ),
        labelNode(
          -1 + (left + 1) * 0.3,
          (bottom + top) / 2,
          [labelFor(labels, vertical, mapping[vertical] ?? vertical)],
          theme,
          undefined,
          theme.axisTitleYAngle ?? 0,
        ),
      ]
      : []),
  ]);
}
