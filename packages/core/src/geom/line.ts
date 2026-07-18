// geom_line / geom_path / geom_step — connected marks, one Line per group.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { splitByEffectiveGroup } from "../group/mod.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import {
  colorsOf,
  dashOf,
  linewidthsOf,
  literalLineProps,
  positionsOf,
  sortByX,
  stepPositions,
  valuesOf,
} from "./shared.ts";

/**
 * Lower geom_line (x-sorted), geom_path (row order), or geom_step (staircase)
 * to one Line per effective group. stat="ecdf" clamps the ±Infinity sentinel
 * x-values that stat_ecdf emits to the panel's x domain edges.
 */
export function lowerLine(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;
  const opacity = layer.params.alpha as number | undefined;
  const xDomain = ctx.xDomain;
  const color = (layer.params.color as string) ?? "#3b82f6";
  return splitByEffectiveGroup(mapping, data)
    .map(({ mapping: m, data: d }) => {
      const ordered = layer.geom === "path" ? d : sortByX(m, d);
      let positions = layer.stat === "ecdf"
        ? (() => {
          const xs = valuesOf(ordered, m.x) ?? [];
          const ys = valuesOf(ordered, m.y) ?? [];
          return xs.slice(0, Math.min(xs.length, ys.length)).map((
            value,
            index,
          ): [number, number] => [
            value === Number.NEGATIVE_INFINITY
              ? xDomain[0]
              : value === Number.POSITIVE_INFINITY
              ? xDomain[1]
              : scalePosition(xScale, value),
            scalePosition(yScale, ys[index]),
          ]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
        })()
        : positionsOf(m, ordered, xScale, yScale);
      if (layer.geom === "step") {
        positions = stepPositions(positions, layer.params.direction ?? "hv");
      }
      if (positions.length === 0) return null;
      const colors = colorsOf(
        m,
        ordered,
        ctx.scales.color,
        ctx.scales.fill,
        "colorOrFill",
      );
      const widths = linewidthsOf(m, ordered, ctx.scales.linewidth);
      const dash = dashOf(layer, m, ordered, ctx.scales.linetype);
      return node("Line", {
        positions,
        ...(colors ? { colors } : { color }),
        ...(widths ? { widths } : literalLineProps(layer, 2)),
        ...(dash ? { dash } : {}),
        ...(opacity != null ? { opacity } : {}),
      });
    })
    .filter((n): n is RenderNode => n !== null);
}
