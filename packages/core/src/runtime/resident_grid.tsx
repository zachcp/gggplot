/** @jsxRuntime classic */
/** @jsx createElement */
// Shared provider→product→mark structure for the resident count/histogram
// grid triads. resident_live.tsx (stat_bin) and resident_count_live.tsx
// (stat_count) are structurally identical — same mounted-device execution
// boundary, same GPUStorageSource product shape, same GPUDataProvider →
// provider → ResidentHistogramBars mark composition — differing only in their
// kernel constructor, useResource dependency keys, which resident buffer backs
// `tileVertices`, whether `bins` reads `bins` or `valuesCount`, and whether an
// auto-domain pass runs first. Those differences are hoisted into a small
// config object; everything else lives here once.

import type { LiveElement } from "@use-gpu/live";
import type { ResidentDomain1DResult } from "@gggplot/reductions";
import type { TypedDataFrame } from "../data/mod.ts";
import type { FieldSpec } from "../plan/mod.ts";
import type { GPUStorageSource } from "./types.ts";
import {
  createElement,
  useAwait,
  useDeviceContext,
  useMemo,
  useResource,
} from "./usegpu_compat.ts";
import { GPUDataProvider } from "./live.tsx";
import {
  type ResidentDomainProduct,
  ResidentDomainProvider,
} from "./resident_domain_live.tsx";
import type { LiveComponent } from "./usegpu_compat.ts";
import { paletteToRgbaF32, ResidentHistogramBars } from "./resident_bar.tsx";

/** The minimal mounted-kernel surface the grid provider drives. */
export interface ResidentGridKernel {
  readonly counts: GPUBuffer;
  readonly barVertices: GPUBuffer;
  /** Per-vertex RGBA bar colors; present only when a palette was supplied. */
  readonly barColors?: GPUBuffer;
  readonly summary: GPUBuffer;
  readonly groupsCount: number;
  dispatch(): void;
  destroy(): void;
}

/** The GPU-resident product exposed to marks and views (counts stay on GPU). */
export interface ResidentGridProduct<S> {
  readonly counts: GPUStorageSource;
  readonly barVertices: GPUStorageSource;
  /**
   * Per-vertex RGBA bar colors (four per cell), present only when the kernel
   * was created with a palette. The bars mark binds this instead of a scalar
   * fill color.
   */
  readonly barColors?: GPUStorageSource;
  /** Dense [group, bin] tile-grid vertices; counts remain GPU-resident. */
  readonly tileVertices: GPUStorageSource;
  /** [group totals..., stacked maximum], for explicit bounded feedback only. */
  readonly summary: GPUStorageSource;
  readonly bins: number;
  readonly groupsCount: number;
  readSummary(): Promise<S>;
}

export interface ResidentGridProviderProps<O, S> {
  x: GPUStorageSource;
  group?: GPUStorageSource;
  options: O;
  children: (product: ResidentGridProduct<S>) => LiveElement;
}

export interface ResidentGridMarkProps<O> {
  data: TypedDataFrame;
  x: string;
  group?: string;
  options: O;
  color: string;
  opacity?: number;
  /**
   * Factor-level hex colors (level order) for a fill/color-mapped bar layer.
   * Converted once to an RGBA palette and expanded per-group on-GPU; absent
   * leaves the mark on its scalar `color` path.
   */
  paletteColors?: string[];
}

/** Product-specific behavior for {@link createResidentGrid}. */
export interface ResidentGridConfig<K extends ResidentGridKernel, O, S> {
  /** Instantiate the mounted kernel against the caller-owned sources. */
  create(
    device: GPUDevice,
    x: GPUStorageSource,
    group: GPUStorageSource | undefined,
    options: O,
  ): K;
  /** Cells-per-group count (`bins` for stat_bin, `valuesCount` for stat_count). */
  binsOf(resident: K): number;
  /** Buffer backing dense tile geometry (a distinct grid, or the bar grid). */
  tileVerticesOf(resident: K): GPUBuffer;
  /** Compact summary readback. */
  readSummary(resident: K): Promise<S>;
  /** The option-derived tail of the useResource dependency list. */
  optionKeys(options: O): readonly unknown[];
  /** Physical dtype of the mounted x field. */
  xDtype: "f32" | "u32";
  /**
   * Leaf mark rendered over the product (bars by default, tiles for the dense
   * [group,bin] heatmap grid). Receives `{ product, color, opacity, colors }`;
   * `colors` is the per-group palette source when the kernel carries one.
   */
  leaf?: LiveComponent;
  /**
   * When present, an `options.autoDomain` mark first resolves x bounds through
   * ResidentDomainProvider, then maps resolved bounds into concrete options.
   */
  resolveAutoDomain?(options: O, bounds: ResidentDomain1DResult): O;
}

export interface ResidentGrid<O, S> {
  Provider: (props: ResidentGridProviderProps<O, S>) => LiveElement;
  Mark: (props: ResidentGridMarkProps<O>) => LiveElement;
}

/**
 * Builds a provider (mounted execution boundary) and a composable mark from a
 * product-specific {@link ResidentGridConfig}. Behavior is identical to the
 * former hand-written stat_bin / stat_count provider+mark pairs.
 */
export function createResidentGrid<K extends ResidentGridKernel, O, S>(
  config: ResidentGridConfig<K, O, S>,
): ResidentGrid<O, S> {
  const leaf: LiveComponent = config.leaf ??
    (ResidentHistogramBars as unknown as LiveComponent);
  const productFrom = (resident: K, version: number): ResidentGridProduct<S> => {
    const bins = config.binsOf(resident);
    const cells = bins * resident.groupsCount;
    return {
      counts: {
        buffer: resident.counts,
        format: "u32",
        length: cells,
        size: [resident.groupsCount, bins],
        version,
      },
      barVertices: {
        buffer: resident.barVertices,
        format: "vec2<f32>",
        length: cells * 4,
        size: [resident.groupsCount, bins, 4],
        version,
      },
      barColors: resident.barColors
        ? {
          buffer: resident.barColors,
          format: "vec4<f32>",
          length: cells * 4,
          size: [resident.groupsCount, bins, 4],
          version,
        }
        : undefined,
      tileVertices: {
        buffer: config.tileVerticesOf(resident),
        format: "vec2<f32>",
        length: cells * 4,
        size: [resident.groupsCount, bins, 4],
        version,
      },
      summary: {
        buffer: resident.summary,
        format: "u32",
        length: resident.groupsCount + 1,
        size: [resident.groupsCount + 1],
        version,
      },
      bins,
      groupsCount: resident.groupsCount,
      readSummary: () => config.readSummary(resident),
    };
  };

  const Provider = (
    { x, group, options, children }: ResidentGridProviderProps<O, S>,
  ): LiveElement => {
    const device = useDeviceContext();
    const resident = useResource((dispose) => {
      const result = config.create(device, x, group, options);
      dispose(() => result.destroy());
      return result;
    }, [device, x.buffer, group?.buffer, ...config.optionKeys(options)]);
    const version = Math.max(x.version, group?.version ?? 0);
    const product = useMemo(() => {
      resident.dispatch();
      return productFrom(resident, version);
    }, [resident, version]);
    return children(product);
  };

  const AwaitDomainMark = (
    { domain, x, group, options, color, opacity }: {
      domain: ResidentDomainProduct;
      x: GPUStorageSource;
      group?: GPUStorageSource;
      options: O;
      color: string;
      opacity?: number;
    },
  ): LiveElement => {
    const [bounds, error] = useAwait(() => domain.readDomain(), [
      domain.domain.version,
    ]);
    if (error) throw error;
    if (!bounds || bounds.empty) return null as never;
    const resolved = config.resolveAutoDomain!(options, bounds);
    return createElement(Provider, {
      x,
      group,
      options: resolved,
      children: (product: ResidentGridProduct<S>) =>
        createElement(leaf, {
          product,
          color,
          opacity,
          colors: product.barColors,
        }),
    });
  };

  const Mark = (
    { data, x, group, options, color, opacity, paletteColors }:
      ResidentGridMarkProps<O>,
  ): LiveElement => {
    // Convert factor-level hex colors to an RGBA palette once (opacity baked
    // into alpha) and fold it into options so the mounted kernel expands it
    // per-group; a palette change re-keys useResource via config.optionKeys.
    const palette = useMemo(
      () =>
        paletteColors ? paletteToRgbaF32(paletteColors, opacity ?? 1) : undefined,
      [paletteColors?.join(","), opacity],
    );
    const resolvedOptions = useMemo(
      () => (palette ? { ...options, palette } as O : options),
      [options, palette],
    );
    options = resolvedOptions;
    const fields: FieldSpec[] = [
      { name: x, dtype: config.xDtype, shape: "row", dimensions: ["row"] },
      ...(group
        ? [{
          name: group,
          dtype: "u32" as const,
          shape: "row" as const,
          dimensions: ["row"],
        }]
        : []),
    ];
    const wantsDomain = config.resolveAutoDomain != null &&
      (options as { autoDomain?: boolean }).autoDomain === true;
    return createElement(GPUDataProvider, {
      data,
      fields,
      children: (sources: Record<string, GPUStorageSource>) =>
        wantsDomain
          ? createElement(ResidentDomainProvider, {
            x: sources[x],
            children: (domain: ResidentDomainProduct) =>
              createElement(AwaitDomainMark, {
                domain,
                x: sources[x],
                group: group ? sources[group] : undefined,
                options,
                color,
                opacity,
              }),
          })
          : createElement(Provider, {
            x: sources[x],
            group: group ? sources[group] : undefined,
            options,
            children: (product: ResidentGridProduct<S>) =>
              createElement(leaf, {
                product,
                color,
                opacity,
                colors: product.barColors,
              }),
          }),
    });
  };

  return { Provider, Mark };
}
