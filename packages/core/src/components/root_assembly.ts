// The component root's assembly step, pure but for its caches (gggplot-6q9).
//
// Split out of gg_plot_root.ts so the component path can be exercised without
// a Live tree or @use-gpu/workbench: given the plot-level spec the parts
// describe and the layer parts in tree order, train across them and assemble
// the plot with the same assemblePlot the compile path uses, reusing every
// prepared layer and lowered mark whose inputs did not change.
import {
  type AssembledPlot,
  type buildFacetPanels,
  type LayerRemovals,
  layoutPlot,
  type LowerMarksArgs,
  polarizeMark,
  type PolarTransform,
  type PreparedLayer,
  type PreparedPlot,
  prepareLayer,
  prepareSignature,
  recordRemovals,
  type RenderNode,
  type ResidentDomains,
  type RowRemoval,
  sortedRemovals,
  type TextMeasurer,
  type TrainedPlot,
  trainPlot,
} from "../compile/mod.ts";
import { reuseUnchanged } from "../compile/stable_tensors.ts";
import { GG, type SpecPart } from "../dsl/base.ts";
import { columnVersion, typedArrayForColumn } from "../data/mod.ts";
import { LAYOUT_BOUND_GEOMS, lowerLayer } from "../geom/mod.ts";
import type {
  Aes,
  DataFrame,
  GGSpec,
  Layer,
  PlotLabels,
  Theme,
} from "../ir/types.ts";
import {
  isDiscreteGpuBindable,
  isGpuBindable,
} from "../render/scale_bindings.ts";
import { type CpuStatCache, createCpuStatCache } from "../stat/mod.ts";
import type { PlotPart } from "./parts.ts";
import { componentProbe } from "./probe.ts";
import { productKey, type ProductPlan } from "../runtime/product_host.tsx";
import type { Generation } from "../runtime/generation_gate.ts";
import type { GridSummary } from "../runtime/resident_grid_pending.ts";
import { RESIDENT_STAT_BIN_TILES_PRODUCT } from "../geom/resident_plans.ts";
import type { ResidentProductProps } from "../geom/types.ts";

export interface PreparedEntry {
  layer: Layer;
  data: DataFrame;
  /** What prepareLayer read off the spec (prepareSignature, gggplot-2gu). */
  signature: string;
  /** The content versions of the rows it read (gggplot-67c). */
  versions: string;
  prepared: PreparedLayer;
  removed: LayerRemovals;
}

export interface LoweredEntry {
  layer: Layer;
  mapping: Aes;
  data: DataFrame;
  /** The content versions of the rows it lowered. */
  versions: string;
  signature: string;
  measureText: unknown;
  nodes: RenderNode[];
}

/** Which of a point layer's mapped aesthetics bind on the GPU (gggplot-fbq). */
interface BoundPlan {
  /** `discrete`: a factor column through a level lookup (gggplot-81r). */
  color?: { column: string; aes: "color" | "fill"; discrete: boolean };
  size?: string;
  alpha?: string;
}

/**
 * Plan GPU-bound aesthetics for a layer, or null to CPU-pack it as before.
 * Narrow on purpose: a 2D point with a continuous mapped color (or fill), and
 * optionally continuous size/alpha; no shape split, stroke ring or layer-wide
 * alpha. Alpha binds only with color, since it folds into the color.
 */
function boundPlan(args: LowerMarksArgs): BoundPlan | null {
  const { layer, mapping, data, ctx } = args;
  if (layer.geom !== "point" || mapping.z) return null;
  if (mapping.shape || mapping.stroke) return null;
  if (layer.params.stroke != null || layer.params.alpha != null) return null;
  const numeric = (column: string | undefined) =>
    !!column && data[column]?.type === "numeric";
  const plan: BoundPlan = {};
  const colorAes = mapping.color ? "color" : mapping.fill ? "fill" : undefined;
  if (colorAes) {
    const column = mapping[colorAes] as string;
    const scale = ctx.scales[colorAes];
    if (numeric(column) && isGpuBindable(scale)) {
      plan.color = { column, aes: colorAes, discrete: false };
    } else if (
      data[column]?.type === "factor" && isDiscreteGpuBindable(scale)
    ) {
      plan.color = { column, aes: colorAes, discrete: true };
    } else return null;
  }
  if (mapping.size) {
    if (!numeric(mapping.size) || !isGpuBindable(ctx.scales.size)) return null;
    plan.size = mapping.size;
  }
  if (mapping.alpha) {
    if (!plan.color) return null;
    if (!numeric(mapping.alpha) || !isGpuBindable(ctx.scales.alpha)) {
      return null;
    }
    plan.alpha = mapping.alpha;
  }
  return plan.color || plan.size ? plan : null;
}

/** Every input lowerLayer reads off its LayerContext, as a comparable string. */
function contextSignature(
  args: LowerMarksArgs,
  layoutBound: boolean,
  bound: BoundPlan | null,
): string {
  const { ctx, mapping } = args;
  // Lowering reads the position scales and the scales of the aesthetics the
  // layer maps (after its stat), never another layer's: a palette change on
  // fill does not re-lower a layer without fill. A bound aesthetic's domain
  // reaches the GPU through refs, not through the lowered marks, so its
  // retrain must not re-lower the layer either.
  const reads = (aes: string) =>
    aes === "x" || aes === "y" || aes === "z" || aes in mapping;
  const scales = Object.fromEntries(
    Object.entries(ctx.scales).filter(([aes]) =>
      reads(aes) &&
      !(bound?.color && aes === bound.color.aes) &&
      !(bound?.size && aes === "size") && !(bound?.alpha && aes === "alpha")
    ),
  );
  return JSON.stringify({
    scales,
    domains: ctx.domains,
    // Only text/label/rug read the theme and panel size for packed output
    // (geom/mod.ts LAYOUT_BOUND_GEOMS); the rest are layout-free.
    ...(layoutBound ? { theme: ctx.theme, panelPixels: ctx.panelPixels } : {}),
  });
}

/** The plot-level spec the parts describe, layers aside. */
export function plotSpec(
  data: DataFrame,
  mapping: Aes,
  theme: Theme | undefined,
  labels: PlotLabels | undefined,
  specParts: SpecPart[],
): GGSpec {
  const plot = new GG(data, mapping);
  if (theme) plot.add({ tag: "theme", value: theme });
  if (labels) plot.add({ tag: "labels", value: labels });
  plot.add(...specParts);
  return plot.build();
}

/** The bound aesthetics, as a key: a different set is a different hook layout. */
function boundKey(bound: BoundPlan): string {
  return [
    bound.color ? bound.color.aes + (bound.color.discrete ? "-d" : "") : "",
    bound.size ? "size" : "",
    bound.alpha ? "alpha" : "",
  ].join(":");
}

/**
 * Turn a point layer's CPU-lowered Point node into a BoundPoint: keep its
 * positions and owners, drop the packed per-vertex colors/sizes, and hand over
 * each bound column's raw values for the GPU to scale.
 */
function bindPoints(
  nodes: RenderNode[],
  bound: BoundPlan,
  data: DataFrame,
  layer: Layer,
): RenderNode[] {
  const values = (column: string) =>
    typedArrayForColumn(data[column]) as Float32Array;
  return nodes.map((mark) => {
    if (mark.component !== "Point" || !mark.owners) return mark;
    const { colors: _c, sizes: _s, color: _fc, size: _fs, ...rest } =
      mark.props;
    return {
      ...mark,
      component: "BoundPoint" as const,
      props: {
        ...rest,
        owners: mark.owners,
        ...(bound.color
          ? {
            color: bound.color.discrete
              ? {
                codes: typedArrayForColumn(
                  data[bound.color.column],
                ) as Uint32Array,
                levels: (data[bound.color.column] as { levels: string[] })
                  .levels,
                aes: bound.color.aes,
              }
              : { values: values(bound.color.column), aes: bound.color.aes },
          }
          : { fixedColor: (layer.params.color as string) ?? "#3b82f6" }),
        ...(bound.size
          ? { size: { values: values(bound.size) } }
          : { fixedSize: (layer.params.size as number) ?? 5 }),
        ...(bound.alpha ? { alpha: { values: values(bound.alpha) } } : {}),
      },
    };
  });
}

/** The root's memo tables, kept for its lifetime. */
export interface RootCaches {
  /** Prepared (filtered + stat) layers, per layer fiber and panel. */
  prepared: Map<string, PreparedEntry>;
  /** Lowered marks, per layer fiber and panel. */
  lowered: Map<string, LoweredEntry>;
  /** CPU stat runs per input version (gggplot-l82). */
  stat: CpuStatCache;
  /**
   * Polar-transformed marks, per lowered mark. A lowered mark keeps its
   * identity while unchanged, so a resize or a sibling's change reuses its
   * munched tensors too.
   */
  polar: WeakMap<RenderNode, { key: string; mark: RenderNode }>;
  /**
   * Sees each layer's CPU lowering, its inputs and its marks before any GPU
   * binding (tests: the owner-index property, gggplot-8e1).
   */
  observeLowering?: (args: LowerMarksArgs, nodes: RenderNode[]) => void;
  /**
   * Bind eligible point aesthetics on the GPU (BoundPoint). On unless set
   * false: tests that check the CPU-packed tensors turn it off.
   */
  bindScales?: boolean;
}

export function createRootCaches(): RootCaches {
  return {
    prepared: new Map(),
    lowered: new Map(),
    stat: createCpuStatCache(),
    polar: new WeakMap(),
  };
}

/** A lowered mark in polar coordinates, reused while it and the mapping hold. */
function transformMark(
  caches: RootCaches,
  mark: RenderNode,
  polar: PolarTransform,
): RenderNode {
  const key = JSON.stringify(polar);
  const prev = caches.polar.get(mark);
  if (prev?.key === key) return prev.mark;
  componentProbe.polarCalls++;
  const next = reuseUnchanged(polarizeMark(mark, polar), prev?.mark);
  caches.polar.set(mark, { key, mark: next });
  return next;
}

/** The layer parts a root assembles, in tree order. */
export type LayerParts = readonly Extract<PlotPart, { kind: "layer" }>[];

/** Every layer part prepared (filtered, stat run or product planned). */
export interface PreparedLayers {
  /** The plot-level spec with the parts' layers. */
  spec: GGSpec;
  layers: LayerParts;
  prepared: PreparedPlot;
  /** Rows each layer dropped before its stat, as compile() reports them. */
  diagnostics: readonly RowRemoval[];
  /** One plan per distinct GPU product the layers ask for (gggplot-280). */
  plans: ProductPlan[];
}

/**
 * The layout-free half of an assembly: every layer prepared and the plot
 * trained. A resize changes none of it (gggplot-d14).
 */
export interface PreparedRoot extends PreparedLayers {
  trained: TrainedPlot;
  /**
   * Per product key, the data version whose read-back y range trained the
   * plot: its mark draws only while the product is at that version.
   */
  residentVersions: ReadonlyMap<string, number>;
}

/**
 * Prepare every layer part, reusing each prepared layer whose layer, panel
 * rows, prepareSignature and column versions are unchanged (gggplot-2gu),
 * and plan the GPU products the resident layers ask for. Null while any
 * layer is pending.
 */
export function prepareLayers(
  base: GGSpec,
  layers: LayerParts,
  panels: ReturnType<typeof buildFacetPanels>,
  caches: RootCaches,
): PreparedLayers | null {
  // vs7 trap 2: a layer whose domain contribution is still in flight would
  // train as empty, so nothing is trained or assembled until every layer has
  // reported. The previous assembly stays on screen meanwhile.
  if (layers.some((layer) => layer.pending)) return null;
  const spec: GGSpec = { ...base, layers: layers.map((l) => l.layer) };
  const faceted = spec.facet.kind !== "none";
  const standalone = !faceted && layers.length === 1;
  const removals = new Map<string, RowRemoval>();
  const livePrepared = new Set<string>();
  const panelLayers = panels.panels.map((panel, panelIndex) =>
    layers.map(({ id, layer }, layerIndex) => {
      const key = `${id}:${panelIndex}`;
      livePrepared.add(key);
      const prev = caches.prepared.get(key);
      // prepareLayer reads the layer, the panel's rows, and the slice of the
      // spec its signature names: a theme, labels, coord limits or a scale's
      // range leave the prepared rows (and the stat) alone.
      const signature = prepareSignature(spec, layer, { faceted, standalone });
      // A column touched in place (touchColumn) keeps the frame's identity
      // and moves only its version, so the versions are part of the key.
      const versions = versionKey(layer.data ?? panel.data);
      let entry = prev && prev.layer === layer && prev.data === panel.data &&
          prev.signature === signature && prev.versions === versions
        ? prev
        : undefined;
      if (!entry) {
        componentProbe.statCalls++;
        const { prepared, removed } = prepareLayer(spec, layer, panel.data, {
          faceted,
          statCache: caches.stat,
          // GPU-eligible layers (geom.residentPlan) become products the
          // root hosts (gggplot-280); the rest take their CPU stat.
          resident: true,
        });
        entry = {
          layer,
          data: panel.data,
          signature,
          versions,
          prepared,
          removed,
        };
        caches.prepared.set(key, entry);
      }
      recordRemovals(removals, layerIndex, layer.geom, entry.removed);
      return entry.prepared;
    })
  );
  for (const key of caches.prepared.keys()) {
    if (!livePrepared.has(key)) caches.prepared.delete(key);
  }
  const prepared: PreparedPlot = {
    panels: panels.panels,
    nrow: panels.nrow,
    ncol: panels.ncol,
    panelLayers,
    removals,
  };
  return {
    spec,
    layers,
    prepared,
    diagnostics: sortedRemovals(removals),
    plans: residentPlans(prepared),
  };
}

/** The key of the product a resident layer's plan asks for. */
const keyOf = (resident: ResidentProductProps) =>
  productKey(resident.product, resident.props);

/**
 * One plan per distinct product, in layer order: consumers of the same
 * product (productKey) share one build and one dispatch per version.
 */
export function residentPlans(prepared: PreparedPlot): ProductPlan[] {
  const plans = new Map<string, ProductPlan>();
  for (const layer of prepared.panelLayers.flat()) {
    const resident = layer.resident;
    if (!resident) continue;
    const key = keyOf(resident);
    const existing = plans.get(key);
    const summary = resident.props.autoYDomain === true;
    if (existing) {
      existing.summary ||= summary;
      continue;
    }
    plans.set(key, {
      key,
      product: resident.product,
      props: resident.props,
      summary,
    });
  }
  return [...plans.values()];
}

/** Summaries read back for products, by product key (product_host.tsx). */
export type ResidentReadbacks = ReadonlyMap<string, Generation<GridSummary>>;

/** What the root trains its resident layers with, once it has it. */
export interface ResidentTraining {
  domains: ResidentDomains;
  versions: ReadonlyMap<string, number>;
  /** A plan still waits for its first summary: nothing can train yet. */
  pending: boolean;
}

/**
 * The y range the resident layers need (gggplot-vnh.5.1, the job the
 * standalone views used to do): a bar product that owns its y reads its
 * stacked maximum back off the GPU (1 for position fill); a tile strip's
 * rows are its group count, known without a readback, and draw no breaks.
 */
export function residentTraining(
  plans: readonly ProductPlan[],
  readbacks: ResidentReadbacks,
): ResidentTraining {
  let lo = Infinity, hi = -Infinity;
  let breaks: number[] | undefined;
  let pending = false;
  const versions = new Map<string, number>();
  const options = (plan: ProductPlan) =>
    plan.props.options as { position?: string; groupsCount?: number };
  for (const plan of plans) {
    if (plan.product === RESIDENT_STAT_BIN_TILES_PRODUCT) {
      lo = Math.min(lo, 0);
      hi = Math.max(hi, Math.max(1, options(plan).groupsCount ?? 1));
      breaks = [];
      continue;
    }
    if (!plan.summary) continue;
    const readback = readbacks.get(plan.key);
    if (!readback) {
      pending = true;
      continue;
    }
    versions.set(plan.key, readback.version);
    lo = Math.min(lo, 0);
    hi = Math.max(
      hi,
      options(plan).position === "fill"
        ? 1
        : Math.max(1, readback.value.stackedMaximum),
    );
  }
  return {
    domains: lo <= hi
      ? { y: { domain: [lo, hi], ...(breaks ? { breaks } : {}) } }
      : {},
    versions,
    pending,
  };
}

/** Train prepared layers, with whatever the resident layers learned. */
export function trainRoot(
  layers: PreparedLayers,
  resident: ResidentTraining = {
    domains: {},
    versions: new Map(),
    pending: false,
  },
): PreparedRoot {
  componentProbe.trainCalls++;
  return {
    ...layers,
    trained: trainPlot(layers.spec, layers.prepared, resident.domains),
    residentVersions: resident.versions,
  };
}

/**
 * Prepare and train in one call. Null while any layer is pending, or while a
 * resident layer still waits for the summary its y range comes from.
 */
export function prepareRoot(
  base: GGSpec,
  layers: LayerParts,
  panels: ReturnType<typeof buildFacetPanels>,
  caches: RootCaches,
  readbacks: ResidentReadbacks = new Map(),
): PreparedRoot | null {
  const prepared = prepareLayers(base, layers, panels, caches);
  if (!prepared) return null;
  const resident = residentTraining(prepared.plans, readbacks);
  return resident.pending ? null : trainRoot(prepared, resident);
}

/** Every column's content version, as one comparable key. */
export function versionKey(frame: DataFrame): string {
  return Object.entries(frame).map(([name, column]) =>
    `${name}:${columnVersion(column)}`
  ).join("|");
}

/** The layout half of an assembly: the tree for one size. */
export interface LaidOutRoot {
  tree: RenderNode;
  info: AssembledPlot | null;
}

/**
 * Lay out a prepared plot at one size: guides, grids, and each panel's marks,
 * lowered or taken from cache (only layout-bound geoms re-lower on a resize).
 */
export function layoutRoot(
  root: PreparedRoot,
  layout: { width: number; height: number; measureText: TextMeasurer },
  caches: RootCaches,
  /** <GGPanel> children, drawn in every panel after its marks. */
  panelContent: readonly unknown[] = [],
): LaidOutRoot {
  componentProbe.assembleCalls++;
  const { spec, layers } = root;
  // A bound point draws as its own PointLayer, outside the VirtualLayers
  // aggregation that orders CPU marks (faces, lines, then points), so it
  // lands beneath them. Binding is therefore limited to where that order is
  // provably the same (gggplot-wo0z lifts it): a plot of point layers only,
  // bound in layer order until the first that cannot bind, after which CPU
  // points draw above, as in the aggregate.
  const pointsOnly = caches.bindScales !== false &&
    layers.every(({ layer }) => layer.geom === "point");
  const unboundFrom = new Map<number, number>();
  const liveLowered = new Set<string>();
  const lowerMarks = (args: LowerMarksArgs): RenderNode[] => {
    const { layer, mapping, data, ctx, layerIndex, panelIndex } = args;
    const id = layers[layerIndex].id;
    const key = `${id}:${panelIndex}`;
    liveLowered.add(key);
    const layoutBound = LAYOUT_BOUND_GEOMS.has(layer.geom);
    const stop = unboundFrom.get(panelIndex);
    const bound = pointsOnly && (stop === undefined || layerIndex < stop)
      ? boundPlan(args)
      : null;
    if (!bound && stop === undefined) unboundFrom.set(panelIndex, layerIndex);
    const signature = contextSignature(args, layoutBound, bound);
    const versions = versionKey(data);
    const prev = caches.lowered.get(key);
    if (
      prev && prev.layer === layer && prev.mapping === mapping &&
      prev.data === data && prev.versions === versions &&
      prev.signature === signature &&
      (!layoutBound || prev.measureText === ctx.measureText)
    ) return prev.nodes;
    componentProbe.lowerCalls++;
    // Keyed per layer, so a sibling inserted before this layer does not
    // shift its marks to a new position and remount them.
    const lowered = lowerLayer(layer, mapping, data, ctx);
    caches.observeLowering?.(args, lowered);
    const fresh = (bound ? bindPoints(lowered, bound, data, layer) : lowered)
      .map((node, i) => ({
        ...node,
        key: bound
          ? `layer-${id}-${panelIndex}-${i}-bound-${boundKey(bound)}`
          : `layer-${id}-${panelIndex}-${i}`,
      }));
    const nodes = reuseUnchanged(fresh, prev?.nodes);
    caches.lowered.set(key, {
      layer,
      mapping,
      data,
      versions,
      signature,
      measureText: ctx.measureText,
      nodes,
    });
    return nodes;
  };

  const content: RenderNode[] = panelContent.length
    ? [{
      component: "PanelContent",
      props: { content: panelContent },
      children: [],
    }]
    : [];
  // A layer whose stat runs on the GPU is drawn from the product the root
  // hosts, inside the panel, under the axes the root trained.
  const residentMark = (
    { resident, layerIndex, panelIndex }: {
      resident: ResidentProductProps;
      layerIndex: number;
      panelIndex: number;
    },
  ): RenderNode[] => {
    const productKey = keyOf(resident);
    const props = resident.props as { color: string; opacity?: number };
    return [{
      component: "ProductMark",
      key: `layer-${layers[layerIndex].id}-${panelIndex}-product`,
      props: {
        productKey,
        form: resident.product === RESIDENT_STAT_BIN_TILES_PRODUCT
          ? "tiles"
          : "bars",
        color: props.color,
        ...(props.opacity !== undefined ? { opacity: props.opacity } : {}),
        ...(root.residentVersions.has(productKey)
          ? { domainVersion: root.residentVersions.get(productKey) }
          : {}),
      },
      children: [],
    }];
  };
  let info: AssembledPlot | null = null;
  const laidOut = layoutPlot(spec, root.prepared, root.trained, {
    layout,
    lowerMarks,
    residentMark,
    transformMark: (mark, polar) => transformMark(caches, mark, polar),
    panelContent: () => content,
    onAssembled: (assembledInfo) => {
      info = assembledInfo;
    },
  });
  // A 3D scene has one data space: its (first) Cartesian.
  const tree = content.length && laidOut.component === "Scene3D"
    ? intoFirstCartesian(laidOut, content)
    : laidOut;
  for (const key of caches.lowered.keys()) {
    if (!liveLowered.has(key)) caches.lowered.delete(key);
  }
  return { tree, info: info as AssembledPlot | null };
}

/** `tree` with `extra` appended to its first Cartesian's children. */
function intoFirstCartesian(tree: RenderNode, extra: RenderNode[]): RenderNode {
  let inserted = false;
  const visit = (node: RenderNode): RenderNode => {
    if (inserted) return node;
    if (node.component === "Cartesian") {
      inserted = true;
      return { ...node, children: [...node.children, ...extra] };
    }
    const children = node.children.map(visit);
    return children.some((child, i) => child !== node.children[i])
      ? { ...node, children }
      : node;
  };
  return visit(tree);
}

/** One whole assembly: prepareRoot then layoutRoot. */
export interface RootAssembly extends LaidOutRoot {
  diagnostics: readonly RowRemoval[];
}

/**
 * Prepare, train and lay out in one call, reusing whatever in `caches` is
 * still valid. Pure but for the caches, so the component path can be
 * exercised without a Live tree. Null while any layer is pending.
 */
export function assembleRoot(
  base: GGSpec,
  layers: LayerParts,
  panels: ReturnType<typeof buildFacetPanels>,
  layout: { width: number; height: number; measureText: TextMeasurer },
  caches: RootCaches,
  readbacks: ResidentReadbacks = new Map(),
): RootAssembly | null {
  const root = prepareRoot(base, layers, panels, caches, readbacks);
  if (!root) return null;
  return { ...layoutRoot(root, layout, caches), diagnostics: root.diagnostics };
}
