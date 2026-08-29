// Scale limits as a data filter (gggplot-wjw).
//
// ggplot2 draws a sharp line between two things that both look like "set the
// axis range":
//
//   scale_x_continuous(limits = c(0, 1))  removes rows outside the limits
//                                         (the "Removed N rows" warning) and
//                                         so changes what stats see
//   coord_cartesian(xlim = c(0, 1))       zooms without removing anything
//
// gggplot had neither. A declared scale domain narrowed the panel's view range
// but left every row in the data, and nothing downstream clips (there is no
// scissor anywhere in the render layer), so an out-of-range mark simply drew
// outside the panel, over the axes and margins.
//
// A scale's `domain` is this library's spelling of ggplot2's scale `limits`,
// so it censors. Zoom-without-drop belongs to a coord-level option, which does
// not exist yet — see gggplot-wjw's follow-up.
import type { Aes, DataFrame, GGSpec, PositionAxis } from "../ir/types.ts";
import { columnValues } from "../data/mod.ts";
import { rowCount, sliceRows } from "../group/mod.ts";

/**
 * The aesthetics each position scale governs. A scale's limits censor every
 * column mapped to its axis, not just the primary one: an errorbar whose ymax
 * escapes the limits is as out-of-range as a point whose y does. These mirror
 * the column families scale training already widens the domain over.
 */
const POSITION_FAMILY: Record<PositionAxis, readonly (keyof Aes)[]> = {
  x: ["x", "xmin", "xmax", "xend"],
  y: ["y", "ymin", "ymax", "yend"],
  z: ["z", "zend"],
};

/**
 * A filtered frame plus how many rows the filter dropped.
 *
 * `data` is the SAME reference as the input when nothing was removed, which
 * the pack cache depends on for its stage-A reuse.
 */
export interface FilterResult {
  data: DataFrame;
  removed: number;
}

/**
 * Whether a raw value falls outside a continuous scale's limits.
 *
 * Missing values are NOT censored here. null/NaN means "no position", which is
 * a different defect with a different fix (gggplot-bab); folding it in would
 * make this filter silently responsible for two behaviours and make the
 * "Removed N rows" count ambiguous once that count is surfaced.
 */
function outsideContinuous(raw: unknown, [lo, hi]: [number, number]): boolean {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return false;
  return value < lo || value > hi;
}

/** Whether a raw value is absent from a discrete scale's declared levels. */
function outsideDiscrete(raw: unknown, levels: readonly string[]): boolean {
  if (raw == null) return false;
  return !levels.includes(String(raw));
}

/**
 * Drop rows the declared position scales exclude.
 *
 * Runs BEFORE stats, which is the whole point: ggplot2's limits change what
 * stat_bin and stat_count see, so censoring after the stat would bin rows the
 * user asked to exclude and then hide the evidence. Returns `data` unchanged
 * (same reference) when no position scale declares a domain, so the common
 * path allocates nothing.
 *
 * Scope: position scales only. Limits on a colour or fill scale raise a
 * separate question — ggplot2 maps those to NA rather than dropping the row —
 * and are deliberately left alone.
 *
 * Reports how many rows it removed so the compiler can surface ggplot2's
 * "Removed N rows containing non-finite values" (gggplot-9v6). `data` keeps
 * its identity when nothing is dropped, which the pack cache relies on.
 */
export function censorToScaleLimits(
  spec: GGSpec,
  mapping: Aes,
  data: DataFrame,
  nonPositionalAes: readonly (keyof Aes)[] = [],
): FilterResult {
  const active = (["x", "y", "z"] as const).flatMap((axis) => {
    const declared = spec.scales.find((scale) => scale.aes === axis);
    if (!declared?.domain) return [];
    const columns = POSITION_FAMILY[axis]
      .filter((aes) => !nonPositionalAes.includes(aes))
      .map((aes) => mapping[aes])
      .filter((column): column is string => !!column && column in data);
    return columns.length ? [{ declared, columns }] : [];
  });
  if (!active.length) return { data, removed: 0 };

  const rows = rowCount(data);
  const keep: number[] = [];
  for (let row = 0; row < rows; row++) {
    let excluded = false;
    for (const { declared, columns } of active) {
      for (const column of columns) {
        const raw = columnValues(data, column)[row];
        excluded = declared.kind === "discrete"
          ? outsideDiscrete(raw, declared.domain as string[])
          : outsideContinuous(raw, declared.domain as [number, number]);
        if (excluded) break;
      }
      if (excluded) break;
    }
    if (!excluded) keep.push(row);
  }
  return keep.length === rows
    ? { data, removed: 0 }
    : { data: sliceRows(data, keep), removed: rows - keep.length };
}

/**
 * Drop rows with no position at all, for geoms that declare they can take it
 * (GeomDefinition.dropsMissingPositions).
 *
 * Separate from limits censoring on purpose. A row excluded by limits was
 * plottable and the user chose to exclude it; a row with a null or NaN
 * position was never plottable. ggplot2 reports the two differently, and
 * keeping them apart keeps a future "Removed N rows" count meaningful.
 *
 * Applying this per geom rather than globally is not fastidiousness: a blanket
 * filter was implemented and measured, and it broke geom_surface's complete-
 * grid contract and geom_polygon's ring topology, because for those geoms the
 * gap IS the information. See the field's own documentation.
 *
 * Reports how many rows it removed so the compiler can surface ggplot2's
 * "Removed N rows containing missing values" (gggplot-9v6).
 */
export function removeMissingPositions(
  mapping: Aes,
  data: DataFrame,
  nonPositionalAes: readonly (keyof Aes)[] = [],
): FilterResult {
  const columns = (["x", "y", "z"] as const)
    .flatMap((axis) => POSITION_FAMILY[axis])
    .filter((aes) => !nonPositionalAes.includes(aes))
    .map((aes) => mapping[aes])
    .filter((column): column is string => !!column && column in data);
  if (!columns.length) return { data, removed: 0 };

  const rows = rowCount(data);
  const keep: number[] = [];
  for (let row = 0; row < rows; row++) {
    const missing = columns.some((column) =>
      isMissingValue(columnValues(data, column)[row])
    );
    if (!missing) keep.push(row);
  }
  return keep.length === rows
    ? { data, removed: 0 }
    : { data: sliceRows(data, keep), removed: rows - keep.length };
}

/** null, undefined, NaN or an infinity — the forms "no position" arrives in. */
function isMissingValue(raw: unknown): boolean {
  if (raw == null) return true;
  return typeof raw === "number" && !Number.isFinite(raw);
}
