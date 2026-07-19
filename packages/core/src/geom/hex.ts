// geom_hex — hexagonal 2D bins as one ChunkedFace node (gggplot-tzc.4).
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import type { LayerContext } from "./types.ts";
import { colorsOf, type FaceLoop, packFaceLoops, valuesOf } from "./shared.ts";

export function lowerHex(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;

  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  if (!xs || !ys) return [];
  const width = Number(
    valuesOf(data, "binwidthX")?.[0] ?? layer.params.width ?? 1,
  );
  const height = Number(
    valuesOf(data, "binwidthY")?.[0] ?? layer.params.height ?? 1,
  );
  const positions = xs.map((value, i) => {
    const x = scalePosition(xScale, value);
    const y = scalePosition(yScale, ys[i]);
    return Array.from({ length: 6 }, (_, vertex): [number, number] => {
      const angle = Math.PI / 3 * vertex;
      return [
        x + Math.cos(angle) * width / 2,
        y + Math.sin(angle) * height / 2,
      ];
    });
  });
  const colors = colorsOf(
    mapping,
    data,
    ctx.scales.color,
    ctx.scales.fill,
    "fillOrColor",
  );
  const metadata = typeof layer.params.fun === "function"
    ? { execution: "cpu-custom-summary", nonSerializable: true }
    : {};
  if (positions.length === 0) return [];
  const fill = (layer.params.fill as string) ?? "#3b82f6";
  // Regular hexagons are always convex, so this uses fan triangulation
  // (concave: false) — same rationale as bar/tile/rect's guaranteed-convex
  // loops (gggplot-tzc.4's render/chunked_face.tsx spike writeup).
  const loops: FaceLoop[] = colors
    ? positions.map((position, i) => ({ positions: position, fill: colors[i] }))
    : positions.map((position) => ({ positions: position, fill }));
  const packed = packFaceLoops(loops);
  return [
    node("ChunkedFace", {
      positions: packed.positions,
      topology: packed.topology,
      colors: packed.colors,
      concave: false,
      ...metadata,
    }),
  ];
}
