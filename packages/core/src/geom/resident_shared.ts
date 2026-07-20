// Shared eligibility and option helpers for residentPlan hooks
// (gggplot-d0g). barResidentPlan and tileResidentPlan grew by copy-paste;
// the common gates live here once. Geom-specific policy (which stats, which
// positions, standalone requirements) stays in each geom's own hook.
import type { Aes, GGSpec } from "../ir/types.ts";
import type { Column, TypedDataFrame } from "../data/mod.ts";
import { columnValues, factorLevelsFor } from "../data/mod.ts";
import { categoricalRange, OTHER_COLOR } from "../scale/mod.ts";

export function explicitDomain(
  spec: GGSpec,
  aes: "x" | "y",
): [number, number] | undefined {
  const scale = spec.scales.find((candidate) => candidate.aes === aes);
  return scale && Array.isArray(scale.domain) &&
      typeof scale.domain[0] === "number" && typeof scale.domain[1] === "number"
    ? scale.domain as [number, number]
    : undefined;
}

/**
 * Discrete color/fill domain in trained-scale order: an explicit factor's
 * declared levels, otherwise the sorted unique observed values. This mirrors
 * scale/training.ts's `discreteLevels` for a single mapped column so the
 * resident palette below is assigned in the SAME order the trained scale
 * (and therefore the legend) uses. Only reached when no custom scale is
 * declared for the aes.
 */
function discreteColorDomain(data: TypedDataFrame, col: string): string[] {
  const declared = factorLevelsFor(data, col);
  if (declared) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const level of declared) {
      if (!seen.has(level)) {
        seen.add(level);
        out.push(level);
      }
    }
    return out;
  }
  const inferred = new Set<string>();
  for (const value of columnValues(data, col)) {
    if (value != null) inferred.add(String(value));
  }
  return [...inferred].sort();
}

/**
 * One hex color per GPU group id (i.e. per factor level in `levels`, the
 * `column.levels` order factorIds resolves to). Each level takes the color the
 * default discrete palette (categoricalRange — the exact function trainScales
 * uses) assigns at its position in the trained domain, so resident mark colors
 * match the legend swatches the trained fill/color scale produces.
 */
export function residentPalette(
  data: TypedDataFrame,
  col: string,
  levels: readonly string[],
): string[] {
  const domain = discreteColorDomain(data, col);
  const range = categoricalRange(domain.length);
  return levels.map((level) => {
    const index = domain.indexOf(level);
    return index >= 0 && index < range.length ? range[index] : OTHER_COLOR;
  });
}

export interface ResidentColorGroups {
  /** Grouping column (fill/color take precedence over group, matching
   * lowerBar's groupCol derivation and the CPU stat's effective grouping). */
  group?: string;
  groupColumn?: Column;
  groupsCount: number;
  /** Factor-level hex colors (level order) when a color/fill maps the group
   * column; drives on-GPU per-group mark colors. */
  paletteColors?: string[];
}

/**
 * The shared fill/color eligibility gate: a color/fill mapping is
 * resident-eligible IFF (a) the mapped column is a factor column, (b) it is
 * the same column the group derivation uses (it directly drives groupIds),
 * and (c) the spec declares no custom scale for that aesthetic. Returns
 * undefined when the mapping is present but ineligible (caller must fall
 * back to CPU); returns the resolved grouping otherwise.
 */
export function residentColorGroups(
  spec: GGSpec,
  mapping: Aes,
  data: TypedDataFrame,
): ResidentColorGroups | undefined {
  const colorAes: "fill" | "color" | undefined = mapping.fill
    ? "fill"
    : mapping.color
    ? "color"
    : undefined;
  const colorCol = colorAes ? mapping[colorAes] : undefined;
  if (colorCol) {
    const colorColumn = data[colorCol];
    const declaredScale = spec.scales.find((scale) => scale.aes === colorAes);
    if (colorColumn?.type !== "factor" || declaredScale) return undefined;
    if (mapping.group && mapping.group !== colorCol) return undefined;
  }

  const group = mapping.fill ?? mapping.color ?? mapping.group;
  const groupColumn = group ? data[group] : undefined;
  if (group && groupColumn?.type !== "factor") return undefined;
  const groupsCount = groupColumn?.type === "factor"
    ? groupColumn.levels.length
    : 1;
  const paletteColors = colorCol && groupColumn?.type === "factor"
    ? residentPalette(data, colorCol, groupColumn.levels)
    : undefined;
  return { group, groupColumn, groupsCount, paletteColors };
}

export interface ResidentBinRequest {
  binwidth: number | undefined;
  /** Requested bin count; undefined when an explicit binwidth governs. */
  bins: number | undefined;
}

/**
 * Validate the layer's binwidth/bins params for the resident histogram
 * kernels. Returns undefined (CPU fallback) for non-positive or non-numeric
 * requests; otherwise the resolved pair with ggplot2's default of 30 bins.
 */
export function residentBinRequest(
  params: Record<string, unknown>,
): ResidentBinRequest | undefined {
  const requestedBinwidth = params.binwidth;
  const requestedBins = params.bins;
  if (
    requestedBinwidth != null &&
      (typeof requestedBinwidth !== "number" || requestedBinwidth <= 0) ||
    requestedBins != null &&
      (typeof requestedBins !== "number" || requestedBins <= 0)
  ) return undefined;
  const bins = (requestedBins as number | undefined) ?? 30;
  return {
    binwidth: requestedBinwidth as number | undefined,
    bins: requestedBinwidth == null ? bins : undefined,
  };
}
