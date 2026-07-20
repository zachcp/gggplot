// Statistical transform dispatch and public family exports.
import type { Aes, Layer } from "../ir/types.ts";
import { ingest, type InputData } from "../data/mod.ts";
import {
  statBin,
  statCount,
  statEcdfProduct,
  statSumProduct,
  statUniqueProduct,
  statWaffleProduct,
} from "./binning.ts";
import { statSmooth } from "./smoothing.ts";
import { statQuantileProduct } from "./quantile.ts";
import { statSummary } from "./summary.ts";
import {
  statBin2d,
  statBoxplot,
  statDensityAxis,
  statDotplot,
  statSummary2d,
} from "./distributions.ts";
import {
  statConnectProduct,
  statEllipse,
  statFunctionProduct,
  statQqProduct,
} from "./analytic.ts";
import {
  statContour,
  statContourFilled,
  statDensity2dProduct,
} from "./contours.ts";
import { type StatFn, statIdentity, type StatResult } from "./shared.ts";
import { statAlign } from "./alignment.ts";

export {
  createStatBinProductPlan,
  type StatBinPlanOptions,
} from "./bin_plan.ts";
export {
  createStatCountProductPlan,
  type StatCountPlanOptions,
} from "./count_plan.ts";
export * from "./shared.ts";
export * from "./binning.ts";
export * from "./smoothing.ts";
export * from "./quantile.ts";
export * from "./summary.ts";
export * from "./distributions.ts";
export * from "./analytic.ts";
export * from "./contours.ts";
export * from "./alignment.ts";

const REGISTRY: Record<Layer["stat"], StatFn> = {
  identity: statIdentity,
  count: statCount,
  sum: statSumProduct,
  bin: statBin,
  smooth: statSmooth,
  summary: statSummary,
  boxplot: statBoxplot,
  density: statDensityAxis("x"),
  ydensity: statDensityAxis("y"),
  dotplot: statDotplot,
  bin2d: statBin2d,
  binhex: statBin2d,
  summary2d: statSummary2d,
  summaryhex: statSummary2d,
  summarybin: statSummary2d,
  qq: statQqProduct(false),
  qqline: statQqProduct(true),
  ellipse: statEllipse,
  function: statFunctionProduct,
  contour: statContour,
  contourfilled: statContourFilled,
  density2d: statDensity2dProduct(false),
  density2dfilled: statDensity2dProduct(true),
  quantile: statQuantileProduct,
  ecdf: statEcdfProduct,
  unique: statUniqueProduct,
  connect: statConnectProduct,
  align: statAlign,
  waffle: statWaffleProduct,
};

export function applyStat(
  layer: Layer,
  mapping: Aes,
  data: InputData,
): StatResult {
  return REGISTRY[layer.stat](ingest(data), mapping, layer.params);
}
