// Named, typed geom components over <GeomLayer> (gggplot-8hz).
//
// Each component is the JSX form of one DSL constructor: <GeomPoint size={3}/>
// builds the layer geomPoint({ size: 3 }) builds. Props are typed per family,
// so a parameter the geom does not read (<GeomPoint bins={3}/>) is a type
// error. Parameters a component does not type (another stat's, after a `stat`
// override, or an extension's) go through `params`.
//
// Every component also carries `layerProps`, the pure props -> <GeomLayer>
// props mapping it renders, so the DSL-equivalence test needs no Live tree.
import type { LiveElement } from "@use-gpu/live";
import type { IngestOptions, InputData } from "../data/mod.ts";
import type { Aes, AesName, PositionKind, StatKind } from "../ir/types.ts";
import { createElement } from "../runtime/usegpu_compat.ts";
import { GeomLayer, type GeomLayerProps } from "./geom_layer.ts";

// --- prop families ---------------------------------------------------------

/** What every layer component takes. */
export interface LayerProps {
  /** This layer's aesthetics, over the plot's unless `inheritAes` is false. */
  mapping?: Aes;
  /** Rows for this layer only (ggplot2's layer `data`). */
  data?: InputData;
  /** How `data` is ingested (column types, factor levels). */
  dataOptions?: IngestOptions;
  stat?: StatKind;
  position?: PositionKind;
  /** ggplot2's inherit.aes. */
  inheritAes?: boolean;
  /** Parameters this component does not type: another stat's, an extension's. */
  params?: Record<string, unknown>;
}

/** Literal stroke color and transparency. */
export interface ColorProps {
  color?: string;
  alpha?: number;
  opacity?: number;
}

export interface FillProps {
  fill?: string;
}

/** Literal line styling. */
export interface LineProps {
  linewidth?: number;
  /** A named dash pattern: "solid", "dashed", "dotted", ... */
  linetype?: string;
  strokeWidth?: number;
}

/** Parameters of the dodge, jitter and nudge positions. */
export interface PositionParams {
  /** Seeds jitter, so a jittered layer is the same on every render. */
  seed?: number;
  dodgeWidth?: number;
  jitterWidth?: number;
  jitterHeight?: number;
  nudgeX?: number;
  nudgeY?: number;
}

/** A stat weight: a numeric column's name, or a fixed finite scalar. */
export type Weight = string | number;

/** stat_bin. */
export interface BinParams {
  bins?: number;
  binwidth?: number;
  boundary?: number;
  breaks?: number[];
  /** Pad the frequency polygon with empty end bins (default true). */
  pad?: boolean;
  weight?: Weight;
}

/** stat_density / stat_ydensity. */
export interface DensityParams {
  bw?: number;
  n?: number;
}

/** stat_bin2d / stat_binhex / stat_summary2d. */
export interface Bin2dParams {
  bins?: number;
  binwidth?: number;
  boundary?: number;
  xbins?: number;
  ybins?: number;
  xbinwidth?: number;
  ybinwidth?: number;
  xboundary?: number;
  yboundary?: number;
  weight?: Weight;
}

/** A summary function: a name ("mean", "median", ...) or a reducer. */
export type SummaryFun = string | ((values: number[]) => number);

/** stat_contour / stat_density2d. */
export interface ContourParams {
  bins?: number;
  breaks?: number[];
  /** Grid resolution of the density estimate. */
  n?: number;
  /** Bandwidths for the 2D kernel. */
  h?: number | [number, number];
  adjust?: number;
  contourVar?: string;
}

/** stat_smooth. */
export interface SmoothParams {
  /** "lm" (default), "loess", "glm", or an extension's method. */
  method?: string;
  formula?: string;
  se?: boolean;
  level?: number;
  n?: number;
  span?: number;
  robustIterations?: number;
  family?: string;
  link?: string;
  maxIterations?: number;
  tolerance?: number;
}

/** Bar, column and tile extents. */
export interface WidthProps {
  width?: number;
}

type Common = LayerProps & ColorProps & PositionParams;

export type PointProps = Common & FillProps & {
  size?: number;
  stroke?: number;
  strokeColor?: string;
  /** "perspective" sizes 3D points by depth. */
  sizeMode?: "screen" | "perspective";
  depthTest?: boolean;
};
export type PathProps = Common & LineProps;
export type StepProps = PathProps & { direction?: "hv" | "vh" | "mid" };
export type BarProps = Common & FillProps & WidthProps & {
  padding?: number;
  weight?: Weight;
};
export type HistogramProps = BarProps & BinParams;
export type AreaProps = Common & FillProps & LineProps & { offset?: number };
export type PolygonProps = Common & FillProps & LineProps;
export type TileProps = Common & FillProps & WidthProps & {
  height?: number;
};
export type RectProps = Common & FillProps & LineProps;
export type TextProps = Common & {
  size?: number;
  angle?: number;
  family?: string;
  fontface?: string;
  weight?: number | string;
  style?: string;
  lineHeight?: number;
  hjust?: number;
  vjust?: number;
  sizeMode?: "screen" | "perspective";
};
export type LabelProps = TextProps & FillProps & {
  labelPadding?: number;
  labelR?: number;
  borderColor?: string;
  borderWidth?: number;
};
export type BoxplotProps = Common & FillProps & LineProps & WidthProps & {
  coef?: number;
};
export type ViolinProps =
  & Common
  & FillProps
  & LineProps
  & WidthProps
  & DensityParams;
export type DotplotProps = Common & FillProps & {
  size?: number;
  bins?: number;
  binwidth?: number;
  stackratio?: number;
};
export type IntervalProps = Common & FillProps & LineProps & WidthProps & {
  size?: number;
  orientation?: "x" | "y";
};
export type SmoothProps = Common & FillProps & LineProps & SmoothParams;
export type DensityProps = PathProps & DensityParams;
export type FreqpolyProps = PathProps & BinParams;
export type Bin2dProps = Common & FillProps & Bin2dParams;
export type HexProps = Bin2dProps;
export type SummaryBinProps = Bin2dProps & { fun?: SummaryFun };
export type WaffleProps = TileProps & {
  rows?: number;
  maxCells?: number;
  direction?: "column";
};
export type SegmentProps = PathProps;
export type CurveProps = PathProps & { curvature?: number; segments?: number };
export type RugProps = PathProps & {
  /** Which panel edges get ticks: letters from "btlr". */
  sides?: string;
  length?: number;
};
export type ContourProps = PathProps & ContourParams;
export type ContourFilledProps = TileProps & ContourParams;
export type QuantileProps = PathProps & {
  quantiles?: number[];
  method?: string;
};
export type EcdfProps = StepProps & { pad?: boolean };
export type CountProps = PointProps & { weight?: Weight };
export type QqProps = PointProps;
export type QqLineProps = PathProps;
export type FunctionProps = PathProps & {
  /** The function to draw. */
  fun: (x: number) => number;
  xlim?: [number, number];
  n?: number;
};
export type EllipseProps = PathProps & { level?: number; n?: number };
export type ConnectProps = PathProps & {
  connection?: "linear" | "hv" | "vh" | "mid" | "sigmoid";
  samples?: number;
  steepness?: number;
};
export type AlignProps = AreaProps & {
  grid?: number | number[];
  interpolation?: string;
  duplicate?: string;
  outside?: string;
};
export type SurfaceProps = Common & FillProps;
export type VoxelProps = Common & FillProps & {
  bins?: number | [number, number, number];
  binwidth?: number | [number, number, number];
  boundary?: number;
  padding?: number;
  weight?: Weight;
};
export type BlankProps = LayerProps;
export type SpokeProps = PathProps;
export type SummaryProps = PointProps & { fun?: SummaryFun };

/** Reference lines: literal positions, never the plot's data or mapping. */
export type RefLineProps = ColorProps & LineProps & {
  params?: Record<string, unknown>;
};

// --- the components --------------------------------------------------------

/** A named component and the <GeomLayer> props it renders. */
export type NamedGeom<P> = ((props: P) => LiveElement) & {
  layerProps: (props: P) => GeomLayerProps;
};

function named<P extends { params?: Record<string, unknown> }>(
  toProps: (props: Omit<P, "params">) => GeomLayerProps,
): NamedGeom<P> {
  const layerProps = (props: P): GeomLayerProps => {
    const { params, ...rest } = props;
    return { ...params, ...toProps(rest) };
  };
  return Object.assign(
    (props: P): LiveElement => createElement(GeomLayer, layerProps(props)),
    { layerProps },
  );
}

/** A geom with its registry defaults. */
const plain = <P extends LayerProps>(
  geom: GeomLayerProps["geom"],
): NamedGeom<P> => named<P>((props) => ({ ...props, geom }));

/** A geom whose default stat differs from the registry's. */
const withStat = <P extends LayerProps>(
  geom: GeomLayerProps["geom"],
  stat: StatKind,
): NamedGeom<P> =>
  named<P>((props) => ({ ...props, geom, stat: props.stat ?? stat }));

export const GeomPoint: NamedGeom<PointProps> = plain("point");
export const GeomLine: NamedGeom<PathProps> = plain("line");
export const GeomPath: NamedGeom<PathProps> = plain("path");
export const GeomStep: NamedGeom<StepProps> = plain("step");
export const GeomBar: NamedGeom<BarProps> = plain("bar");
export const GeomHistogram: NamedGeom<HistogramProps> = named((props) => ({
  ...props,
  geom: "bar",
  stat: "bin",
}));
export const GeomCol: NamedGeom<BarProps> = plain("col");
export const GeomArea: NamedGeom<AreaProps> = plain("area");
export const GeomRibbon: NamedGeom<AreaProps> = plain("ribbon");
export const GeomPolygon: NamedGeom<PolygonProps> = plain("polygon");
export const GeomTile: NamedGeom<TileProps> = plain("tile");
/** Like GeomTile, at full axis resolution: pass no width/height. */
export const GeomRaster: NamedGeom<TileProps> = plain("tile");
export const GeomRect: NamedGeom<RectProps> = plain("rect");
export const GeomText: NamedGeom<TextProps> = plain("text");
export const GeomLabel: NamedGeom<LabelProps> = plain("label");
export const GeomBoxplot: NamedGeom<BoxplotProps> = plain("boxplot");
export const GeomViolin: NamedGeom<ViolinProps> = plain("violin");
export const GeomDotplot: NamedGeom<DotplotProps> = plain("dotplot");
export const GeomErrorbar: NamedGeom<IntervalProps> = plain("errorbar");
export const GeomErrorbarh: NamedGeom<IntervalProps> = named((props) => ({
  ...props,
  geom: "errorbar",
  orientation: "y",
}));
export const GeomLinerange: NamedGeom<IntervalProps> = plain("linerange");
export const GeomPointrange: NamedGeom<IntervalProps> = plain("pointrange");
export const GeomCrossbar: NamedGeom<IntervalProps> = plain("crossbar");
export const GeomSmooth: NamedGeom<SmoothProps> = plain("smooth");
/** Kernel density estimate drawn as a line. */
export const GeomDensity: NamedGeom<DensityProps> = withStat("line", "density");
/** Binned counts connected through ascending bin centers. */
export const GeomFreqpoly: NamedGeom<FreqpolyProps> = withStat("line", "bin");
export const GeomBin2d: NamedGeom<Bin2dProps> = withStat("tile", "bin2d");
export const GeomHex: NamedGeom<HexProps> = plain("hex");
export const GeomWaffle: NamedGeom<WaffleProps> = named((props) => ({
  ...props,
  geom: "tile",
  stat: "waffle",
}));
export const GeomQq: NamedGeom<QqProps> = withStat("point", "qq");
export const GeomQqLine: NamedGeom<QqLineProps> = withStat("line", "qqline");
export const GeomSegment: NamedGeom<SegmentProps> = plain("segment");
export const GeomCurve: NamedGeom<CurveProps> = plain("curve");
export const GeomSpoke: NamedGeom<SpokeProps> = plain("spoke");
export const GeomRug: NamedGeom<RugProps> = plain("rug");
export const GeomContour: NamedGeom<ContourProps> = withStat(
  "segment",
  "contour",
);
export const GeomContourFilled: NamedGeom<ContourFilledProps> = withStat(
  "tile",
  "contourfilled",
);
export const GeomDensity2d: NamedGeom<ContourProps> = withStat(
  "segment",
  "density2d",
);
export const GeomDensity2dFilled: NamedGeom<ContourFilledProps> = withStat(
  "tile",
  "density2dfilled",
);
/** Quantile regression lines, colored by quantile unless color is mapped. */
export const GeomQuantile: NamedGeom<QuantileProps> = named((props) => ({
  ...props,
  geom: "line",
  mapping: props.mapping?.color
    ? props.mapping
    : { ...props.mapping, color: "quantile" },
  stat: props.stat ?? "quantile",
}));
/** Empirical cumulative distribution as an hv step function. */
export const GeomEcdf: NamedGeom<EcdfProps> = named((props) => ({
  direction: "hv",
  ...props,
  geom: "step",
  stat: props.stat ?? "ecdf",
}));
/** Points whose default position is deterministic jitter. */
export const GeomJitter: NamedGeom<PointProps> = named((props) => ({
  ...props,
  geom: "point",
  position: props.position ?? "jitter",
}));
/** Duplicate x/y tuples aggregated, sized by count unless size is set. */
export const GeomCount: NamedGeom<CountProps> = named((props) => ({
  ...props,
  geom: "point",
  mapping: props.mapping?.size || props.size !== undefined
    ? props.mapping
    : { ...props.mapping, size: "n" },
  stat: props.stat ?? "sum",
}));
export const GeomFunction: NamedGeom<FunctionProps> = withStat(
  "line",
  "function",
);
/** Trains scales and facets without drawing marks or legend keys. */
export const GeomBlank: NamedGeom<BlankProps> = plain("blank");
/** A grid-connected height field, z = f(x, y); needs a complete grid. */
export const GeomSurface: NamedGeom<SurfaceProps> = plain("surface");
/** Occupancy cells of binned 3D observations. */
export const GeomVoxel: NamedGeom<VoxelProps> = withStat("voxel", "bin3d");

// Stat-first spellings, as in the DSL.
export const StatSum: NamedGeom<CountProps> = withStat("point", "sum");
export const StatSummary: NamedGeom<SummaryProps> = withStat(
  "point",
  "summary",
);
export const StatWaffle: NamedGeom<WaffleProps> = withStat("tile", "waffle");
export const StatSummary2d: NamedGeom<SummaryBinProps> = withStat(
  "tile",
  "summary2d",
);
export const StatSummaryHex: NamedGeom<SummaryBinProps> = named((props) => ({
  ...props,
  geom: "hex",
  hex: true,
  stat: props.stat ?? "summaryhex",
}));
export const StatSummaryBin: NamedGeom<SummaryBinProps> = withStat(
  "tile",
  "summarybin",
);
export const StatEllipse: NamedGeom<EllipseProps> = withStat("line", "ellipse");
export const StatFunction: NamedGeom<FunctionProps> = GeomFunction;
export const StatConnect: NamedGeom<ConnectProps> = withStat("line", "connect");
export const StatAlign: NamedGeom<AlignProps> = named((props) => ({
  ...props,
  geom: "area",
  stat: props.stat ?? "align",
  position: props.position ?? "stack",
}));
export const StatDensity2d: NamedGeom<ContourProps> = GeomDensity2d;
export const StatDensity2dFilled: NamedGeom<ContourFilledProps> =
  GeomDensity2dFilled;
export const StatQuantile: NamedGeom<QuantileProps> = withStat(
  "line",
  "quantile",
);
export const StatEcdf: NamedGeom<EcdfProps> = withStat("step", "ecdf");
export const StatUnique: NamedGeom<PointProps> = withStat("point", "unique");

// --- literal layers --------------------------------------------------------

/** A literal layer: one synthetic frame, never the plot's data or mapping. */
function literalLayer(
  geom: GeomLayerProps["geom"],
  columns: Record<string, unknown[]>,
  rest: Record<string, unknown>,
): GeomLayerProps {
  const mapping: Aes = {};
  for (const name of Object.keys(columns)) mapping[name as AesName] = name;
  return {
    ...rest,
    geom,
    stat: "identity",
    position: "identity",
    mapping,
    data: columns,
    inheritAes: false,
  };
}

const listOf = (value: number | number[]) =>
  Array.isArray(value) ? value : [value];

/** Full-width horizontal lines at `yintercept`. */
export const GeomHline: NamedGeom<
  RefLineProps & { yintercept: number | number[] }
> = named(
  ({ yintercept, ...rest }) =>
    literalLayer("hline", { y: listOf(yintercept) }, rest),
);
/** Full-height vertical lines at `xintercept`. */
export const GeomVline: NamedGeom<
  RefLineProps & { xintercept: number | number[] }
> = named(
  ({ xintercept, ...rest }) =>
    literalLayer("vline", { x: listOf(xintercept) }, rest),
);
/** The line y = slope * x + intercept across the panel. */
export const GeomAbline: NamedGeom<
  RefLineProps & { slope?: number; intercept?: number }
> = named((props) => literalLayer("abline", {}, props));

/** Positions an annotation places literally. */
const ANNOTATE_AES = [
  "x",
  "y",
  "xend",
  "yend",
  "xmin",
  "xmax",
  "ymin",
  "ymax",
  "label",
] as const;

export type AnnotateProps =
  & ColorProps
  & FillProps
  & LineProps
  & Partial<Record<Exclude<(typeof ANNOTATE_AES)[number], "label">, number>>
  & {
    geom: "segment" | "rect" | "text" | "point";
    label?: string;
    size?: number;
    params?: Record<string, unknown>;
  };

/** A literal mark at fixed coordinates (ggplot2's annotate()). */
export const Annotate: NamedGeom<AnnotateProps> = named(
  ({ geom, ...props }) => {
    const columns: Record<string, unknown[]> = {};
    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined) continue;
      if ((ANNOTATE_AES as readonly string[]).includes(key)) {
        columns[key] = [value];
      } else rest[key] = value;
    }
    return literalLayer(geom, columns, rest);
  },
);
