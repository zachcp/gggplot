import type {
  Aes,
  AesName,
  PlotLabels,
  PositionAxis,
  Theme,
} from "../ir/types.ts";
import { node, type RenderNode } from "./rendertree.ts";
import {
  scaleColorValue,
  scaleLinetypeValue,
  scaleLinewidthValue,
  scaleShapeValue,
  scaleSizeValue,
  type TrainedScale,
} from "../scale/mod.ts";
import { colorWithAlpha, normalizeFontface } from "../geom/shared.ts";
import { linspace } from "./coordinates.ts";

export function labelFor(
  labels: PlotLabels,
  key: string,
  fallback: string,
): string {
  return labels[key] ?? fallback;
}

function legendTitle(
  scale: TrainedScale,
  labels: PlotLabels,
  fallback: string,
): string {
  return labels[scale.aes] ?? scale.name ?? fallback;
}

function labelNode(
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

export function legendNodes(
  scales: Partial<Record<AesName, TrainedScale>>,
  labels: PlotLabels,
  theme: Theme,
  panelBounds: [number, number, number, number],
  layoutWidth?: number,
): RenderNode[] {
  const {
    color: colorScale,
    fill: fillScale,
    size: sizeScale,
    alpha: alphaScale,
    shape: shapeScale,
    linetype: linetypeScale,
    linewidth: linewidthScale,
  } = scales;
  const nodes: RenderNode[] = [];
  let y = -0.76;
  const guideLeft = panelBounds[2];
  // Guide keys are physical glyphs, so their horizontal geometry must not
  // shrink as a fraction of a narrow remaining margin. Define the key slot in
  // CSS pixels and convert once into the root's normalized coordinates.
  const px = 2 / Math.max(layoutWidth ?? 800, 1);
  const paddingPx = 8;
  const keyBoxPx = 20;
  const keyLabelGapPx = 6;
  const titleX = guideLeft + paddingPx * px;
  const swatchX = guideLeft + (paddingPx + keyBoxPx / 2) * px;
  const labelX = guideLeft + (paddingPx + keyBoxPx + keyLabelGapPx) * px;

  // Shared per-entry layout. Every legend family stacks a 14px title, then a
  // swatch column at swatchX beside a value-label column at labelX, advancing
  // y by a fixed 0.11 per key plus inter-entry padding. Extracting these keeps
  // the title/swatch/label geometry defined once instead of per aesthetic.
  const pushTitle = (scale: TrainedScale, fallback: string) => {
    nodes.push(
      labelNode(titleX, y, [legendTitle(scale, labels, fallback)], theme, 14),
    );
    y += 0.14;
  };
  const pushKeyLabels = (texts: string[]) => {
    nodes.push(labelNode(labelX, y, texts, theme));
    y += texts.length * 0.11 + 0.12;
  };
  const swatchColumn = (count: number): [number, number][] =>
    Array.from(
      { length: count },
      (_, i): [number, number] => [swatchX, y + i * 0.11],
    );
  // size/alpha/linewidth all key a continuous domain by [lo, mid, hi]
  // representative values (or just [lo] when the domain is a single point).
  const representativeValues = (scale: TrainedScale): number[] => {
    const [lo, hi] = scale.domain as [number, number];
    return hi > lo ? [lo, (lo + hi) / 2, hi] : [lo];
  };

  // Discrete color and fill are the same swatch legend — a Point per level
  // tinted by the scale — differing only in which scale supplies the color.
  const discreteSwatchLegend = (scale: TrainedScale, aes: "color" | "fill") => {
    const levels = scale.domain as string[];
    pushTitle(scale, aes);
    nodes.push(node("Point", {
      positions: swatchColumn(levels.length),
      colors: levels.map((level) => scaleColorValue(scale, level)),
      size: 7,
    }));
    pushKeyLabels(levels);
  };

  if (
    colorScale && Array.isArray(colorScale.domain) &&
    typeof colorScale.domain[0] === "string"
  ) {
    discreteSwatchLegend(colorScale, "color");
  }

  if (
    fillScale && Array.isArray(fillScale.domain) &&
    typeof fillScale.domain[0] === "string"
  ) {
    discreteSwatchLegend(fillScale, "fill");
  }

  const continuousColorGuide = (
    scale: TrainedScale | undefined,
    fallback: "color" | "fill",
  ) => {
    if (
      !scale || typeof scale.domain[0] !== "number" ||
      scale.guide?.kind === "none"
    ) return;
    const guideKind = scale.guide?.kind ?? "colorbar";
    const count = guideKind === "colorbar"
      ? 24
      : Math.max(2, scale.guide?.bins ?? 6);
    const [lo, hi] = scale.domain as [number, number];
    nodes.push(
      labelNode(
        titleX,
        y,
        [scale.guide?.title ?? legendTitle(scale, labels, fallback)],
        theme,
        14,
      ),
    );
    y += 0.14;
    const height = 0.28 / count;
    const positions = Array.from(
      { length: count },
      (_, i): [number, number][] => {
        const top = y + i * height;
        return [[swatchX - 0.025, top], [swatchX - 0.025, top + height], [
          swatchX + 0.025,
          top + height,
        ], [swatchX + 0.025, top]];
      },
    );
    const values = Array.from(
      { length: count },
      (_, i) => lo + (hi - lo) * (i + 0.5) / count,
    );
    nodes.push(...positions.map((position, i) =>
      node("Polygon", {
        positions: position,
        fill: scaleColorValue(scale, values[i]),
        guideKind,
      })
    ));
    nodes.push(
      labelNode(labelX, y, [
        String(Number(hi.toFixed(2))),
        String(Number(lo.toFixed(2))),
      ], theme),
    );
    y += 0.36;
  };

  continuousColorGuide(colorScale, "color");
  continuousColorGuide(fillScale, "fill");

  if (sizeScale && !Array.isArray(sizeScale.domain[0])) {
    const values = representativeValues(sizeScale);
    pushTitle(sizeScale, "size");
    nodes.push(node("Point", {
      positions: swatchColumn(values.length),
      sizes: values.map((v) => scaleSizeValue(sizeScale, v)),
      color: "#3b82f6",
    }));
    pushKeyLabels(
      values.map((v) => String(Number.isInteger(v) ? v : Number(v.toFixed(2)))),
    );
  }

  // Alpha is a mapped continuous aesthetic, so it receives the same compact
  // representative-value guide as size/linewidth. Literal layer opacity is
  // intentionally absent because it does not train a scale.
  if (alphaScale && !Array.isArray(alphaScale.domain[0])) {
    const [lo, hi] = alphaScale.domain as [number, number];
    const values = representativeValues(alphaScale);
    pushTitle(alphaScale, "alpha");
    nodes.push(node("Point", {
      positions: swatchColumn(values.length),
      size: 7,
      colors: values.map((value) => {
        const [rangeLo, rangeHi] = alphaScale.range as [number, number];
        const alpha = hi === lo
          ? rangeHi
          : rangeLo + (rangeHi - rangeLo) * ((value - lo) / (hi - lo));
        return colorWithAlpha("#3b82f6", alpha);
      }),
    }));
    pushKeyLabels(values.map((v) => String(Number(v.toFixed(2)))));
  }

  if (
    shapeScale && Array.isArray(shapeScale.domain) &&
    typeof shapeScale.domain[0] === "string"
  ) {
    const levels = shapeScale.domain as string[];
    pushTitle(shapeScale, "shape");
    levels.forEach((level, i) => {
      nodes.push(node("Point", {
        positions: [[swatchX, y + i * 0.11]],
        shape: scaleShapeValue(shapeScale, level),
        color: "#3b82f6",
        size: 7,
      }));
    });
    pushKeyLabels(levels);
  }

  if (
    linetypeScale && Array.isArray(linetypeScale.domain) &&
    typeof linetypeScale.domain[0] === "string"
  ) {
    const levels = linetypeScale.domain as string[];
    pushTitle(linetypeScale, "linetype");
    levels.forEach((level, i) => {
      const dash = scaleLinetypeValue(linetypeScale, level);
      nodes.push(node("Line", {
        positions: [[swatchX - 0.025, y + i * 0.11], [
          swatchX + 0.025,
          y + i * 0.11,
        ]],
        color: "#3b82f6",
        width: 2,
        ...(dash ? { dash } : {}),
      }));
    });
    pushKeyLabels(levels);
  }

  if (linewidthScale && !Array.isArray(linewidthScale.domain[0])) {
    const values = representativeValues(linewidthScale);
    pushTitle(linewidthScale, "linewidth");
    values.forEach((value, i) => {
      nodes.push(node("Line", {
        positions: [[swatchX - 0.025, y + i * 0.11], [
          swatchX + 0.025,
          y + i * 0.11,
        ]],
        color: "#3b82f6",
        width: scaleLinewidthValue(linewidthScale, value),
      }));
    });
    pushKeyLabels(
      values.map((v) => String(Number.isInteger(v) ? v : Number(v.toFixed(2)))),
    );
  }

  return nodes;
}

/** Root-overlay title-family text; axis labels stage with their view guides. */
export function plotLabelNodes(labels: PlotLabels, theme: Theme): RenderNode[] {
  const nodes: RenderNode[] = [];
  if (labels.title) {
    nodes.push(
      labelNode(-0.92, 0.92, [labels.title], theme, (theme.fontSize ?? 14) + 4),
    );
  }
  if (labels.subtitle) {
    nodes.push(
      labelNode(-0.92, 0.84, [labels.subtitle], theme, theme.fontSize ?? 14),
    );
  }
  if (labels.caption) {
    nodes.push(
      labelNode(
        -0.92,
        -0.92,
        [labels.caption],
        theme,
        Math.max((theme.fontSize ?? 13) - 1, 8),
      ),
    );
  }
  if (labels.tag) {
    nodes.push(
      labelNode(0.92, 0.92, [labels.tag], theme, theme.fontSize ?? 14),
    );
  }
  return nodes;
}

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

/** One faceting variable combination (e.g. { cyl: "6" }), row/col-major order. */
