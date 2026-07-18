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
   * A GPU-resident product mark, resolved at render time through the runtime
   * resident registry: props.product (a plan id string) selects the live
   * component and props.view picks its standalone auto-domain form. Serializable
   * and runtime-only — emitSource compiles portable CPU nodes, never this.
   */
  | "ResidentProduct"
  /** One facet cell with a concrete viewport supplied by FacetGrid. */
  | "FacetPanel"
  /** Insets a single plot panel while outer labels remain in chart space. */
  | "PanelViewport"
  /** Centers a square viewport inside the host before a Polar view. */
  | "RadialViewport"
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
