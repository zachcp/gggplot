import type { AesName, PlotLabels, Theme } from "../ir/types.ts";
import { node, type RenderNode } from "./rendertree.ts";
import {
  scaleColorValue,
  scaleLinetypeValue,
  scaleLinewidthValue,
  scaleShapeValue,
  scaleSizeValue,
  type TrainedScale,
} from "../scale/mod.ts";
import { colorWithAlpha } from "../geom/shared.ts";
import { labelNode } from "./guide_text.ts";

function legendTitle(
  scale: TrainedScale,
  labels: PlotLabels,
  fallback: string,
): string {
  return labels[scale.aes] ?? scale.name ?? fallback;
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
/**
 * Plot-level text in the flat guide space, where **y grows DOWNWARD**: -1 is
 * the top edge and +1 the bottom. That is the same convention `guideLayout`
 * uses (it maps the TOP margin onto `-1 + 2*topPx/height`) and that
 * `axisGuideOverlay` relies on when it places x tick labels — which sit low on
 * a chart — at the numerically larger `panelBounds[3]`.
 *
 * Title and subtitle therefore belong at NEGATIVE y and the caption at
 * positive. They were inverted until gggplot-4q2.11 put the first plot title on
 * screen (via the 3D overlay) and showed the title rendering along the bottom.
 */
export function plotLabelNodes(labels: PlotLabels, theme: Theme): RenderNode[] {
  const nodes: RenderNode[] = [];
  if (labels.title) {
    nodes.push(
      labelNode(
        -0.92,
        -0.92,
        [labels.title],
        theme,
        (theme.fontSize ?? 14) + 4,
      ),
    );
  }
  if (labels.subtitle) {
    nodes.push(
      labelNode(-0.92, -0.84, [labels.subtitle], theme, theme.fontSize ?? 14),
    );
  }
  if (labels.caption) {
    nodes.push(
      labelNode(
        -0.92,
        0.92,
        [labels.caption],
        theme,
        Math.max((theme.fontSize ?? 13) - 1, 8),
      ),
    );
  }
  if (labels.tag) {
    nodes.push(
      labelNode(0.92, -0.92, [labels.tag], theme, theme.fontSize ?? 14),
    );
  }
  return nodes;
}
