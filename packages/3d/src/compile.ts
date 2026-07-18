import type { ExtensionRegistry } from "@gggplot/core/plan";
import { projectPoint, resolveCamera } from "./camera.ts";
import type {
  PointCloudRenderNode,
  PointCloudSpec,
  Vec3,
  Vec4,
} from "./types.ts";

function numericColumn(spec: PointCloudSpec, name: string): number[] {
  const column = spec.data[name];
  if (!column) throw new Error(`[gggplot/3d] Missing mapped column: ${name}`);
  return column.map((value, index) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      throw new Error(`[gggplot/3d] ${name}[${index}] must be finite`);
    }
    return numeric;
  });
}

function parseColor(value: number | string | null, index: number): Vec4 {
  if (typeof value === "number" && Number.isFinite(value)) {
    const channel = Math.max(0, Math.min(1, value));
    return [channel, channel, channel, 1];
  }
  if (typeof value === "string") {
    const hex = value.match(/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i)?.[1];
    if (hex) {
      const expanded = hex.length === 3
        ? [...hex].map((part) => `${part}${part}`).join("")
        : hex;
      return [
        parseInt(expanded.slice(0, 2), 16) / 255,
        parseInt(expanded.slice(2, 4), 16) / 255,
        parseInt(expanded.slice(4, 6), 16) / 255,
        expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
      ];
    }
  }
  throw new Error(
    `[gggplot/3d] color[${index}] must be a grayscale number in [0, 1] or a hex color`,
  );
}

export function compilePointCloud(
  spec: PointCloudSpec,
  registry: ExtensionRegistry,
): PointCloudRenderNode {
  registry.resolve(spec.extension);
  const x = numericColumn(spec, spec.mapping.x);
  const y = numericColumn(spec, spec.mapping.y);
  const z = numericColumn(spec, spec.mapping.z);
  if (x.length !== y.length || x.length !== z.length) {
    throw new Error("[gggplot/3d] x, y, and z columns must have equal lengths");
  }
  const sizeValues = spec.mapping.size
    ? numericColumn(spec, spec.mapping.size)
    : undefined;
  if (sizeValues && sizeValues.length !== x.length) {
    throw new Error("[gggplot/3d] size column must match position length");
  }
  const colorValues = spec.mapping.color
    ? spec.data[spec.mapping.color]
    : undefined;
  if (spec.mapping.color && !colorValues) {
    throw new Error(
      `[gggplot/3d] Missing mapped column: ${spec.mapping.color}`,
    );
  }
  if (colorValues && colorValues.length !== x.length) {
    throw new Error("[gggplot/3d] color column must match position length");
  }
  const positions: number[] = [];
  const sizes: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const projected = projectPoint([x[i], y[i], z[i]], spec.camera);
    if (!projected.every(Number.isFinite)) continue;
    positions.push(...projected);
    if (sizeValues) sizes.push(sizeValues[i]);
    if (colorValues) colors.push(...parseColor(colorValues[i], i));
  }
  const color = spec.params?.color ?? [0.23, 0.51, 0.96, 1] satisfies Vec4;
  return {
    component: spec.extension,
    props: {
      positions: new Float32Array(positions),
      ...(sizeValues ? { sizes: new Float32Array(sizes) } : {}),
      ...(colorValues ? { colors: new Float32Array(colors) } : {}),
      color,
      size: spec.params?.size ?? 6,
      opacity: spec.params?.opacity ?? 1,
      depthTest: spec.params?.depthTest ?? true,
      depthWrite: true,
      formats: { positions: "vec4<f32>" },
      camera: resolveCamera(spec.camera),
    },
    children: [],
  };
}

export const pointCloudRows = (node: PointCloudRenderNode): Vec3[] => {
  const rows: Vec3[] = [];
  for (let i = 0; i < node.props.positions.length; i += 4) {
    rows.push([
      node.props.positions[i],
      node.props.positions[i + 1],
      node.props.positions[i + 2],
    ]);
  }
  return rows;
};
