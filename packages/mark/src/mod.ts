import {
  type ExtensionDefinition,
  ExtensionRegistry,
} from "@gggplot/core/plan";

export const MARK_EXTENSION_ID = "@gggplot/mark:geom_mark@1";
export type MarkMethod = "hull" | "ellipse" | "rect" | "circle";
export type Point2 = [number, number];

export interface MarkSpec {
  extension: typeof MARK_EXTENSION_ID;
  data: { x: number[]; y: number[]; group?: string[] };
  params?: {
    method?: MarkMethod;
    expand?: number;
    segments?: number;
    fill?: string;
    stroke?: string;
  };
}

export interface MarkNode {
  component: "Polygon";
  props: { positions: Point2[]; fill: string; stroke: string; group: string };
  children: [];
}

export const markDefinition: ExtensionDefinition = {
  id: MARK_EXTENSION_ID,
  kind: "geom",
  requiredAes: ["x", "y"],
  optionalAes: ["group", "fill", "color"],
  parameters: {
    method: { type: "string", default: "hull" },
    expand: { type: "number", default: 0 },
    segments: { type: "number", default: 48 },
    fill: { type: "string", default: "#93c5fd55" },
    stroke: { type: "string", default: "#1d4ed8" },
  },
  missingValues: "drop",
  scope: "panel",
  showLegend: "auto",
  capabilities: ["cpu", "live", "emit"],
};

function hull(points: Point2[]): Point2[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length <= 2) return sorted;
  const cross = (o: Point2, a: Point2, b: Point2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (input: Point2[]) => {
    const out: Point2[] = [];
    for (const point of input) {
      while (
        out.length >= 2 &&
        cross(out[out.length - 2], out[out.length - 1], point) <= 0
      ) out.pop();
      out.push(point);
    }
    return out;
  };
  return [
    ...half(sorted).slice(0, -1),
    ...half(sorted.toReversed()).slice(0, -1),
  ];
}

function enclosure(
  points: Point2[],
  method: MarkMethod,
  expand: number,
  segments: number,
): Point2[] {
  const cx = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const cy = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  if (method === "hull" && points.length >= 3) {
    return hull(points).map(([x, y]): Point2 => {
      const dx = x - cx, dy = y - cy, length = Math.hypot(dx, dy);
      return length > 0
        ? [x + dx / length * expand, y + dy / length * expand]
        : [x, y];
    });
  }
  const minX = Math.min(...points.map((point) => point[0])) - expand;
  const maxX = Math.max(...points.map((point) => point[0])) + expand;
  const minY = Math.min(...points.map((point) => point[1])) - expand;
  const maxY = Math.max(...points.map((point) => point[1])) + expand;
  if (method === "rect" || method === "hull") {
    return [[minX, minY], [minX, maxY], [maxX, maxY], [maxX, minY]];
  }
  const radiusX = method === "circle"
    ? Math.max(
      expand,
      ...points.map(([x, y]) => Math.hypot(x - cx, y - cy) + expand),
    )
    : Math.max(expand, (maxX - minX) / 2);
  const radiusY = method === "circle"
    ? radiusX
    : Math.max(expand, (maxY - minY) / 2);
  return Array.from({ length: segments }, (_, index): Point2 => {
    const angle = index / segments * Math.PI * 2;
    return [cx + Math.cos(angle) * radiusX, cy + Math.sin(angle) * radiusY];
  });
}

export function compileMarks(
  spec: MarkSpec,
  registry: ExtensionRegistry,
): MarkNode[] {
  registry.resolve(spec.extension);
  const { x, y } = spec.data;
  if (
    x.length !== y.length ||
    (spec.data.group && spec.data.group.length !== x.length)
  ) throw new TypeError("[gggplot/mark] mapped columns must align");
  const method = spec.params?.method ?? "hull",
    expand = Number(spec.params?.expand ?? 0),
    segments = Number(spec.params?.segments ?? 48);
  if (!["hull", "ellipse", "rect", "circle"].includes(method)) {
    throw new TypeError(`[gggplot/mark] unsupported method "${method}"`);
  }
  if (!Number.isFinite(expand) || expand < 0) {
    throw new TypeError("[gggplot/mark] expand must be non-negative");
  }
  if (!Number.isInteger(segments) || segments < 8 || segments > 512) {
    throw new TypeError(
      "[gggplot/mark] segments must be an integer from 8 to 512",
    );
  }
  const groups = new Map<string, Point2[]>();
  for (let index = 0; index < x.length; index++) {
    if (![x[index], y[index]].every(Number.isFinite)) continue;
    const key = spec.data.group?.[index] ?? "__all__";
    groups.set(key, [...(groups.get(key) ?? []), [x[index], y[index]]]);
  }
  return [...groups].filter(([, points]) => points.length).map((
    [group, points],
  ) => ({
    component: "Polygon" as const,
    props: {
      positions: enclosure(points, method, expand, segments),
      group,
      fill: spec.params?.fill ?? "#93c5fd55",
      stroke: spec.params?.stroke ?? "#1d4ed8",
    },
    children: [] as [],
  }));
}

export function registerMarks(
  registry = new ExtensionRegistry(),
): ExtensionRegistry {
  return registry.register(markDefinition, {
    cpu: (input) => compileMarks(input as MarkSpec, registry),
    live: { value: compileMarks },
    emit: { importFrom: "@gggplot/mark", exportName: "compileMarks" },
  });
}

export function emitMarkSource(
  nodes: MarkNode[],
  name = "ClusterMarks",
): string {
  const body = nodes.map(({ props }) =>
    `    <Polygon positions={${JSON.stringify(props.positions)}} fill=${
      JSON.stringify(props.fill)
    } stroke=${JSON.stringify(props.stroke)} />`
  ).join("\n");
  return `import { Polygon } from "@use-gpu/plot";\nexport const ${name} = () => <>\n${body}\n</>;\n`;
}
