// Registry-facing interfaces for the per-geom lowering modules.
//
// `LayerContext` replaces the former 19-positional-parameter lowerLayer
// signature (8 of which were individual trained scales) with one object built
// once per panel by compile(). `GeomDefinition` mirrors the stat side's
// Record<StatKind, StatFn> contract: each geom kind maps to a definition that
// carries the DSL defaults plus a uniform `lower` function.
import type {
  Aes,
  AesName,
  DataFrame,
  GGSpec,
  Layer,
  PositionAxis,
  PositionKind,
  StatKind,
  Theme,
} from "../ir/types.ts";
import type { TypedDataFrame } from "../data/mod.ts";
import type { TrainedScale } from "../scale/mod.ts";
import type { RenderNode } from "../compile/rendertree.ts";
import type { TextMeasurer } from "../compile/guides.ts";

export interface LayerContext {
  /** Trained scales keyed by aesthetic — replaces 8 positional scale params. */
  scales: Partial<Record<AesName, TrainedScale>>;
  /** Canonical position domains, including z for 3D modes. */
  domains: Partial<Record<PositionAxis, [number, number]>>;
  theme: Theme;
  /** 2D compatibility conveniences; new shared lowering should use domains. */
  xDomain: [number, number];
  yDomain: [number, number];
  panelPixels: { width: number; height: number };
  measureText?: TextMeasurer;
}

/**
 * A geom's declaration that an eligible layer can be rendered by a GPU-resident
 * product instead of CPU-lowered marks. Returned by GeomDefinition.residentPlan
 * and carried, fully serializable, on a generic "ResidentProduct" RenderNode:
 * the live backend resolves `product` (a plan id string, never a component
 * reference) to a concrete component through the runtime resident registry.
 */
export interface ResidentProductProps {
  /** Plan id resolving to a runtime component, e.g. "@gggplot/core:stat_bin@1". */
  product: string;
  /** Serializable node props for the resolved product (today's ResidentHistogramNodeProps). */
  props: Record<string, unknown>;
  /** True for the standalone auto-y-domain "view" form (else the inline mark form). */
  standaloneView?: boolean;
}

/** Inputs a domainContribution hook needs to widen a panel's trained x/y domains. */
export interface DomainContributionCtx {
  scales: Partial<Record<PositionAxis, TrainedScale>>;
  domains: Partial<Record<PositionAxis, [number, number]>>;
  xScale?: TrainedScale;
  yScale?: TrainedScale;
  zScale?: TrainedScale;
  xDomain: [number, number];
  yDomain: [number, number];
}

export interface GeomDocMeta {
  summary: string;
  aesthetics: { required: AesName[]; optional: AesName[] };
  params?: Record<string, string>;
  ggplot2Equivalent?: string;
}

export type PlotDimension = 2 | 3;

/**
 * How a 3D realization interacts with the depth buffer.
 *
 * `opaque` always writes depth. `alphaAware` writes depth only while the layer
 * is actually opaque and switches to transparent rendering once any alpha
 * drops below 1 — the effective policy depends on the data, so a mode can
 * declare the capability but not the outcome. `overlay` never tests or writes,
 * for content that must sit on top of the scene regardless of position.
 *
 * Declaring this per mode is what stops each new 3D geom from re-deriving the
 * rule: point and line arrived at the same `depthWrite: !transparent`
 * independently, and the planar surfaces in gggplot-lcy.3 would have been the
 * third copy.
 */
export type DepthPolicy = "opaque" | "alphaAware" | "overlay";

/** One dimensional realization exposed behind a public geom definition. */
export interface GeomMode {
  dimensions: PlotDimension;
  /** Position aesthetics that must be mapped for this realization. */
  requiredPosition: readonly AesName[];
  /** Omit to preserve the geom's ordinary stat surface. */
  stats?: readonly StatKind[];
  /** Omit to preserve the geom's ordinary position surface. */
  positions?: readonly PositionKind[];
  /** Allowed values for params whose validity differs by dimensional mode. */
  params?: Readonly<Record<string, readonly unknown[]>>;
  /**
   * Depth-buffer behavior. Omitting it means `alphaAware`, which is what
   * point, line, and path already did: a geom that forgets to declare gets
   * the safe reading, since writing depth for genuinely translucent content
   * produces visible blending artifacts while the reverse costs nothing.
   */
  depth?: DepthPolicy;
}

export interface GeomDefinition {
  /** Serializable reference metadata consumed by documentation tooling only. */
  doc: GeomDocMeta;
  /** Default stat used by the DSL layer builder when none is supplied. */
  defaultStat: StatKind;
  /** Default position used by the DSL layer builder (default "identity"). */
  defaultPosition?: PositionKind;
  /**
   * Aesthetics this geom accepts without them selecting a dimensional mode.
   *
   * `z` on geom_tile is the current case: it is a documented value channel,
   * not a position. Without this declaration a mapped `z` on a geom with no
   * 3D mode is indistinguishable from a 3D request that was silently ignored,
   * which is the bug this field exists to make impossible.
   */
  nonPositionalAes?: readonly AesName[];
  /**
   * Public dimensional realizations. Omit for an ordinary 2D-only geom.
   * Shared geoms declare both modes without growing a second GeomKind.
   */
  modes?: readonly GeomMode[];
  /** Params that must be accepted by the selected mode rather than globally. */
  dimensionalParams?: readonly string[];
  /**
   * Whether a row with no position can simply be dropped before lowering.
   *
   * True for geoms whose rows are independent marks — a point, a tile, a bar.
   * Removing one changes nothing about its neighbours, and keeping it is
   * actively wrong: ingest() turns NaN into null and scalePosition maps null
   * onto a finite coordinate, so the row is drawn somewhere its data never
   * was. Measured: geom_point plotted [0, NaN, 2] at y=0 (gggplot-bab).
   *
   * FALSE — the important half — for geoms whose topology is defined by row
   * order or grid completeness. A missing value in geom_path is a BREAK in
   * the line, not an absent row; geom_surface needs a complete grid and drops
   * only the cells touching the hole. Filtering those rows upstream joins the
   * line across the gap, or throws on an incomplete grid. That was measured
   * too: a blanket filter failed exactly four tests, every one of them
   * asserting that a missing value carries structural meaning.
   *
   * This is ggplot2's per-layer na.rm handling, which is per-geom for the
   * same reason.
   */
  dropsMissingPositions?: boolean;
  /** False for scale-training-only layers such as geomBlank. */
  contributesDimension?: boolean;
  /** Lower one geom layer to its RenderNode(s) — one per group for connected geoms. */
  lower(
    layer: Layer,
    mapping: Aes,
    data: DataFrame,
    ctx: LayerContext,
  ): RenderNode[];
  /**
   * Optional per-geom domain-widening contribution — e.g. stacked-bar totals,
   * silhouette-area symmetric range, tile cell half-widths. compile() calls
   * this once per layer per panel (fixed and free-scale alike) and, when it
   * returns a value, replaces the running x/y domain with it. The contract is
   * *replacement*, not delta: the returned domain must already contain
   * ctx.xDomain/ctx.yDomain (monotonically widening), so compile() can just
   * assign it back. Return undefined (or omit x/y) to leave that axis as-is.
   */
  domainContribution?(
    layer: Layer,
    mapping: Aes,
    data: DataFrame,
    ctx: DomainContributionCtx,
  ): Partial<Record<PositionAxis, [number, number]>> | undefined;
  /**
   * Optional per-geom GPU-resident capability declaration. When compile() is
   * asked for resident lowering (CompileOptions.resident), it consults this
   * hook per layer instead of any product-specific branch: a returned
   * ResidentProductProps replaces CPU marks with a generic "ResidentProduct"
   * node; undefined keeps the CPU path (fallback when eligibility gates fail).
   * `opts.standalone` is true only for an unfaceted single-layer plot, which
   * enables the automatic-y-domain "view" form.
   */
  residentPlan?(
    spec: GGSpec,
    layer: Layer,
    mapping: Aes,
    data: TypedDataFrame,
    opts: { standalone: boolean },
  ): ResidentProductProps | undefined;
}
