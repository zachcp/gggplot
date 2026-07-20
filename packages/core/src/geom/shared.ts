// Pure aesthetic-extraction and geometry helpers shared by the per-geom
// lowering modules. These functions were extracted verbatim from the former
// compile/lowering.ts monolith; they take explicit trained scales so they stay
// pure and independent of the LayerContext plumbing. Per-geom `lower`
// implementations read scales off `ctx.scales` and pass them in here.
import type { Aes, DataFrame, GGSpec, Layer } from "../ir/types.ts";
import { columnValues, numericColumnValues } from "../data/mod.ts";
import { sliceRows } from "../group/mod.ts";
import {
  namedLinetypeValue,
  scaleAlphaValue,
  scaleColorValue,
  scaleLinetypeValue,
  scaleLinewidthValue,
  scalePosition,
  scaleShapeValue,
  scaleSizeValue,
  type TrainedScale,
} from "../scale/mod.ts";
import type { FlatTensor, MarkTopology } from "../compile/rendertree.ts";

export function valuesOf(
  data: DataFrame,
  column: string | undefined,
): unknown[] | undefined {
  return column && column in data ? columnValues(data, column) : undefined;
}

/** Pull an [x,y] position array for a layer from its mapped columns. */
export function positionsOf(
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
): [number, number][] {
  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  if (!xs || !ys || xs.length === 0 || ys.length === 0) return [];
  const n = Math.min(xs.length, ys.length);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    out.push([scalePosition(xScale, xs[i]), scalePosition(yScale, ys[i])]);
  }
  return out;
}

/**
 * Same scalePosition semantics as positionsOf, but writes into two parallel
 * planar arrays instead of allocating a tuple per row — the form packMarkRows
 * consumes directly. Returns empty arrays when either axis is unmapped/empty.
 */
export function positionsXYOf(
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
): { xs: number[]; ys: number[] } {
  const xCol = valuesOf(data, mapping.x);
  const yCol = valuesOf(data, mapping.y);
  if (!xCol || !yCol || xCol.length === 0 || yCol.length === 0) {
    return { xs: [], ys: [] };
  }
  const n = Math.min(xCol.length, yCol.length);
  const xs = new Array<number>(n);
  const ys = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    xs[i] = scalePosition(xScale, xCol[i]);
    ys[i] = scalePosition(yScale, yCol[i]);
  }
  return { xs, ys };
}

/**
 * Reorder every column by ascending x — geom_line always connects points in
 * x order (so an unsorted dataset still draws a proper line), unlike
 * geom_path, which preserves the data's own row order for trajectories.
 */
export function sortByX(mapping: Aes, data: GGSpec["data"]): GGSpec["data"] {
  const col = mapping.x;
  if (!col || !(col in data)) return data;
  const xs = numericColumnValues(data, col);
  const order = [...Array(xs.length).keys()].sort((a, b) =>
    (xs[a] ?? Number.POSITIVE_INFINITY) - (xs[b] ?? Number.POSITIVE_INFINITY)
  );
  return sliceRows(data, order);
}

export type ColorPreference = "color" | "fill" | "colorOrFill" | "fillOrColor";

/**
 * Per-row aesthetic extraction shared by sizesOf/alphasOf/shapesOf/
 * linewidthsOf/strokesOf (and colorsOf's final map): read the column mapped to
 * `aes`, return undefined if unmapped/absent, else map each value through
 * `scaleFn` with the given trained scale.
 */
function scaledColumn<T>(
  mapping: Aes,
  data: GGSpec["data"],
  aes: keyof Aes,
  scale: TrainedScale | undefined,
  scaleFn: (scale: TrainedScale | undefined, raw: unknown) => T,
): T[] | undefined {
  const col = mapping[aes];
  if (!col || !(col in data)) return undefined;
  return columnValues(data, col).map((v) => scaleFn(scale, v));
}

/** Per-row hex colors from a mapped color/fill column, or undefined if unmapped. */
export function colorsOf(
  mapping: Aes,
  data: GGSpec["data"],
  colorScale: TrainedScale | undefined,
  fillScale: TrainedScale | undefined,
  preference: ColorPreference = "colorOrFill",
): string[] | undefined {
  const aesName = preference === "color"
    ? "color"
    : preference === "fill"
    ? "fill"
    : preference === "fillOrColor" && mapping.fill
    ? "fill"
    : mapping.color
    ? "color"
    : mapping.fill
    ? "fill"
    : undefined;
  if (!aesName) return undefined;
  const scale = aesName === "fill" ? fillScale : colorScale;
  return scaledColumn(mapping, data, aesName, scale, scaleColorValue);
}

/** Per-row point radii from a mapped size column, or undefined if unmapped. */
export function sizesOf(
  mapping: Aes,
  data: GGSpec["data"],
  sizeScale: TrainedScale | undefined,
): number[] | undefined {
  return scaledColumn(mapping, data, "size", sizeScale, scaleSizeValue);
}

/** Per-row opacity from a mapped alpha column; literals remain layer params. */
export function alphasOf(
  mapping: Aes,
  data: GGSpec["data"],
  alphaScale: TrainedScale | undefined,
): number[] | undefined {
  return scaledColumn(mapping, data, "alpha", alphaScale, scaleAlphaValue);
}

/**
 * Recognize a #rgb or #rrggbb hex color and normalize it to a 6-digit hex
 * string, preserving the input's original digit casing. Returns null for
 * anything else (named CSS colors, rgb()/rgba() strings, #rrggbbaa) — those
 * are not hex/named-parseable by this minimal parser. Shared by
 * colorWithAlpha (CSS string output) and packColorsRGBA (normalized vec4
 * output) so both agree on what counts as a parseable color.
 */
function expandHexColor(color: string): string | null {
  const hex = color.startsWith("#") ? color.slice(1) : color;
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [...hex].map((part) => part + part).join("");
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return hex;
  }
  return null;
}

/** Encode a mapped opacity into a CSS color the Point adapter can bind per row. */
export function colorWithAlpha(color: string, alpha: number): string {
  const hex = expandHexColor(color);
  if (hex == null) {
    // CSS rgba() is accepted by UseGPU's color parser for named/non-hex colors.
    return color;
  }
  return `#${hex}${
    Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(
      2,
      "0",
    )
  }`;
}

/**
 * Parse a color string into normalized [r,g,b,a] components in 0..1, for
 * packColorsRGBA. Uses the same hex recognition as colorWithAlpha
 * (expandHexColor); non-hex colors (named CSS colors, rgb()/rgba() strings)
 * fall back to opaque black — this minimal parser has no CSS named-color
 * table. Alpha defaults to 1 (fully opaque); callers fold per-row alpha in
 * separately via packColorsRGBA's alphas argument.
 */
function parseColorRGBA(color: string): [number, number, number, number] {
  const hex = expandHexColor(color);
  if (hex == null) return [0, 0, 0, 1];
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
    1,
  ];
}

/** Per-row point shapes from a mapped shape column, or undefined if unmapped. */
export function shapesOf(
  mapping: Aes,
  data: GGSpec["data"],
  shapeScale: TrainedScale | undefined,
): string[] | undefined {
  return scaledColumn(mapping, data, "shape", shapeScale, scaleShapeValue);
}

/** Per-vertex line widths from a mapped continuous linewidth column. */
export function linewidthsOf(
  mapping: Aes,
  data: GGSpec["data"],
  linewidthScale: TrainedScale | undefined,
): number[] | undefined {
  return scaledColumn(
    mapping,
    data,
    "linewidth",
    linewidthScale,
    scaleLinewidthValue,
  );
}

export function strokesOf(
  mapping: Aes,
  data: GGSpec["data"],
  strokeScale: TrainedScale | undefined,
): number[] | undefined {
  return scaledColumn(mapping, data, "stroke", strokeScale, scaleLinewidthValue);
}

/** A connected Line has one dash style; grouping has already isolated its level. */
export function dashOf(
  layer: Layer,
  mapping: Aes,
  data: GGSpec["data"],
  linetypeScale: TrainedScale | undefined,
): readonly number[] | undefined {
  const literal = layer.params.linetype;
  if (typeof literal === "string") return namedLinetypeValue(literal);
  const col = mapping.linetype;
  if (!col || !(col in data)) return undefined;
  return scaleLinetypeValue(linetypeScale, columnValues(data, col)[0]);
}

export function literalLineProps(
  layer: Layer,
  defaultWidth: number,
): Record<string, unknown> {
  const linetype = layer.params.linetype;
  const dash = typeof linetype === "string"
    ? namedLinetypeValue(linetype)
    : undefined;
  return {
    width: (layer.params.linewidth as number) ??
      (layer.params.width as number) ??
      (layer.params.strokeWidth as number) ?? defaultWidth,
    ...(dash ? { dash } : {}),
  };
}

/**
 * Closed polygon loop for a filled band (geom_area/geom_ribbon): the top edge
 * (ymax, x-ascending) followed by the bottom edge (ymin, x-descending).
 * geom_area defaults ymin to a 0 baseline when unmapped.
 */
export function bandPositions(
  mapping: Aes,
  data: GGSpec["data"],
  xScale: TrainedScale | undefined,
  yScale: TrainedScale | undefined,
): [number, number][] {
  const xs = valuesOf(data, mapping.x);
  const ymaxCol = mapping.ymax ?? mapping.y;
  const ymaxs = valuesOf(data, ymaxCol);
  const ymins = valuesOf(data, mapping.ymin);
  if (!xs || !ymaxs) return [];

  const n = Math.min(xs.length, ymaxs.length, ymins ? ymins.length : xs.length);
  const order = [...Array(n).keys()].sort((a, b) =>
    scalePosition(xScale, xs[a]) - scalePosition(xScale, xs[b])
  );

  const top: [number, number][] = order.map((i) => [
    scalePosition(xScale, xs[i]),
    scalePosition(yScale, ymaxs[i]),
  ]);
  const bottom: [number, number][] = order
    .map((i): [number, number] => [
      scalePosition(xScale, xs[i]),
      ymins ? scalePosition(yScale, ymins[i]) : scalePosition(yScale, 0),
    ])
    .reverse();

  return [...top, ...bottom];
}

/** Full band width at a shared position: 1 level-index unit for discrete scales, else the smallest gap between distinct values. */
export function resolutionOf(
  scale: TrainedScale | undefined,
  values: number[],
): number {
  if (scale?.kind === "discrete") return 1;
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  let minGap = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    minGap = Math.min(minGap, sorted[i] - sorted[i - 1]);
  }
  return Number.isFinite(minGap) ? minGap : 1;
}

export function normalizeFontface(
  fontface: unknown,
  fallbackWeight: unknown = "normal",
  fallbackStyle: unknown = "normal",
): { weight: number | string; style: string } {
  const face = String(fontface ?? "").toLowerCase().replaceAll("_", ".");
  if (face === "bold.italic" || face === "bolditalic") {
    return { weight: "bold", style: "italic" };
  }
  if (face === "bold") return { weight: "bold", style: "normal" };
  if (face === "italic") return { weight: "normal", style: "italic" };
  if (face === "plain") return { weight: "normal", style: "normal" };
  return {
    weight: typeof fallbackWeight === "number" ||
        typeof fallbackWeight === "string"
      ? fallbackWeight
      : "normal",
    style: fallbackStyle === "italic" || fallbackStyle === "oblique"
      ? fallbackStyle
      : "normal",
  };
}

export function requiredValues(
  geom: string,
  mapping: Aes,
  data: GGSpec["data"],
  aes: keyof Aes,
): unknown[] {
  const column = mapping[aes];
  const values = valuesOf(data, column);
  if (!values) {
    throw new TypeError(`${geom} requires a mapped ${aes} aesthetic`);
  }
  return values;
}

export function stepPositions(
  positions: [number, number][],
  direction: unknown,
): [number, number][] {
  if (direction !== "hv" && direction !== "vh" && direction !== "mid") {
    throw new TypeError('geomStep direction must be "hv", "vh", or "mid"');
  }
  if (positions.length < 2) return positions;
  const out: [number, number][] = [positions[0]];
  for (let i = 1; i < positions.length; i++) {
    const [x0, y0] = positions[i - 1];
    const [x1, y1] = positions[i];
    if (direction === "hv") out.push([x1, y0]);
    if (direction === "vh") out.push([x0, y1]);
    if (direction === "mid") {
      const midpoint = (x0 + x1) / 2;
      out.push([midpoint, y0], [midpoint, y1]);
    }
    out.push([x1, y1]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// FlatTensor packing (gggplot-tzc.1 foundation). Compiler-internal: nothing
// here is emitted on a RenderNode yet — no geom mark file calls these until
// tzc.3/tzc.4 convert point/line/rect/area/polygon families to flat tensors.
// ---------------------------------------------------------------------------

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
    const [r, g, b] = parseColorRGBA(colors[i]);
    const a = alphas ? Math.max(0, Math.min(1, alphas[i])) : 1;
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
  return { array, format, dims, length: totalLength, size: [totalLength], version: 0 };
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
