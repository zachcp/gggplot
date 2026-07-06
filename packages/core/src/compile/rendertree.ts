// Render Tree — an abstract, serializable description of a UseGPU/plot component
// tree. It is the single output of the compiler and the single input to both
// backends (renderLive, emitSource), decoupling the ggplot front-end from the
// UseGPU back-end.

/** Names correspond to exports of @use-gpu/plot (Plot, Cartesian, Point, ...). */
export type ComponentName =
  | "Plot"
  | "Cartesian"
  | "Polar"
  | "Axis"
  | "Grid"
  | "Point"
  | "Line"
  | "Face"
  | "Polygon"
  | "Label";

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
