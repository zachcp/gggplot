import type { Aes, PlotLabels, PositionAxis, Theme } from "../ir/types.ts";
import type { TrainedScale } from "../scale/mod.ts";
import { scalePosition } from "../scale/mod.ts";
import { axisTickValues, gridDivision, tickLabel } from "./axes.ts";
import { node, type RenderNode } from "./rendertree.ts";

const PLANES = ["xy", "yz", "xz"] as const;
const PLACEMENT: Record<PositionAxis, string> = {
  x: "bottom",
  y: "left",
  z: "bottom",
};

function anchor(
  axis: PositionAxis,
  value: number,
  origin: [number, number, number],
): [number, number, number, number] {
  const point: [number, number, number, number] = [...origin, 1];
  point[axis === "x" ? 0 : axis === "y" ? 1 : 2] = value;
  return point;
}

const axisIndex = (axis: PositionAxis): 0 | 1 | 2 =>
  axis === "x" ? 0 : axis === "y" ? 1 : 2;

/** Pure camera rule shared with the runtime guide component and unit tests. */
export function cameraNearOrigin3d(
  domains: [[number, number], [number, number], [number, number]],
  bearing: number,
  pitch: number,
): [number, number, number] {
  const direction = [
    Math.sin(bearing) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(bearing) * Math.cos(pitch),
  ];
  return domains.map((domain, index) =>
    direction[index] >= 0 ? domain[1] : domain[0]
  ) as [number, number, number];
}

function tickPosition(scale: TrainedScale, value: unknown): number {
  return scalePosition(scale, value);
}

/** Ordinary RenderNodes for camera-aware in-scene x/y/z guides. */
export function guideNodes3d(
  scales: Record<PositionAxis, TrainedScale>,
  domains: Record<PositionAxis, [number, number]>,
  mapping: Aes,
  labels: PlotLabels,
  theme: Theme,
): RenderNode[] {
  const nodes: RenderNode[] = [];
  const origin: [number, number, number] = [
    domains.x[0],
    domains.y[0],
    domains.z[0],
  ];
  const fontSize = theme.fontSize ?? 13;
  const face = {
    ...(theme.fontFamily ? { family: theme.fontFamily } : {}),
    ...(theme.fontWeight ? { weight: theme.fontWeight } : {}),
    ...(theme.fontStyle ? { style: theme.fontStyle } : {}),
  };

  if (theme.grid !== false) {
    const breaks = Object.fromEntries(
      (["x", "y", "z"] as const).map((axis) => [
        axis,
        axisTickValues(scales[axis], 5),
      ]),
    ) as Record<PositionAxis, unknown[]>;
    const gridStyle = {
      auto: true,
      color: theme.gridColor ?? "#334155",
      width: theme.gridWidth ?? 1,
      zBias: -1,
    };
    for (const axes of PLANES) {
      const firstAxis = axes[0] as PositionAxis;
      const secondAxis = axes[1] as PositionAxis;
      const first = gridDivision(breaks[firstAxis]);
      const second = gridDivision(breaks[secondAxis]);
      if (first) {
        nodes.push(node("Grid", {
          axes,
          range: [first.range, domains[secondAxis]],
          first: first.props,
          second: null,
          ...gridStyle,
        }));
      }
      if (second) {
        nodes.push(node("Grid", {
          axes,
          range: [domains[firstAxis], second.range],
          first: null,
          second: second.props,
          ...gridStyle,
        }));
      }
      const irregular = [
        ...(first ? [] : breaks[firstAxis].map((value) => {
          const p1 = anchor(firstAxis, Number(value), origin);
          const p2 = [...p1] as [number, number, number, number];
          p1[axisIndex(secondAxis)] = domains[secondAxis][0];
          p2[axisIndex(secondAxis)] = domains[secondAxis][1];
          return [p1, p2];
        })),
        ...(second ? [] : breaks[secondAxis].map((value) => {
          const p1 = anchor(secondAxis, Number(value), origin);
          const p2 = [...p1] as [number, number, number, number];
          const crossIndex = axisIndex(firstAxis);
          p1[crossIndex] = domains[firstAxis][0];
          p2[crossIndex] = domains[firstAxis][1];
          return [p1, p2];
        })),
      ];
      if (irregular.length) {
        nodes.push(node("GuideLines", {
          positions: irregular,
          color: gridStyle.color,
          width: gridStyle.width,
          zBias: gridStyle.zBias,
        }));
      }
    }
  }
  if (theme.axes === false) return nodes;

  for (const axis of ["x", "y", "z"] as const) {
    const scale = scales[axis];
    const range = domains[axis];
    const breaks = axisTickValues(scale, 5);
    const values = breaks.map((value) => tickPosition(scale, value));
    nodes.push(node("CameraAxis3D", {
      axis,
      domains: [domains.x, domains.y, domains.z],
      range,
      values,
      labels: breaks.map(tickLabel),
      ...(theme.axisTitles === false
        ? {}
        : { title: labels[axis] ?? scale.name ?? mapping[axis] }),
      axisColor: theme.axisColor ?? "#94a3b8",
      axisWidth: theme.axisWidth ?? 2,
      textColor: theme.textColor ?? "#cbd5e1",
      fontSize,
      tickSize: Math.max(fontSize - 2, 8),
      placement: PLACEMENT[axis],
      ...face,
    }));
  }
  return nodes;
}
