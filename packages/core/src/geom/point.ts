// geom_point / geom_dotplot (and jitter/nudge/jitterdodge positions).
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { jitter, nudge } from "../position/mod.ts";
import type { LayerContext } from "./types.ts";
import {
  alphasOf,
  colorsOf,
  colorWithAlpha,
  positionsOf,
  resolutionOf,
  shapesOf,
  sizesOf,
  strokesOf,
  valuesOf,
} from "./shared.ts";

/** Lower a geom_point/geom_dotplot layer to Point mark(s), applying its position adjustment. */
export function lowerPoint(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;
  const opacity = layer.params.alpha as number | undefined;

  let positions = positionsOf(mapping, data, xScale, yScale);
  if (positions.length === 0) return [];
  if (layer.position === "jitter") {
    const xAmount = (layer.params.width as number) ??
      resolutionOf(xScale, positions.map((p) => p[0])) * 0.4;
    const yAmount = (layer.params.height as number) ?? 0.4;
    positions = positions.map((
      [x, y],
    ) => [jitter(x, xAmount), jitter(y, yAmount)]);
  } else if (layer.position === "nudge") {
    positions = nudge(
      positions,
      (layer.params.x as number) ?? (layer.params.nudgeX as number) ?? 0,
      (layer.params.y as number) ?? (layer.params.nudgeY as number) ?? 0,
    );
  } else if (layer.position === "jitterdodge") {
    const groupValues = valuesOf(
      data,
      mapping.group ?? mapping.color ?? mapping.fill ?? mapping.shape,
    );
    const groups = [...new Set((groupValues ?? []).map(String))].sort();
    const dodgeWidth = (layer.params.dodgeWidth as number) ?? 0.75;
    const jitterWidth = (layer.params.jitterWidth as number) ?? 0.1;
    const jitterHeight = (layer.params.jitterHeight as number) ?? 0;
    positions = positions.map(([x, y], i) => {
      const slot = Math.max(0, groups.indexOf(String(groupValues?.[i])));
      const offset = groups.length > 1
        ? (slot - (groups.length - 1) / 2) * dodgeWidth / groups.length
        : 0;
      return [jitter(x + offset, jitterWidth), jitter(y, jitterHeight)];
    });
  }
  const colors = colorsOf(
    mapping,
    data,
    ctx.scales.color,
    ctx.scales.fill,
    "colorOrFill",
  );
  const color = (layer.params.color as string) ?? "#3b82f6";
  const sizes = sizesOf(mapping, data, ctx.scales.size);
  const strokes = strokesOf(mapping, data, ctx.scales.stroke);
  const alphas = alphasOf(mapping, data, ctx.scales.alpha);
  const rgbaColors = alphas
    ? positions.map((_, i) => colorWithAlpha(colors?.[i] ?? color, alphas[i]))
    : undefined;
  const shapes = shapesOf(mapping, data, ctx.scales.shape);

  if (shapes) {
    const byShape = new Map<string, number[]>();
    shapes.forEach((shape, i) => {
      if (!byShape.has(shape)) byShape.set(shape, []);
      byShape.get(shape)!.push(i);
    });
    return [...byShape.entries()].map(([shape, indices]) =>
      node("Point", {
        positions: indices.map((i) => positions[i]),
        ...(rgbaColors
          ? { colors: indices.map((i) => rgbaColors[i]) }
          : colors
          ? { colors: indices.map((i) => colors[i]) }
          : { color }),
        ...(sizes
          ? { sizes: indices.map((i) => sizes[i]) }
          : { size: (layer.params.size as number) ?? 5 }),
        shape,
        ...(opacity != null ? { opacity } : {}),
      })
    );
  }

  const literalStroke = typeof layer.params.stroke === "number"
    ? layer.params.stroke
    : undefined;
  if (strokes || literalStroke != null) {
    const baseSizes = sizes ??
      positions.map(() => (layer.params.size as number) ?? 5);
    const widths = strokes ?? positions.map(() => literalStroke ?? 0);
    const outerColor = (layer.params.strokeColor as string) ??
      (layer.params.color as string) ?? "#1a1a1a";
    const innerColor = (layer.params.fill as string) ?? color;
    return [
      node("Point", {
        positions,
        sizes: baseSizes.map((size, i) => size + 2 * widths[i]),
        color: outerColor,
        execution: "cpu-outline-fallback",
      }),
      node("Point", {
        positions,
        ...(rgbaColors
          ? { colors: rgbaColors }
          : colors
          ? { colors }
          : { color: innerColor }),
        sizes: baseSizes,
        execution: "cpu-outline-fallback",
        ...(opacity != null ? { opacity } : {}),
      }),
    ];
  }

  return [node("Point", {
    positions,
    ...(rgbaColors ? { colors: rgbaColors } : colors ? { colors } : { color }),
    ...(sizes ? { sizes } : {
      size: (layer.params.size as number) ??
        (layer.geom === "dotplot" ? 4 : 5),
    }),
    ...(opacity != null ? { opacity } : {}),
  })];
}
