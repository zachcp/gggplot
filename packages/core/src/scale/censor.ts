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
 */
export function censorToScaleLimits(
  spec: GGSpec,
  mapping: Aes,
  data: DataFrame,
): DataFrame {
  const active = (["x", "y", "z"] as const).flatMap((axis) => {
    const declared = spec.scales.find((scale) => scale.aes === axis);
    if (!declared?.domain) return [];
    const columns = POSITION_FAMILY[axis]
      .map((aes) => mapping[aes])
      .filter((column): column is string => !!column && column in data);
    return columns.length ? [{ declared, columns }] : [];
  });
  if (!active.length) return data;

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
  return keep.length === rows ? data : sliceRows(data, keep);
}
