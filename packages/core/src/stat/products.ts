// Stats as products behind one interface (gggplot-l82, ADR-007 decision 6).
//
// Every stat is a CPU product: a named, versioned transform from a layer's
// rows to its stat output. stat_count and stat_bin are ALSO GPU products
// (@gggplot/reductions' ProductSpecs, mounted by runtime/product_kernels.ts).
// A consumer asks statProduct() for a stat and gets one of the two shapes:
// the CPU form runs synchronously and is ready at once; the GPU form names a
// spec the product tier mounts, whose answer arrives through its generation.
//
// Scale-limit censoring and position transforms stay BEFORE the stat (vnh.15
// finding 3): a product only ever sees rows that compile/prepareLayer has
// already filtered.
import type { ProductSpec } from "@gggplot/reductions";
import {
  COUNT_GRID_PRODUCT,
  DOMAIN_1D_PRODUCT,
  HISTOGRAM_GRID_PRODUCT,
} from "@gggplot/reductions";
import {
  type Column,
  columnVersion,
  ingest,
  type InputData,
} from "../data/mod.ts";
import type { Aes, Layer, StatKind } from "../ir/types.ts";
import type { StatFn, StatResult } from "./shared.ts";

/** A stat run on the CPU, synchronously. */
export interface CpuStatProduct {
  id: string;
  executor: "cpu";
  stat: StatKind;
  run: (
    data: InputData,
    mapping: Aes,
    params: Record<string, unknown>,
  ) => StatResult;
}

/** A stat run on the GPU by the product tier, from a ProductSpec. */
export interface GpuStatProduct {
  id: string;
  executor: "gpu";
  stat: StatKind;
  /** The grid the stat produces. */
  spec: ProductSpec;
  /** A stage whose answer sizes `spec` first (stat_bin's auto-domain). */
  stage?: ProductSpec;
}

export type StatProduct = CpuStatProduct | GpuStatProduct;

/** Wraps a stat function as its CPU product. */
export function cpuStatProduct(stat: StatKind, fn: StatFn): CpuStatProduct {
  return {
    id: `@gggplot/core:stat_${stat}@1`,
    executor: "cpu",
    stat,
    run: (data, mapping, params) => fn(ingest(data), mapping, params),
  };
}

/** The GPU products, keyed by stat. Everything else is CPU-only. */
export const GPU_STAT_PRODUCTS: Partial<Record<StatKind, GpuStatProduct>> = {
  count: {
    id: "@gggplot/core:stat_count_gpu@1",
    executor: "gpu",
    stat: "count",
    spec: COUNT_GRID_PRODUCT,
  },
  bin: {
    id: "@gggplot/core:stat_bin_gpu@1",
    executor: "gpu",
    stat: "bin",
    spec: HISTOGRAM_GRID_PRODUCT,
    stage: DOMAIN_1D_PRODUCT,
  },
};

/**
 * The product for a stat: the GPU form when one exists and is preferred,
 * else the CPU form, which every stat has.
 */
export function statProduct(
  cpu: Readonly<Record<StatKind, CpuStatProduct>>,
  stat: StatKind,
  preferGpu = false,
): StatProduct {
  const gpu = preferGpu ? GPU_STAT_PRODUCTS[stat] : undefined;
  return gpu ?? cpu[stat];
}

/**
 * A memo of CPU stat runs per input version. A run is reused when the stat,
 * its params and mapping, and every input column (by identity and version)
 * are unchanged, so re-preparing a layer whose rows did not change reruns no
 * stat. Columns are held weakly.
 */
export interface CpuStatCache {
  run: (
    product: CpuStatProduct,
    layer: Layer,
    mapping: Aes,
    data: InputData,
  ) => StatResult;
  /** Runs actually executed (cache misses), for tests and probes. */
  readonly misses: number;
}

export function createCpuStatCache(): CpuStatCache {
  // Keyed on the frame's first column, the rest of the key in a string that
  // folds in every column's identity token and version.
  const tokens = new WeakMap<Column, number>();
  let nextToken = 1;
  const tokenOf = (column: Column) => {
    let token = tokens.get(column);
    if (!token) tokens.set(column, token = nextToken++);
    return token;
  };
  const entries = new WeakMap<Column, Map<string, StatResult>>();
  const unrooted = new Map<string, StatResult>();
  const cache = {
    misses: 0,
    run(
      product: CpuStatProduct,
      layer: Layer,
      mapping: Aes,
      data: InputData,
    ): StatResult {
      const frame = ingest(data);
      const columns = Object.entries(frame).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0
      );
      let paramsKey: string;
      try {
        paramsKey = JSON.stringify(layer.params);
      } catch {
        // Unserializable params (a custom function) are never memoized.
        cache.misses++;
        return product.run(frame, mapping, layer.params);
      }
      if (Object.values(layer.params).some((v) => typeof v === "function")) {
        cache.misses++;
        return product.run(frame, mapping, layer.params);
      }
      const key = [
        product.id,
        paramsKey,
        JSON.stringify(mapping),
        ...columns.map(([name, column]) =>
          `${name}:${tokenOf(column)}:${columnVersion(column)}`
        ),
      ].join("|");
      const root = columns[0]?.[1];
      const bucket = root
        ? entries.get(root) ?? (() => {
          const m = new Map<string, StatResult>();
          entries.set(root, m);
          return m;
        })()
        : unrooted;
      const hit = bucket.get(key);
      if (hit) return hit;
      cache.misses++;
      const result = product.run(frame, mapping, layer.params);
      bucket.set(key, result);
      return result;
    },
  };
  return cache;
}
