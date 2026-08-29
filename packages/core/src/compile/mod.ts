// Pipeline orchestration. Lowering, coordinate, guide, and facet details live in focused modules.
import type { Aes, AesName, DataFrame, GGSpec, Layer } from "../ir/types.ts";
import { node, type RenderNode, type RowRemoval } from "./rendertree.ts";
import { applyStat } from "../stat/mod.ts";
import {
  censorToScaleLimits,
  removeMissingPositions,
  type TrainedScale,
  trainScales,
} from "../scale/mod.ts";
import {
  facetPanelGeometry,
  facetPanelGuideOverlays,
  facetStripLabelNodes,
  panelGuideTickCount,
} from "./facet_layout.ts";

import {
  GEOM_REGISTRY,
  lowerLayer,
  resolvePlotDimension,
} from "../geom/mod.ts";
import type { LayerContext } from "../geom/mod.ts";
import {
  numericRange,
  polarGridLines,
  resolveAxes2d,
  resolveAxes3d,
} from "./coordinates.ts";
import {
  axisGuideOverlay,
  axisTickValues,
  gridDivision,
  guideLayout,
  legendNodes,
  plotLabelNodes,
  type TextMeasurer,
} from "./guides.ts";
import { guideNodes3d } from "./guides_3d.ts";
import { resolveCamera3D } from "../ir/camera.ts";
import { buildFacetPanels } from "./facets.ts";
import {
  type PackCache,
  stageAKey,
  stageBTransformedMark,
  UNCACHEABLE_GEOMS,
} from "./pack_cache.ts";

export * from "./rendertree.ts";
export * from "./guides.ts";
export { type LayerContext, lowerLayer } from "../geom/mod.ts";
export { buildFacetPanels } from "./facets.ts";
export { createPackCache, PackCache } from "./pack_cache.ts";

export interface CompileOptions {
  /** Enable runtime-only GPU products; source emission keeps portable CPU nodes. */
  resident?: boolean;
  /** Concrete host geometry and glyph metrics for guide-aware panel layout. */
  layout?: {
    width: number;
    height: number;
    measureText: TextMeasurer;
  };
  /**
   * Staged geometry cache (gggplot-tzc.5): when supplied, re-compiling an
   * unchanged spec (or a DSL-rebuilt spec reusing the same data columns)
   * reuses the same renderer-ready FlatTensor/MarkTopology objects instead
   * of re-packing/re-transforming them. Absent -> uncached, byte-for-byte
   * identical to pre-tzc.5 behavior. See compile/pack_cache.ts.
   */
  packCache?: PackCache;
}

/** Fold every layer's geom domainContribution into the starting domains. */
function widenDomains(
  perLayer: ReadonlyArray<
    { layer: Layer; data: DataFrame; mapping: Aes }
  >,
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
  xStart: [number, number],
  yStart: [number, number],
): [[number, number], [number, number]] {
  let xDomain = xStart;
  let yDomain = yStart;
  for (const { layer, data, mapping } of perLayer) {
    const contrib = GEOM_REGISTRY[layer.geom].domainContribution?.(
      layer,
      mapping,
      data,
      {
        scales: { x: xScale, y: yScale },
        domains: { x: xDomain, y: yDomain },
        xScale,
        yScale,
        xDomain,
        yDomain,
      },
    );
    if (contrib?.x) xDomain = contrib.x;
    if (contrib?.y) yDomain = contrib.y;
  }
  return [xDomain, yDomain];
}

function nonDegenerate(domain: [number, number]): [number, number] {
  return domain[0] === domain[1] ? [domain[0] - 0.5, domain[1] + 0.5] : domain;
}

function compileThreeDimensionalPlot(
  spec: GGSpec,
  perLayer: ReadonlyArray<{
    layer: Layer;
    data: DataFrame;
    mapping: Aes;
  }>,
  scales: Map<string, TrainedScale>,
  options: CompileOptions,
): RenderNode {
  const x = scales.get("x");
  const y = scales.get("y");
  const z = scales.get("z");
  if (!x || !y || !z) {
    throw new Error("[gggplot] a 3D plot requires trained x, y, and z scales");
  }
  const domains = {
    x: nonDegenerate(numericRange(x) ?? [0, 1]),
    y: nonDegenerate(numericRange(y) ?? [0, 1]),
    z: nonDegenerate(numericRange(z) ?? [0, 1]),
  };
  const scaleRecord = Object.fromEntries(scales) as Partial<
    Record<AesName, TrainedScale>
  >;
  const context: LayerContext = {
    scales: scaleRecord,
    domains,
    theme: spec.theme,
    xDomain: domains.x,
    yDomain: domains.y,
    panelPixels: {
      width: options.layout?.width ?? 800,
      height: options.layout?.height ?? 600,
    },
    measureText: options.layout?.measureText,
  };
  const marks = perLayer.flatMap(({ layer, mapping, data }) =>
    lowerLayer(layer, mapping, data, context)
  );
  const positionScales = { x, y, z };
  const scene = node("Plot", {}, [
    node(
      "Cartesian",
      {
        ...(spec.coord.params ?? {}),
        range: [domains.x, domains.y, domains.z, [1, 1]],
        axes: resolveAxes3d(spec.coord),
      },
      [
        ...guideNodes3d(
          positionScales,
          domains,
          perLayer[0]?.mapping ?? spec.mapping,
          spec.labels,
          spec.theme,
        ),
        ...marks,
      ],
    ),
  ]);
  const overlay = node("Embedded", { normalize: true }, [
    ...plotLabelNodes(spec.labels, spec.theme),
    ...legendNodes(
      scaleRecord,
      spec.labels,
      spec.theme,
      [-1, -1, 0.62, 1],
      options.layout?.width,
      options.layout?.height,
    ),
  ]);
  return node("Scene3D", { camera: spec.camera ?? resolveCamera3D() }, [
    scene,
    overlay,
  ]);
}

/**
 * Root props carrying any row removals, plus ggplot2's console warning.
 *
 * Two channels on purpose. The serializable `diagnostics` prop is the one
 * tests and tools read: gggplot compiles to a tree rather than running in a
 * REPL, so a warning alone would be unobservable. The console.warn matches the
 * existing palette-fold precedent in scale/palette.ts, because a user whose
 * plot silently lost rows should hear about it the same way a user whose
 * levels silently folded does.
 *
 * A plot that drops nothing sets no prop and prints nothing.
 */
function removalProps(
  removals: Map<string, RowRemoval>,
): Record<string, unknown> {
  if (removals.size === 0) return {};
  const diagnostics = [...removals.values()].sort((a, b) =>
    a.layer - b.layer || a.reason.localeCompare(b.reason)
  );
  for (const removal of diagnostics) {
    const kind = removal.reason === "missing-position"
      ? "missing values"
      : "non-finite values";
    console.warn(
      `[gggplot] Removed ${removal.rows} row${
        removal.rows === 1 ? "" : "s"
      } containing ${kind} (${removal.geom})`,
    );
  }
  return { diagnostics };
}

export function compile(
  spec: GGSpec,
  options: CompileOptions = {},
): RenderNode {
  const dimensionality = resolvePlotDimension(spec);
  const labels = spec.labels ?? {};

  // ③ facet → panels, partitioned before stats so stat_count/stat_bin/etc.
  // aggregate within each panel independently (ggplot2's default). A layer
  // with its own data override bypasses faceting — it renders unfiltered
  // into every panel.
  const { panels, nrow, ncol } = buildFacetPanels(
    spec.facet,
    spec.data,
    labels,
  );
  const faceted = spec.facet.kind !== "none";

  // Row removals, keyed layer:reason and summed across panels (gggplot-9v6).
  const removalTotals = new Map<string, RowRemoval>();
  const recordRemoval = (
    layer: number,
    geom: string,
    reason: RowRemoval["reason"],
    rows: number,
  ) => {
    if (rows <= 0) return;
    const key = `${layer}:${reason}`;
    const existing = removalTotals.get(key);
    if (existing) existing.rows += rows;
    else removalTotals.set(key, { layer, geom, reason, rows });
  };

  // ① stat transform per layer, per panel (resolving each layer's effective mapping/data)
  const panelLayers = panels.map((panel) =>
    spec.layers.map((layer) => {
      const mapping = layer.inheritAes === false
        ? (layer.mapping ?? {})
        : { ...spec.mapping, ...layer.mapping };
      const geom = GEOM_REGISTRY[layer.geom];
      // ggplot2 order: scale limits censor the data BEFORE the stat runs, so
      // stat_bin and friends never see rows the user excluded (gggplot-wjw).
      // Two row filters, in ggplot2's order and for different reasons. Missing
      // positions go first (a row that was never plottable), then scale limits
      // (a row the user chose to exclude) — both before the stat, so neither
      // is counted by stat_bin and then hidden at draw time.
      const layerIndex = spec.layers.indexOf(layer);
      const missing = geom.dropsMissingPositions
        ? removeMissingPositions(
          mapping,
          layer.data ?? panel.data,
          geom.nonPositionalAes,
        )
        : { data: layer.data ?? panel.data, removed: 0 };
      const censored = censorToScaleLimits(
        spec,
        mapping,
        missing.data,
        geom.nonPositionalAes,
      );
      // Accumulated per layer across panels: ggplot2 reports one removal per
      // layer, not one per facet cell.
      recordRemoval(
        layerIndex,
        layer.geom,
        "missing-position",
        missing.removed,
      );
      recordRemoval(layerIndex, layer.geom, "outside-limits", censored.removed);
      const data = censored.data;
      const resident = options.resident
        ? geom.residentPlan?.(
          spec,
          layer,
          mapping,
          data,
          { standalone: !faceted && spec.layers.length === 1 },
        )
        : undefined;
      if (resident) return { layer, data, mapping, resident };
      const res = applyStat(layer, mapping, data);
      return { layer, data: res.data, mapping: res.mapping };
    })
  );

  // ② train scales across all panels combined → shared x/y domains for every
  // panel's view range (ggplot2's default scales="fixed"; free per-panel
  // scales aren't implemented).
  const allPerLayer = panelLayers.flat();
  const scales = trainScales(spec, allPerLayer);
  if (dimensionality.dimensions === 3) {
    return compileThreeDimensionalPlot(spec, allPerLayer, scales, options);
  }
  const xScale = scales.get("x");
  const yScale = scales.get("y");
  const colorScale = scales.get("color");
  const fillScale = scales.get("fill");
  const sizeScale = scales.get("size");
  const alphaScale = scales.get("alpha");
  const shapeScale = scales.get("shape");
  const linetypeScale = scales.get("linetype");
  const linewidthScale = scales.get("linewidth");
  const strokeScale = scales.get("stroke");
  const [xDomain, yDomain] = widenDomains(
    allPerLayer,
    xScale,
    yScale,
    numericRange(xScale) ?? [0, 1],
    numericRange(yScale) ?? [0, 1],
  );
  const xGuideScale = xScale?.kind === "continuous"
    ? { ...xScale, domain: xDomain }
    : xScale;
  const yGuideScale = yScale?.kind === "continuous"
    ? { ...yScale, domain: yDomain }
    : yScale;

  // One trained-scale record keyed by aesthetic, shared by guide layout,
  // legends, and each panel's LayerContext. The non-position scales are
  // plot-wide; `guideScales` carries the guide (widened-domain) x/y for axis
  // and legend layout, while each panel spreads `aestheticScales` over its own
  // (possibly free-scaled) x/y when building its LayerContext.
  const aestheticScales = {
    color: colorScale,
    fill: fillScale,
    size: sizeScale,
    alpha: alphaScale,
    shape: shapeScale,
    linetype: linetypeScale,
    linewidth: linewidthScale,
    stroke: strokeScale,
  };
  const guideScales: Partial<Record<AesName, TrainedScale>> = {
    x: xGuideScale,
    y: yGuideScale,
    ...aestheticScales,
  };

  // ④ coord → view component
  // "axes" is a swizzle string applied to Cartesian/Polar's output after the
  // range-to-clip-space matrix is built — the same trait on both view
  // components, so one projection model covers cartesian x/y swaps
  // (coord_flip) and polar theta/radius reassignment (coord_polar(theta="y"))
  // without touching mark positions or the trained domains.
  const view = spec.coord.kind === "polar" ? "Polar" : "Cartesian";
  const axes = resolveAxes2d(spec.coord);

  const theme = spec.theme;
  const { bounds: panelBounds, tickCount, titleAnchors } = guideLayout(
    options.layout?.width,
    options.layout?.height,
    options.layout?.measureText,
    theme,
    labels,
    spec.mapping,
    guideScales,
  );
  const panelTickCount = faceted
    ? panelGuideTickCount(tickCount, ncol)
    : tickCount;

  /** Build one panel's Cartesian/Polar view node (guides + this panel's marks). */
  function buildPanel(
    perLayer: typeof allPerLayer,
    panelIndex = 0,
  ): RenderNode {
    const free = spec.facet.scales ?? "fixed";
    const panelScales = free === "fixed" ? scales : trainScales(spec, perLayer);
    const panelXScale = free === "free" || free === "free_x"
      ? panelScales.get("x")
      : xScale;
    const panelYScale = free === "free" || free === "free_y"
      ? panelScales.get("y")
      : yScale;
    let panelXDomain = free === "free" || free === "free_x"
      ? numericRange(panelXScale) ?? xDomain
      : xDomain;
    let panelYDomain = free === "free" || free === "free_y"
      ? numericRange(panelYScale) ?? yDomain
      : yDomain;
    [panelXDomain, panelYDomain] = widenDomains(
      perLayer,
      panelXScale,
      panelYScale,
      panelXDomain,
      panelYDomain,
    );
    // ⑤ geoms → marks. One LayerContext per panel replaces the former
    // 19-positional-parameter lowerLayer signature: the x/y scales are the
    // panel's (possibly free-scaled) scales, the other aesthetic scales are the
    // plot-wide trained scales, and the domains/panel pixels are this panel's.
    const ctx: LayerContext = {
      scales: {
        x: panelXScale,
        y: panelYScale,
        ...aestheticScales,
      },
      domains: { x: panelXDomain, y: panelYDomain },
      theme,
      xDomain: panelXDomain,
      yDomain: panelYDomain,
      panelPixels: {
        width: Math.max(
          1,
          (options.layout?.width ?? 800) *
            (panelBounds[2] - panelBounds[0]) / 2,
        ),
        height: Math.max(
          1,
          (options.layout?.height ?? 600) *
            (panelBounds[3] - panelBounds[1]) / 2,
        ),
      },
      measureText: options.layout?.measureText,
    };
    // Stage A (gggplot-tzc.5): memoize each non-resident layer's lowerLayer
    // output through options.packCache, keyed on its mapped columns'
    // revisions + geometry params + panel membership (see pack_cache.ts).
    // UNCACHEABLE_GEOMS (text/label/rug) read ctx.theme/xDomain/yDomain/
    // panelPixels directly for packed output, so they're always lowered
    // fresh rather than grow the key with those dependencies. Absent
    // packCache -> byte-identical to the pre-tzc.5 uncached path.
    const marks = perLayer.flatMap(
      ({ layer, data, mapping, resident }, layerIndex) => {
        if (resident) {
          return [
            node("ResidentProduct", {
              product: resident.product,
              ...resident.props,
            }),
          ];
        }
        if (!options.packCache || UNCACHEABLE_GEOMS.has(layer.geom)) {
          return lowerLayer(layer, mapping, data, ctx);
        }
        const { primary, key } = stageAKey(
          options.packCache,
          layer,
          layerIndex,
          panelIndex,
          mapping,
          data,
          ctx.scales,
        );
        return options.packCache.stageA(
          primary,
          key,
          () => lowerLayer(layer, mapping, data, ctx),
        );
      },
    );
    const thetaAxis: 0 | 1 = axes[0] === "x" ? 0 : 1;
    const thetaDomain = thetaAxis === 0 ? panelXDomain : panelYDomain;
    const coordParams = spec.coord.params ?? {};
    const requestedStart = typeof coordParams.start === "number"
      ? coordParams.start
      : 0;
    const requestedEnd = typeof coordParams.end === "number"
      ? coordParams.end
      : requestedStart + Math.PI * 2;
    // UseGPU Polar's view matrix treats the angular range like a centered
    // Cartesian axis before bending it. A symmetric radian interval therefore
    // keeps the circle centered; [0, 2π] translates it by half a viewport.
    const thetaSpan = requestedEnd - requestedStart;
    const thetaStart = -thetaSpan / 2;
    const thetaEnd = thetaSpan / 2;
    // LOWERING-ORDER CONTRACT (gggplot-tzc epic): geoms lower into
    // component-tagged marks first — flat nodes carrying a FlatTensor
    // 'positions' + MarkTopology 'topology' — with NO topology.indices
    // attached yet. Only THEN does compile apply coordinate transforms:
    // polarizeNode's pointwise theta/radius remap, followed by munchFlatNode
    // (dispatched on topology.kind, not component name). Triangulated indices
    // (tzc.4) are only ever attached AFTER this point — munchFlatNode throws
    // if it ever sees topology.indices already present, since munching after
    // triangulation would silently desync indices from the newly-inserted
    // vertices.
    //
    // Stage B (gggplot-tzc.5): stageBTransformedMark memoizes this transform
    // per mark through options.packCache, rooted on Stage A's OWN output
    // positions array (see pack_cache.ts) — a Stage A cache hit upstream
    // therefore also hits Stage B, so a genuinely unchanged polar/munched
    // chart reuses its transformed tensors too, not just its packed ones.
    // Cartesian views never reach this branch at all (`polarMarks = marks`
    // below), which is exactly what makes "Cartesian reuses Stage A tensors
    // unchanged" true by construction rather than by a caching decision.
    const polarMarks = view === "Polar"
      ? marks.map((mark) =>
        stageBTransformedMark(
          options.packCache,
          mark,
          thetaAxis,
          thetaDomain,
          thetaStart,
          thetaEnd,
        )
      )
      : marks;
    const viewXDomain: [number, number] = view === "Polar" && thetaAxis === 0
      ? [thetaStart, thetaEnd]
      : panelXDomain;
    const viewYDomain: [number, number] = view === "Polar" && thetaAxis === 1
      ? [thetaStart, thetaEnd]
      : panelYDomain;

    // ⑥ guides — background + grid + axes, themed per spec.theme.
    // A background is only drawn when theme.background is set (default: no
    // panel fill, matching ggplot2's theme_minimal); it's a full-range Polygon
    // drawn first so grid/marks layer on top in RenderTree/emitted-source
    // order. theme.grid: false (ggplot2's theme_classic/theme_void) omits the
    // Grid node entirely. gridColor/gridWidth/axisColor/axisWidth pass
    // straight through to Grid/Axis's own `color`/`width` traits, which
    // default to sensible values when unset.
    //
    // @use-gpu/workbench's VirtualLayers aggregator regroups draws by shape
    // type before sorting aggregated layers by zIndex. Keep the full-panel
    // background on a lower layer and lift Grid/Axis with their native zBias
    // trait (these helpers accept zBias directly, not ZIndexTrait) so the live
    // WebGPU backend does not reject guide lines against the panel fill.
    const guides: RenderNode[] = [];
    if (theme.background) {
      guides.push(node("Polygon", {
        positions: [[panelXDomain[0], panelYDomain[0]], [
          panelXDomain[0],
          panelYDomain[1],
        ], [
          panelXDomain[1],
          panelYDomain[1],
        ], [panelXDomain[1], panelYDomain[0]]],
        fill: theme.background,
        depth: 1,
        depthWrite: false,
      }));
    }
    if (theme.grid !== false) {
      const xBreaks = axisTickValues(panelXScale, panelTickCount);
      const yBreaks = axisTickValues(panelYScale, panelTickCount);
      const xGrid = gridDivision(xBreaks);
      const yGrid = gridDivision(yBreaks);
      const gridStyle = {
        width: theme.gridWidth ?? 1,
        zBias: -1,
        ...(theme.gridColor ? { color: theme.gridColor } : {}),
      };
      const explicitGridPositions: [number, number][][] = [
        ...(xGrid
          ? []
          : xBreaks.filter((v): v is number => typeof v === "number").map(
            (
              x,
            ): [number, number][] => [[x, panelYDomain[0]], [
              x,
              panelYDomain[1],
            ]],
          )),
        ...(yGrid
          ? []
          : yBreaks.filter((v): v is number => typeof v === "number").map(
            (
              y,
            ): [number, number][] => [[panelXDomain[0], y], [
              panelXDomain[1],
              y,
            ]],
          )),
      ];
      if (view === "Polar") {
        guides.push(polarGridLines(viewXDomain, viewYDomain, theme));
      } else {
        const xFirst = axes[0] === "x";
        const yFirst = axes[0] === "y";
        if (xGrid) {
          guides.push(node("Grid", {
            axes,
            range: xFirst
              ? [xGrid.range, panelYDomain]
              : [panelYDomain, xGrid.range],
            first: xFirst ? xGrid.props : null,
            second: xFirst ? null : xGrid.props,
            ...gridStyle,
          }));
        }
        if (yGrid) {
          guides.push(node("Grid", {
            axes,
            range: yFirst
              ? [yGrid.range, panelXDomain]
              : [panelXDomain, yGrid.range],
            first: yFirst ? yGrid.props : null,
            second: yFirst ? null : yGrid.props,
            ...gridStyle,
          }));
        }
        if (explicitGridPositions.length) {
          guides.push(node("GuideLines", {
            positions: explicitGridPositions,
            ...gridStyle,
          }));
        }
      }
    }
    if (theme.axes !== false) {
      guides.push(
        node("Axis", {
          axis: "x",
          width: theme.axisWidth ?? 2,
          zBias: 0,
          ...(theme.axisColor ? { color: theme.axisColor } : {}),
        }),
        node("Axis", {
          axis: "y",
          width: theme.axisWidth ?? 2,
          zBias: 0,
          ...(theme.axisColor ? { color: theme.axisColor } : {}),
        }),
      );
    }

    return node(
      view,
      {
        range: [viewXDomain, viewYDomain],
        axes,
        ...coordParams,
      },
      [...guides, ...polarMarks],
    );
  }

  // Embedded bridges the host camera's pixel-space layout (from FlatCamera's
  // LayoutContext) into Cartesian's normalized [-1,1] output — without it,
  // Cartesian's tiny normalized units get misread as raw pixel coordinates by
  // the camera's projection, collapsing every mark into the canvas corner.
  // Embedded also establishes the Plot wrapper (font/virtual-layers) itself,
  // so it replaces our own explicit root Plot node rather than nesting inside it.
  if (!faceted) {
    const standaloneResident = panelLayers[0].length === 1
      ? panelLayers[0][0].resident
      : undefined;
    if (standaloneResident?.standaloneView) {
      return node("Embedded", {
        normalize: true,
        ...removalProps(removalTotals),
      }, [
        node("PanelViewport", { bounds: panelBounds }, [
          node("ResidentProduct", {
            product: standaloneResident.product,
            view: true,
            ...standaloneResident.props,
            axes,
            theme,
          }),
        ]),
        axisGuideOverlay(
          labels,
          spec.mapping,
          theme,
          xGuideScale,
          yGuideScale,
          axes,
          panelBounds,
          tickCount,
        ),
        ...plotLabelNodes(labels, theme),
        // A fill/color-mapped resident bar chart trains a discrete fill scale
        // exactly like the CPU path; emit the same legend so a standalone
        // resident view shows the swatches its bar colors correspond to.
        ...legendNodes(
          guideScales,
          labels,
          theme,
          panelBounds,
          options.layout?.width,
          options.layout?.height,
        ),
      ]);
    }
    return node("Embedded", {
      normalize: true,
      ...removalProps(removalTotals),
    }, [
      ...(view === "Polar"
        ? [node("RadialViewport", {}, [buildPanel(panelLayers[0])])]
        : [node("PanelViewport", { bounds: panelBounds }, [
          buildPanel(panelLayers[0]),
        ])]),
      ...(view === "Cartesian"
        ? [
          axisGuideOverlay(
            labels,
            spec.mapping,
            theme,
            xGuideScale,
            yGuideScale,
            axes,
            panelBounds,
            tickCount,
            { titleAnchors },
          ),
        ]
        : []),
      ...plotLabelNodes(labels, theme),
      ...legendNodes(
        guideScales,
        labels,
        theme,
        panelBounds,
        options.layout?.width,
        options.layout?.height,
      ),
    ]);
  }

  // A faceted plot keeps one outer Embedded/Plot reconciler. FacetGrid applies
  // a normalized PanelViewport matrix to each transparent FacetPanel group,
  // so all cell marks and plot-level text share one virtual-layer submission.
  const embeds = panels.map((_panel, i) => {
    // Empty crossed combinations still receive the same panel field, guides,
    // and axes; only their mark list is empty. This keeps the visual grid
    // legible without manufacturing data rows.
    return node("FacetPanel", {}, [buildPanel(panelLayers[i], i)]);
  });
  const facetGap = theme.panelSpacing ?? 24;
  const facetStripHeight = theme.stripHeight ?? 24;
  const facetGeometry = facetPanelGeometry(
    panelBounds,
    nrow,
    ncol,
    facetGap,
    facetStripHeight,
    options.layout,
  );
  return node("Embedded", {
    normalize: true,
    ...removalProps(removalTotals),
  }, [
    node("FacetGrid", {
      nrow,
      ncol,
      gap: facetGap,
      stripHeight: facetStripHeight,
      axisPolicy: spec.facet.scales ?? "fixed",
      bounds: panelBounds,
    }, embeds),
    ...facetStripLabelNodes(panels, facetGeometry, panelBounds, ncol, theme),
    ...facetPanelGuideOverlays(panels, facetGeometry, {
      spec,
      panelLayers,
      scales,
      xGuideScale,
      yGuideScale,
      labels,
      mapping: spec.mapping,
      theme,
      axes,
      bounds: panelBounds,
      tickCount,
      ncol,
      layout: options.layout,
    }),
    axisGuideOverlay(
      labels,
      spec.mapping,
      theme,
      xGuideScale,
      yGuideScale,
      axes,
      panelBounds,
      tickCount,
      {
        horizontalTicks: false,
        verticalTicks: false,
        titles: true,
        titleAnchors,
      },
    ),
    ...plotLabelNodes(labels, theme),
    ...legendNodes(
      guideScales,
      labels,
      theme,
      panelBounds,
      options.layout?.width,
      options.layout?.height,
    ),
  ]);
}
