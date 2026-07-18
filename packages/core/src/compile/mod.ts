// Pipeline orchestration. Lowering, coordinate, guide, and facet details live in focused modules.
import type { GGSpec } from "../ir/types.ts";
import { node, type RenderNode } from "./rendertree.ts";
import { applyStat } from "../stat/mod.ts";
import { trainScales } from "../scale/mod.ts";
import { facetCellLayouts } from "./facet_layout.ts";

import { GEOM_REGISTRY, lowerLayer } from "../geom/mod.ts";
import type { LayerContext } from "../geom/mod.ts";
import {
  munchPolygonNode,
  numericRange,
  polarGridLines,
  polarizeNode,
} from "./coordinates.ts";
import {
  axisGuideOverlay,
  guideLayout,
  legendNodes,
  plotLabelNodes,
  type TextMeasurer,
  themeFaceProps,
} from "./guides.ts";
import { buildFacetPanels } from "./facets.ts";

export * from "./rendertree.ts";
export * from "./guides.ts";
export { type LayerContext, lowerLayer } from "../geom/mod.ts";
export { buildFacetPanels } from "./facets.ts";

export interface CompileOptions {
  /** Enable runtime-only GPU products; source emission keeps portable CPU nodes. */
  resident?: boolean;
  /** Concrete host geometry and glyph metrics for guide-aware panel layout. */
  layout?: {
    width: number;
    height: number;
    measureText: TextMeasurer;
  };
}

export function compile(
  spec: GGSpec,
  options: CompileOptions = {},
): RenderNode {
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

  // ① stat transform per layer, per panel (resolving each layer's effective mapping/data)
  const panelLayers = panels.map((panel) =>
    spec.layers.map((layer) => {
      const mapping = layer.inheritAes === false
        ? (layer.mapping ?? {})
        : { ...spec.mapping, ...layer.mapping };
      const data = layer.data ?? panel.data;
      const resident = options.resident
        ? GEOM_REGISTRY[layer.geom].residentPlan?.(
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
  let xDomain = numericRange(xScale) ?? [0, 1];
  let yDomain = numericRange(yScale) ?? [0, 1];
  for (const { layer, data, mapping } of allPerLayer) {
    const contrib = GEOM_REGISTRY[layer.geom].domainContribution?.(
      layer,
      mapping,
      data,
      { xScale, yScale, xDomain, yDomain },
    );
    if (contrib?.x) xDomain = contrib.x;
    if (contrib?.y) yDomain = contrib.y;
  }
  const xGuideScale = xScale?.kind === "continuous"
    ? { ...xScale, domain: xDomain }
    : xScale;
  const yGuideScale = yScale?.kind === "continuous"
    ? { ...yScale, domain: yDomain }
    : yScale;

  // ④ coord → view component
  // "axes" is a swizzle string applied to Cartesian/Polar's output after the
  // range-to-clip-space matrix is built — the same trait on both view
  // components, so one projection model covers cartesian x/y swaps
  // (coord_flip) and polar theta/radius reassignment (coord_polar(theta="y"))
  // without touching mark positions or the trained domains.
  const view = spec.coord.kind === "polar" ? "Polar" : "Cartesian";
  const project = spec.coord.project ?? ["x", "y"];
  const axes = project[0] === "y" ? "yx" : "xy";

  const theme = spec.theme;
  const { bounds: panelBounds, tickCount } = guideLayout(
    options.layout?.width,
    options.layout?.height,
    options.layout?.measureText,
    theme,
    labels,
    spec.mapping,
    xGuideScale,
    yGuideScale,
    [
      colorScale,
      fillScale,
      sizeScale,
      alphaScale,
      shapeScale,
      linetypeScale,
      linewidthScale,
    ],
  );

  /** Build one panel's Cartesian/Polar view node (guides + this panel's marks). */
  function buildPanel(perLayer: typeof allPerLayer): RenderNode {
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
    for (const { layer, data, mapping } of perLayer) {
      const contrib = GEOM_REGISTRY[layer.geom].domainContribution?.(
        layer,
        mapping,
        data,
        {
          xScale: panelXScale,
          yScale: panelYScale,
          xDomain: panelXDomain,
          yDomain: panelYDomain,
        },
      );
      if (contrib?.x) panelXDomain = contrib.x;
      if (contrib?.y) panelYDomain = contrib.y;
    }
    // ⑤ geoms → marks. One LayerContext per panel replaces the former
    // 19-positional-parameter lowerLayer signature: the x/y scales are the
    // panel's (possibly free-scaled) scales, the other aesthetic scales are the
    // plot-wide trained scales, and the domains/panel pixels are this panel's.
    const ctx: LayerContext = {
      scales: {
        x: panelXScale,
        y: panelYScale,
        color: colorScale,
        fill: fillScale,
        size: sizeScale,
        alpha: alphaScale,
        shape: shapeScale,
        linetype: linetypeScale,
        linewidth: linewidthScale,
        stroke: strokeScale,
      },
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
    const marks = perLayer.flatMap(({ layer, data, mapping, resident }) =>
      resident
        ? [
          node("ResidentProduct", {
            product: resident.product,
            ...resident.props,
          }),
        ]
        : lowerLayer(layer, mapping, data, ctx)
    );
    const thetaAxis: 0 | 1 = project[0] === "x" ? 0 : 1;
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
    const polarMarks = view === "Polar"
      ? marks.map((mark) =>
        munchPolygonNode(
          polarizeNode(mark, thetaAxis, thetaDomain, thetaStart, thetaEnd),
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
      guides.push(
        view === "Polar"
          ? polarGridLines(viewXDomain, viewYDomain, theme)
          : node("Grid", {
            axes,
            width: theme.gridWidth ?? 1,
            zBias: -1,
            ...(theme.gridColor ? { color: theme.gridColor } : {}),
          }),
      );
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
      return node("Embedded", { normalize: true }, [
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
          project,
          panelBounds,
          tickCount,
        ),
        ...plotLabelNodes(labels, theme),
      ]);
    }
    return node("Embedded", { normalize: true }, [
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
            project,
            panelBounds,
            tickCount,
          ),
        ]
        : []),
      ...plotLabelNodes(labels, theme),
      ...legendNodes(
        colorScale,
        fillScale,
        sizeScale,
        alphaScale,
        shapeScale,
        linetypeScale,
        linewidthScale,
        labels,
        theme,
        panelBounds,
        options.layout?.width,
      ),
    ]);
  }

  // A faceted plot keeps one outer Embedded/Plot reconciler. FacetGrid applies
  // a normalized PanelViewport matrix to each transparent FacetPanel group,
  // so all cell marks and plot-level text share one virtual-layer submission.
  //
  // Strip Labels live in the plot-level overlay rather than a cell Embedded:
  // cell-local glyph bindings are zero-sized in UseGPU's nested font layout.
  // Their normalized positions are derived from the panel row/column, so they
  // remain independent of each panel's trained data domain.
  const embeds = panels.map((_panel, i) => {
    // Empty crossed combinations still receive the same panel field, guides,
    // and axes; only their mark list is empty. This keeps the visual grid
    // legible without manufacturing data rows.
    return node("FacetPanel", {}, [buildPanel(panelLayers[i])]);
  });
  const facetGap = theme.panelSpacing ?? 24;
  const facetStripHeight = theme.stripHeight ?? 24;
  const facetWidth = Math.max(
    (options.layout?.width ?? 800) * (panelBounds[2] - panelBounds[0]) / 2,
    1,
  );
  const facetHeight = Math.max(
    (options.layout?.height ?? 600) * (panelBounds[3] - panelBounds[1]) / 2,
    1,
  );
  const facetLayouts = facetCellLayouts(
    facetWidth,
    facetHeight,
    nrow,
    ncol,
    facetGap,
    facetStripHeight,
  );
  const stripLabels = panels.filter((panel) => panel.label).map((panel) => {
    const strip = facetLayouts[panel.row * ncol + panel.col].strip;
    const x = panelBounds[0] + (strip[0] + strip[2]) / 2 / facetWidth *
        (panelBounds[2] - panelBounds[0]);
    const y = panelBounds[1] + (strip[1] + strip[3]) / 2 / facetHeight *
        (panelBounds[3] - panelBounds[1]);
    const stripWidth = strip[2] - strip[0];
    const stripSize = Math.max(
      8,
      Math.min(
        theme.fontSize ?? 13,
        stripWidth / Math.max(panel.label.length * 0.62, 1),
      ),
    );
    return node("Label", {
      positions: [[x, y]],
      labels: [panel.label],
      color: theme.textColor ?? "#0b0b0b",
      size: stripSize,
      zBias: 2,
      ...themeFaceProps(theme),
    });
  });
  const freeMode = spec.facet.scales ?? "fixed";
  const panelTickCount = Math.max(2, Math.ceil(tickCount / ncol));
  const panelGuideOverlays = panels.map((panel, i) => {
    const rect = facetLayouts[panel.row * ncol + panel.col].panel;
    const bounds: [number, number, number, number] = [
      panelBounds[0] + rect[0] / facetWidth * (panelBounds[2] - panelBounds[0]),
      panelBounds[1] +
      rect[1] / facetHeight * (panelBounds[3] - panelBounds[1]),
      panelBounds[0] + rect[2] / facetWidth * (panelBounds[2] - panelBounds[0]),
      panelBounds[1] +
      rect[3] / facetHeight * (panelBounds[3] - panelBounds[1]),
    ];
    const localScales = freeMode === "fixed"
      ? scales
      : trainScales(spec, panelLayers[i]);
    const localX = freeMode === "free" || freeMode === "free_x"
      ? localScales.get("x")
      : xGuideScale;
    const localY = freeMode === "free" || freeMode === "free_y"
      ? localScales.get("y")
      : yGuideScale;
    const hasPanelBelow = panels.some((other) =>
      other.col === panel.col && other.row > panel.row
    );
    const horizontalTicks = freeMode === "free" || freeMode === "free_x" ||
      !hasPanelBelow;
    const verticalTicks = freeMode === "free" || freeMode === "free_y" ||
      panel.col === 0;
    return axisGuideOverlay(
      labels,
      spec.mapping,
      theme,
      localX,
      localY,
      project,
      bounds,
      panelTickCount,
      {
        horizontalTicks,
        verticalTicks,
        titles: false,
        width: options.layout?.width,
        height: options.layout?.height,
        tickSize: Math.max(
          8,
          Math.min((theme.fontSize ?? 13) - 2, facetWidth / ncol / 18),
        ),
      },
    );
  });
  return node("Embedded", { normalize: true }, [
    node("FacetGrid", {
      nrow,
      ncol,
      gap: facetGap,
      stripHeight: facetStripHeight,
      axisPolicy: spec.facet.scales ?? "fixed",
      bounds: panelBounds,
    }, embeds),
    ...stripLabels,
    ...panelGuideOverlays,
    axisGuideOverlay(
      labels,
      spec.mapping,
      theme,
      xGuideScale,
      yGuideScale,
      project,
      panelBounds,
      tickCount,
      { horizontalTicks: false, verticalTicks: false, titles: true },
    ),
    ...plotLabelNodes(labels, theme),
    ...legendNodes(
      colorScale,
      fillScale,
      sizeScale,
      alphaScale,
      shapeScale,
      linetypeScale,
      linewidthScale,
      labels,
      theme,
      panelBounds,
      options.layout?.width,
    ),
  ]);
}
