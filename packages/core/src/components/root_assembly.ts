// The component root's assembly step, pure but for its caches (gggplot-6q9).
//
// Split out of gg_plot_root.ts so the component path can be exercised without
// a Live tree or @use-gpu/workbench: given the plot-level spec the parts
// describe and the layer parts in tree order, train across them and assemble
// the plot with the same assemblePlot the compile path uses, reusing every
// prepared layer and lowered mark whose inputs did not change.
import {
  type AssembledPlot,
  assemblePlot,
  type buildFacetPanels,
  type LayerRemovals,
  type LowerMarksArgs,
  polarizeMark,
  type PolarTransform,
  type PreparedLayer,
  prepareLayer,
  recordRemovals,
  type RenderNode,
  type RowRemoval,
  rowRemovalsOf,
  type TextMeasurer,
} from "../compile/mod.ts";
import { reuseUnchanged } from "../compile/stable_tensors.ts";
import { GG, type SpecPart } from "../dsl/base.ts";
import { typedArrayForColumn } from "../data/mod.ts";
import { LAYOUT_BOUND_GEOMS, lowerLayer } from "../geom/mod.ts";
import type {
  Aes,
  DataFrame,
  GGSpec,
  Layer,
  PlotLabels,
  Theme,
} from "../ir/types.ts";
import { isGpuBindable } from "../render/scale_bindings.ts";
import { type CpuStatCache, createCpuStatCache } from "../stat/mod.ts";
import type { PlotPart } from "./parts.ts";
import { componentProbe } from "./probe.ts";

export interface PreparedEntry {
  layer: Layer;
  data: DataFrame;
  spec: GGSpec;
  prepared: PreparedLayer;
  removed: LayerRemovals;
}

export interface LoweredEntry {
  layer: Layer;
  mapping: Aes;
  data: DataFrame;
  signature: string;
  measureText: unknown;
  nodes: RenderNode[];
}

/** Which of a point layer's mapped aesthetics bind on the GPU (gggplot-fbq). */
interface BoundPlan {
  color?: { column: string; aes: "color" | "fill" };
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
    if (!numeric(column) || !isGpuBindable(ctx.scales[colorAes])) return null;
    plan.color = { column, aes: colorAes };
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
  const { ctx } = args;
  // A bound aesthetic's domain reaches the GPU through refs, not through the
  // lowered marks, so its retrain must not re-lower the layer.
  const scales = bound
    ? Object.fromEntries(
      Object.entries(ctx.scales).filter(([aes]) =>
        !(bound.color && aes === bound.color.aes) &&
        !(bound.size && aes === "size") && !(bound.alpha && aes === "alpha")
      ),
    )
    : ctx.scales;
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
    bound.color ? bound.color.aes : "",
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
            color: { values: values(bound.color.column), aes: bound.color.aes },
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

/** One assembly of the plot: its tree, scales/panel info and row removals. */
export interface RootAssembly {
  tree: RenderNode;
  info: AssembledPlot | null;
  /** Rows each layer dropped before its stat, as compile() reports them. */
  diagnostics: readonly RowRemoval[];
}

/** The layer parts a root assembles, in tree order. */
export type LayerParts = readonly Extract<PlotPart, { kind: "layer" }>[];

/**
 * Train across the layer parts and assemble the plot, reusing whatever in
 * `caches` is still valid: a layer's prepared rows while its layer, panel rows
 * and plot-level spec are unchanged, its marks while everything lowering
 * reads is. Pure but for the caches, so the component path can be exercised
 * without a Live tree.
 */
export function assembleRoot(
  base: GGSpec,
  layers: LayerParts,
  panels: ReturnType<typeof buildFacetPanels>,
  layout: { width: number; height: number; measureText: TextMeasurer },
  caches: RootCaches,
): RootAssembly {
  componentProbe.assembleCalls++;
  const spec: GGSpec = { ...base, layers: layers.map((l) => l.layer) };
  const faceted = spec.facet.kind !== "none";
  const removals = new Map<string, RowRemoval>();
  const livePrepared = new Set<string>();
  const panelLayers = panels.panels.map((panel, panelIndex) =>
    layers.map(({ id, layer }, layerIndex) => {
      const key = `${id}:${panelIndex}`;
      livePrepared.add(key);
      const prev = caches.prepared.get(key);
      // prepareLayer reads the layer, the panel's rows, and the spec's
      // mapping, scales and facet; `base` changes identity when any
      // plot-level part does.
      let entry = prev && prev.layer === layer && prev.data === panel.data &&
          prev.spec === base
        ? prev
        : undefined;
      if (!entry) {
        componentProbe.statCalls++;
        const { prepared, removed } = prepareLayer(spec, layer, panel.data, {
          faceted,
          statCache: caches.stat,
        });
        entry = { layer, data: panel.data, spec: base, prepared, removed };
        caches.prepared.set(key, entry);
      }
      recordRemovals(removals, layerIndex, layer.geom, entry.removed);
      return entry.prepared;
    })
  );
  for (const key of caches.prepared.keys()) {
    if (!livePrepared.has(key)) caches.prepared.delete(key);
  }

  const liveLowered = new Set<string>();
  const lowerMarks = (args: LowerMarksArgs): RenderNode[] => {
    const { layer, mapping, data, ctx, layerIndex, panelIndex } = args;
    const id = layers[layerIndex].id;
    const key = `${id}:${panelIndex}`;
    liveLowered.add(key);
    const layoutBound = LAYOUT_BOUND_GEOMS.has(layer.geom);
    const bound = boundPlan(args);
    const signature = contextSignature(args, layoutBound, bound);
    const prev = caches.lowered.get(key);
    if (
      prev && prev.layer === layer && prev.mapping === mapping &&
      prev.data === data && prev.signature === signature &&
      (!layoutBound || prev.measureText === ctx.measureText)
    ) return prev.nodes;
    componentProbe.lowerCalls++;
    // Keyed per layer, so a sibling inserted before this layer does not
    // shift its marks to a new position and remount them.
    const lowered = lowerLayer(layer, mapping, data, ctx);
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
      signature,
      measureText: ctx.measureText,
      nodes,
    });
    return nodes;
  };

  let info: AssembledPlot | null = null;
  const tree = assemblePlot(spec, {
    panels: panels.panels,
    nrow: panels.nrow,
    ncol: panels.ncol,
    panelLayers,
    removals,
  }, {
    layout,
    lowerMarks,
    transformMark: (mark, polar) => transformMark(caches, mark, polar),
    onAssembled: (assembledInfo) => {
      info = assembledInfo;
    },
  });
  for (const key of caches.lowered.keys()) {
    if (!liveLowered.has(key)) caches.lowered.delete(key);
  }
  const assembled = info as AssembledPlot | null;
  return { tree, info: assembled, diagnostics: rowRemovalsOf(tree) };
}
