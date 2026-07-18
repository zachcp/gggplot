/** @jsxRuntime classic */
/** @jsx createElement */
import * as Live from "@use-gpu/live";
import type { LiveElement } from "@use-gpu/live";
import type { TypedDataFrame } from "../data/mod.ts";
import type { FieldSpec } from "../plan/mod.ts";
import type { MountedCountSourceOptions } from "./resident.ts";
import { GPUDataProvider } from "./live.tsx";
import { ResidentCountProvider } from "./resident_count_live.tsx";
import { ResidentHistogramBars } from "./resident_bar.tsx";

type Component = (props: Record<string, unknown>) => LiveElement;
type CreateElement = (
  type: Component,
  props: Record<string, unknown>,
) => LiveElement;
const createElement =
  (Live as unknown as { createElement: CreateElement }).createElement;
export interface ResidentCountMarkProps {
  data: TypedDataFrame;
  x: string;
  group?: string;
  options: MountedCountSourceOptions;
  color: string;
  opacity?: number;
}
export const ResidentCountMark = (
  { data, x, group, options, color, opacity }: ResidentCountMarkProps,
): LiveElement => {
  const fields: FieldSpec[] = [
    { name: x, dtype: "u32", shape: "row", dimensions: ["row"] },
    ...(group
      ? [{
        name: group,
        dtype: "u32" as const,
        shape: "row" as const,
        dimensions: ["row"],
      }]
      : []),
  ];
  return createElement(GPUDataProvider as unknown as Component, {
    data,
    fields,
    children: (sources: Record<string, unknown>) =>
      createElement(ResidentCountProvider as unknown as Component, {
        x: sources[x],
        group: group ? sources[group] : undefined,
        options,
        children: (product: unknown) =>
          createElement(ResidentHistogramBars as unknown as Component, {
            product,
            color,
            opacity,
          }),
      }),
  });
};
