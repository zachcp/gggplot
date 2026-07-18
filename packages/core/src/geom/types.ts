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
  theme: Theme;
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
  xScale?: TrainedScale;
  yScale?: TrainedScale;
  xDomain: [number, number];
  yDomain: [number, number];
}

export interface GeomDocMeta {
  summary: string;
  aesthetics: { required: AesName[]; optional: AesName[] };
  params?: Record<string, string>;
  ggplot2Equivalent?: string;
}

export interface GeomDefinition {
  /** Serializable reference metadata consumed by documentation tooling only. */
  doc: GeomDocMeta;
  /** Default stat used by the DSL layer builder when none is supplied. */
  defaultStat: StatKind;
  /** Default position used by the DSL layer builder (default "identity"). */
  defaultPosition?: PositionKind;
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
  ): { x?: [number, number]; y?: [number, number] } | undefined;
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
