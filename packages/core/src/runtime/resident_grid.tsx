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
import type { TypedDataFrame } from "../data/mod.ts";
import type { GPUStorageSource } from "./types.ts";
import {
  createElement,
  useDeviceContext,
  useMemo,
  useResource,
} from "./usegpu_compat.ts";
import { useHoistedProduct } from "./resident_products.ts";
import type { LiveComponent } from "./usegpu_compat.ts";
import { paletteToRgbaF32, ResidentHistogramBars } from "./resident_bar.tsx";

/** The minimal mounted-kernel surface the grid provider drives. */
export interface ResidentGridKernel {
  readonly counts: GPUBuffer;
  readonly barVertices: GPUBuffer;
  /** Per-vertex RGBA bar colors; present only when a palette was supplied. */
  readonly barColors?: GPUBuffer;
  /** The uploaded per-group RGBA palette; present only alongside barColors. */
  readonly palette?: GPUBuffer;
  /**
   * Per-vertex RGBA heatmap colors, shading each cell by its own count.
   * Unconditional where the underlying kernel produces one (the histogram
   * grid); absent for kernels with no such pass (the count grid).
   */
  readonly heatmapColors?: GPUBuffer;
  readonly summary: GPUBuffer;
  readonly groupsCount: number;
  dispatch(): void;
  /** The resolved x-axis bin geometry, for a grid that has one. */
  readonly lo?: number;
  readonly binwidth?: number;
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
  /**
   * The uploaded per-group RGBA palette, present only alongside `barColors`.
   *
   * An INPUT, unlike everything else here: the colour pass reads it to fill
   * `barColors`. It is exposed because the mounted <Kernel> path binds that
   * pass itself rather than going through the kernel's own bind group
   * (gggplot-vs7.7); marks have no use for it.
   */
  readonly palette?: GPUStorageSource;
  /**
   * Per-vertex RGBA heatmap colors (four per cell), shading each cell by its
   * own count through a fixed ramp — present whenever the underlying kernel
   * produces one (unconditionally, for the histogram grid). The tile mark
   * binds this instead of `barColors`, which would otherwise flatten every
   * cell in a row to the same group color.
   */
  readonly heatmapColors?: GPUStorageSource;
  /** Dense [group, bin] tile-grid vertices; counts remain GPU-resident. */
  readonly tileVertices: GPUStorageSource;
  /** [group totals..., stacked maximum], for explicit bounded feedback only. */
  readonly summary: GPUStorageSource;
  readonly bins: number;
  readonly groupsCount: number;
  /**
   * Whether the kernel that owns these buffers is still mounted.
   *
   * A summary readback can span many frames while the kernel's pipelines
   * compile, and a route change can dispose the kernel underneath it. Copying
   * out of a destroyed buffer is a Dawn validation error, so anything that
   * reads across frames must check this first.
   */
  alive(): boolean;
  /**
   * Input rows this grid was built over.
   *
   * Not a rendering input — it is how a caller knows whether a summary of zero
   * is a legitimate answer or a chain that has not finished dispatching. See
   * resident_grid_pending.ts.
   */
  readonly rows: number;
  /**
   * The RESOLVED x-axis bin geometry this grid was built for, when it has one.
   *
   * Present for stat_bin, absent for stat_count — a categorical grid's cells
   * ARE integer indices, so it has no lo/binwidth to speak of. `binwidth` is
   * derived when the caller gave a bin count instead of a width, so this is the
   * only trustworthy source for it; the mounted <Kernel> path passes both as
   * shader args and must use exactly what the kernel packed, never a
   * re-derivation.
   */
  readonly binGeometry?: { readonly lo: number; readonly binwidth: number };
  /**
   * This version's compact summary, once a readback has produced one.
   *
   * Supplied by whoever mounted the kernels, not by the kernel object: the
   * readback runs as a <Readback> inside the frame's compute pass, so the
   * product cannot read its own summary buffer without re-introducing the
   * out-of-band staging copy that gggplot-vs7.4 removed. See
   * runtime/resident_readback.tsx.
   */
  readSummary(): Promise<S>;
  /** The input version this product was built for. */
  readonly version: number;
}

export interface ResidentGridProviderProps<O, S> {
  x: GPUStorageSource;
  group?: GPUStorageSource;
  options: O;
  /**
   * How this product's summary is read back, keyed by the version it belongs
   * to. The caller owns it because the caller owns the <Compute> the readback
   * mounts in; see ResidentGridProduct.readSummary.
   */
  readSummary: (version: number) => Promise<S>;
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
   * Set by GGPlot when this node's kernels were built above the plot
   * (runtime/resident_host.tsx). When present the product comes from context
   * and this component only renders its leaf.
   */
  residentId?: number;
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
  const productFrom = (
    resident: K,
    version: number,
    rows: number,
    alive: () => boolean,
    readSummary: (version: number) => Promise<S>,
  ): ResidentGridProduct<S> => {
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
      palette: resident.palette
        ? {
          buffer: resident.palette,
          format: "vec4<f32>",
          length: resident.groupsCount,
          size: [resident.groupsCount],
          version,
        }
        : undefined,
      heatmapColors: resident.heatmapColors
        ? {
          buffer: resident.heatmapColors,
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
      alive,
      rows,
      binGeometry: resident.lo != null && resident.binwidth != null
        ? { lo: resident.lo, binwidth: resident.binwidth }
        : undefined,
      readSummary: () => readSummary(version),
      version,
    };
  };

  /**
   * Allocates the kernel's buffers and yields its product. It DOES NOT
   * DISPATCH.
   *
   * Dispatch belongs to runtime/resident_host.tsx, which mounts this node's
   * passes as <Kernel>s inside the frame's <Compute> (gggplot-vs7.1). This used
   * to submit its own command buffer from the useMemo body below, guarded by a
   * `defer` prop that the host set; every resident product is hoisted now, so
   * the guard was always true and the branch it guarded was dead — verified by
   * making it throw and running every route.
   */
  const Provider = (
    { x, group, options, readSummary, children }: ResidentGridProviderProps<
      O,
      S
    >,
  ): LiveElement => {
    const device = useDeviceContext();
    // The resource tracks LIVENESS, not just cleanup: a reader that spans
    // frames has to be able to tell that these buffers are gone. See
    // ResidentGridProduct.alive.
    const owned = useResource((dispose) => {
      const kernel = config.create(device, x, group, options);
      const state = { alive: true };
      dispose(() => {
        state.alive = false;
        kernel.destroy();
      });
      return { kernel, state };
    }, [device, x.buffer, group?.buffer, ...config.optionKeys(options)]);
    const version = Math.max(x.version, group?.version ?? 0);
    const product = useMemo(
      () =>
        productFrom(
          owned.kernel,
          version,
          x.length,
          () => owned.state.alive,
          readSummary,
        ),
      [owned, version, x.length, readSummary],
    );
    return children(product);
  };

  const Mark = (
    { options, color, opacity, paletteColors, residentId }:
      ResidentGridMarkProps<O>,
  ): LiveElement => {
    // Runs unconditionally to keep hook order stable; null when not hoisted,
    // and also null on the first frame of a hoisted stat_bin node, while its x
    // bounds are still being read back off the GPU.
    const hoisted = useHoistedProduct<ResidentGridProduct<S>>(residentId);
    // Convert factor-level hex colors to an RGBA palette once (opacity baked
    // into alpha) and fold it into options so the mounted kernel expands it
    // per-group; a palette change re-keys useResource via config.optionKeys.
    const palette = useMemo(
      () =>
        paletteColors
          ? paletteToRgbaF32(paletteColors, opacity ?? 1)
          : undefined,
      [paletteColors?.join(","), opacity],
    );
    const resolvedOptions = useMemo(
      () => (palette ? { ...options, palette } as O : options),
      [options, palette],
    );
    options = resolvedOptions;
    if (typeof residentId !== "number") {
      // Not hoisted, which for a resident product now means misconfigured: its
      // id is missing from resident_host.tsx's HOISTED_PRODUCTS, so nothing
      // built its kernel and nothing will dispatch it. This used to fall back
      // to building the kernel in place; that path is gone with gggplot-vs7.1,
      // and failing here beats rendering an empty panel, which is exactly how
      // the tile product hid two bugs for months (gggplot-vs7.12).
      throw new Error(
        "[gggplot] a resident mark was mounted without a hoisted product; " +
          "add its product id to HOISTED_PRODUCTS in runtime/resident_host.tsx",
      );
    }
    // Null while a hoisted stat_bin node is still resolving its x bounds.
    if (!hoisted) return null as never;
    // A mark renders INSIDE the panel, so it contributes its leaf and nothing
    // else — the panel owns the range. That is the only structural difference
    // from the standalone view forms, which also mount a <Cartesian>.
    return createElement(leaf, {
      product: hoisted,
      color,
      opacity,
      colors: hoisted.barColors,
    });
  };

  return { Provider, Mark };
}
