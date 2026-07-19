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
  /**
   * A mark node carrying chunked flat topology (gggplot-tzc.3): one or more
   * disjoint/variable-length polylines packed into a single FlatTensor
   * 'positions' + MarkTopology 'topology' prop (see PackedGeometry/
   * concatPacked in geom/shared.ts). Semantically distinct from plain 'Line'
   * so guides/annotations/reference lines (which stay 'Line') can never be
   * silently affected by the mark realization this name selects. See the
   * REGISTRY in render/GGPlot.tsx for which live component 'ChunkedLine'
   * resolves to.
   */
  | "ChunkedLine"
  /**
   * A mark node carrying chunked flat FACE topology (gggplot-tzc.4): one or
   * more closed loops (4/rect, 6/hex, variable outlines) packed into a
   * single FlatTensor 'positions' + MarkTopology 'topology' prop (kind:
   * 'loops'), with a per-vertex FlatTensor(vec4) 'colors' tensor expanded
   * during lowering from each loop's per-face fill (see packFaceLoops in
   * geom/shared.ts). A 'concave' boolean prop picks the live realization's
   * triangulation strategy (see render/chunked_face.tsx for the concavity
   * spike finding: fan for guaranteed-convex families — rect/tile/bar/col/
   * hex/boxplot/crossbar boxes — versus upstream earcut-backed concave
   * triangulation for arbitrary/wiggly outlines — polygon/violin/area/
   * ribbon/smooth SE band). Semantically distinct from plain 'Polygon' so
   * the theme-background panel and guide/legend swatches (which stay
   * 'Polygon') can never be silently affected by the mark realization this
   * name selects. See the REGISTRY in render/GGPlot.tsx for which live
   * component 'ChunkedFace' resolves to.
   */
  | "ChunkedFace"
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

/**
 * Per-row float attribute data, INTERLEAVED layout: components of one
 * element are adjacent — [x0,y0, x1,y1, ...] for dims=2 — matching Use.GPU
 * vector inputs. NOT planar/column-major ([all x..., all y...]).
 * Mirrors @use-gpu/core TensorArray's float fields; deliberately omits
 * upstream 'ragged'. Never mutate 'array' after construction.
 */
export interface FlatTensor {
  array: Float32Array;
  format: "f32" | "vec2" | "vec4";
  dims: 1 | 2 | 4;
  length: number; // element count = array.length / dims
  size: number[]; // [length]
  version: number; // 0 for fresh packs; identity is the cache key
}

/**
 * Renderer-facing topology: separate from float data, integer TypedArrays,
 * aligned with workbench useLineSegmentsSource/useFaceSegmentsSource.
 * Contains ONLY what a renderer consumes — no compiler bookkeeping.
 */
export interface MarkTopology {
  kind: "points" | "polyline" | "loops";
  chunks?: Uint32Array; // per-chunk vertex counts
  loops?: boolean; // closed loops; a node is topologically HOMOGENEOUS
  // (upstream accepts boolean[]; unneeded — no geom
  // family mixes open/closed in one style batch;
  // documented constraint, enforced by convention)
  indices?: Uint32Array; // triangulated indices for concave loops (tzc.4;
  // attached only AFTER coordinate transforms)
}

export const node = (
  component: ComponentName,
  props: Record<string, unknown> = {},
  children: RenderNode[] = [],
): RenderNode => ({ component, props, children });
