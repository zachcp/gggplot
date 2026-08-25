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
import { CATEGORICAL_PALETTE, OTHER_COLOR } from "../scale/palette.ts";
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
  layoutHeight?: number,
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
  // The same argument applies vertically. A key row holds a physical glyph, so
  // a normalized-only step silently collapses on a short canvas: the historical
  // 0.11 is 33px tall at the default 600px height but only 16.5px at the 300px
  // 3D canvas, which crowds 13px labels into their neighbours. Keep 0.11 as the
  // rhythm and raise it only when pixels demand, so default-height output is
  // unchanged and short canvases stay legible.
  const minKeyRowPx = 18;
  const keyStep = Math.max(
    0.11,
    minKeyRowPx * 2 / Math.max(layoutHeight ?? 600, 1),
  );
  // Title and inter-group gaps ride the same scale, so a widened row keeps the
  // legend's proportions instead of stretching keys against fixed padding.
  const rowScale = keyStep / 0.11;
  const titleAdvance = 0.14 * rowScale;
  const groupGap = 0.12 * rowScale;

  // Shared per-entry layout. Every legend family stacks a 14px title, then a
  // swatch column at swatchX beside a value-label column at labelX, advancing
  // y by keyStep per key plus inter-entry padding. Extracting these keeps
  // the title/swatch/label geometry defined once instead of per aesthetic.
  const pushTitle = (scale: TrainedScale, fallback: string) => {
    nodes.push(
      labelNode(titleX, y, [legendTitle(scale, labels, fallback)], theme, 14),
    );
    y += titleAdvance;
  };
  const pushKeyLabels = (texts: string[]) => {
    nodes.push(labelNode(labelX, y, texts, theme, undefined, 0, keyStep));
    y += texts.length * keyStep + groupGap;
  };
  const swatchColumn = (count: number): [number, number][] =>
    Array.from(
      { length: count },
      (_, i): [number, number] => [swatchX, y + i * keyStep],
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

    // Two independent limits, both of which used to be ignored (gggplot-i5m.21).
    //
    // 1. THE PALETTE. Past CATEGORICAL_PALETTE.length levels every further
    //    level is drawn in the same OTHER_COLOR, so listing them individually
    //    printed N rows carrying identical swatches and different labels —
    //    advertising distinctions the plot cannot draw. Fold them into one
    //    row that says how many, matching what the marks actually show.
    // 2. THE CANVAS. Keys stack downward from y with no upper bound and ran
    //    off the +1 edge of the guide overlay, silently losing the tail.
    //    Truncate to what fits and spend the last row saying what was cut.
    const paletted = levels.length > CATEGORICAL_PALETTE.length
      ? [
        ...levels.slice(0, CATEGORICAL_PALETTE.length).map((level) => ({
          label: level,
          color: scaleColorValue(scale, level),
        })),
        {
          label: `Other (${levels.length - CATEGORICAL_PALETTE.length})`,
          color: OTHER_COLOR,
        },
      ]
      : levels.map((level) => ({
        label: level,
        color: scaleColorValue(scale, level),
      }));

    // Rows between the current cursor and the overlay's bottom edge. Floor,
    // so a partially-visible final row never counts as fitting.
    const rowsAvailable = Math.max(1, Math.floor((1 - y) / keyStep));
    const truncated = paletted.length > rowsAvailable;
    // One row is spent on the "+N more" note, so it is never itself clipped.
    const shown = truncated ? paletted.slice(0, rowsAvailable - 1) : paletted;
    const hidden = paletted.length - shown.length;

    nodes.push(node("Point", {
      positions: swatchColumn(shown.length),
      colors: shown.map((entry) => entry.color),
      size: 7,
    }));
    pushKeyLabels([
      ...shown.map((entry) => entry.label),
      ...(truncated ? [`+${hidden} more`] : []),
    ]);
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
    y += titleAdvance;
    const height = 0.28 * rowScale / count;
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
      labelNode(
        labelX,
        y,
        [
          String(Number(hi.toFixed(2))),
          String(Number(lo.toFixed(2))),
        ],
        theme,
        undefined,
        0,
        keyStep,
      ),
    );
    y += 0.36 * rowScale;
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
        positions: [[swatchX, y + i * keyStep]],
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
        positions: [[swatchX - 0.025, y + i * keyStep], [
          swatchX + 0.025,
          y + i * keyStep,
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
        positions: [[swatchX - 0.025, y + i * keyStep], [
          swatchX + 0.025,
          y + i * keyStep,
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
  // These anchors sit a fixed 4% in from an edge, so they must be aligned to
  // that edge rather than centred on it — see labelNode's `placement` note and
  // gggplot-5ze. Left-corner text grows rightward; the right-corner tag grows
  // leftward.
  if (labels.title) {
    nodes.push(
      labelNode(
        -0.92,
        -0.92,
        [labels.title],
        theme,
        (theme.fontSize ?? 14) + 4,
        0,
        undefined,
        "left",
      ),
    );
  }
  if (labels.subtitle) {
    nodes.push(
      labelNode(
        -0.92,
        -0.84,
        [labels.subtitle],
        theme,
        theme.fontSize ?? 14,
        0,
        undefined,
        "left",
      ),
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
        0,
        undefined,
        "left",
      ),
    );
  }
  if (labels.tag) {
    nodes.push(
      labelNode(
        0.92,
        -0.92,
        [labels.tag],
        theme,
        theme.fontSize ?? 14,
        0,
        undefined,
        "right",
      ),
    );
  }
  return nodes;
}
