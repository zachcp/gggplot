import {
  groupedLinearRegression1d,
  groupedSummary1d,
} from "@gggplot/reductions";
import type { Aes, DataFrame } from "../ir/types.ts";
import {
  columnValues,
  dataFrameFromColumns,
  numericColumnValues,
} from "../data/mod.ts";
import {
  groupColumnsOf,
  groupKeyAt,
  groupValuesAt,
  rowCount,
  sliceRows,
} from "../group/mod.ts";
import type { StatFn } from "./shared.ts";
import { encodeEffectiveGroups, encodeValueIds } from "./shared.ts";

function criticalValue(level: number): number {
  if (!Number.isFinite(level) || level <= 0 || level >= 1) {
    throw new TypeError("[gggplot] smooth level must be inside (0,1)");
  }
  // Acklam's central inverse-normal approximation is ample for visual bands.
  const p = (1 + level) / 2;
  const q = p - 0.5;
  const r = q * q;
  return (((((-39.6968302866538 * r + 220.946098424521) * r -
                275.928510446969) * r + 138.357751867269) * r -
        30.6647980661472) *
      r + 2.50662827745924) *
    q /
    (((((-54.4760987982241 * r + 161.585836858041) * r -
                  155.698979859887) * r + 66.8013118877197) * r -
          13.2806815528857) *
        r + 1);
}

function inverse3(matrix: number[][]): number[][] | null {
  const [a, b, c] = matrix[0], [d, e, f] = matrix[1], [g, h, i] = matrix[2];
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) +
    c * (d * h - e * g);
  if (Math.abs(determinant) < 1e-14) return null;
  return [
    [
      (e * i - f * h) / determinant,
      (c * h - b * i) / determinant,
      (b * f - c * e) / determinant,
    ],
    [
      (f * g - d * i) / determinant,
      (a * i - c * g) / determinant,
      (c * d - a * f) / determinant,
    ],
    [
      (d * h - e * g) / determinant,
      (b * g - a * h) / determinant,
      (a * e - b * d) / determinant,
    ],
  ];
}

function localQuadratic(
  pairs: [number, number][],
  x0: number,
  span: number,
  robust: number[],
): { fitted: number; se: number } {
  const distances = pairs.map(([x]) => Math.abs(x - x0));
  const neighborhood = Math.max(
    3,
    Math.min(pairs.length, Math.ceil(span * pairs.length)),
  );
  const bandwidth = [...distances].sort((a, b) => a - b)[neighborhood - 1] ||
    Number.EPSILON;
  const weights = distances.map((distance, row) => {
    const ratio = Math.min(1, distance / bandwidth);
    return (1 - ratio ** 3) ** 3 * robust[row];
  });
  const normal = Array.from({ length: 3 }, () => [0, 0, 0]);
  const rhs = [0, 0, 0];
  for (let row = 0; row < pairs.length; row++) {
    const dx = pairs[row][0] - x0;
    const basis = [1, dx, dx * dx];
    for (let j = 0; j < 3; j++) {
      rhs[j] += weights[row] * basis[j] * pairs[row][1];
      for (let k = 0; k < 3; k++) {
        normal[j][k] += weights[row] * basis[j] * basis[k];
      }
    }
  }
  const inverse = inverse3(normal);
  if (!inverse) {
    const weighted = weights.reduce(
      (sum, weight, row) => sum + weight * pairs[row][1],
      0,
    );
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return { fitted: total ? weighted / total : pairs[0][1], se: 0 };
  }
  const beta = inverse.map((row) =>
    row.reduce((sum, value, column) => sum + value * rhs[column], 0)
  );
  let sse = 0, active = 0;
  for (let row = 0; row < pairs.length; row++) {
    if (weights[row] <= 0) continue;
    const dx = pairs[row][0] - x0;
    const residual = pairs[row][1] -
      (beta[0] + beta[1] * dx + beta[2] * dx * dx);
    sse += weights[row] * residual * residual;
    active++;
  }
  return {
    fitted: beta[0],
    se: Math.sqrt(Math.max(0, sse / Math.max(1, active - 3) * inverse[0][0])),
  };
}

function smoothLoess(
  pairs: [number, number][],
  params: Record<string, unknown>,
): DataFrame {
  const distinct = new Set(pairs.map(([x]) => x));
  if (distinct.size < 3) {
    throw new TypeError(
      "[gggplot] loess requires at least 3 finite distinct x values",
    );
  }
  const span = Number(params.span ?? 0.75);
  if (!Number.isFinite(span) || span <= 0 || span > 1) {
    throw new TypeError("[gggplot] loess span must be inside (0,1]");
  }
  const iterations = Number(params.robustIterations ?? 2);
  if (!Number.isInteger(iterations) || iterations < 0) {
    throw new TypeError(
      "[gggplot] loess robustIterations must be a non-negative integer",
    );
  }
  let robust = pairs.map(() => 1);
  for (let iteration = 0; iteration < iterations; iteration++) {
    const residuals = pairs.map(([x, y]) =>
      Math.abs(y - localQuadratic(pairs, x, span, robust).fitted)
    );
    const median = sampleQuantile(residuals, 0.5);
    if (median <= Number.EPSILON) break;
    robust = residuals.map((residual) => {
      const ratio = Math.min(1, residual / (6 * median));
      return (1 - ratio * ratio) ** 2;
    });
  }
  const n = Number(params.n ?? 80);
  if (!Number.isInteger(n) || n < 2) {
    throw new TypeError("[gggplot] smooth n must be an integer of at least 2");
  }
  const lo = Math.min(...pairs.map(([x]) => x)),
    hi = Math.max(...pairs.map(([x]) => x));
  const xs = Array.from(
    { length: n },
    (_, index) => lo + (hi - lo) * index / (n - 1),
  );
  const fits = xs.map((x) => localQuadratic(pairs, x, span, robust));
  const z = criticalValue(Number(params.level ?? 0.95));
  return dataFrameFromColumns({
    smoothx: xs,
    y: fits.map(({ fitted }) => fitted),
    ...(params.se === false ? {} : {
      ymin: fits.map(({ fitted, se }) => fitted - z * se),
      ymax: fits.map(({ fitted, se }) => fitted + z * se),
    }),
  });
}

function smoothGlm(
  pairs: [number, number][],
  params: Record<string, unknown>,
): DataFrame {
  if (
    (params.family ?? "binomial") !== "binomial" ||
    (params.link ?? "logit") !== "logit"
  ) {
    throw new TypeError(
      '[gggplot] glm supports only family "binomial" with link "logit"',
    );
  }
  if (pairs.some(([, y]) => y !== 0 && y !== 1)) {
    throw new TypeError("[gggplot] binomial glm y values must be 0 or 1");
  }
  const maxIterations = Number(params.maxIterations ?? 50),
    tolerance = Number(params.tolerance ?? 1e-8);
  if (
    !Number.isInteger(maxIterations) || maxIterations < 1 ||
    !Number.isFinite(tolerance) || tolerance <= 0
  ) {
    throw new TypeError("[gggplot] glm convergence controls are invalid");
  }
  let intercept = 0,
    slope = 0,
    covariance: [[number, number], [number, number]] = [[1, 0], [0, 1]];
  let converged = false;
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let s0 = 0, s1 = 0, s2 = 0, t0 = 0, t1 = 0;
    for (const [x, y] of pairs) {
      const eta = Math.max(-30, Math.min(30, intercept + slope * x));
      const mu = 1 / (1 + Math.exp(-eta));
      const weight = Math.max(1e-9, mu * (1 - mu));
      const working = eta + (y - mu) / weight;
      s0 += weight;
      s1 += weight * x;
      s2 += weight * x * x;
      t0 += weight * working;
      t1 += weight * x * working;
    }
    const determinant = s0 * s2 - s1 * s1;
    if (Math.abs(determinant) < 1e-14) {
      throw new TypeError("[gggplot] glm design matrix is singular");
    }
    const nextIntercept = (t0 * s2 - t1 * s1) / determinant;
    const nextSlope = (t1 * s0 - t0 * s1) / determinant;
    covariance = [[s2 / determinant, -s1 / determinant], [
      -s1 / determinant,
      s0 / determinant,
    ]];
    if (
      Math.max(
        Math.abs(nextIntercept - intercept),
        Math.abs(nextSlope - slope),
      ) < tolerance
    ) converged = true;
    intercept = nextIntercept;
    slope = nextSlope;
    if (converged) break;
  }
  if (!converged) {
    throw new TypeError(
      `[gggplot] glm failed to converge in ${maxIterations} iterations`,
    );
  }
  const n = Number(params.n ?? 80);
  if (!Number.isInteger(n) || n < 2) {
    throw new TypeError("[gggplot] smooth n must be an integer of at least 2");
  }
  const lo = Math.min(...pairs.map(([x]) => x)),
    hi = Math.max(...pairs.map(([x]) => x));
  const xs = Array.from(
    { length: n },
    (_, index) => lo + (hi - lo) * index / (n - 1),
  );
  const z = criticalValue(Number(params.level ?? 0.95));
  const logistic = (value: number) =>
    1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))));
  const eta = xs.map((x) => intercept + slope * x);
  const se = xs.map((x) =>
    Math.sqrt(
      Math.max(
        0,
        covariance[0][0] + 2 * x * covariance[0][1] + x * x * covariance[1][1],
      ),
    )
  );
  return dataFrameFromColumns({
    smoothx: xs,
    y: eta.map(logistic),
    ...(params.se === false ? {} : {
      ymin: eta.map((value, index) => logistic(value - z * se[index])),
      ymax: eta.map((value, index) => logistic(value + z * se[index])),
    }),
  });
}

function sampleQuantile(values: number[], probability: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lo = Math.floor(index), hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

function pinballFit(
  pairs: [number, number][],
  probability: number,
): [number, number] {
  const xs = pairs.map(([x]) => x), ys = pairs.map(([, y]) => y);
  if (Math.min(...xs) === Math.max(...xs)) {
    return [sampleQuantile(ys, probability), 0];
  }
  const candidates: [number, number][] = [[sampleQuantile(ys, probability), 0]];
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const dx = pairs[j][0] - pairs[i][0];
      if (dx === 0) continue;
      const slope = (pairs[j][1] - pairs[i][1]) / dx;
      candidates.push([pairs[i][1] - slope * pairs[i][0], slope]);
    }
  }
  const loss = ([intercept, slope]: [number, number]) =>
    pairs.reduce((sum, [x, y]) => {
      const residual = y - intercept - slope * x;
      return sum +
        (residual >= 0 ? probability * residual : (probability - 1) * residual);
    }, 0);
  return candidates.reduce((best, candidate) => {
    const delta = loss(candidate) - loss(best);
    return delta < -1e-12 ||
        (Math.abs(delta) <= 1e-12 && (candidate[1] < best[1] ||
          (candidate[1] === best[1] && candidate[0] < best[0])))
      ? candidate
      : best;
  });
}

export const statQuantileProduct: StatFn = (data, mapping, params) => {
  if (params.method !== undefined && params.method !== "rq") {
    throw new TypeError('[gggplot] stat quantile method must be "rq"');
  }
  const requested = params.quantiles ?? [0.25, 0.5, 0.75];
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new TypeError(
      "[gggplot] quantiles must be a non-empty sorted array inside (0,1)",
    );
  }
  const quantiles = requested.map(Number);
  if (
    quantiles.some((q, i) =>
      !Number.isFinite(q) || q <= 0 || q >= 1 ||
      (i > 0 && q <= quantiles[i - 1])
    )
  ) {
    throw new TypeError(
      "[gggplot] quantiles must be a non-empty sorted array inside (0,1)",
    );
  }
  const xCol = mapping.x, yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) {
    throw new TypeError(
      "[gggplot] stat quantile requires numeric x and y mappings",
    );
  }
  const groupCols = groupColumnsOf(mapping, data).filter((column) =>
    column !== xCol && column !== yCol && column !== "quantile"
  );
  const xs = numericColumnValues(data, xCol),
    ys = numericColumnValues(data, yCol);
  const grouped = new Map<
    string,
    { pairs: [number, number][]; values: Record<string, unknown> }
  >();
  for (let row = 0; row < Math.min(xs.length, ys.length); row++) {
    const x = xs[row], y = ys[row];
    if (
      typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" ||
      !Number.isFinite(y)
    ) continue;
    const key = groupKeyAt(data, groupCols, row);
    const group = grouped.get(key) ??
      { pairs: [], values: groupValuesAt(data, groupCols, row) };
    group.pairs.push([x, y]);
    grouped.set(key, group);
  }
  const out: Record<string, unknown[]> = {
    quantilex: [],
    quantiley: [],
    quantile: [],
    quantileGroup: [],
  };
  for (const column of groupCols) out[column] = [];
  for (const [groupKey, group] of grouped) {
    if (group.pairs.length < 2) {
      throw new TypeError(
        "[gggplot] stat quantile requires at least two finite rows per group",
      );
    }
    const lo = Math.min(...group.pairs.map(([x]) => x)),
      hi = Math.max(...group.pairs.map(([x]) => x));
    for (const q of quantiles) {
      const [intercept, slope] = pinballFit(group.pairs, q);
      out.quantilex.push(lo, hi);
      out.quantiley.push(intercept + slope * lo, intercept + slope * hi);
      out.quantile.push(q, q);
      out.quantileGroup.push(`${groupKey}:${q}`, `${groupKey}:${q}`);
      for (const column of groupCols) {
        out[column].push(group.values[column], group.values[column]);
      }
    }
  }
  return {
    data: dataFrameFromColumns(out),
    mapping: {
      ...mapping,
      x: "quantilex",
      y: "quantiley",
      group: "quantileGroup",
    },
  };
};

/**
 * Fit a trend line through (x, y) and re-emit it as `params.n` (default 80)
 * evenly spaced points spanning x's data range, replacing x's column values
 * (bin-center style, like stat_bin) and producing new `y`, and — unless
 * `params.se === false` — `ymin`/`ymax` columns for a 95%-ish confidence
 * ribbon, mapped onto y/ymin/ymax (overriding any prior mapping, since the
 * fitted point count differs from the input row count).
 *
 * Supported methods are ordinary least-squares (`lm`), one-dimensional robust
 * local quadratic regression (`loess`), and binomial/logit IRLS (`glm`). The
 * core deliberately rejects `gam`: a GAM backend belongs behind the portable
 * extension registry because it requires a substantially larger solver.
 *
 * The confidence band uses the standard OLS prediction-interval formula
 * `se(ŷ) = s * sqrt(1/n + (x - x̄)² / Sxx)` with an inverse-normal critical
 * value for `level`, rather than the exact Student's-t value for level/df — a
 * large-sample approximation, slightly narrower than ggplot2's CI for small n.
 */
export function smoothGroup(
  data: DataFrame,
  mapping: Aes,
  params: Record<string, unknown>,
): DataFrame | null {
  const xCol = mapping.x;
  const yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) return null;

  const pairs: [number, number][] = [];
  const rawX = numericColumnValues(data, xCol);
  const rawY = numericColumnValues(data, yCol);
  const n = Math.min(rawX.length, rawY.length);
  for (let i = 0; i < n; i++) {
    const x = rawX[i];
    const y = rawY[i];
    if (x != null && y != null) pairs.push([x, y]);
  }
  if (pairs.length < 2) return null;

  const method = String(params.method ?? "lm");
  if (params.formula !== undefined && params.formula !== "y~x") {
    throw new TypeError('[gggplot] smooth supports only formula "y~x"');
  }
  if (method === "gam") {
    throw new TypeError(
      '[gggplot] smooth method "gam" requires an extension-registry adapter; core supports lm, loess, and glm',
    );
  }
  if (method !== "lm" && method !== "loess" && method !== "glm") {
    throw new TypeError(
      `[gggplot] smooth method "${method}" is unsupported; choose lm, loess, or glm`,
    );
  }
  if (method === "loess" || method === "glm") {
    const fitted = method === "loess"
      ? smoothLoess(pairs, params)
      : smoothGlm(pairs, params);
    const xCol = mapping.x!;
    return dataFrameFromColumns({
      [xCol]: columnValues(fitted, "smoothx"),
      y: columnValues(fitted, "y"),
      ...(params.se === false ? {} : {
        ymin: columnValues(fitted, "ymin"),
        ymax: columnValues(fitted, "ymax"),
      }),
    });
  }

  const m = pairs.length;
  const regression = groupedLinearRegression1d({
    x: new Float64Array(pairs.map(([x]) => x)),
    y: new Float64Array(pairs.map(([, y]) => y)),
  });
  const slope = regression.slope[0];
  const intercept = regression.intercept[0];
  const xbar = regression.sumX[0] / m;
  const sxx = regression.sumXX[0] - regression.sumX[0] ** 2 / m;
  const sse = regression.sumYY[0] -
    2 * intercept * regression.sumY[0] -
    2 * slope * regression.sumXY[0] +
    m * intercept ** 2 +
    2 * intercept * slope * regression.sumX[0] +
    slope ** 2 * regression.sumXX[0];
  const s2 = m > 2 ? sse / (m - 2) : 0;

  const se = params.se !== false;
  const numPoints = Number(params.n ?? 80);
  if (!Number.isInteger(numPoints) || numPoints < 2) {
    throw new TypeError("[gggplot] smooth n must be an integer of at least 2");
  }
  const xs = pairs.map(([x]) => x);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const step = numPoints > 1 ? (hi - lo) / (numPoints - 1) : 0;

  const fittedX: number[] = [];
  const fittedY: number[] = [];
  const ymin: number[] = [];
  const ymax: number[] = [];
  const Z = criticalValue(Number(params.level ?? 0.95));
  for (let i = 0; i < numPoints; i++) {
    const x = lo + i * step;
    const y = intercept + slope * x;
    fittedX.push(x);
    fittedY.push(y);
    if (se) {
      const seY = Math.sqrt(
        Math.max(0, s2) * (1 / m + (sxx > 0 ? (x - xbar) ** 2 / sxx : 0)),
      );
      ymin.push(y - Z * seY);
      ymax.push(y + Z * seY);
    }
  }

  return dataFrameFromColumns({
    [xCol]: fittedX,
    y: fittedY,
    ...(se ? { ymin, ymax } : {}),
  });
}

export const statSmooth: StatFn = (data, mapping, params) => {
  const xCol = mapping.x;
  const yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) {
    console.warn(
      `[gggplot] stat "smooth" requires x and y mappings; falling back to identity`,
    );
    return { data, mapping };
  }

  const se = params.se !== false;
  const groupCols = groupColumnsOf(mapping, data);
  const grouped = new Map<
    string,
    { indices: number[]; values: Record<string, unknown> }
  >();
  const n = rowCount(data);
  for (let i = 0; i < n; i++) {
    const key = groupKeyAt(data, groupCols, i);
    let group = grouped.get(key);
    if (!group) {
      group = { indices: [], values: groupValuesAt(data, groupCols, i) };
      grouped.set(key, group);
    }
    group.indices.push(i);
  }

  const out: Record<string, unknown[]> = {
    [xCol]: [],
    y: [],
    ...(se ? { ymin: [], ymax: [] } : {}),
  };
  for (const col of groupCols) out[col] = [];

  for (const group of grouped.values()) {
    const groupData = sliceRows(data, group.indices);
    const fitted = smoothGroup(groupData, mapping, params);
    if (!fitted) continue;
    const m = columnValues(fitted, xCol).length;
    for (const col of Object.keys(fitted)) {
      out[col].push(...columnValues(fitted, col));
    }
    for (const col of groupCols) {
      (out[col] as unknown[]).push(...new Array(m).fill(group.values[col]));
    }
  }

  if (out[xCol].length === 0) return { data, mapping };

  return {
    data: dataFrameFromColumns(out),
    mapping: {
      ...mapping,
      y: "y",
      ...(se ? { ymin: "ymin", ymax: "ymax" } : {}),
    },
  };
};

const AGGREGATORS: Record<string, (values: number[]) => number> = {
  mean: (vs) => vs.reduce((a, b) => a + b, 0) / vs.length,
  median: (vs) => {
    const sorted = [...vs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  },
  sum: (vs) => vs.reduce((a, b) => a + b, 0),
  min: (vs) => Math.min(...vs),
  max: (vs) => Math.max(...vs),
};

/**
 * Aggregate y per distinct x value with `params.fun` (default "mean"; also
 * "median"/"sum"/"min"/"max", or a custom `(values: number[]) => number`),
 * replacing y's values in place — one aggregated row per x level, in
 * first-seen order. Pairs with geom_point/geom_line/geom_col etc. (ggplot2
 * defaults stat_summary to geom_pointrange, which this codebase doesn't
 * implement; use e.g. `geomPoint({ stat: "summary" })` instead).
 */
export const statSummary: StatFn = (data, mapping, params) => {
  const xCol = mapping.x;
  const yCol = mapping.y;
  if (!xCol || !yCol || !(xCol in data) || !(yCol in data)) {
    console.warn(
      `[gggplot] stat "summary" requires x and y mappings; falling back to identity`,
    );
    return { data, mapping };
  }

  const fun = params.fun as string | ((values: number[]) => number) | undefined;
  const groupCols = groupColumnsOf(mapping, data);

  if (typeof fun !== "function") {
    const metric = fun ?? "mean";
    const known = new Set(["mean", "median", "sum", "min", "max"]);
    if (!known.has(metric)) {
      console.warn(
        `[gggplot] stat "summary" fun "${fun}" not recognized; using "mean"`,
      );
    }
    const selected = known.has(metric) ? metric : "mean";
    const xs = columnValues(data, xCol);
    const ys = numericColumnValues(data, yCol);
    const n = Math.min(xs.length, ys.length);
    const rowIndices = Array.from({ length: n }, (_, i) => i);
    const encodedX = encodeValueIds(xs.slice(0, n));
    const groups = encodeEffectiveGroups(mapping, data, rowIndices);
    const reduced = groupedSummary1d({
      xIds: encodedX.ids,
      xCount: encodedX.values.length,
      values: new Float64Array(
        Array.from({ length: n }, (_, i) => ys[i] ?? Number.NaN),
      ),
      groupIds: groups.ids,
      groupsCount: groups.values.length,
      includeMedian: selected === "median",
    });

    const observed = new Uint8Array(reduced.groupsCount * reduced.xCount);
    for (let i = 0; i < n; i++) {
      const group = groups.ids?.[i] ?? 0;
      observed[group * reduced.xCount + encodedX.ids[i]] = 1;
    }

    const xOut: unknown[] = [];
    const yOut: number[] = [];
    const groupOut: Record<string, unknown[]> = Object.fromEntries(
      groups.columns.map((col) => [col, []]),
    );
    const valuesByMetric = {
      mean: reduced.means,
      median: reduced.medians,
      sum: reduced.sums,
      min: reduced.mins,
      max: reduced.maxs,
    } as const;
    const values = valuesByMetric[selected as keyof typeof valuesByMetric];
    for (let group = 0; group < reduced.groupsCount; group++) {
      for (let x = 0; x < reduced.xCount; x++) {
        const offset = group * reduced.xCount + x;
        if (!observed[offset]) continue;
        xOut.push(encodedX.values[x]);
        yOut.push(values[offset]);
        for (const col of groups.columns) {
          groupOut[col].push(groups.values[group][col]);
        }
      }
    }

    return {
      data: dataFrameFromColumns({
        [xCol]: xOut,
        ...groupOut,
        [yCol]: yOut,
      }),
      mapping,
    };
  }

  const aggregate = typeof fun === "function"
    ? fun
    : AGGREGATORS[fun ?? "mean"];
  if (!aggregate) {
    console.warn(
      `[gggplot] stat "summary" fun "${fun}" not recognized; using "mean"`,
    );
  }
  const agg = aggregate ?? AGGREGATORS.mean;

  const groups = new Map<
    string,
    { x: unknown; groupValues: Record<string, unknown>; values: number[] }
  >();
  const xs = columnValues(data, xCol);
  const ys = numericColumnValues(data, yCol);
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    const key = `${String(xs[i])}\0${groupKeyAt(data, groupCols, i)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        x: xs[i],
        groupValues: groupValuesAt(data, groupCols, i),
        values: [],
      });
    }
    const y = ys[i];
    if (y != null) groups.get(key)!.values.push(y);
  }

  const rows = [...groups.values()];
  return {
    data: dataFrameFromColumns({
      [xCol]: rows.map((row) => row.x),
      ...Object.fromEntries(
        groupCols.map((col) => [col, rows.map((row) => row.groupValues[col])]),
      ),
      [yCol]: rows.map((row) => agg(row.values)),
    }),
    mapping,
  };
};
