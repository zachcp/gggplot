import type {
  Aes,
  DataFrame,
  GGSpec,
  PlotLabels,
  PositionAxis,
  Theme,
} from "../ir/types.ts";
import { node, type RenderNode } from "./rendertree.ts";
import { trainScales, type TrainedScale } from "../scale/mod.ts";
import { axisGuideOverlay, themeFaceProps } from "./guides.ts";
import type { FacetPanel } from "./facets.ts";

export interface FacetCellLayout {
  row: number;
  col: number;
  /** Pixel-space cell rectangle [left, top, right, bottom]. */
  cell: [number, number, number, number];
  /** Pixel-space strip rectangle, reserved above the panel. */
  strip: [number, number, number, number];
  /** Pixel-space drawable panel rectangle, excluding strip and spacing. */
  panel: [number, number, number, number];
}

/** Canonical responsive facet rectangles in CSS pixels. */
export function facetCellLayouts(
  width: number,
  height: number,
  nrow: number,
  ncol: number,
  gap = 16,
  stripHeight = 24,
): FacetCellLayout[] {
  if (width <= 0 || height <= 0 || nrow < 1 || ncol < 1) return [];
  const safeGap = Math.max(0, gap);
  const cellWidth = Math.max(0, (width - safeGap * (ncol - 1)) / ncol);
  const cellHeight = Math.max(0, (height - safeGap * (nrow - 1)) / nrow);
  const safeStrip = Math.min(Math.max(0, stripHeight), cellHeight);
  const cells: FacetCellLayout[] = [];
  for (let row = 0; row < nrow; row++) {
    for (let col = 0; col < ncol; col++) {
      const left = col * (cellWidth + safeGap);
      const top = row * (cellHeight + safeGap);
      const right = left + cellWidth;
      const bottom = top + cellHeight;
      cells.push({
        row,
        col,
        cell: [left, top, right, bottom],
        strip: [left, top, right, top + safeStrip],
        panel: [left, top + safeStrip, right, bottom],
      });
    }
  }
  return cells;
}

/** Facet-grid pixel geometry: the panel-band dimensions and per-cell rects. */
export interface FacetPanelGeometry {
  /** Pixel width of the whole panel band inside the normalized bounds. */
  facetWidth: number;
  /** Pixel height of the whole panel band inside the normalized bounds. */
  facetHeight: number;
  /** Per-cell (strip/panel) rectangles, row-major by `row * ncol + col`. */
  layouts: FacetCellLayout[];
}

/**
 * Convert the plot's normalized panel bounds into pixel-space facet geometry:
 * the panel band's pixel size (host layout scaled by the bounds' fraction of
 * clip space) and the responsive per-cell rectangles. This feeds both the
 * strip labels and the per-panel guide overlays.
 */
export function facetPanelGeometry(
  bounds: [number, number, number, number],
  nrow: number,
  ncol: number,
  gap: number,
  stripHeight: number,
  layout?: { width: number; height: number },
): FacetPanelGeometry {
  const facetWidth = Math.max(
    (layout?.width ?? 800) * (bounds[2] - bounds[0]) / 2,
    1,
  );
  const facetHeight = Math.max(
    (layout?.height ?? 600) * (bounds[3] - bounds[1]) / 2,
    1,
  );
  const layouts = facetCellLayouts(
    facetWidth,
    facetHeight,
    nrow,
    ncol,
    gap,
    stripHeight,
  );
  return { facetWidth, facetHeight, layouts };
}

/**
 * Strip Labels live in the plot-level overlay rather than a cell Embedded:
 * cell-local glyph bindings are zero-sized in UseGPU's nested font layout.
 * Their normalized positions are derived from the panel row/column, so they
 * remain independent of each panel's trained data domain.
 */
export function facetStripLabelNodes(
  panels: FacetPanel[],
  geometry: FacetPanelGeometry,
  bounds: [number, number, number, number],
  ncol: number,
  theme: Theme,
): RenderNode[] {
  const { facetWidth, facetHeight, layouts } = geometry;
  return panels.filter((panel) => panel.label).map((panel) => {
    const strip = layouts[panel.row * ncol + panel.col].strip;
    const x = bounds[0] + (strip[0] + strip[2]) / 2 / facetWidth *
        (bounds[2] - bounds[0]);
    const y = bounds[1] + (strip[1] + strip[3]) / 2 / facetHeight *
        (bounds[3] - bounds[1]);
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
}

/** Non-geometry inputs the per-panel guide overlays need beyond the grid rects. */
export interface FacetPanelGuideContext {
  spec: GGSpec;
  panelLayers: { data: DataFrame; mapping: Aes }[][];
  /** Plot-wide trained scales (used as the fixed-scale panel scales). */
  scales: Map<string, TrainedScale>;
  xGuideScale: TrainedScale | undefined;
  yGuideScale: TrainedScale | undefined;
  labels: PlotLabels;
  mapping: Aes;
  theme: Theme;
  project: [PositionAxis, PositionAxis];
  bounds: [number, number, number, number];
  tickCount: number;
  ncol: number;
  layout?: { width: number; height: number };
}

/**
 * Per-panel axis tick/guide overlays for a facet grid. Each panel's normalized
 * bounds are derived from its pixel-space panel rect; ticks are drawn only on
 * the grid's outer edge (bottom row / first column) under fixed scales, and on
 * every panel under free scales. Titles are drawn once by the plot-level
 * overlay, not here.
 */
export function facetPanelGuideOverlays(
  panels: FacetPanel[],
  geometry: FacetPanelGeometry,
  ctx: FacetPanelGuideContext,
): RenderNode[] {
  const { facetWidth, facetHeight, layouts } = geometry;
  const {
    spec,
    panelLayers,
    scales,
    xGuideScale,
    yGuideScale,
    labels,
    mapping,
    theme,
    project,
    bounds,
    tickCount,
    ncol,
    layout,
  } = ctx;
  const freeMode = spec.facet.scales ?? "fixed";
  const panelTickCount = Math.max(2, Math.ceil(tickCount / ncol));
  return panels.map((panel, i) => {
    const rect = layouts[panel.row * ncol + panel.col].panel;
    const panelBoundsRect: [number, number, number, number] = [
      bounds[0] + rect[0] / facetWidth * (bounds[2] - bounds[0]),
      bounds[1] +
      rect[1] / facetHeight * (bounds[3] - bounds[1]),
      bounds[0] + rect[2] / facetWidth * (bounds[2] - bounds[0]),
      bounds[1] +
      rect[3] / facetHeight * (bounds[3] - bounds[1]),
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
      mapping,
      theme,
      localX,
      localY,
      project,
      panelBoundsRect,
      panelTickCount,
      {
        horizontalTicks,
        verticalTicks,
        titles: false,
        width: layout?.width,
        height: layout?.height,
        tickSize: Math.max(
          8,
          Math.min((theme.fontSize ?? 13) - 2, facetWidth / ncol / 18),
        ),
      },
    );
  });
}
