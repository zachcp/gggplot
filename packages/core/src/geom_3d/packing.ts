// Flat-native 3D position packing. Mirrors geom/packing.ts's packMarkRows but
// emits vec4 `[x, y, z, 1]` positions with REAL z (not a projected NDC z), and
// reuses the 2D scalar/color packers verbatim for companions.
import type { FlatTensor } from "../compile/rendertree.ts";
import { packColorsRGBA, packScalar } from "../geom/packing.ts";

export interface PackPoints3dInput {
  xs: number[];
  ys: number[];
  zs: number[];
  colors?: string[];
  sizes?: number[];
  alphas?: number[];
}

export interface PackedPoints3d {
  /** Retained-row mask (finite x AND y AND z); reusable for further packing. */
  mask: Uint8Array;
  positions: FlatTensor;
  colors?: FlatTensor;
  sizes?: FlatTensor;
}

/**
 * Pack (x, y, z) rows into an interleaved vec4 FlatTensor, dropping any row
 * with a non-finite coordinate — the 3D analog of packMarkRows's finite-x/y
 * mask, extended to z. Positions stay in data space; the camera matrix (built
 * separately) projects them on the GPU.
 */
export function packPoints3d(input: PackPoints3dInput): PackedPoints3d {
  const { xs, ys, zs, colors, sizes, alphas } = input;
  const n = Math.min(xs.length, ys.length, zs.length);
  const mask = new Uint8Array(n);
  let kept = 0;
  for (let i = 0; i < n; i++) {
    const keep = Number.isFinite(xs[i]) && Number.isFinite(ys[i]) &&
      Number.isFinite(zs[i]);
    mask[i] = keep ? 1 : 0;
    if (keep) kept++;
  }

  const array = new Float32Array(kept * 4);
  let w = 0;
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    array[w * 4] = xs[i];
    array[w * 4 + 1] = ys[i];
    array[w * 4 + 2] = zs[i];
    array[w * 4 + 3] = 1;
    w++;
  }
  const positions: FlatTensor = {
    array,
    format: "vec4",
    dims: 4,
    length: kept,
    size: [kept],
    version: 0,
  };

  return {
    mask,
    positions,
    ...(colors ? { colors: packColorsRGBA(colors, mask, alphas) } : {}),
    ...(sizes ? { sizes: packScalar(sizes, mask) } : {}),
  };
}
