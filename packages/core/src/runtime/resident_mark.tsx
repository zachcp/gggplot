/** @jsxRuntime classic */
/** @jsx createElement */
// Composes mounted RawData sources, the resident stat, and its Face mark.

import * as Live from "@use-gpu/live";
import type { LiveElement } from "@use-gpu/live";
import type { TypedDataFrame } from "../data/mod.ts";
import type { FieldSpec } from "../plan/mod.ts";
import type { MountedHistogramSourceOptions } from "./resident.ts";
import {
  type ResidentDomainProduct,
  ResidentDomainProvider,
} from "./resident_domain_live.tsx";
import { ResidentHistogramBars } from "./resident_bar.tsx";
import { GPUDataProvider } from "./live.tsx";
import { ResidentHistogramProvider } from "./resident_live.tsx";

type Component = (props: Record<string, unknown>) => LiveElement;
type CreateElement = (
  type: Component,
  props: Record<string, unknown>,
) => LiveElement;
const createElement =
  (Live as unknown as { createElement: CreateElement }).createElement;
type UseAwait = <T>(
  callback: ((cancelled: () => boolean) => Promise<T>) | null,
  dependencies: readonly unknown[],
) => [T | undefined, Error | undefined, boolean];
const useAwait = (Live as unknown as { useAwait: UseAwait }).useAwait;

export interface ResidentHistogramMarkProps {
  data: TypedDataFrame;
  x: string;
  group?: string;
  options: Omit<MountedHistogramSourceOptions, "lo" | "hi"> & {
    lo?: number;
    hi?: number;
    autoDomain?: boolean;
  };
  color: string;
  opacity?: number;
}

interface AwaitDomainProps {
  domain: ResidentDomainProduct;
  x: unknown;
  group: unknown;
  options: ResidentHistogramMarkProps["options"];
  color: string;
  opacity?: number;
}

const AwaitDomainHistogram = (
  { domain, x, group, options, color, opacity }: AwaitDomainProps,
): LiveElement => {
  const [bounds, error] = useAwait(
    () => domain.readDomain(),
    [domain.domain.version],
  );
  if (error) throw error;
  if (!bounds || bounds.empty) return null as never;
  const resolved = {
    ...options,
    lo: bounds.min,
    hi: bounds.max,
    autoDomain: undefined,
  } as MountedHistogramSourceOptions;
  return createElement(ResidentHistogramProvider as unknown as Component, {
    x,
    group,
    options: resolved,
    children: (product: unknown) =>
      createElement(ResidentHistogramBars as unknown as Component, {
        product,
        color,
        opacity,
      }),
  });
};

/** Direct composable lowering target for an eligible stat_bin/geom_histogram layer. */
export const ResidentHistogramMark = (
  { data, x, group, options, color, opacity }: ResidentHistogramMarkProps,
): LiveElement => {
  const fields: FieldSpec[] = [
    { name: x, dtype: "f32", shape: "row", dimensions: ["row"] },
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
      options.autoDomain
        ? createElement(ResidentDomainProvider as unknown as Component, {
          x: sources[x],
          children: (domain: ResidentDomainProduct) =>
            createElement(AwaitDomainHistogram as unknown as Component, {
              domain,
              x: sources[x],
              group: group ? sources[group] : undefined,
              options,
              color,
              opacity,
            }),
        })
        : createElement(ResidentHistogramProvider as unknown as Component, {
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
