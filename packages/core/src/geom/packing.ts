// FlatTensor packing primitives (extracted from geom/shared.ts). Compiler-
// internal: these build the flat interleaved Float32Array + MarkTopology
// products that per-geom lowering hands to the RenderTree. Nothing here reads
// trained scales or mapped columns — that is geom/shared.ts's companion
// aesthetic-extraction half. Re-exported by geom/shared.ts so existing
// `../geom/shared.ts` imports keep resolving.
import type { FlatTensor, MarkTopology } from "../compile/rendertree.ts";
import { parseColorRGBA } from "../color/mod.ts";

/**
 * Intermediate packing product. 'owners' maps each vertex to its retained
 * source row for row-to-vertex attribute expansion; it is stripped before a
 * node's renderer-facing MarkTopology is built. Compiler-internal — never
 * placed on a RenderTree node (see MarkTopology in compile/rendertree.ts,
 * which has no owners field).
 */
export interface PackedGeometry {
  positions: FlatTensor;
  topology: MarkTopology;
  owners?: Uint32Array; // absent for kind='points' (vertex i IS row i)
}

/** Count of set (truthy) entries in a retained-row mask. */
function maskCount(mask: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) count++;
  return count;
}

/**
 * Pack a per-row scalar (size/width/alpha/...) through a retained-row mask
 * into a dims=1 FlatTensor. The mask is a required argument — packScalar
 * never decides which rows to keep, only packMarkRows does.
 */
export function packScalar(values: number[], mask: Uint8Array): FlatTensor {
  const kept = maskCount(mask);
  const array = new Float32Array(kept);
  let w = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    array[w++] = values[i];
  }
  return {
    array,
    format: "f32",
    dims: 1,
    length: kept,
    size: [kept],
    version: 0,
  };
}

/**
 * Pack per-row colors (hex strings) through a retained-row mask into a
 * dims=4 vec4 FlatTensor of normalized 0..1 RGBA floats, folding per-row
 * alpha in when provided (defaults to fully opaque). The mask is a required
 * argument — packColorsRGBA never decides which rows to keep.
 */
export function packColorsRGBA(
  colors: string[],
  mask: Uint8Array,
  alphas?: number[],
): FlatTensor {
  const kept = maskCount(mask);
  const array = new Float32Array(kept * 4);
  let w = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const [r, g, b, a] = parseColorRGBA(colors[i], alphas ? alphas[i] : 1);
    array[w * 4] = r;
    array[w * 4 + 1] = g;
    array[w * 4 + 2] = b;
    array[w * 4 + 3] = a;
    w++;
  }
  return {
    array,
    format: "vec4",
    dims: 4,
    length: kept,
    size: [kept],
    version: 0,
  };
}

export interface PackMarkRowsInput {
  xs: number[];
  ys: number[];
  colors?: string[];
  sizes?: number[];
  widths?: number[];
  alphas?: number[];
}

export interface PackedMarkRows {
  /** Retained-row mask computed by packMarkRows; reusable for further
   * companion packing (e.g. via packScalar/packColorsRGBA) beyond the
   * fields packMarkRows already packs. */
  mask: Uint8Array;
  positions: FlatTensor;
  colors?: FlatTensor;
  sizes?: FlatTensor;
  widths?: FlatTensor;
  alphas?: FlatTensor;
}

export interface PackPoints3dInput {
  xs: number[];
  ys: number[];
  zs: number[];
  colors?: string[];
  sizes?: number[];
  alphas?: number[];
}

export interface PackedPoints3d {
  mask: Uint8Array;
  positions: FlatTensor;
  colors?: FlatTensor;
  sizes?: FlatTensor;
}

/** Shared row-mask packing widened to homogeneous vec4 [x,y,z,1]. */
export function packPoints3d(input: PackPoints3dInput): PackedPoints3d {
  const { xs, ys, zs, colors, sizes, alphas } = input;
  const length = Math.min(xs.length, ys.length, zs.length);
  const mask = new Uint8Array(length);
  let kept = 0;
  for (let row = 0; row < length; row++) {
    if (
      Number.isFinite(xs[row]) && Number.isFinite(ys[row]) &&
      Number.isFinite(zs[row])
    ) {
      mask[row] = 1;
      kept++;
    }
  }
  const array = new Float32Array(kept * 4);
  let output = 0;
  for (let row = 0; row < length; row++) {
    if (!mask[row]) continue;
    array[output * 4] = xs[row];
    array[output * 4 + 1] = ys[row];
    array[output * 4 + 2] = zs[row];
    array[output * 4 + 3] = 1;
    output++;
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

/**
 * SOURCE-ROW SELECTION: the sole mask builder. Computes one retained-row
 * mask (finite x AND finite y — matching the drop semantics geom_line
 * already applies before connecting points) and packs positions plus every
 * provided companion through that same mask, so a row dropped for a NaN
 * coordinate is dropped consistently everywhere. Positions are INTERLEAVED
 * ([x0,y0, x1,y1, ...]), never planar.
 */
export function packMarkRows(input: PackMarkRowsInput): PackedMarkRows {
  const { xs, ys, colors, sizes, widths, alphas } = input;
  const n = Math.min(xs.length, ys.length);
  const mask = new Uint8Array(n);
  let kept = 0;
  for (let i = 0; i < n; i++) {
    const keep = Number.isFinite(xs[i]) && Number.isFinite(ys[i]);
    mask[i] = keep ? 1 : 0;
    if (keep) kept++;
  }

  const array = new Float32Array(kept * 2);
  let w = 0;
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    array[w * 2] = xs[i];
    array[w * 2 + 1] = ys[i];
    w++;
  }
  const positions: FlatTensor = {
    array,
    format: "vec2",
    dims: 2,
    length: kept,
    size: [kept],
    version: 0,
  };

  return {
    mask,
    positions,
    ...(colors ? { colors: packColorsRGBA(colors, mask, alphas) } : {}),
    ...(sizes ? { sizes: packScalar(sizes, mask) } : {}),
    ...(widths ? { widths: packScalar(widths, mask) } : {}),
    ...(alphas ? { alphas: packScalar(alphas, mask) } : {}),
  };
}

/**
 * ROW-TO-VERTEX EXPANSION: the sole row-to-vertex expander. Expands a
 * per-row FlatTensor (e.g. one color per bar) to per-vertex by gathering
 * each vertex's owning row, deterministically, in owners order. Point/line
 * families skip this entirely (identity mapping — no owners array
 * allocated, rowTensor is already per-vertex).
 */
export function expandByOwners(
  rowTensor: FlatTensor,
  owners: Uint32Array,
): FlatTensor {
  const { dims } = rowTensor;
  const array = new Float32Array(owners.length * dims);
  for (let v = 0; v < owners.length; v++) {
    const row = owners[v];
    for (let d = 0; d < dims; d++) {
      array[v * dims + d] = rowTensor.array[row * dims + d];
    }
  }
  return {
    array,
    format: rowTensor.format,
    dims,
    length: owners.length,
    size: [owners.length],
    version: 0,
  };
}

/** Highest row index referenced by an owners array, plus one (the row count
 * it spans), or the vertex count itself when there is no owners array
 * (identity mapping: vertex i IS row i). */
function rowSpanOf(geom: PackedGeometry): number {
  if (!geom.owners) return geom.positions.length;
  let max = -1;
  for (let i = 0; i < geom.owners.length; i++) {
    if (geom.owners[i] > max) max = geom.owners[i];
  }
  return max + 1;
}

/**
 * Concatenate multiple PackedGeometry pieces (e.g. one per group in a
 * grouped/faceted layer) into one, aligning positions and owners and
 * emitting per-piece chunk lengths on the combined topology. Owners are
 * re-based by each preceding piece's own row span, so the combined owners
 * array stays valid against a correspondingly concatenated row-attribute
 * tensor. Empty pieces (zero vertices) contribute nothing — no tensor bytes
 * and no chunk-length entry.
 */
export function concatPacked(geoms: PackedGeometry[]): PackedGeometry {
  const nonEmpty = geoms.filter((g) => g.positions.length > 0);

  if (nonEmpty.length === 0) {
    const empty: FlatTensor = {
      array: new Float32Array(0),
      format: "vec2",
      dims: 2,
      length: 0,
      size: [0],
      version: 0,
    };
    return { positions: empty, topology: { kind: "points" } };
  }

  const { dims, format } = nonEmpty[0].positions;
  const { kind, loops } = nonEmpty[0].topology;
  const totalVerts = nonEmpty.reduce((sum, g) => sum + g.positions.length, 0);
  const anyOwners = nonEmpty.some((g) => g.owners);

  const array = new Float32Array(totalVerts * dims);
  const owners = anyOwners ? new Uint32Array(totalVerts) : undefined;
  const chunks = new Uint32Array(nonEmpty.length);

  let vOffset = 0;
  let rowOffset = 0;
  nonEmpty.forEach((g, i) => {
    const len = g.positions.length;
    array.set(g.positions.array, vOffset * dims);
    if (owners) {
      for (let v = 0; v < len; v++) {
        owners[vOffset + v] = (g.owners ? g.owners[v] : v) + rowOffset;
      }
    }
    chunks[i] = len;
    vOffset += len;
    rowOffset += rowSpanOf(g);
  });

  return {
    positions: {
      array,
      format,
      dims,
      length: totalVerts,
      size: [totalVerts],
      version: 0,
    },
    topology: {
      kind,
      chunks,
      ...(loops !== undefined ? { loops } : {}),
    },
    ...(owners ? { owners } : {}),
  };
}

/**
 * Concatenate parallel per-vertex companion FlatTensors (e.g. one packed
 * colors tensor per group) in the SAME group order as a concatPacked call
 * over that group's positions — concatPacked's PackedGeometry carries only
 * 'positions'/'topology'/'owners', so a caller concatenating per-group
 * colors/widths/... alongside positions needs this separately (gggplot-
 * tzc.3: line.ts's packChunkedLineNodes concatenates one Line per group into
 * one ChunkedLine node this way). Callers must pass the SAME already-
 * non-empty-filtered group list, in the SAME order, they passed to
 * concatPacked, so vertex i here lines up with vertex i of the concatenated
 * positions. All inputs must share dims/format — true of every companion
 * packMarkRows produces for one mark family's rows.
 */
export function concatFlatTensors(tensors: FlatTensor[]): FlatTensor {
  const nonEmpty = tensors.filter((t) => t.length > 0);
  if (nonEmpty.length === 0) {
    const { format = "f32", dims = 1 } = tensors[0] ?? {};
    return {
      array: new Float32Array(0),
      format,
      dims,
      length: 0,
      size: [0],
      version: 0,
    };
  }
  const { dims, format } = nonEmpty[0];
  const totalLength = nonEmpty.reduce((sum, t) => sum + t.length, 0);
  const array = new Float32Array(totalLength * dims);
  let offset = 0;
  for (const t of nonEmpty) {
    array.set(t.array, offset * dims);
    offset += t.length;
  }
  return {
    array,
    format,
    dims,
    length: totalLength,
    size: [totalLength],
    version: 0,
  };
}

/**
 * One closed-loop face (a bar rectangle, a hex cell, a polygon/violin/area
 * outline, ...) with its own per-face fill, ready for packFaceLoops. `alpha`
 * folds a per-loop opacity into the packed color (defaults to fully
 * opaque) — distinct from a layer-level `opacity` prop threaded straight
 * onto the ChunkedFace node by callers (see line.ts/ChunkedLine's same
 * split for the rationale: a mapped per-row alpha bakes into color, a
 * literal layer-level params.alpha stays a separate uniform-ish prop).
 */
export interface FaceLoop {
  positions: [number, number][];
  fill: string;
  alpha?: number;
}

export interface PackedFaceGeometry {
  positions: FlatTensor;
  /** Renderer-facing topology only — kind:'loops', chunks, loops:true. NEVER an 'owners' field (gggplot-tzc.4: owners is compiler-internal and is stripped before this point — see the mandatory no-owners-on-RenderTree test). */
  topology: MarkTopology;
  colors: FlatTensor;
}

/**
 * Pack N closed-loop faces (gggplot-tzc.4: bar/tile/rect/area/polygon/
 * violin/boxplot-box/crossbar-box/hex/smooth-SE-ribbon families) into one
 * PackedFaceGeometry: positions = concatPacked loop vertices with owners
 * mapping each vertex to its OWN loop (loop i's vertices all own row i);
 * colors = each loop's fill expanded per-vertex via expandByOwners; owners
 * is then discarded (concatPacked's owners field is compiler-internal
 * plumbing for this expansion step only — never returned here, matching
 * the same discipline packChunkedLineNodes/concatPacked already document).
 * Callers filter degenerate (<3-vertex) loops before calling, same as the
 * pre-tzc.4 per-geom `if (positions.length < 3) continue;` guards did.
 */
export function packFaceLoops(loops: FaceLoop[]): PackedFaceGeometry {
  const pieces: PackedGeometry[] = loops.map((loop) => {
    const array = new Float32Array(loop.positions.length * 2);
    loop.positions.forEach(([x, y], v) => {
      array[v * 2] = x;
      array[v * 2 + 1] = y;
    });
    return {
      positions: {
        array,
        format: "vec2",
        dims: 2,
        length: loop.positions.length,
        size: [loop.positions.length],
        version: 0,
      },
      topology: { kind: "loops", loops: true },
      // LOCAL owners (all-0): each piece is exactly ONE row (one loop) —
      // concatPacked re-bases every piece's owners by the cumulative row
      // SPAN of the preceding pieces (see its docstring), so a piece
      // already carrying its final GLOBAL row index here would be rebased
      // a second time and overshoot. rowSpanOf(all-0 owners) = 1, so
      // concatPacked's own rebasing already produces exactly the desired
      // global row index (0, 1, 2, ... one per loop, in loops[] order).
      owners: new Uint32Array(loop.positions.length).fill(0),
    };
  });
  const combined = concatPacked(pieces);
  const rowMask = new Uint8Array(loops.length).fill(1);
  const rowColors = packColorsRGBA(
    loops.map((l) => l.fill),
    rowMask,
    loops.map((l) => l.alpha ?? 1),
  );
  const colors = combined.owners
    ? expandByOwners(rowColors, combined.owners)
    : rowColors;
  return { positions: combined.positions, topology: combined.topology, colors };
}

/**
 * Pack N independent, EQUAL-LENGTH point chunks (disjoint segments/curves/
 * ticks — geom_segment/geom_curve/geom_spoke/geom_rug/geom_hline/geom_vline/
 * errorbar's stems all emit a FIXED point count per row: always 2 for a
 * straight segment, a constant segments+1 for geom_curve) into one
 * FlatTensor 'positions' + MarkTopology. positions.size is set to the
 * 2-element [chunkLen, chunkCount] form @use-gpu/parse's flatten.mjs
 * (sizeToChunkCounts) auto-detects UNIFORM chunk boundaries from on a
 * directly-passed TensorArray prop — the same mechanism plot's own <Line>
 * already uses, so these keep rendering through the unmodified 'Line'
 * registry mapping (gggplot-tzc.3: these are reference lines/row-disjoint
 * annotations, never geom_line's variable-length per-group ChunkedLine).
 * topology.chunks is set explicitly too, for tzc.2's munch/polarize
 * machinery, which reads topology rather than positions.size.
 *
 * Does NOT use packMarkRows: packMarkRows's mask is a per-ROW-to-per-VERTEX
 * (1:1) mechanism (one dropped row = one dropped vertex); these families are
 * one-row-to-N-vertices, a different shape entirely — each caller keeps its
 * own existing finite-value filtering (already applied to the `chunkPoints`
 * passed in) rather than a mask.
 */
export function packUniformChunks(
  chunkPoints: readonly (readonly [number, number])[][],
): PackedGeometry {
  const chunkCount = chunkPoints.length;
  if (chunkCount === 0) {
    return {
      positions: {
        array: new Float32Array(0),
        format: "vec2",
        dims: 2,
        length: 0,
        size: [0],
        version: 0,
      },
      topology: { kind: "polyline" },
    };
  }
  const chunkLen = chunkPoints[0].length;
  const array = new Float32Array(chunkCount * chunkLen * 2);
  let w = 0;
  for (const chunk of chunkPoints) {
    for (const [x, y] of chunk) {
      array[w++] = x;
      array[w++] = y;
    }
  }
  const length = chunkCount * chunkLen;
  return {
    positions: {
      array,
      format: "vec2",
      dims: 2,
      length,
      size: [chunkLen, chunkCount],
      version: 0,
    },
    topology: {
      kind: "polyline",
      chunks: new Uint32Array(chunkCount).fill(chunkLen),
      loops: false,
    },
  };
}

/**
 * The vec4 analogue of packUniformChunks, for disjoint 3D chunks.
 *
 * Rows arrive already filtered: a segment with any non-finite component is
 * dropped whole by the caller rather than half-packed, since half a segment is
 * a line to nowhere.
 */
export function packUniformChunks3d(
  chunkPoints: readonly (readonly [number, number, number])[][],
): PackedGeometry {
  const chunkCount = chunkPoints.length;
  if (chunkCount === 0) {
    return {
      positions: {
        array: new Float32Array(0),
        format: "vec4",
        dims: 4,
        length: 0,
        size: [0],
        version: 0,
      },
      topology: { kind: "polyline" },
    };
  }
  const chunkLen = chunkPoints[0].length;
  const array = new Float32Array(chunkCount * chunkLen * 4);
  let w = 0;
  for (const chunk of chunkPoints) {
    for (const [x, y, z] of chunk) {
      array[w++] = x;
      array[w++] = y;
      array[w++] = z;
      array[w++] = 1;
    }
  }
  const length = chunkCount * chunkLen;
  return {
    positions: {
      array,
      format: "vec4",
      dims: 4,
      length,
      size: [chunkLen, chunkCount],
      version: 0,
    },
    topology: {
      kind: "polyline",
      chunks: new Uint32Array(chunkCount).fill(chunkLen),
      loops: false,
    },
  };
}

/** A planar surface ring placed in 3D. Vertices carry z; nothing is extruded. */
export interface FaceLoop3D {
  positions: [number, number, number][];
  fill: string;
  alpha?: number;
}

/**
 * The vec4 analogue of packFaceLoops.
 *
 * Rings arrive already filtered: a loop with any non-finite vertex is dropped
 * whole by the caller rather than closed across the gap, which would invent
 * area the data never had.
 */
export function packFaceLoops3d(loops: FaceLoop3D[]): PackedFaceGeometry {
  const pieces: PackedGeometry[] = loops.map((loop) => {
    const array = new Float32Array(loop.positions.length * 4);
    loop.positions.forEach(([x, y, z], v) => {
      array[v * 4] = x;
      array[v * 4 + 1] = y;
      array[v * 4 + 2] = z;
      array[v * 4 + 3] = 1;
    });
    return {
      positions: {
        array,
        format: "vec4",
        dims: 4,
        length: loop.positions.length,
        size: [loop.positions.length],
        version: 0,
      },
      topology: { kind: "loops", loops: true } as MarkTopology,
      // Local all-0 owners, rebased by concatPacked exactly as the 2D packer
      // relies on; see packFaceLoops for why a global index here would double.
      owners: new Uint32Array(loop.positions.length).fill(0),
    };
  });
  const combined = concatPacked(pieces);
  const rowMask = new Uint8Array(loops.length).fill(1);
  const rowColors = packColorsRGBA(
    loops.map((l) => l.fill),
    rowMask,
    loops.map((l) => l.alpha ?? 1),
  );
  const colors = combined.owners
    ? expandByOwners(rowColors, combined.owners)
    : rowColors;
  return { positions: combined.positions, topology: combined.topology, colors };
}
