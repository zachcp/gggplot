// Tests for gggplot-tzc.1: the FlatTensor/MarkTopology renderer-facing
// contract (compile/rendertree.ts) and the compiler-internal PackedGeometry
// packing helpers (geom/shared.ts). Foundation-stage only — no geom mark
// file emits FlatTensor yet (that starts in tzc.3/tzc.4).
import { assertEquals } from "@std/assert";
import type { FlatTensor, MarkTopology } from "../src/compile/rendertree.ts";
import {
  colorWithAlpha,
  concatPacked,
  expandByOwners,
  packColorsRGBA,
  type PackedGeometry,
  packMarkRows,
  packScalar,
} from "../src/geom/shared.ts";
import { serializeTypedArrays } from "../../../scripts/capture_geom_fixtures.ts";

// ---------------------------------------------------------------------------
// Interleaved layout
// ---------------------------------------------------------------------------

Deno.test("packMarkRows positions are interleaved [x0,y0,x1,y1,...], not planar", () => {
  const packed = packMarkRows({ xs: [1, 3], ys: [2, 4] });
  assertEquals(Array.from(packed.positions.array), [1, 2, 3, 4]);
  assertEquals(packed.positions.format, "vec2<f32>");
  assertEquals(packed.positions.dims, 2);
  assertEquals(packed.positions.length, 2);
  assertEquals(packed.positions.size, [2]);
  assertEquals(packed.positions.version, 0);
});

// ---------------------------------------------------------------------------
// Mid-data invalid-row alignment
// ---------------------------------------------------------------------------

Deno.test("packMarkRows drops a mid-data NaN row consistently across positions, color, and size", () => {
  const xs = [0, 1, NaN, 3];
  const ys = [0, 1, 2, 3];
  const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffffff"];
  const sizes = [1, 2, 3, 4];

  const packed = packMarkRows({ xs, ys, colors, sizes });

  // Row index 2 (NaN x) is dropped; rows 0, 1, 3 survive in order.
  assertEquals(Array.from(packed.mask), [1, 1, 0, 1]);
  assertEquals(Array.from(packed.positions.array), [0, 0, 1, 1, 3, 3]);
  assertEquals(packed.positions.length, 3);

  // Color for row 3 (white) must land at packed slot 2, not slot 3 — proves
  // color packing walked the SAME mask as positions, not an independent
  // finite-check over its own array.
  assertEquals(packed.colors!.length, 3);
  const c = packed.colors!.array;
  assertEquals([c[0], c[1], c[2], c[3]], [1, 0, 0, 1]); // row 0: red, alpha 1
  assertEquals([c[4], c[5], c[6], c[7]], [0, 1, 0, 1]); // row 1: green
  assertEquals([c[8], c[9], c[10], c[11]], [1, 1, 1, 1]); // row 3: white

  assertEquals(Array.from(packed.sizes!.array), [1, 2, 4]);
});

Deno.test("packMarkRows also drops rows on a non-finite y", () => {
  const packed = packMarkRows({ xs: [0, 1, 2], ys: [0, Infinity, 2] });
  assertEquals(Array.from(packed.mask), [1, 0, 1]);
  assertEquals(Array.from(packed.positions.array), [0, 0, 2, 2]);
});

// ---------------------------------------------------------------------------
// expandByOwners
// ---------------------------------------------------------------------------

Deno.test("expandByOwners expands a per-row bar color to its 4 vertices, keeping alignment", () => {
  // Two bars, 4 vertices each, row-major colors: bar0 red, bar1 blue.
  const rowColors: FlatTensor = {
    array: Float32Array.from([1, 0, 0, 1, /* red */ 0, 0, 1, 1 /* blue */]),
    format: "vec4<f32>",
    dims: 4,
    length: 2,
    size: [2],
    version: 0,
  };
  const owners = Uint32Array.from([0, 0, 0, 0, 1, 1, 1, 1]);

  const expanded = expandByOwners(rowColors, owners);

  assertEquals(expanded.length, 8);
  assertEquals(expanded.dims, 4);
  assertEquals(expanded.format, "vec4<f32>");
  for (let v = 0; v < 4; v++) {
    assertEquals(
      Array.from(expanded.array.slice(v * 4, v * 4 + 4)),
      [1, 0, 0, 1],
      `vertex ${v} should carry bar0's red`,
    );
  }
  for (let v = 4; v < 8; v++) {
    assertEquals(
      Array.from(expanded.array.slice(v * 4, v * 4 + 4)),
      [0, 0, 1, 1],
      `vertex ${v} should carry bar1's blue`,
    );
  }
});

Deno.test("expandByOwners handles a scalar (dims=1) row tensor", () => {
  const rowSizes: FlatTensor = {
    array: Float32Array.from([5, 9]),
    format: "f32",
    dims: 1,
    length: 2,
    size: [2],
    version: 0,
  };
  const owners = Uint32Array.from([1, 1, 0, 0]);
  const expanded = expandByOwners(rowSizes, owners);
  assertEquals(Array.from(expanded.array), [9, 9, 5, 5]);
});

// ---------------------------------------------------------------------------
// MarkTopology has no owners field (type-level)
// ---------------------------------------------------------------------------

// If 'owners' is ever added back to MarkTopology, this assignment becomes
// legal and `never` is no longer assignable to it in the failing direction
// — the type below collapses to `never`, and assigning `true` to `never`
// fails `deno check`.
type _AssertMarkTopologyHasNoOwners = "owners" extends keyof MarkTopology
  ? "FAIL: MarkTopology must not have an owners field"
  : true;
const _assertMarkTopologyHasNoOwners: _AssertMarkTopologyHasNoOwners = true;

Deno.test("MarkTopology/PackedGeometry separation: owners lives only on PackedGeometry", () => {
  void _assertMarkTopologyHasNoOwners;
  // Runtime companion to the type-level assertion above: a PackedGeometry
  // can carry owners; its topology (the renderer-facing slice) cannot.
  const geom: PackedGeometry = {
    positions: {
      array: new Float32Array(0),
      format: "vec2<f32>",
      dims: 2,
      length: 0,
      size: [0],
      version: 0,
    },
    topology: { kind: "points" },
    owners: new Uint32Array([0]),
  };
  assertEquals("owners" in geom.topology, false);
  assertEquals(Object.keys(geom.topology).sort(), ["kind"]);
});

// ---------------------------------------------------------------------------
// RGBA parsing (colorWithAlpha / packColorsRGBA share one hex parser)
// ---------------------------------------------------------------------------

Deno.test("colorWithAlpha expands #rgb and folds alpha into a #rrggbbaa string", () => {
  assertEquals(colorWithAlpha("#abc", 1), "#aabbccff");
  assertEquals(colorWithAlpha("#aabbcc", 0.5), "#aabbcc80");
  assertEquals(colorWithAlpha("#aabbcc", 0), "#aabbcc00");
  // out-of-range alpha clamps
  assertEquals(colorWithAlpha("#aabbcc", 2), "#aabbccff");
  // non-hex colors pass through unchanged (no CSS named-color table here)
  assertEquals(colorWithAlpha("steelblue", 0.5), "steelblue");
});

Deno.test("packColorsRGBA normalizes hex colors to 0..1 and folds per-row alpha", () => {
  const mask = new Uint8Array([1, 1]);
  const packed = packColorsRGBA(["#ff0000", "#0000ff"], mask, [1, 0.5]);
  assertEquals(packed.format, "vec4<f32>");
  assertEquals(packed.dims, 4);
  assertEquals(packed.length, 2);
  assertEquals(Array.from(packed.array), [1, 0, 0, 1, 0, 0, 1, 0.5]);
});

Deno.test("packColorsRGBA respects the mask (skips masked-out rows) and defaults alpha to 1", () => {
  const mask = new Uint8Array([1, 0, 1]);
  const packed = packColorsRGBA(["#ffffff", "#000000", "#008000"], mask);
  assertEquals(packed.length, 2);
  assertEquals(
    Array.from(packed.array),
    Array.from(Float32Array.from([1, 1, 1, 1, 0, 128 / 255, 0, 1])),
  );
});

Deno.test("packScalar respects the mask", () => {
  const mask = new Uint8Array([0, 1, 1, 0]);
  const packed = packScalar([10, 20, 30, 40], mask);
  assertEquals(Array.from(packed.array), [20, 30]);
  assertEquals(packed.format, "f32");
  assertEquals(packed.dims, 1);
});

// ---------------------------------------------------------------------------
// concatPacked: chunk/owner bookkeeping, empty-group elision
// ---------------------------------------------------------------------------

function point(x: number, y: number): PackedGeometry {
  return {
    positions: {
      array: Float32Array.from([x, y]),
      format: "vec2<f32>",
      dims: 2,
      length: 1,
      size: [1],
      version: 0,
    },
    topology: { kind: "points" },
  };
}

function emptyGroup(): PackedGeometry {
  return {
    positions: {
      array: new Float32Array(0),
      format: "vec2<f32>",
      dims: 2,
      length: 0,
      size: [0],
      version: 0,
    },
    topology: { kind: "points" },
  };
}

Deno.test("concatPacked concatenates positions and emits per-group chunk lengths", () => {
  const groupA: PackedGeometry = {
    positions: {
      array: Float32Array.from([0, 0, 1, 1]),
      format: "vec2<f32>",
      dims: 2,
      length: 2,
      size: [2],
      version: 0,
    },
    topology: { kind: "points" },
  };
  const groupB: PackedGeometry = {
    positions: {
      array: Float32Array.from([2, 2, 3, 3, 4, 4]),
      format: "vec2<f32>",
      dims: 2,
      length: 3,
      size: [3],
      version: 0,
    },
    topology: { kind: "points" },
  };

  const combined = concatPacked([groupA, groupB]);
  assertEquals(
    Array.from(combined.positions.array),
    [0, 0, 1, 1, 2, 2, 3, 3, 4, 4],
  );
  assertEquals(combined.positions.length, 5);
  assertEquals(Array.from(combined.topology.chunks!), [2, 3]);
});

Deno.test("concatPacked elides empty groups from both tensors and chunk entries", () => {
  const combined = concatPacked([point(0, 0), emptyGroup(), point(1, 1)]);
  assertEquals(Array.from(combined.positions.array), [0, 0, 1, 1]);
  assertEquals(combined.positions.length, 2);
  // Only 2 chunk entries — the empty group contributes none.
  assertEquals(Array.from(combined.topology.chunks!), [1, 1]);
});

Deno.test("concatPacked re-bases owners by each preceding group's own row span", () => {
  // Two bar groups, each with 2 source rows expanded to 4 vertices/row-owner
  // pairs (2 rows * 2 vertices each, to keep the fixture small).
  const groupA: PackedGeometry = {
    positions: {
      array: Float32Array.from([0, 0, 0, 1, 1, 0, 1, 1]),
      format: "vec2<f32>",
      dims: 2,
      length: 4,
      size: [4],
      version: 0,
    },
    topology: { kind: "loops", loops: true },
    owners: Uint32Array.from([0, 0, 1, 1]), // 2 source rows in group A
  };
  const groupB: PackedGeometry = {
    positions: {
      array: Float32Array.from([2, 0, 2, 1, 3, 0, 3, 1]),
      format: "vec2<f32>",
      dims: 2,
      length: 4,
      size: [4],
      version: 0,
    },
    topology: { kind: "loops", loops: true },
    owners: Uint32Array.from([0, 0, 1, 1]), // group B's OWN row-local owners
  };

  const combined = concatPacked([groupA, groupB]);
  // Group A's row span is 2 (rows 0,1), so group B's owners are offset by 2.
  assertEquals(
    Array.from(combined.owners!),
    [0, 0, 1, 1, 2, 2, 3, 3],
  );
  assertEquals(Array.from(combined.topology.chunks!), [4, 4]);
  assertEquals(combined.topology.kind, "loops");
  assertEquals(combined.topology.loops, true);
  assertEquals("owners" in combined.topology, false);
});

Deno.test("concatPacked handles all-empty input", () => {
  const combined = concatPacked([emptyGroup(), emptyGroup()]);
  assertEquals(combined.positions.length, 0);
  assertEquals(combined.topology.chunks, undefined);
});

// ---------------------------------------------------------------------------
// Fixture serializer round-trip
// ---------------------------------------------------------------------------

Deno.test("serializeTypedArrays round-trips Float32Array as {$f32:[...]} through JSON", () => {
  const payload = { positions: Float32Array.from([1, 2.5, -3]) };
  const json = JSON.stringify(payload, serializeTypedArrays);
  assertEquals(JSON.parse(json), { positions: { $f32: [1, 2.5, -3] } });
});

Deno.test("serializeTypedArrays round-trips Uint32Array as {$u32:[...]} through JSON", () => {
  const payload = { chunks: Uint32Array.from([4, 6, 0]) };
  const json = JSON.stringify(payload, serializeTypedArrays);
  assertEquals(JSON.parse(json), { chunks: { $u32: [4, 6, 0] } });
});

Deno.test("serializeTypedArrays rounds Float32Array noise to 6 decimal places", () => {
  const noisy = Float32Array.from([0.1]); // 0.10000000149011612 as float64
  const json = JSON.stringify({ v: noisy }, serializeTypedArrays);
  assertEquals(JSON.parse(json), { v: { $f32: [0.1] } });
});

Deno.test("serializeTypedArrays leaves plain arrays/values untouched", () => {
  const json = JSON.stringify({ a: [1, 2, 3], b: "x" }, serializeTypedArrays);
  assertEquals(JSON.parse(json), { a: [1, 2, 3], b: "x" });
});
