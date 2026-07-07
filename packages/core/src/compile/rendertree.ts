// Render Tree — an abstract, serializable description of a UseGPU/plot component
// tree. It is the single output of the compiler and the single input to both
// backends (renderLive, emitSource), decoupling the ggplot front-end from the
// UseGPU back-end.

/** Names correspond to exports of @use-gpu/plot (Plot, Cartesian, Point, ...). */
export type ComponentName =
  | "Plot"
  | "Embedded"
  | "Cartesian"
  | "Polar"
  | "Axis"
  | "Grid"
  | "Point"
  | "Line"
  | "Face"
  | "Polygon"
  | "Label"
  /**
   * Not a real @use-gpu/plot export — a small custom Live component (defined
   * in render/GGPlot.tsx, inlined by emit/mod.ts) that divides the ambient
   * LayoutContext pixel rect into an nrow x ncol grid and provides each
   * sub-rectangle as the LayoutContext for one Embedded child, giving
   * facet_wrap/facet_grid their multi-panel layout.
   */
  | "FacetGrid";

export interface RenderNode {
  component: ComponentName;
  props: Record<string, unknown>;
  children: RenderNode[];
}

export const node = (
  component: ComponentName,
  props: Record<string, unknown> = {},
  children: RenderNode[] = [],
): RenderNode => ({ component, props, children });
