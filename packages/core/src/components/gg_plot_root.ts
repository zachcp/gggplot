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
import { assembleRoot, createRootCaches, plotSpec } from "./root_assembly.ts";

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
        onDiagnostics: props.onDiagnostics,
      }),
  );
};

/** Phase 2: train across the parts and assemble, memoized per layer. */
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

  const caches = useOne(() => createRootCaches());
  const scalesRef = useOne(() => ({ value: null as GGScalesValue | null }));
  // One stable set of GPU refs for the root's lifetime (gggplot-fbq).
  const gpuRefs = useOne(() => createScaleBindingRefs());
  const panelRef = useOne(() => ({ value: null as GGPanelValue | null }));

  const pending = layers.some((layer) => layer.pending);
  const assembled = useMemo(
    () =>
      // vs7 trap 2: never train a contribution that has not arrived as empty.
      pending ? null : assembleRoot(
        base,
        layers,
        panels,
        { width, height, measureText },
        caches,
      ),
    [pending, base, layers, panels, width, height, measureText],
  );
  // Row removals: reported once per distinct set, not on every re-assembly.
  const reportedRef = useOne(() => ({ key: "[]" }));
  if (assembled) {
    const key = JSON.stringify(assembled.diagnostics);
    if (key !== reportedRef.key) {
      reportedRef.key = key;
      warnRowRemovals(assembled.diagnostics);
      onDiagnostics?.(assembled.diagnostics);
    }
  }

  if (!assembled) return null;
  const { tree, info } = assembled;

  // One immutable value per distinct set of scales: a resize keeps the
  // identity, a retrain moves the revision.
  if (info) {
    const prev = scalesRef.value;
    if (!prev || JSON.stringify(prev.scales) !== JSON.stringify(info.scales)) {
      // Written in place before the marks render, so bound shaders draw this
      // revision's domains in the same frame its guides do.
      updateScaleBindingRefs(gpuRefs, info.scales);
      scalesRef.value = {
        scales: info.scales,
        revision: (prev?.revision ?? 0) + 1,
        gpu: gpuRefs,
      };
      componentProbe.scalesRevision = scalesRef.value.revision;
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
