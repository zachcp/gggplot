export interface GroupedCount1DInput {
  valueIds: Uint32Array;
  valuesCount: number;
  groupIds?: Uint32Array;
  groupsCount?: number;
}

export interface GroupedCount1DResult {
  counts: Uint32Array;
  valuesCount: number;
  groupsCount: number;
  shape: [number, number];
  backend: "cpu";
}

export interface GroupedHistogram1DInput {
  values: Float32Array;
  lo: number;
  hi: number;
  bins?: number;
  binwidth?: number;
  groupIds?: Uint32Array;
  groupsCount?: number;
}

export interface GroupedHistogram1DResult {
  counts: Uint32Array;
  density: Float32Array;
  centers: Float32Array;
  totals: Uint32Array;
  lo: number;
  hi: number;
  binwidth: number;
  bins: number;
  groupsCount: number;
  shape: [number, number];
  backend: "cpu" | "webgpu";
}

export interface GroupedSummary1DInput {
  xIds: Uint32Array;
  xCount: number;
  values: Float64Array | Float32Array;
  groupIds?: Uint32Array;
  groupsCount?: number;
  includeMedian?: boolean;
}

export interface GroupedSummary1DResult {
  counts: Uint32Array;
  sums: Float64Array;
  means: Float64Array;
  mins: Float64Array;
  maxs: Float64Array;
  medians: Float64Array;
  xCount: number;
  groupsCount: number;
  shape: [number, number];
  backend: "cpu";
}

export interface GroupedLinearRegression1DInput {
  x: Float64Array | Float32Array;
  y: Float64Array | Float32Array;
  groupIds?: Uint32Array;
  groupsCount?: number;
}

export interface GroupedLinearRegression1DResult {
  counts: Uint32Array;
  sumX: Float64Array;
  sumY: Float64Array;
  sumXX: Float64Array;
  sumXY: Float64Array;
  sumYY: Float64Array;
  slope: Float64Array;
  intercept: Float64Array;
  backend: "cpu";
}

export interface GroupedBoxplot1DInput {
  values: Float64Array | Float32Array;
  groupIds?: Uint32Array;
  groupsCount?: number;
  coef?: number;
}

export interface GroupedBoxplot1DResult {
  counts: Uint32Array;
  lower: Float64Array;
  q1: Float64Array;
  median: Float64Array;
  q3: Float64Array;
  upper: Float64Array;
  outlierValues: Float64Array;
  outlierGroups: Uint32Array;
  groupsCount: number;
  backend: "cpu";
}

export interface GroupedDensity1DInput {
  values: Float64Array | Float32Array;
  lo: number;
  hi: number;
  points?: number;
  bandwidth?: number;
  groupIds?: Uint32Array;
  groupsCount?: number;
}

export interface GroupedDensity1DResult {
  centers: Float64Array;
  density: Float64Array;
  totals: Uint32Array;
  lo: number;
  hi: number;
  bandwidth: number;
  points: number;
  groupsCount: number;
  shape: [number, number];
  backend: "cpu";
}

export interface GroupedHistogram2DInput {
  x: Float32Array;
  y: Float32Array;
  xLo: number;
  xHi: number;
  yLo: number;
  yHi: number;
  xBins?: number;
  yBins?: number;
  groupIds?: Uint32Array;
  groupsCount?: number;
}

export interface GroupedHistogram2DResult {
  counts: Uint32Array;
  xCenters: Float32Array;
  yCenters: Float32Array;
  totals: Uint32Array;
  xLo: number;
  xHi: number;
  yLo: number;
  yHi: number;
  xBins: number;
  yBins: number;
  groupsCount: number;
  shape: [number, number, number];
  backend: "cpu" | "webgpu";
}

export interface GpuReductionTimings {
  uploadMs: number;
  dispatchMs: number;
  readbackMs: number;
  totalMs: number;
}

export interface GpuGroupedHistogram1DResult extends GroupedHistogram1DResult {
  backend: "webgpu";
  timings: GpuReductionTimings;
}

export interface GpuGroupedHistogram2DResult extends GroupedHistogram2DResult {
  backend: "webgpu";
  timings: GpuReductionTimings;
}

export interface WgpuKernelPlan {
  kind: "grouped-histogram-1d" | "grouped-histogram-2d";
  workgroupSize: number;
  dispatchSize: number;
  countsLength: number;
  shaders: {
    clearU32: string;
    groupedHistogram1D: string;
    groupedHistogram2D?: string;
    histogramBarVertices?: string;
    histogramSummary?: string;
  };
}
