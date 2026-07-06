// Scales — stage ② of the pipeline.
//
// Scale training scans the (post-stat) data across all layers to learn each
// aesthetic's data-space domain, so the coord/view can be given a range and
// marks can be mapped into visual space. Only continuous x/y training is
// implemented; discrete + color/size palettes are stubs.

import type { Aes, DataFrame, GGSpec, Scale } from "../ir/types.ts";

export interface TrainedScale extends Scale {
  domain: [number, number] | string[];
}

/** Numeric [min,max] extent of a column, ignoring non-finite values. */
function continuousExtent(values: unknown[]): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) {
      if (n < min) min = n;
      if (n > max) max = n;
    }
  }
  return min <= max ? [min, max] : null;
}

/**
 * Train scales for x and y by unioning each layer's mapped columns.
 * Returns a map keyed by aesthetic name. Extend for color/size/shape.
 */
export function trainScales(
  spec: GGSpec,
  perLayer: { data: DataFrame; mapping: Aes }[],
): Map<string, TrainedScale> {
  const trained = new Map<string, TrainedScale>();

  for (const aesName of ["x", "y"] as const) {
    const declared = spec.scales.find((s) => s.aes === aesName);
    let lo = Infinity;
    let hi = -Infinity;

    for (const { data, mapping } of perLayer) {
      const col = mapping[aesName];
      if (!col || !(col in data)) continue;
      const ext = continuousExtent(data[col]);
      if (!ext) continue;
      lo = Math.min(lo, ext[0]);
      hi = Math.max(hi, ext[1]);
    }

    if (lo <= hi) {
      trained.set(aesName, {
        aes: aesName,
        kind: declared?.kind ?? "continuous",
        name: declared?.name,
        domain: (declared?.domain as [number, number]) ?? [lo, hi],
      });
    }
  }

  return trained;
}
