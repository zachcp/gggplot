// Staged geometry cache (gggplot-tzc.5). Makes compile() idempotent at the
// tensor level: re-compiling an UNCHANGED spec — or a DSL-rebuilt spec that
// is structurally identical and reuses the same underlying data columns —
// yields renderer-ready FlatTensor/MarkTopology objects that are
// REFERENCE-IDENTICAL (===) to the previous compile's, all the way from
// packing (Stage A) through coordinate/topology transforms (Stage B) to the
// RenderTree nodes the renderer actually consumes. This is what lets a host
// (render/GGPlot.tsx) skip re-uploading GPU buffers on an unrelated re-render.
//
// WHY STAGED: tzc.2's polarize/munch step allocates brand-new arrays even
// when given the same input twice (positions.array is documented
// never-mutate-after-construction, so pointwise remaps must copy). A cache
// wrapped only around packing (Stage A) would still leave polar/concave
// charts re-uploading on every render, since the coordinate step downstream
// of packing always reallocates. Hence two independent stages, each keyed on
// exactly what can invalidate it:
//   Stage A (pack)              — geom lowering: aesthetic extraction +
//                                  packMarkRows/packFaceLoops/packUniformChunks.
//                                  Depends on data + mapping + geometry params.
//   Stage B (coordinate/topology) — polarize + munch. Depends on Stage A's
//                                  OWN output tensors plus coord params.
// Stage C (derived/triangulated indices) does not exist in this codebase:
// tzc.4's concavity spike validated the UPSTREAM mount-time concave source
// (useFaceSegmentsConcaveSource, @use-gpu/core's generateConcaveIndices via
// earcut) end to end and took that path — no CPU triangulation step was
// added to the compiler, so there is no derived-index artifact for a Stage C
// cache to hold. See the bd note on this bead for the explicit confirmation.
//
// ---------------------------------------------------------------------------
// INVALIDATION STRUCTURE (the load-bearing choice)
// ---------------------------------------------------------------------------
// `revisions` is a WeakMap<Column | Float32Array, number> — one revision
// counter per data column (a data/mod.ts NumericColumn/FactorColumn object)
// or per Stage-A-output tensor array (used as Stage B's own dependency).
// Every stage's cache key is a STRING that folds in the CURRENT revision of
// every column/tensor it depends on (0 when the dependency has never been
// invalidated, i.e. absent from the WeakMap — see revisionOf). invalidate()
// simply increments that one entry; every lookup that used the old value
// naturally builds a DIFFERENT key string next time and misses. No reverse
// index from column -> cache entries is needed or maintained.
//
// The cache STORE itself is a WeakMap<RevisionKey, Map<string, V>> — one
// string-keyed Map of entries per "primary" column/tensor, reachable ONLY
// through a weak reference from that primary. This satisfies both required
// properties:
//   (a) NO STRONG REFS TO COLUMN ARRAYS: the outer WeakMap holds its
//       Map<string,V> values with a weak key; nothing in this module retains
//       a strong reference to a Column or its underlying values array,  or to
//       any Float32Array beyond what a cached RenderNode already legitimately
//       owns (its own packed tensor). When the primary column/tensor becomes
//       unreachable elsewhere (e.g. spec.data is discarded), its entire
//       per-primary cache Map — including every stale entry rooted under it —
//       becomes collectible in the same GC pass. Companion dependencies
//       (e.g. a color column for a position-primaried entry) are NEVER
//       stored by reference at all — only their revision NUMBER is read via
//       revisionOf() and folded into the key string.
//   (b) invalidate(column) MISSES ALL DEPENDENT ENTRIES: any cache key whose
//       string included that column's old revision no longer matches the
//       string built from its new (incremented) revision, so every future
//       lookup for an entry that depended on it recomputes. This holds
//       regardless of which column an entry happens to be ROOTED under
//       (its "primary") — rooting only decides collectibility, key-string
//       membership decides correctness.
// A plain (non-weak) fallback Map is used ONLY for the rare param-only
// layer with no mapped column at all (e.g. geom_abline(slope=, intercept=)):
// nothing data-derived is retained there, so strong references are harmless.
//
// ---------------------------------------------------------------------------
// STAGE A — pack
// ---------------------------------------------------------------------------
// Key = every mapped aesthetic's column name + column revision, plus each
// aesthetic's scale identity/params THAT AFFECT PACKED VALUES, plus a
// deterministic stringification of the layer's geom/position/params, plus
// panel membership (panelIndex) and layer identity (layerIndex).
//
// "Scale params that affect packed values" is aesthetic-specific, verified
// directly against scale/mapping.ts:
//   - x/y (scalePosition): discrete -> factor-level order (domain) matters;
//     continuous/log/sqrt -> ONLY the transform kind matters. scalePosition
//     never reads a continuous scale's domain bounds at all, so the packed
//     position values are already domain-independent — this cache
//     deliberately does NOT fold continuous x/y domain into the key. That is
//     what lets gggplot-tzc.7's continuous-linear raw data-space positions
//     avoid invalidating this cache on every zoom/pan/limits change — tzc.7
//     confirmed scalePosition's continuous-kind branch was already a bare
//     identity (nothing to change here) and added the reference-identity
//     gate test (tests/raw_position_domain_test.ts) plus
//     docs/RESIDENCY_MATRIX.md documenting the log/sqrt/discrete CPU rows
//     this exempts.
//   - every other aesthetic (color/fill/size/alpha/shape/linetype/linewidth/
//     stroke): scaleColorValue/scaleSizeValue/scaleAlphaValue/... all read
//     the FULL domain+range to compute a packed value (e.g. color
//     interpolates t = (raw-lo)/(hi-lo) across the continuous domain), so
//     the full scale identity (kind+domain+range) is folded in for these.
// domainContribution (the ctx.xDomain/yDomain widening pass) runs BEFORE
// lowerLayer and never feeds back into it for the converted geom families —
// confirmed by inspection: point/line/bar/area/tile/polygon/violin/boxplot/
// hex/rect's `lower()` implementations never read ctx.xDomain/ctx.yDomain or
// ctx.panelPixels. Three geoms DO read them inside `lower()` for actual
// packed output (text/label via ctx.theme+ctx.panelPixels for glyph
// placement; rug via ctx.panelPixels for tick length) — those three are
// excluded from Stage A caching entirely (UNCACHEABLE_GEOMS) rather than
// grow the key with theme/pixel/domain dependencies that would defeat the
// "reuse across resize/theme-only changes" goal for every OTHER geom.
//
// Stage A's cache VALUE is the full RenderNode[] a layer's lower() produces
// for one panel — i.e. every PackedGeometry/companion tensor a geom's
// packing calls (packMarkRows/packFaceLoops/packUniformChunks, all of which
// share one retained-row mask per call) built together, cached as one
// atomic unit. This is a conscious granularity choice: PackedGeometry and a
// PackMarkRows bundle are produced by ONE packing call sharing one mask, so
// they are not independently invalidatable without plumbing the cache
// through every geom/*.ts file's internal packing calls — out of scope for
// this pass (see the multi-column invalidation test below and its doc
// comment for exactly what this implies).
//
// ---------------------------------------------------------------------------
// STAGE B — coordinate / topology (polarize + munch)
// ---------------------------------------------------------------------------
// Key = Stage A output tensor IDENTITY (used as the WeakMap ROOT, not part
// of the string — object identity isn't meaningfully stringifiable, and
// rooting on it means a Stage A cache MISS automatically produces a fresh
// WeakMap key, so Stage B never needs its own invalidate() hook: Stage A
// identity changing IS Stage B's invalidation signal) + coord kind + theta
// axis + theta domain/start/end + a fixed munch-policy version tag.
//
// Cartesian views never call polarize/munch at all (compile/mod.ts's
// `polarMarks = marks` branch) — so Stage A's output tensors already reach
// RenderTree completely unchanged for Cartesian, satisfying "Cartesian
// identity transforms MUST reuse Stage A tensors unchanged (===, no copy)"
// by construction, with no extra caching layer required. stageBTransformedMark
// only ever runs for Polar views.
import type { Column } from "../data/mod.ts";
import type { Aes, AesName, DataFrame, GeomKind, Layer } from "../ir/types.ts";
import type { TrainedScale } from "../scale/mod.ts";
import type { RenderNode } from "./rendertree.ts";
import { isFlatTensor, munchFlatNode, polarizeNode } from "./coordinates.ts";

/** Anything a stage key's revision can be tracked against (see module doc). */
export type RevisionKey = Column | Float32Array;

/**
 * Geoms whose `lower()` reads ctx.theme/ctx.xDomain/ctx.yDomain/
 * ctx.panelPixels directly to compute packed output (text/label's glyph
 * placement falls back to theme font/color; rug's tick length is a pixel
 * fraction of the domain) — see the Stage A doc above. Excluded from
 * packCache entirely; lowerLayer still runs, uncached, every compile.
 */
export const UNCACHEABLE_GEOMS: ReadonlySet<GeomKind> = new Set([
  "text",
  "label",
  "rug",
]);

/**
 * The staged geometry cache. One instance is meant to live for the lifetime
 * of a mounted plot (render/GGPlot.tsx holds ONE via Live's `useOne`);
 * CompileOptions.packCache is optional — omitting it keeps compile()
 * exactly as uncached as before this bead.
 */
export class PackCache {
  private readonly revisions = new WeakMap<RevisionKey, number>();
  private readonly stageAStore = new WeakMap<
    RevisionKey,
    Map<string, RenderNode[]>
  >();
  /** Rooting fallback for the rare layer with no mapped column at all. */
  private readonly stageANoColumn = new Map<string, RenderNode[]>();
  private readonly stageBStore = new WeakMap<
    Float32Array,
    Map<string, RenderNode>
  >();

  /** Current revision of `column`, or 0 if it has never been invalidated. */
  revisionOf(column: RevisionKey | undefined): number {
    if (!column) return 0;
    return this.revisions.get(column) ?? 0;
  }

  /**
   * Bump a column/tensor's revision so every cache key that folded in its
   * OLD revision misses on the next lookup. The escape hatch for hosts that
   * mutate ingested data in place instead of rebuilding a spec (see
   * data/mod.ts's immutability jsdoc).
   */
  invalidate(column: RevisionKey): void {
    this.revisions.set(column, (this.revisions.get(column) ?? 0) + 1);
  }

  /** Stage A: pack. `primary` roots collectibility (see module doc); may be
   * undefined for a purely param-driven layer (falls back to a plain Map). */
  stageA(
    primary: Column | undefined,
    key: string,
    compute: () => RenderNode[],
  ): RenderNode[] {
    const bucket = primary
      ? (this.stageAStore.get(primary) ??
        (() => {
          const m = new Map<string, RenderNode[]>();
          this.stageAStore.set(primary, m);
          return m;
        })())
      : this.stageANoColumn;
    const hit = bucket.get(key);
    if (hit) return hit;
    const value = compute();
    bucket.set(key, value);
    return value;
  }

  /** Stage B: coordinate/topology. Rooted on Stage A's OWN output positions
   * array — see module doc for why this needs no separate invalidation. */
  stageB(
    primary: Float32Array,
    key: string,
    compute: () => RenderNode,
  ): RenderNode {
    let bucket = this.stageBStore.get(primary);
    if (!bucket) {
      bucket = new Map();
      this.stageBStore.set(primary, bucket);
    }
    const hit = bucket.get(key);
    if (hit) return hit;
    const value = compute();
    bucket.set(key, value);
    return value;
  }
}

export function createPackCache(): PackCache {
  return new PackCache();
}

/** Deterministic, key-order-independent stringification for the layer
 * param portion of a Stage A key — two structurally equal `params` objects
 * built by two separate DSL calls (e.g. a DSL-rebuilt spec) must stringify
 * identically regardless of the order their fields were assigned in. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${
    keys
      .map((k) =>
        `${JSON.stringify(k)}:${
          stableStringify((value as Record<string, unknown>)[k])
        }`
      )
      .join(",")
  }}`;
}

/** The scale-identity portion of a Stage A key for one aesthetic — see the
 * module doc's Stage A section for exactly what's included and why. */
function scaleKeyFor(aes: AesName, scale: TrainedScale | undefined): string {
  if (!scale) return "-";
  if (aes === "x" || aes === "y") {
    return scale.kind === "discrete"
      ? `discrete:${JSON.stringify(scale.domain)}`
      : scale.kind;
  }
  return `${scale.kind}:${JSON.stringify(scale.domain)}:${
    JSON.stringify(scale.range)
  }`;
}

/** The one mapped column a Stage A entry is rooted under for collectibility
 * (x, else y, else the first other mapped aesthetic's column, else
 * undefined). Does not affect key CORRECTNESS — only GC characteristics. */
function stageAPrimaryColumn(
  mapping: Aes,
  data: DataFrame,
): Column | undefined {
  const x = mapping.x ? data[mapping.x] : undefined;
  if (x) return x;
  const y = mapping.y ? data[mapping.y] : undefined;
  if (y) return y;
  for (const colName of Object.values(mapping)) {
    const col = colName ? data[colName] : undefined;
    if (col) return col;
  }
  return undefined;
}

/** Build a layer's Stage A cache key (see module doc for the full contract)
 * plus the column it should be rooted under. */
export function stageAKey(
  cache: PackCache,
  layer: Layer,
  layerIndex: number,
  panelIndex: number,
  mapping: Aes,
  data: DataFrame,
  scales: Partial<Record<AesName, TrainedScale>>,
): { primary: Column | undefined; key: string } {
  const aesNames = (Object.keys(mapping) as AesName[]).sort();
  const columnPart = aesNames
    .map((aes) => {
      const colName = mapping[aes];
      const col = colName ? data[colName] : undefined;
      return `${aes}=${colName ?? ""}#${cache.revisionOf(col)}:${
        scaleKeyFor(aes, scales[aes])
      }`;
    })
    .join("|");
  const paramPart = stableStringify({
    geom: layer.geom,
    position: layer.position,
    params: layer.params,
  });
  return {
    primary: stageAPrimaryColumn(mapping, data),
    key: `A:layer${layerIndex}:panel${panelIndex}:${columnPart}::${paramPart}`,
  };
}

/**
 * Stage B: apply the polar coordinate transform (polarize + munch) to one
 * Stage A mark node, memoized against a packCache when supplied. Falls back
 * to the plain uncached computation for a missing cache OR a node whose
 * `positions` prop is not a FlatTensor — identical output either way, just
 * not memoized in the latter case. Every mark packs a FlatTensor today, so
 * the fallback is defensive; guide nodes are never routed here.
 */
export function stageBTransformedMark(
  cache: PackCache | undefined,
  mark: RenderNode,
  axis: 0 | 1,
  domain: [number, number],
  start: number,
  end: number,
): RenderNode {
  const compute = () =>
    munchFlatNode(polarizeNode(mark, axis, domain, start, end));
  if (!cache) return compute();
  const positions = mark.props.positions;
  if (!isFlatTensor(positions)) return compute();
  const key = `B:${axis}:${domain[0]}:${domain[1]}:${start}:${end}:munchV1`;
  return cache.stageB(positions.array, key, compute);
}
