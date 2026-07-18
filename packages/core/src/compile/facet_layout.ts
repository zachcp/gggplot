export interface FacetCellLayout {
  row: number;
  col: number;
  /** Pixel-space cell rectangle [left, top, right, bottom]. */
  cell: [number, number, number, number];
  /** Pixel-space strip rectangle, reserved above the panel. */
  strip: [number, number, number, number];
  /** Pixel-space drawable panel rectangle, excluding strip and spacing. */
  panel: [number, number, number, number];
}

/** Canonical responsive facet rectangles in CSS pixels. */
export function facetCellLayouts(
  width: number,
  height: number,
  nrow: number,
  ncol: number,
  gap = 16,
  stripHeight = 24,
): FacetCellLayout[] {
  if (width <= 0 || height <= 0 || nrow < 1 || ncol < 1) return [];
  const safeGap = Math.max(0, gap);
  const cellWidth = Math.max(0, (width - safeGap * (ncol - 1)) / ncol);
  const cellHeight = Math.max(0, (height - safeGap * (nrow - 1)) / nrow);
  const safeStrip = Math.min(Math.max(0, stripHeight), cellHeight);
  const cells: FacetCellLayout[] = [];
  for (let row = 0; row < nrow; row++) {
    for (let col = 0; col < ncol; col++) {
      const left = col * (cellWidth + safeGap);
      const top = row * (cellHeight + safeGap);
      const right = left + cellWidth;
      const bottom = top + cellHeight;
      cells.push({
        row,
        col,
        cell: [left, top, right, bottom],
        strip: [left, top, right, top + safeStrip],
        panel: [left, top + safeStrip, right, bottom],
      });
    }
  }
  return cells;
}
