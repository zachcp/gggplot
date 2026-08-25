// stat_bin_3d — sparse occupancy binning on a 3D lattice.
// Contract: docs/DESIGN_3D_BIN_PRODUCT.md
import { dataFrameFromColumns, numericColumnValues } from "../data/mod.ts";
import type { StatFn } from "./shared.ts";

/** Per-axis width and origin resolved from bins/binwidth/boundary. */
interface AxisBinning {
  width: number;
  origin: number;
}

function triple<T>(value: unknown, index: number): T | undefined {
  if (Array.isArray(value)) return value[index] as T | undefined;
  return value as T | undefined;
}

function resolveAxis(
  values: number[],
  params: Record<string, unknown>,
  index: number,
): AxisBinning {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const requestedWidth = Number(triple<number>(params.binwidth, index));
  const bins = Math.max(1, Number(triple<number>(params.bins, index) ?? 30));
  // A degenerate extent collapses to one bin rather than dividing by zero.
  const span = hi - lo;
  const width = Number.isFinite(requestedWidth) && requestedWidth > 0
    ? requestedWidth
    : span > 0
    ? span / bins
    : 1;
  const boundary = Number(triple<number>(params.boundary, index));
  const origin = Number.isFinite(boundary)
    ? boundary + Math.floor((lo - boundary) / width) * width
    : lo;
  return { width, origin };
}

/**
 * Bin observations into 3D lattice cells, emitting one row per OCCUPIED cell.
 *
 * The product is sparse by design: a dense lattice at the 2D default of 30
 * bins per axis is 27,000 cells, overwhelmingly empty on real data. Absence
 * therefore means "no observations landed here", never zero.
 */
export const statBin3d: StatFn = (data, mapping, params) => {
  const xCol = mapping.x, yCol = mapping.y, zCol = mapping.z;
  if (
    !xCol || !yCol || !zCol || !(xCol in data) || !(yCol in data) ||
    !(zCol in data)
  ) {
    throw new TypeError(
      "[gggplot] stat_bin_3d requires numeric x, y, and z mappings",
    );
  }
  if (params.weight !== undefined) {
    throw new TypeError("[gggplot] stat_bin_3d does not support weights in V1");
  }

  const xs = numericColumnValues(data, xCol);
  const ys = numericColumnValues(data, yCol);
  const zs = numericColumnValues(data, zCol);
  // Missing positions are dropped before binning, never binned into a
  // "missing" cell. ingest() turns NaN into null, so the null check is the
  // one that actually fires (see gggplot-ybv).
  const rows: number[] = [];
  const length = Math.min(xs.length, ys.length, zs.length);
  for (let row = 0; row < length; row++) {
    if (
      [xs[row], ys[row], zs[row]].every((value) =>
        typeof value === "number" && Number.isFinite(value)
      )
    ) rows.push(row);
  }

  const empty = () => ({
    data: dataFrameFromColumns({ [xCol]: [], [yCol]: [], [zCol]: [], count: [] }),
    mapping: {
      ...mapping,
      ...(mapping.fill || params.fill !== undefined ? {} : { fill: "count" }),
    },
  });
  if (!rows.length) return empty();

  const xValues = rows.map((row) => xs[row] as number);
  const yValues = rows.map((row) => ys[row] as number);
  const zValues = rows.map((row) => zs[row] as number);
  const axes = [
    resolveAxis(xValues, params, 0),
    resolveAxis(yValues, params, 1),
    resolveAxis(zValues, params, 2),
  ];

  const indexOf = (value: number, axis: AxisBinning) =>
    Math.floor((value - axis.origin) / axis.width);

  interface Cell {
    xi: number;
    yi: number;
    zi: number;
    count: number;
  }
  const cells = new Map<string, Cell>();
  for (let i = 0; i < rows.length; i++) {
    const xi = indexOf(xValues[i], axes[0]);
    const yi = indexOf(yValues[i], axes[1]);
    const zi = indexOf(zValues[i], axes[2]);
    const key = `${xi}|${yi}|${zi}`;
    const cell = cells.get(key) ?? { xi, yi, zi, count: 0 };
    cell.count++;
    cells.set(key, cell);
  }

  const center = (index: number, axis: AxisBinning) =>
    axis.origin + (index + 0.5) * axis.width;
  // Density divides by cell VOLUME. An area divisor still yields a plausible
  // number — monotone in count, internally consistent — and is wrong by a
  // factor with units of length.
  const volume = axes[0].width * axes[1].width * axes[2].width;
  const total = rows.length;

  const out: Record<string, unknown[]> = {
    [xCol]: [],
    [yCol]: [],
    [zCol]: [],
    count: [],
    density: [],
    // The design doc wanted the lattice widths in resolved params rather than
    // repeated per row, but StatResult carries only data and mapping — there
    // is no params channel from a stat to its geom. Columns are the honest
    // alternative: redundant, but the geom genuinely needs the cell size and
    // cannot recover it from centers when an axis holds a single cell.
    binWidthX: [],
    binWidthY: [],
    binWidthZ: [],
  };
  for (const cell of cells.values()) {
    out[xCol].push(center(cell.xi, axes[0]));
    out[yCol].push(center(cell.yi, axes[1]));
    out[zCol].push(center(cell.zi, axes[2]));
    out.count.push(cell.count);
    out.density.push(cell.count / (total * volume));
    out.binWidthX.push(axes[0].width);
    out.binWidthY.push(axes[1].width);
    out.binWidthZ.push(axes[2].width);
  }

  return {
    data: dataFrameFromColumns(out),
    mapping: {
      ...mapping,
      ...(mapping.fill || params.fill !== undefined ? {} : { fill: "count" }),
    },
  };
};
