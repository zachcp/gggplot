// geom_smooth — per-group trend ChunkedLine (gggplot-tzc.3) with an optional
// SE ribbon packed into a single ChunkedFace node (gggplot-tzc.4). SE bands
// can wiggle/self-cross, so this uses the concave-capable triangulation path
// (concave: true) — see render/chunked_face.tsx's spike writeup.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { splitByEffectiveGroup } from "../group/mod.ts";
import type { LayerContext } from "./types.ts";
import {
  bandPositions,
  colorsOf,
  dashOf,
  type FaceLoop,
  packFaceLoops,
  positionsOf,
} from "./shared.ts";
import { type LineGroupRows, packChunkedLineNodes } from "./line.ts";

export function lowerSmooth(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;
  const colorScale = ctx.scales.color;
  const fillScale = ctx.scales.fill;
  const opacity = layer.params.alpha as number | undefined;
  const explicitColor = layer.params.color as string | undefined;
  const defaultWidth = (layer.params.linewidth as number) ??
    (layer.params.width as number) ??
    (layer.params.strokeWidth as number) ?? 2;

  const ribbonLoops: FaceLoop[] = [];
  const lineGroups: LineGroupRows[] = [];
  for (
    const { mapping: m, data: d } of splitByEffectiveGroup(mapping, data)
  ) {
    const mappedColors = colorsOf(m, d, colorScale, fillScale, "colorOrFill");
    if (m.ymin && m.ymax) {
      const bandPos = bandPositions(m, d, xScale, yScale);
      if (bandPos.length) {
        const ribbonFill = (layer.params.fill as string) ?? "#c7d2fe";
        ribbonLoops.push({ positions: bandPos, fill: ribbonFill });
      }
    }
    const positions = positionsOf(m, d, xScale, yScale);
    if (positions.length === 0) continue;
    const xs = positions.map(([x]) => x);
    const ys = positions.map(([, y]) => y);
    // One color level per effective group — repeat the group's uniform color
    // per vertex (aligns with the packed vertex tensor regardless of the
    // fitted point count). See lowerLine for the same rationale.
    const color = explicitColor ?? mappedColors?.[0] ?? "#3b82f6";
    const colors = xs.map(() => color);
    const dash = dashOf(layer, m, d, ctx.scales.linetype);
    lineGroups.push({
      xs,
      ys,
      colors,
      widths: xs.map(() => defaultWidth),
      dash,
      ...(opacity != null ? { alphas: xs.map(() => opacity) } : {}),
    });
  }
  const ribbons: RenderNode[] = ribbonLoops.length
    ? (() => {
      const packed = packFaceLoops(ribbonLoops);
      return [node("ChunkedFace", {
        positions: packed.positions,
        topology: packed.topology,
        colors: packed.colors,
        concave: true,
      })];
    })()
    : [];
  return [...ribbons, ...packChunkedLineNodes(lineGroups, opacity)];
}
