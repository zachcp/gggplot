// vnh.3 spike: a two-phase GGPlot root via Live Capture. Deliberately absent
// from the public exports.
//
// Phase 1: each geom child runs its own row filtering and stat (prepareLayer,
// memoized on its inputs) and reports a LayerDecl to the root through
// useCapture. It renders nothing itself.
// Phase 2: the capture's continuation receives every decl in tree order,
// trains scales across all of them and assembles the plot with the SAME
// assemblePlot the compile path uses, so guides and layout are identical by
// construction. Marks are lowered through a per-layer memo keyed on the
// layer's fiber, and unchanged tensors keep their previous identity
// (reuseUnchanged), so a resize or a sibling's change uploads nothing for a
// layer whose inputs did not change.
import type { LiveElement } from "@use-gpu/live";
import { LayoutContext, useFontContext } from "@use-gpu/workbench";
import {
  capture,
  createElement,
  makeCapture,
  makeContext,
  provide,
  useCapture,
  useContext,
  useFiberId,
  useMemo,
  useOne,
} from "../src/runtime/usegpu_compat.ts";
import {
  assemblePlot,
  buildFacetPanels,
  type LayerRemovals,
  type LowerMarksArgs,
  type PreparedLayer,
  prepareLayer,
  recordRemovals,
  type RenderNode,
  type RowRemoval,
} from "../src/compile/mod.ts";
import { UNCACHEABLE_GEOMS } from "../src/compile/pack_cache.ts";
import { reuseUnchanged } from "../src/compile/stable_tensors.ts";
import { lowerLayer } from "../src/geom/mod.ts";
import { ggplot } from "../src/dsl/base.ts";
import { geomLine, geomPoint } from "../src/dsl/geoms.ts";
import type { InputData } from "../src/data/mod.ts";
import type { Aes, GGSpec, Layer, PlotLabels, Theme } from "../src/ir/types.ts";
import { renderTree } from "../src/render/GGPlot.tsx";
import { createGlyphTextMeasurer } from "../src/render/font_resources.ts";

/** What a geom child reports to the root. */
export interface LayerDecl {
  /** The geom's fiber id: stable for as long as the geom stays mounted. */
  id: number;
  layer: Layer;
  prepared: PreparedLayer;
  removed: LayerRemovals;
}

/** Work counters the probe reads; module-level so every instance shares them. */
export const captureProbe = {
  statCalls: 0,
  lowerCalls: 0,
  assembleCalls: 0,
  viewRenders: 0,
  /** Geom component mounts: a remount of an existing layer shows up here. */
  geomMounts: 0,
  reset() {
    this.statCalls = 0;
    this.lowerCalls = 0;
    this.assembleCalls = 0;
    this.viewRenders = 0;
    this.geomMounts = 0;
  },
};

const LayerCapture = makeCapture("GGLayerDecls");
/** The plot's spec without layers: data, mapping, scales, coord, theme, labels. */
const PlotBaseContext = makeContext<GGSpec | null>(null, "GGPlotBase");

/**
 * Returns `value` unless it is shallow-equal to the last value, in which case
 * the last one comes back. Inline JSX objects (`mapping={{ x: "wt" }}`) are new
 * on every render; this keeps them from invalidating every memo below.
 */
function useStable<T>(value: T): T {
  const ref = useOne(() => ({ current: value }));
  const prev = ref.current as unknown;
  const same = prev === value || (
    prev !== null && value !== null && typeof prev === "object" &&
    typeof value === "object" &&
    Object.keys(prev).length === Object.keys(value).length &&
    Object.entries(value).every(([k, v]) =>
      (prev as Record<string, unknown>)[k] === v
    )
  );
  if (!same) ref.current = value;
  return ref.current;
}

export interface GGPlotXProps {
  data: InputData;
  mapping?: Aes;
  theme?: Theme;
  labels?: PlotLabels;
  children?: unknown;
}

/** Root: provides the base spec, captures layer decls, renders the view after them. */
export const GGPlotX = (props: GGPlotXProps): LiveElement => {
  const mapping = useStable(props.mapping ?? {});
  const theme = useStable(props.theme);
  const labels = useStable(props.labels);
  const base = useMemo(() => {
    const spec = ggplot(props.data, mapping).build();
    return {
      ...spec,
      theme: theme ?? spec.theme,
      labels: labels ?? spec.labels,
    };
  }, [props.data, mapping, theme, labels]);
  return provide(
    PlotBaseContext,
    base,
    capture<LayerDecl>(
      LayerCapture,
      props.children,
      (decls) => createElement(PlotView, { base, decls }),
    ),
  );
};

/** Phase 1 for any geom: filter rows, run the stat, report the decl. */
const GeomLayerX = ({ layer }: { layer: Layer }): LiveElement => {
  const base = useContext<GGSpec | null>(PlotBaseContext);
  if (!base) throw new Error("[gggplot] a geom component needs a <GGPlotX>");
  const id = useFiberId();
  useOne(() => captureProbe.geomMounts++);
  const decl = useMemo((): LayerDecl => {
    captureProbe.statCalls++;
    // A one-layer spec: prepareLayer reads spec.layers only for the resident
    // standalone check, which this spike leaves off.
    const spec = { ...base, layers: [layer] };
    const { prepared, removed } = prepareLayer(spec, layer, base.data, {
      faceted: false,
    });
    return { id, layer, prepared, removed };
  }, [base, layer, id]);
  useCapture(LayerCapture, decl);
  return null as unknown as LiveElement;
};

type GeomProps = NonNullable<Parameters<typeof geomPoint>[0]>;

function useLayer(
  build: (opts: GeomProps) => { value: unknown },
  props: GeomProps,
) {
  // Live leaves `key: undefined` on props after reading it; it is not a param.
  const { key: _key, ...params } = props as GeomProps & { key?: unknown };
  const opts = useStable(params);
  return useMemo(() => build(opts).value as Layer, [opts]);
}

export const GeomPointX = (props: GeomProps): LiveElement =>
  createElement(GeomLayerX, { layer: useLayer(geomPoint, props) });

export const GeomLineX = (props: GeomProps): LiveElement =>
  createElement(GeomLayerX, { layer: useLayer(geomLine, props) });

interface LoweredLayer {
  layer: Layer;
  mapping: Aes;
  data: unknown;
  signature: string;
  measureText: unknown;
  nodes: RenderNode[];
}

/** Every input lowerLayer reads off its LayerContext, as a comparable string. */
function contextSignature(args: LowerMarksArgs, layoutBound: boolean): string {
  const { ctx } = args;
  return JSON.stringify({
    scales: ctx.scales,
    domains: ctx.domains,
    // Only text/label/rug read the theme and panel size for packed output
    // (compile/pack_cache.ts UNCACHEABLE_GEOMS); the rest are layout-free.
    ...(layoutBound ? { theme: ctx.theme, panelPixels: ctx.panelPixels } : {}),
  });
}

/** Phase 2: train across all decls and assemble, lowering each layer through a memo. */
const PlotView = (
  { base, decls }: { base: GGSpec; decls: LayerDecl[] },
): LiveElement => {
  captureProbe.viewRenders++;
  const rustText = useFontContext();
  const measureText = useMemo(
    () => createGlyphTextMeasurer(rustText),
    [rustText],
  );
  const [left, top, right, bottom] = useContext(LayoutContext) as [
    number,
    number,
    number,
    number,
  ];
  const width = Math.max(right - left, 1);
  const height = Math.max(bottom - top, 1);
  const lowered = useOne(() => new Map<number, LoweredLayer>());
  // The capture hands over a fresh array on every resume; the decls inside it
  // keep their identity unless their geom's inputs changed.
  const layers = useMemo(() => decls, decls);
  const tree = useMemo(() => {
    captureProbe.assembleCalls++;
    if (base.facet.kind !== "none") {
      throw new Error("[gggplot] the vnh.3 spike does not facet");
    }
    const spec: GGSpec = { ...base, layers: layers.map((d) => d.layer) };
    const removals = new Map<string, RowRemoval>();
    layers.forEach((d, i) =>
      recordRemovals(removals, i, d.layer.geom, d.removed)
    );
    const { panels } = buildFacetPanels(base.facet, base.data, base.labels);
    const live = new Set<number>();
    const lowerMarks = (args: LowerMarksArgs): RenderNode[] => {
      const { layer, mapping, data, ctx, layerIndex } = args;
      const id = layers[layerIndex].id;
      live.add(id);
      const layoutBound = UNCACHEABLE_GEOMS.has(layer.geom);
      const signature = contextSignature(args, layoutBound);
      const prev = lowered.get(id);
      if (
        prev && prev.layer === layer && prev.mapping === mapping &&
        prev.data === data && prev.signature === signature &&
        (!layoutBound || prev.measureText === ctx.measureText)
      ) return prev.nodes;
      captureProbe.lowerCalls++;
      // Keyed per layer so a sibling inserted before this layer does not shift
      // its marks to a new position and remount them.
      const fresh = lowerLayer(layer, mapping, data, ctx).map((node, i) => ({
        ...node,
        key: `layer-${id}-${i}`,
      }));
      const nodes = reuseUnchanged(fresh, prev?.nodes);
      lowered.set(id, {
        layer,
        mapping,
        data,
        signature,
        measureText: ctx.measureText,
        nodes,
      });
      return nodes;
    };
    const result = assemblePlot(spec, {
      panels,
      nrow: 1,
      ncol: 1,
      panelLayers: [layers.map((d) => d.prepared)],
      removals,
    }, { layout: { width, height, measureText }, lowerMarks });
    for (const id of lowered.keys()) if (!live.has(id)) lowered.delete(id);
    return result;
  }, [base, layers, width, height, measureText]);
  return renderTree(tree) as LiveElement;
};
