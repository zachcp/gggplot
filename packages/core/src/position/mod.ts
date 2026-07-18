// Position adjustments — stage between scale training and geom lowering.
// Operates on already scale-mapped numeric x/y values, grouped by shared x
// (bars/areas) or applied per-point (jitter). Needed by bars (stack/dodge/
// fill) and overlapping points (jitter).

/** One bar's scale-mapped position and the group it belongs to at that x. */
export interface PositionedBar {
  x: number;
  y: number;
  groupKey: string;
}

/** A bar after position adjustment: its vertical span, x offset and width. */
export interface PlacedBar extends PositionedBar {
  y0: number;
  y1: number;
  xOffset: number;
  width: number;
}

/**
 * Stack bars sharing the same x on top of each other in group-key order
 * ("stack"), normalize each x's stack to [0,1] ("fill"), or leave them
 * unstacked/overlapping at a shared baseline ("identity").
 */
export function stackBars(
  bars: PositionedBar[],
  width: number,
  mode: "stack" | "fill" | "identity" | "silhouette" = "stack",
): PlacedBar[] {
  if (mode === "identity") {
    return bars.map((b) => ({ ...b, y0: 0, y1: b.y, xOffset: 0, width }));
  }

  const byX = new Map<number, number[]>();
  bars.forEach((b, i) => {
    if (!byX.has(b.x)) byX.set(b.x, []);
    byX.get(b.x)!.push(i);
  });

  const out = new Array<PlacedBar>(bars.length);
  for (const indices of byX.values()) {
    const total = indices.reduce((sum, i) => sum + bars[i].y, 0);
    let cum = mode === "silhouette" ? -total / 2 : 0;
    for (const i of indices) {
      const b = bars[i];
      const y0 = cum;
      const y1 = cum + b.y;
      cum = y1;
      out[i] = mode === "fill"
        ? {
          ...b,
          y0: total > 0 ? y0 / total : 0,
          y1: total > 0 ? y1 / total : 0,
          xOffset: 0,
          width,
        }
        : { ...b, y0, y1, xOffset: 0, width };
    }
  }
  return out;
}

/**
 * Dodge bars sharing the same x side-by-side. Group order (and so dodge
 * slot) is stable across all x values, so bars from the same group line up.
 */
export function dodgeBars(bars: PositionedBar[], width: number): PlacedBar[] {
  const groupOrder = [...new Set(bars.map((b) => b.groupKey))].sort();
  const n = groupOrder.length || 1;
  const dodgedWidth = width / n;

  return bars.map((b) => {
    const gi = groupOrder.indexOf(b.groupKey);
    const xOffset = (gi - (n - 1) / 2) * dodgedWidth;
    return { ...b, y0: 0, y1: b.y, xOffset, width: dodgedWidth };
  });
}

/** Dodge bars using their own optional widths, preserving the total group span. */
export function dodge2Bars(
  bars: (PositionedBar & { width?: number })[],
  defaultWidth: number,
  padding = 0.1,
): PlacedBar[] {
  const byX = new Map<number, number[]>();
  bars.forEach((bar, i) => {
    const group = byX.get(bar.x) ?? [];
    group.push(i);
    byX.set(bar.x, group);
  });
  const out = new Array<PlacedBar>(bars.length);
  for (const indices of byX.values()) {
    const widths = indices.map((i) => bars[i].width ?? defaultWidth);
    const total = widths.reduce((sum, width) => sum + width, 0) || defaultWidth;
    let cursor = -total / 2;
    indices.forEach((index, slot) => {
      const width = widths[slot] * (1 - padding);
      const center = cursor + widths[slot] / 2;
      const bar = bars[index];
      out[index] = { ...bar, y0: 0, y1: bar.y, xOffset: center, width };
      cursor += widths[slot];
    });
  }
  return out;
}

/** Apply a fixed offset to each point. */
export function nudge(
  positions: readonly [number, number][],
  x = 0,
  y = 0,
): [number, number][] {
  return positions.map(([px, py]) => [px + x, py + y]);
}

/** Nudge a scale-mapped value by uniform random noise in [-amount, amount]. */
export function jitter(value: number, amount: number): number {
  return value + (Math.random() * 2 - 1) * amount;
}
