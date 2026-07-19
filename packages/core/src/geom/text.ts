// geom_text / geom_label — measured, batched glyph and label-box marks.
import type { Aes, DataFrame, Layer } from "../ir/types.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import { scalePosition } from "../scale/mod.ts";
import { columnValues } from "../data/mod.ts";
import type { TextMeasurer } from "../compile/guides.ts";
import type { MarkTopology } from "../compile/rendertree.ts";
import type { LayerContext } from "./types.ts";
import {
  colorsOf,
  type FaceLoop,
  normalizeFontface,
  packFaceLoops,
  packMarkRows,
  packUniformChunks,
  valuesOf,
} from "./shared.ts";

const fallbackMeasurer: TextMeasurer = (text, size) => ({
  width: text.length * size * 0.6,
  height: size,
});

const POINTS_TOPOLOGY: MarkTopology = { kind: "points" };

/**
 * Lower geom_text to labels and geom_label to measured background, border,
 * and label nodes. Box dimensions are CSS-pixel stable and use the same
 * compiler-provided glyph measurer as guide layout when one is available.
 * Falls back to the theme's fontFamily/fontSize/textColor when the layer
 * doesn't set its own size/color/family param.
 */
export function lowerText(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;
  const theme = ctx.theme;
  const xDomain = ctx.xDomain;
  const yDomain = ctx.yDomain;
  const panelPixels = ctx.panelPixels;
  const measureText = ctx.measureText ?? fallbackMeasurer;

  const labelCol = mapping.label;
  if (!labelCol || !(labelCol in data)) return [];
  const rawLabels = columnValues(data, labelCol);
  const rawX = valuesOf(data, mapping.x);
  const rawY = valuesOf(data, mapping.y);
  if (!rawX || !rawY) return [];
  const retained: number[] = [];
  const positions: [number, number][] = [];
  const labels: string[] = [];
  for (
    let row = 0;
    row < Math.min(rawX.length, rawY.length, rawLabels.length);
    row++
  ) {
    if (rawLabels[row] == null) continue;
    const position: [number, number] = [
      scalePosition(xScale, rawX[row]),
      scalePosition(yScale, rawY[row]),
    ];
    if (!position.every(Number.isFinite)) continue;
    retained.push(row);
    positions.push(position);
    labels.push(String(rawLabels[row]));
  }
  if (!positions.length) return [];

  const mappedColors = colorsOf(
    mapping,
    data,
    ctx.scales.color,
    ctx.scales.fill,
    "color",
  );
  const colors = mappedColors?.filter((_, row) => retained.includes(row));
  const mappedFills = colorsOf(
    mapping,
    data,
    ctx.scales.color,
    ctx.scales.fill,
    "fill",
  );
  const fills = mappedFills?.filter((_, row) => retained.includes(row));
  const color = (layer.params.color as string) ?? theme.textColor ?? "#0b0b0b";
  const size = (layer.params.size as number) ?? theme.fontSize ?? 14;
  const defaultFamily = (layer.params.family as string) ?? theme.fontFamily;
  const defaultFace = normalizeFontface(
    layer.params.fontface,
    layer.params.weight ?? theme.fontWeight,
    layer.params.style ?? theme.fontStyle,
  );
  const lineHeight = (layer.params.lineheight as number) ??
    (layer.params.lineHeight as number) ?? theme.lineHeight;
  const angle = (layer.params.angle as number) ?? 0;
  const sourceFamilies = valuesOf(data, mapping.family);
  const sourceFaces = valuesOf(data, mapping.fontface);
  const mappedFamilies = retained.map((row) => sourceFamilies?.[row]);
  const mappedFaces = retained.map((row) => sourceFaces?.[row]);
  const batches = new Map<string, {
    family?: string;
    weight: number | string;
    style: string;
    indices: number[];
  }>();

  positions.forEach((_, index) => {
    const family = mappedFamilies?.[index] != null
      ? String(mappedFamilies[index])
      : defaultFamily;
    const face = mappedFaces?.[index] != null
      ? normalizeFontface(mappedFaces[index])
      : defaultFace;
    const key = JSON.stringify([family, face.weight, face.style]);
    const batch = batches.get(key) ?? { family, ...face, indices: [] };
    batch.indices.push(index);
    batches.set(key, batch);
  });

  // gggplot-tzc.3: positions (and colors, when mapped) pack into FlatTensors
  // via packMarkRows — labels stay a plain string[] (label text never goes
  // flat) but are re-filtered by the SAME mask so they stay index-aligned
  // with the packed positions/colors (a no-op here in practice: 'retained'
  // above has already dropped every non-finite position, so packMarkRows'
  // mask is always all-1s at this point — kept for consistency with
  // packMarkRows as the sole mask builder, per the epic's row-alignment rule).
  const labelNodes = [...batches.values()].map((batch) => {
    const batchColors = colors
      ? batch.indices.map((index) => colors[index])
      : undefined;
    const packed = packMarkRows({
      xs: batch.indices.map((index) => positions[index][0]),
      ys: batch.indices.map((index) => positions[index][1]),
      ...(batchColors ? { colors: batchColors } : {}),
    });
    const batchLabels = batch.indices
      .filter((_, i) => packed.mask[i])
      .map((index) => labels[index]);
    return node("Label", {
      positions: packed.positions,
      topology: POINTS_TOPOLOGY,
      labels: batchLabels,
      ...(packed.colors ? { colors: packed.colors } : { color }),
      size,
      weight: batch.weight,
      style: batch.style,
      ...(lineHeight != null ? { lineHeight } : {}),
      ...(angle ? { angle } : {}),
      zBias: 2,
      ...(batch.family ? { family: batch.family } : {}),
    });
  });
  if (layer.geom !== "label") return labelNodes;

  const padding = Number(layer.params.labelPadding ?? 3);
  const radius = Number(layer.params.labelR ?? 2);
  const borderWidth = Number(layer.params.borderWidth ?? 1);
  if (
    ![padding, radius, borderWidth].every((value) =>
      Number.isFinite(value) && value >= 0
    )
  ) {
    throw new TypeError(
      "geomLabel padding, radius, and border width must be non-negative CSS-pixel values",
    );
  }
  const xPerPixel = (xDomain[1] - xDomain[0]) / panelPixels.width;
  const yPerPixel = (yDomain[1] - yDomain[0]) / panelPixels.height;
  const radians = angle * Math.PI / 180;
  const rotate = (
    [x, y]: [number, number],
    [cx, cy]: [number, number],
  ): [number, number] => {
    const dx = x - cx, dy = y - cy;
    return [
      cx + dx * Math.cos(radians) - dy * Math.sin(radians),
      cy + dx * Math.sin(radians) + dy * Math.cos(radians),
    ];
  };
  const boxes: [number, number][][] = [];
  for (let index = 0; index < positions.length; index++) {
    const family = mappedFamilies[index] != null
      ? String(mappedFamilies[index])
      : defaultFamily;
    const face = mappedFaces[index] != null
      ? normalizeFontface(mappedFaces[index])
      : defaultFace;
    const lines = labels[index].split("\n");
    const metrics = lines.map((line) =>
      measureText(line, size, family, face.weight, face.style)
    );
    const widthPx = Math.max(0, ...metrics.map((metric) => metric.width)) +
      2 * padding;
    const naturalHeight = metrics.reduce(
      (sum, metric) => sum + metric.height,
      0,
    );
    const heightPx =
      (lineHeight != null ? Number(lineHeight) * lines.length : naturalHeight) +
      2 * padding;
    const halfWidth = widthPx * xPerPixel / 2,
      halfHeight = heightPx * yPerPixel / 2;
    const cornerRadiusX = Math.min(radius, widthPx / 2) * xPerPixel;
    const cornerRadiusY = Math.min(radius, heightPx / 2) * yPerPixel;
    const [cx, cy] = positions[index];
    const loop: [number, number][] = [];
    for (
      const [cornerX, cornerY, start] of [
        [cx + halfWidth - cornerRadiusX, cy + halfHeight - cornerRadiusY, 0],
        [
          cx - halfWidth + cornerRadiusX,
          cy + halfHeight - cornerRadiusY,
          Math.PI / 2,
        ],
        [
          cx - halfWidth + cornerRadiusX,
          cy - halfHeight + cornerRadiusY,
          Math.PI,
        ],
        [
          cx + halfWidth - cornerRadiusX,
          cy - halfHeight + cornerRadiusY,
          3 * Math.PI / 2,
        ],
      ] as const
    ) {
      for (let step = 0; step <= 3; step++) {
        const theta = start + step * Math.PI / 6;
        loop.push(rotate([
          cornerX + cornerRadiusX * Math.cos(theta),
          cornerY + cornerRadiusY * Math.sin(theta),
        ], positions[index]));
      }
    }
    boxes.push(loop);
  }
  const opacity = layer.params.alpha as number | undefined;
  const fill = (layer.params.fill as string) ?? "#ffffff";
  const borderColor = (layer.params.borderColor as string) ?? color;
  // gggplot-cct: geom_label's background and border pack into a ChunkedFace
  // (packFaceLoops — label boxes are convex rounded rects, concave: false)
  // and a flat Line (packUniformChunks — every box loop tessellates to the
  // same fixed vertex count), mirroring geom_boxplot's own box+line pattern.
  const boxLoops: FaceLoop[] = fills
    ? boxes.map((positions, i) => ({ positions, fill: fills[i] }))
    : boxes.map((positions) => ({ positions, fill }));
  const packedBoxes = packFaceLoops(boxLoops);
  const packedBorder = packUniformChunks(
    boxes.map((box) => [...box, box[0]]),
  );
  return [
    node("ChunkedFace", {
      positions: packedBoxes.positions,
      topology: packedBoxes.topology,
      colors: packedBoxes.colors,
      concave: false,
      zBias: 0,
      ...(opacity != null ? { opacity } : {}),
      radius,
    }),
    node("Line", {
      positions: packedBorder.positions,
      topology: packedBorder.topology,
      ...(colors ? { colors } : { color: borderColor }),
      width: borderWidth,
      zBias: 1,
      ...(opacity != null ? { opacity } : {}),
    }),
    ...labelNodes.map((label) => ({
      ...label,
      props: {
        ...label.props,
        zBias: 2,
        ...(opacity != null ? { opacity } : {}),
      },
    })),
  ];
}
