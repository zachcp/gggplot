// The component-first <GGPlot> root (gggplot-2bj, ADR-007, proven by vnh.3).
//
// Phase 1: the children render inline and report plot parts through Live
// Capture (components/parts.ts): layers, scales, a coord, a facet, a theme,
// labels. They render nothing themselves.
// Phase 2: the capture's continuation assembles the plot from the parts with
// the same assemblePlot the compile path uses, so guides and layout match it.
//
// What makes a change cheap is memoization keyed on what each step reads:
// - each layer's row filtering and stat (prepareLayer) is memoized per layer
//   and panel on its layer, data, mapping, scales and facet. The stat runs
//   here rather than in the layer's own fiber because it reads sibling parts
//   (a scale's limits censor rows before the stat).
// - each layer's lowering is memoized on its inputs plus everything lowering
//   reads from its LayerContext, and unchanged tensors keep their identity
//   (reuseUnchanged), so only changed data re-uploads.
// - marks are keyed by layer, so adding or removing a layer remounts nothing
//   else.
// A resize therefore re-runs guide layout only: no stat, no lowering, no mark
// upload.
//
// Resident GPU products are not on this path yet (gggplot-280): every layer
// takes its CPU stat.
import type { LiveElement } from "@use-gpu/live";
import {
  LayoutContext,
  useFontContext,
  useNoDeviceContext,
} from "@use-gpu/workbench";
import {
  type AssembledPlot,
  assemblePlot,
  buildFacetPanels,
  type LayerRemovals,
  type LowerMarksArgs,
  type PreparedLayer,
  prepareLayer,
  recordRemovals,
  type RenderNode,
  type RowRemoval,
} from "../compile/mod.ts";
import { UNCACHEABLE_GEOMS } from "../compile/pack_cache.ts";
import { reuseUnchanged } from "../compile/stable_tensors.ts";
import { GG, type SpecPart } from "../dsl/base.ts";
import { ingest, type InputData } from "../data/mod.ts";
import { lowerLayer } from "../geom/mod.ts";
import type {
  Aes,
  DataFrame,
  GGSpec,
  Layer,
  PlotLabels,
  Theme,
} from "../ir/types.ts";
import { renderTree } from "../render/render_tree.tsx";
import {
  createGlyphTextMeasurer,
  type FontResources,
  validateFontRequests,
} from "../render/font_resources.ts";
import {
  getGpuMarkCounters,
  installGpuInstrumentation,
  isInstrumentFlagSet,
  resetGpuMarkCounters,
} from "../render/gpu_instrument.ts";
import { isResidentColumn } from "../runtime/types.ts";
import {
  capture,
  createElement,
  provide,
  useContext,
  useDeviceContext,
  useMemo,
  useOne,
} from "../runtime/usegpu_compat.ts";
import { useGGData } from "./gg_data.ts";
import {
  GGPanelContext,
  type GGPanelValue,
  GGScalesContext,
  type GGScalesValue,
} from "./gg_scales.ts";
import { type PlotPart, PlotPartCapture } from "./parts.ts";
import { componentProbe } from "./probe.ts";

export { componentProbe };

export interface GGPlotRootProps {
  /** Plot data. Defaults to the nearest <GGData>'s frame. */
  data?: InputData;
  mapping?: Aes;
  theme?: Theme;
  labels?: PlotLabels;
  /** Disable runtime controls for static export hosts (3D orbit). */
  interactive?: boolean;
  /** Fonts the host loaded; the theme's font requests are checked against them. */
  fontResources?: FontResources | null;
  children?: unknown;
}

/**
 * Returns `value` unless it is shallow-equal to the last one, in which case
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

/** Phase 1: resolve the data, open the capture, render the view after it. */
export const GGPlotRoot = (props: GGPlotRootProps): LiveElement => {
  const shared = useGGData();
  const raw = props.data ?? shared?.frame;
  if (!raw) {
    throw new Error(
      "[gggplot] <GGPlot> needs data: pass `data`, or mount it under <GGData>",
    );
  }
  const data = useMemo((): DataFrame => {
    if (
      Object.values(raw as Record<string, unknown>).some((column) =>
        isResidentColumn(column as never)
      )
    ) {
      // CPU stats and lowering read columns on the CPU. A GPU-only resident
      // column is for resident products (gggplot-280).
      throw new Error(
        "[gggplot] <GGPlot> cannot read a GPU-resident column on the CPU path",
      );
    }
    return ingest(raw as InputData);
  }, [raw]);
  const mapping = useStable(props.mapping ?? {});
  const theme = useStable(props.theme);
  const labels = useStable(props.labels);
  return capture<PlotPart>(
    PlotPartCapture,
    props.children,
    (parts) =>
      createElement(PlotView, {
        data,
        mapping,
        theme,
        labels,
        parts,
        interactive: props.interactive ?? true,
        fontResources: props.fontResources ?? null,
      }),
  );
};

interface PreparedEntry {
  layer: Layer;
  data: DataFrame;
  spec: GGSpec;
  prepared: PreparedLayer;
  removed: LayerRemovals;
}

interface LoweredEntry {
  layer: Layer;
  mapping: Aes;
  data: DataFrame;
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

/** The plot-level spec the parts describe, layers aside. */
function plotSpec(
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

/** Phase 2: train across the parts and assemble, memoized per layer. */
const PlotView = (
  { data, mapping, theme, labels, parts, interactive, fontResources }: {
    data: DataFrame;
    mapping: Aes;
    theme?: Theme;
    labels?: PlotLabels;
    parts: PlotPart[];
    interactive: boolean;
    fontResources: FontResources | null;
  },
): LiveElement => {
  componentProbe.viewRenders++;
  useInstrumentation();
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

  // The capture hands over a fresh array on every resume; each part inside it
  // keeps its identity unless its own inputs changed.
  const stableParts = useMemo(() => parts, parts);
  const layers = useMemo(
    () =>
      stableParts.filter((p): p is Extract<PlotPart, { kind: "layer" }> =>
        p.kind === "layer"
      ),
    [stableParts],
  );
  // Rebuilt whenever ANY part changes, so stabilized again by its own
  // elements: a layer change must not look like a plot-level change, or every
  // layer's stat memo (keyed on `base`) would miss.
  const specPartList = stableParts.flatMap((p) =>
    p.kind === "spec" ? [p.part as SpecPart] : []
  );
  const specParts = useMemo(() => specPartList, specPartList);
  const base = useMemo(
    () => plotSpec(data, mapping, theme, labels, specParts),
    [data, mapping, theme, labels, specParts],
  );
  useMemo(() => {
    if (fontResources) validateFontRequests(base, fontResources);
    return true;
  }, [base, fontResources]);
  const panels = useMemo(
    () => buildFacetPanels(base.facet, base.data, base.labels),
    [base.facet, base.data, base.labels],
  );

  const preparedCache = useOne(() => new Map<string, PreparedEntry>());
  const loweredCache = useOne(() => new Map<string, LoweredEntry>());
  const scalesRef = useOne(() => ({ value: null as GGScalesValue | null }));
  const panelRef = useOne(() => ({ value: null as GGPanelValue | null }));

  const pending = layers.some((layer) => layer.pending);
  const assembled = useMemo(() => {
    // vs7 trap 2: never train a contribution that has not arrived as empty.
    if (pending) return null;
    componentProbe.assembleCalls++;
    const spec: GGSpec = { ...base, layers: layers.map((l) => l.layer) };
    const faceted = spec.facet.kind !== "none";
    const removals = new Map<string, RowRemoval>();
    const livePrepared = new Set<string>();
    const panelLayers = panels.panels.map((panel, panelIndex) =>
      layers.map(({ id, layer }, layerIndex) => {
        const key = `${id}:${panelIndex}`;
        livePrepared.add(key);
        const prev = preparedCache.get(key);
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
          });
          entry = { layer, data: panel.data, spec: base, prepared, removed };
          preparedCache.set(key, entry);
        }
        recordRemovals(removals, layerIndex, layer.geom, entry.removed);
        return entry.prepared;
      })
    );
    for (const key of preparedCache.keys()) {
      if (!livePrepared.has(key)) preparedCache.delete(key);
    }

    const liveLowered = new Set<string>();
    const lowerMarks = (args: LowerMarksArgs): RenderNode[] => {
      const { layer, mapping, data, ctx, layerIndex, panelIndex } = args;
      const id = layers[layerIndex].id;
      const key = `${id}:${panelIndex}`;
      liveLowered.add(key);
      const layoutBound = UNCACHEABLE_GEOMS.has(layer.geom);
      const signature = contextSignature(args, layoutBound);
      const prev = loweredCache.get(key);
      if (
        prev && prev.layer === layer && prev.mapping === mapping &&
        prev.data === data && prev.signature === signature &&
        (!layoutBound || prev.measureText === ctx.measureText)
      ) return prev.nodes;
      componentProbe.lowerCalls++;
      // Keyed per layer, so a sibling inserted before this layer does not
      // shift its marks to a new position and remount them.
      const fresh = lowerLayer(layer, mapping, data, ctx).map((node, i) => ({
        ...node,
        key: `layer-${id}-${panelIndex}-${i}`,
      }));
      const nodes = reuseUnchanged(fresh, prev?.nodes);
      loweredCache.set(key, {
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
      layout: { width, height, measureText },
      lowerMarks,
      onAssembled: (assembledInfo) => {
        info = assembledInfo;
      },
    });
    for (const key of loweredCache.keys()) {
      if (!liveLowered.has(key)) loweredCache.delete(key);
    }
    return { tree, info: info as AssembledPlot | null };
  }, [pending, base, layers, panels, width, height, measureText]);

  if (!assembled) return null;
  const { tree, info } = assembled;

  // One immutable value per distinct set of scales: a resize keeps the
  // identity, a retrain moves the revision.
  if (info) {
    const prev = scalesRef.value;
    if (!prev || JSON.stringify(prev.scales) !== JSON.stringify(info.scales)) {
      scalesRef.value = {
        scales: info.scales,
        revision: (prev?.revision ?? 0) + 1,
      };
    }
    const panel = panelRef.value;
    if (
      !panel || panel.dimensions !== info.dimensions ||
      panel.bounds.some((b, i) => b !== info.panelBounds[i])
    ) {
      panelRef.value = {
        bounds: info.panelBounds,
        dimensions: info.dimensions,
      };
    }
  }

  const view = tree.component === "Scene3D"
    ? { ...tree, props: { ...tree.props, interactive } }
    : tree;
  return provide(
    GGScalesContext,
    scalesRef.value,
    provide(GGPanelContext, panelRef.value, renderTree(view) as LiveElement),
  );
};

/** Dev-only GPU upload instrumentation behind ?instrument, as GGPlot has. */
function useInstrumentation(): void {
  // The flag is fixed for a session, so exactly one side of the pair runs on
  // every render and the hook order stays stable.
  const device = isInstrumentFlagSet()
    ? useDeviceContext()
    : (useNoDeviceContext(), null);
  useOne(() => {
    if (!device) return false;
    installGpuInstrumentation(device);
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__gggplotGpuInstrument = {
        getCounters: getGpuMarkCounters,
        reset: resetGpuMarkCounters,
      };
    }
    return true;
  }, device);
}
