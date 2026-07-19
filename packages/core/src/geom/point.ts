// geom_point / geom_dotplot (and jitter/nudge/jitterdodge positions).
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { jitter, nudge } from "../position/mod.ts";
import type { LayerContext } from "./types.ts";
import {
  alphasOf,
  colorsOf,
  packMarkRows,
  positionsOf,
  resolutionOf,
  shapesOf,
  sizesOf,
  strokesOf,
  valuesOf,
} from "./shared.ts";
import type { MarkTopology } from "../compile/rendertree.ts";

const POINTS_TOPOLOGY: MarkTopology = { kind: "points" };

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

  const xs = positions.map(([x]) => x);
  const ys = positions.map(([, y]) => y);

  const mappedColors = colorsOf(
    mapping,
    data,
    ctx.scales.color,
    ctx.scales.fill,
    "colorOrFill",
  );
  const color = (layer.params.color as string) ?? "#3b82f6";
  const mappedSizes = sizesOf(mapping, data, ctx.scales.size);
  const defaultSize = (layer.params.size as number) ??
    (layer.geom === "dotplot" ? 4 : 5);

  const strokes = strokesOf(mapping, data, ctx.scales.stroke);
  const alphas = alphasOf(mapping, data, ctx.scales.alpha);
  const shapes = shapesOf(mapping, data, ctx.scales.shape);

  // gggplot-tzc.3: positions ALWAYS pack into a FlatTensor(vec2) +
  // {kind:'points'} topology through packMarkRows (the sole mask builder).
  // Per-row colors (mapped, or literal + per-row alpha folded — DELETING the
  // old rgbaColors CSS-string path) and per-row sizes pack into companion
  // FlatTensors through the SAME mask; a single literal color/size instead
  // stays a scalar 'color'/'size' prop (parseColorRGBA is hex-only, so a
  // literal like "red" must not be forced through the vec4 packer). Emits one
  // Point node (this helper), reused by all three shape/stroke/plain paths.
  const emitPoint = (
    indices: number[],
    extra: Record<string, unknown>,
    overrides: {
      colorsFor?: string[];
      color?: string;
      scalarColor?: boolean; // force a scalar literal color (stroke outline ring)
      sizesFor?: number[];
      size?: number;
    } = {},
  ): RenderNode => {
    const nodeColor = overrides.color ?? color;
    const nodeSize = overrides.size ?? defaultSize;
    // Per-row colors when there's a mapped/explicit per-row color list OR a
    // per-row alpha to fold in (repeat the literal color across rows so the
    // packer can fold alpha); otherwise a single scalar color.
    const perRowColors = overrides.scalarColor
      ? undefined
      : overrides.colorsFor ?? mappedColors ??
        (alphas ? indices.map(() => nodeColor) : undefined);
    const perRowSizes = overrides.sizesFor ?? mappedSizes;
    const packed = packMarkRows({
      xs: indices.map((i) => xs[i]),
      ys: indices.map((i) => ys[i]),
      ...(perRowColors ? { colors: indices.map((i) => perRowColors[i]) } : {}),
      ...(perRowSizes ? { sizes: indices.map((i) => perRowSizes[i]) } : {}),
      ...(alphas ? { alphas: indices.map((i) => alphas[i]) } : {}),
    });
    return node("Point", {
      positions: packed.positions,
      topology: POINTS_TOPOLOGY,
      ...(packed.colors ? { colors: packed.colors } : { color: nodeColor }),
      ...(packed.sizes ? { sizes: packed.sizes } : { size: nodeSize }),
      ...extra,
      ...(opacity != null ? { opacity } : {}),
    });
  };

  if (shapes) {
    const byShape = new Map<string, number[]>();
    shapes.forEach((shape, i) => {
      if (!byShape.has(shape)) byShape.set(shape, []);
      byShape.get(shape)!.push(i);
    });
    // tzc.3: sanctioned per-shape Point split — shape is a uniform render
    // trait (point sprite), so each distinct shape value gets its own node.
    return [...byShape.entries()].map(([shape, indices]) =>
      emitPoint(indices, { shape })
    );
  }

  const literalStroke = typeof layer.params.stroke === "number"
    ? layer.params.stroke
    : undefined;
  if (strokes || literalStroke != null) {
    const baseSizes = mappedSizes ?? xs.map(() => defaultSize);
    const strokeWidths = strokes ?? xs.map(() => literalStroke ?? 0);
    const outerSizes = baseSizes.map((size, i) => size + 2 * strokeWidths[i]);
    const outerColor = (layer.params.strokeColor as string) ??
      (layer.params.color as string) ?? "#1a1a1a";
    const innerColor = (layer.params.fill as string) ?? color;
    const all = xs.map((_, i) => i);
    // Keep the two-node stroke-outline fallback, flat: sizes are per-row
    // (derived from stroke width) so always pack; the outer ring is a single
    // literal color (scalar), the inner disc mapped-or-literal.
    return [
      emitPoint(all, { execution: "cpu-outline-fallback" }, {
        scalarColor: true,
        color: outerColor,
        sizesFor: outerSizes,
      }),
      emitPoint(all, { execution: "cpu-outline-fallback" }, {
        color: innerColor,
        sizesFor: baseSizes,
      }),
    ];
  }

  return [emitPoint(xs.map((_, i) => i), {})];
}
