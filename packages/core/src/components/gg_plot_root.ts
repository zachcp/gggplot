// The component-first <GGPlot> root (gggplot-2bj, ADR-007, proven by vnh.3).
//
// Phase 1: the children render inline and report plot parts through Live
// Capture (components/parts.ts): layers, scales, a coord, a facet, a theme,
// labels. They render nothing themselves.
// Phase 2 (PlotView): the capture's continuation prepares every layer and
// trains the plot (prepareRoot, compile's trainPlot), layout-free, and
// provides the scales. It reads no LayoutContext.
// Phase 3 (PlotLayout): lays the trained plot out at the host's size with the
// font measurer (layoutRoot, compile's layoutPlot), so guides and layout match
// the compile path. Only this phase re-renders on a resize (gggplot-d14).
//
// What makes a change cheap is memoization keyed on what each step reads:
// - each layer's row filtering and stat (prepareLayer) is memoized per layer
//   and panel on its layer, its panel rows and the slice of the spec it reads
//   (prepareSignature, gggplot-2gu). The stat runs here rather than in the
//   layer's own fiber because it reads sibling parts (a scale's limits censor
//   rows before the stat).
// - each layer's lowering is memoized on its inputs plus everything lowering
//   reads from its LayerContext, and unchanged tensors keep their identity
//   (reuseUnchanged), so only changed data re-uploads.
// - marks are keyed by layer, so adding or removing a layer remounts nothing
//   else.
// A resize therefore re-runs layout only: no stat, no training, no lowering
// (layout-bound text, label and rug aside), no mark upload.
//
// GPU-eligible layers (stat_count / stat_bin through geom.residentPlan) become
// resident products: the assembly plans one product per distinct productKey,
// ProductHost mounts each once in a sibling <Compute> ABOVE the plot, and every
// mark that reads it finds it by key (gggplot-280, -vnh.5.1). A product that
// owns its y range reports its read-back summary, and the root trains y from
// it, so a GPU-stat plot gets axes like any other.
import type { LiveElement } from "@use-gpu/live";
import * as UseGpuWorkbench from "@use-gpu/workbench";
import {
  buildFacetPanels,
  type RowRemoval,
  warnRowRemovals,
} from "../compile/mod.ts";
import type { SpecPart } from "../dsl/base.ts";
import { ingest, type InputData } from "../data/mod.ts";
import type { Aes, DataFrame, PlotLabels, Theme } from "../ir/types.ts";
import { renderTree } from "../render/render_tree.tsx";
import {
  createScaleBindingRefs,
  updateScaleBindingRefs,
} from "../render/scale_bindings.ts";
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
import type { Generation } from "../runtime/generation_gate.ts";
import { ProductHost } from "../runtime/product_host.tsx";
import type { GridSummary } from "../runtime/resident_grid_pending.ts";
import { isResidentColumn } from "../runtime/types.ts";
import {
  capture,
  createElement,
  provide,
  useContext,
  useDeviceContext,
  useMemo,
  useOne,
  useState,
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
import {
  createRootCaches,
  layoutRoot,
  plotSpec,
  type PreparedLayers,
  type PreparedRoot,
  prepareLayers,
  type ResidentReadbacks,
  residentTraining,
  type RootCaches,
  trainRoot,
  versionKey,
} from "./root_assembly.ts";
import { esm } from "../runtime/usegpu_compat.ts";
const { LayoutContext, useFontContext, useNoDeviceContext } = esm(
  UseGpuWorkbench,
  "LayoutContext",
);

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
  /**
   * Called with the rows each layer dropped before its stat (missing
   * positions, values outside scale limits) whenever that set changes, and
   * with an empty list once it clears. The same set is console-warned.
   */
  onDiagnostics?: (removals: readonly RowRemoval[]) => void;
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
      // CPU stats and lowering read columns on the CPU. Plots over GPU-only
      // columns arrive with the loader routes (gggplot-y43).
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
        onDiagnostics: props.onDiagnostics,
      }),
  );
};

/**
 * Phase 2: prepare and train across the parts, layout-free, and provide the
 * scales. Reads no LayoutContext, so a resize never re-renders it: only
 * PlotLayout below re-lays out (gggplot-d14).
 */
const PlotView = (
  {
    data,
    mapping,
    theme,
    labels,
    parts,
    interactive,
    fontResources,
    onDiagnostics,
  }: {
    data: DataFrame;
    mapping: Aes;
    theme?: Theme;
    labels?: PlotLabels;
    parts: PlotPart[];
    interactive: boolean;
    fontResources: FontResources | null;
    onDiagnostics?: (removals: readonly RowRemoval[]) => void;
  },
): LiveElement => {
  componentProbe.viewRenders++;
  useInstrumentation();

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
  // elements: a layer change must not look like a plot-level change.
  const specPartList = stableParts.flatMap((p) =>
    p.kind === "spec" ? [p.part as SpecPart] : []
  );
  const specParts = useMemo(() => specPartList, specPartList);
  // <GGPanel> children, stabilized the same way.
  const panelList = stableParts.flatMap((p) =>
    p.kind === "panel" ? [p.content] : []
  );
  const panelContent = useMemo(() => panelList, panelList);
  const base = useMemo(
    () => plotSpec(data, mapping, theme, labels, specParts),
    [data, mapping, theme, labels, specParts],
  );
  useMemo(() => {
    if (fontResources) validateFontRequests(base, fontResources);
    return true;
  }, [base, fontResources]);
  // A column touched in place moves its version, not the frame's identity:
  // facet partitions are cut again, and prepareRoot re-prepares what read it.
  const dataVersion = versionKey(base.data);
  const panels = useMemo(
    () => buildFacetPanels(base.facet, base.data, base.labels),
    [base.facet, base.data, base.labels, dataVersion],
  );

  const caches = useOne(() => createRootCaches());
  const scalesRef = useOne(() => ({ value: null as GGScalesValue | null }));
  // One stable set of GPU refs for the root's lifetime (gggplot-fbq).
  const gpuRefs = useOne(() => createScaleBindingRefs());

  // Null while a layer is pending (vs7 trap 2); the last one is kept.
  const lastLayersRef = useOne(() => ({
    value: null as PreparedLayers | null,
  }));
  const prepared = useMemo(() => {
    const next = prepareLayers(base, layers, panels, caches);
    if (next) lastLayersRef.value = next;
    return lastLayersRef.value;
  }, [base, layers, panels, dataVersion]);
  // Summaries the hosted products read back, by product key. A product that
  // owns its y range trains it from here; until its first summary lands the
  // previous trained plot stays on screen (or nothing, on the first frame).
  const [readbacks, setReadbacks] = useState<ResidentReadbacks>(
    () => new Map(),
  );
  const onSummary = useOne(
    () => (key: string, summary: Generation<GridSummary>) =>
      setReadbacks((prev) => {
        const old = prev.get(key);
        if (
          old && old.version === summary.version &&
          old.value.stackedMaximum === summary.value.stackedMaximum
        ) return prev;
        const next = new Map(prev);
        next.set(key, summary);
        return next;
      }),
  );
  const lastRef = useOne(() => ({ value: null as PreparedRoot | null }));
  const root = useMemo(() => {
    if (!prepared) return lastRef.value;
    const resident = residentTraining(prepared.plans, readbacks);
    if (!resident.pending) lastRef.value = trainRoot(prepared, resident);
    return lastRef.value;
  }, [prepared, readbacks]);
  const plans = prepared?.plans ?? [];
  // Row removals: reported once per distinct set, not on every re-assembly.
  const reportedRef = useOne(() => ({ key: "[]" }));
  if (root) {
    const key = JSON.stringify(root.diagnostics);
    if (key !== reportedRef.key) {
      reportedRef.key = key;
      warnRowRemovals(root.diagnostics);
      onDiagnostics?.(root.diagnostics);
    }
  }
  // Products are built ABOVE the tree: <Plot>'s VirtualLayers boundary keeps
  // a kernel below it from reaching a compute pass (runtime/product_host.tsx).
  // They mount before the first training, which may wait on their summaries.
  const host = (children: LiveElement) =>
    createElement(ProductHost, { plans, onSummary, children }) as LiveElement;
  if (!root) return host(null);

  // One immutable value per distinct set of scales: only a retrain moves the
  // revision, and a resize never reaches this component.
  const scales = root.trained.guideScales;
  const prev = scalesRef.value;
  if (!prev || JSON.stringify(prev.scales) !== JSON.stringify(scales)) {
    // Written in place before the marks render, so bound shaders draw this
    // revision's domains in the same frame its guides do.
    updateScaleBindingRefs(gpuRefs, scales);
    scalesRef.value = {
      scales,
      revision: (prev?.revision ?? 0) + 1,
      gpu: gpuRefs,
    };
    componentProbe.scalesRevision = scalesRef.value.revision;
  }
  return host(provide(
    GGScalesContext,
    scalesRef.value,
    createElement(PlotLayout, {
      root,
      caches,
      interactive,
      panelContent,
    }) as LiveElement,
  ));
};

/**
 * Phase 3: lay the trained plot out at the host's size with the font
 * measurer: guides, grids, panel bounds, and marks (from cache unless
 * layout-bound). The only part of the root a resize re-renders.
 */
const PlotLayout = (
  { root, caches, interactive, panelContent }: {
    root: PreparedRoot;
    caches: RootCaches;
    interactive: boolean;
    panelContent: readonly unknown[];
  },
): LiveElement => {
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
  const panelRef = useOne(() => ({ value: null as GGPanelValue | null }));
  const { tree, info } = useMemo(
    () =>
      layoutRoot(root, { width, height, measureText }, caches, panelContent),
    [root, width, height, measureText, panelContent],
  );
  if (info) {
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
    GGPanelContext,
    panelRef.value,
    renderTree(view) as LiveElement,
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
