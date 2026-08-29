// Tests for gggplot-tzc.2: flat-aware coordinate transforms (polarizeNode's
// FlatTensor branch, and the new munchFlatNode) over compile/coordinates.ts.
// These sit alongside the existing nested-array coord_polar pipeline tests
// in pipeline_test.ts, which stay untouched — this file only exercises the
// additive FlatTensor + MarkTopology path (nothing emits it yet; tzc.3/4).
import { assertAlmostEquals, assertEquals, assertThrows } from "@std/assert";
import { node, type RenderNode } from "../src/compile/rendertree.ts";
import type { FlatTensor, MarkTopology } from "../src/compile/rendertree.ts";
import { munchFlatNode, polarizeNode } from "../src/compile/coordinates.ts";

/**
 * Independent nested-array loop munch reference (the retired munchPolygonNode
 * oracle, gggplot-79f): subdivides each closed-loop edge into 16 points so the
 * flat munchFlatNode path can be checked against a second implementation.
 * Kept in the test only — production has one munch path (munchFlatNode).
 */
function referenceLoopMunch(
  loop: [number, number][],
  detail = 16,
): [number, number][] {
  if (loop.length < 2) return loop;
  const out: [number, number][] = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    for (let step = 0; step < detail; step++) {
      const t = step / detail;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/**
 * FlatTensor stores Float32Array (see compile/rendertree.ts) and its
 * arithmetic (map/lerp) runs on already-float32-rounded inputs, while the
 * legacy nested-array path computes the same map/lerp in full float64 on
 * un-rounded inputs — so "numerically equivalent" means equal up to float32
 * rounding error at each intermediate step (a handful of ULPs), not
 * bit-identical to a single final fround() of the float64 result.
 */
function assertFloat32Equivalent(actual: number[], expectedF64: number[]) {
  assertEquals(actual.length, expectedF64.length);
  for (let i = 0; i < actual.length; i++) {
    assertAlmostEquals(actual[i], expectedF64[i], 1e-4, `at index ${i}`);
  }
}

function flatPositions(
  pts: [number, number][],
  version = 0,
): FlatTensor {
  const array = new Float32Array(pts.length * 2);
  pts.forEach(([x, y], i) => {
    array[i * 2] = x;
    array[i * 2 + 1] = y;
  });
  return {
    array,
    format: "vec2<f32>",
    dims: 2,
    length: pts.length,
    size: [pts.length],
    version,
  };
}

function loopsTopology(chunk: number): MarkTopology {
  return { kind: "loops", chunks: Uint32Array.from([chunk]), loops: true };
}

// ---------------------------------------------------------------------------
// Flat vs nested numeric equivalence (loops)
// ---------------------------------------------------------------------------

Deno.test("flat loop munch under polar coords is numerically equivalent to the reference nested path", () => {
  const rect: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const domain: [number, number] = [0, 2];
  const start = -Math.PI;
  const end = Math.PI;

  // Reference: polarize the nested positions (polarizeNode handles nested
  // arrays too), then subdivide with the independent loop-munch reference.
  const nested = node("Polygon", { positions: rect });
  const polarizedNested = polarizeNode(nested, 0, domain, start, end);
  const nestedFlatArray = referenceLoopMunch(
    polarizedNested.props.positions as [number, number][],
  ).flat();

  const flat = node("Polygon", {
    positions: flatPositions(rect),
    topology: loopsTopology(4),
  });
  const flatOut = munchFlatNode(polarizeNode(flat, 0, domain, start, end));
  const flatPos = flatOut.props.positions as FlatTensor;

  // Density policy: 4 edges * 16 points/edge = 64 vertices, matching the
  // existing "coord_polar munches Polygon edges" pipeline test's 64.
  assertEquals(flatPos.length, 64);
  assertEquals(nestedFlatArray.length, 128);
  assertFloat32Equivalent(Array.from(flatPos.array), nestedFlatArray);

  const topo = flatOut.props.topology as MarkTopology;
  assertEquals(Array.from(topo.chunks!), [64]);
  assertEquals(topo.kind, "loops");
  assertEquals(topo.loops, true);
});

Deno.test("flat loop munch matches the reference density policy for a chunk with no explicit 'chunks' (whole tensor as one loop)", () => {
  const tri: [number, number][] = [[0, 0], [2, 0], [1, 1]];
  const nestedFlatArray = referenceLoopMunch(tri).flat();

  const flat = node("Polygon", {
    positions: flatPositions(tri),
    topology: { kind: "loops", loops: true }, // no 'chunks' — one implied chunk
  });
  const flatOut = munchFlatNode(flat);
  const flatPos = flatOut.props.positions as FlatTensor;

  assertEquals(flatPos.length, 48); // 3 edges * 16
  assertEquals(Array.from(flatPos.array), nestedFlatArray);
  // Input had no 'chunks'; output should not invent one either.
  assertEquals((flatOut.props.topology as MarkTopology).chunks, undefined);
});

// ---------------------------------------------------------------------------
// Polyline munching: interior segments only, no closing edge
// ---------------------------------------------------------------------------

Deno.test("flat polyline munch subdivides interior segments only, with no closing edge, and reaches the true endpoint", () => {
  const path: [number, number][] = [[0, 0], [1, 0], [1, 1]];
  const flat = node("Line", {
    positions: flatPositions(path),
    topology: { kind: "polyline", chunks: Uint32Array.from([3]) },
  });

  const out = munchFlatNode(flat);
  const pos = out.props.positions as FlatTensor;
  const topo = out.props.topology as MarkTopology;

  // 2 interior segments * 16 points/segment + 1 explicit final endpoint.
  assertEquals(pos.length, 33);
  assertEquals(Array.from(topo.chunks!), [33]);
  assertEquals(topo.kind, "polyline");

  // First emitted vertex is exactly the chunk's first vertex (t=0).
  assertEquals([pos.array[0], pos.array[1]], [0, 0]);
  // Last emitted vertex is exactly the chunk's true final vertex — proves
  // the path reaches its real endpoint despite interior-only subdivision.
  const lastIdx = pos.length - 1;
  assertEquals(
    [pos.array[lastIdx * 2], pos.array[lastIdx * 2 + 1]],
    [1, 1],
  );

  // No closing edge: a munched loop of the same 3-point shape would be 48
  // vertices (3 edges * 16); the polyline is materially fewer (33), and in
  // particular never revisits vertex 0 after the first sample.
  const revisitsStart = [] as number[];
  for (let i = 1; i < pos.length; i++) {
    if (pos.array[i * 2] === 0 && pos.array[i * 2 + 1] === 0) {
      revisitsStart.push(i);
    }
  }
  assertEquals(revisitsStart, []);
});

Deno.test("flat polyline munch is a strict passthrough for a degenerate (<2 vertex) chunk", () => {
  const single: [number, number][] = [[5, 5]];
  const flat = node("Line", {
    positions: flatPositions(single),
    topology: { kind: "polyline", chunks: Uint32Array.from([1]) },
  });
  const out = munchFlatNode(flat);
  const pos = out.props.positions as FlatTensor;
  assertEquals(pos.length, 1);
  assertEquals(Array.from(pos.array), [5, 5]);
});

// ---------------------------------------------------------------------------
// Companion expansion: piecewise-constant repetition of the segment start
// ---------------------------------------------------------------------------

Deno.test("companion (2-color) repetition stays aligned through loop munching", () => {
  // Unit square, vertices 0,1 red and 2,3 blue.
  const square: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const colors: FlatTensor = {
    array: Float32Array.from([
      1,
      0,
      0,
      1, // v0 red
      1,
      0,
      0,
      1, // v1 red
      0,
      0,
      1,
      1, // v2 blue
      0,
      0,
      1,
      1, // v3 blue
    ]),
    format: "vec4<f32>",
    dims: 4,
    length: 4,
    size: [4],
    version: 0,
  };
  const flat = node("Polygon", {
    positions: flatPositions(square),
    colors,
    topology: loopsTopology(4),
  });

  const out = munchFlatNode(flat);
  const outColors = out.props.colors as FlatTensor;
  assertEquals(outColors.length, 64);

  // Edge i's emitted vertices repeat vertex i's (the edge's START vertex)
  // color: edge0 starts at v0(red), edge1 at v1(red), edge2 at v2(blue),
  // edge3 at v3(blue) -> 32 red then 32 blue, aligned with the positions'
  // own edge order (not a naive "first half / second half" split).
  for (let v = 0; v < 32; v++) {
    assertEquals(
      Array.from(outColors.array.slice(v * 4, v * 4 + 4)),
      [1, 0, 0, 1],
      `vertex ${v} should be red`,
    );
  }
  for (let v = 32; v < 64; v++) {
    assertEquals(
      Array.from(outColors.array.slice(v * 4, v * 4 + 4)),
      [0, 0, 1, 1],
      `vertex ${v} should be blue`,
    );
  }
});

// ---------------------------------------------------------------------------
// indices-present rejection
// ---------------------------------------------------------------------------

Deno.test("munchFlatNode throws when topology.indices is already present", () => {
  const tri: [number, number][] = [[0, 0], [1, 0], [0, 1]];
  const flat = node("Face", {
    positions: flatPositions(tri),
    topology: {
      kind: "loops",
      chunks: Uint32Array.from([3]),
      loops: true,
      indices: Uint32Array.from([0, 1, 2]),
    },
  });
  assertThrows(
    () => munchFlatNode(flat),
    Error,
    "indices",
  );
});

// ---------------------------------------------------------------------------
// Dispatch ignores component name
// ---------------------------------------------------------------------------

Deno.test("munchFlatNode transforms a node by topology shape, independent of component name", () => {
  const rect: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const face = node("Face", {
    positions: flatPositions(rect),
    topology: loopsTopology(4),
  });

  // Dispatch is on topology 'loops', not component name: a Face munches the
  // same as any other loop mark (4 edges * 16 = 64 vertices).
  const flatResult = munchFlatNode(face);
  const pos = flatResult.props.positions as FlatTensor;
  assertEquals(pos.length, 64);
  assertEquals(flatResult.component, "Face");
});

Deno.test("polarizeNode transforms a FlatTensor+MarkTopology node regardless of component name", () => {
  const pts: [number, number][] = [[0, 10], [1, 20], [2, 30]];
  const flat = node("Face", {
    positions: flatPositions(pts, 7),
    topology: { kind: "points" },
  });

  const out = polarizeNode(flat, 1, [10, 30], -Math.PI, Math.PI);
  const pos = out.props.positions as FlatTensor;

  assertFloat32Equivalent(
    Array.from(pos.array),
    [0, -Math.PI, 1, 0, 2, Math.PI],
  );
  // Output version tracks input version (pointwise remap; same vertex set).
  assertEquals(pos.version, 7);
  // A brand-new array — never mutates the (possibly cached/shared) input.
  const originalArray = (flat.props.positions as FlatTensor).array;
  assertEquals(Array.from(originalArray), [0, 10, 1, 20, 2, 30]);
  assertEquals(pos.array === originalArray, false);
});

// ---------------------------------------------------------------------------
// Points topology: nothing to munch
// ---------------------------------------------------------------------------

Deno.test("munchFlatNode passes a 'points' topology node through unchanged", () => {
  const pts: [number, number][] = [[0, 0], [1, 1]];
  const flat = node("Point", {
    positions: flatPositions(pts),
    topology: { kind: "points" },
  });
  const out = munchFlatNode(flat);
  const pos = out.props.positions as FlatTensor;
  assertEquals(pos.length, 2);
  assertEquals(Array.from(pos.array), [0, 0, 1, 1]);
});

// ---------------------------------------------------------------------------
// Recursion into children
// ---------------------------------------------------------------------------

Deno.test("munchFlatNode recurses into children, munching flat descendants under a non-flat parent", () => {
  const rect: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const child: RenderNode = node("Face", {
    positions: flatPositions(rect),
    topology: loopsTopology(4),
  });
  const parent: RenderNode = node("Embedded", {}, [child]);

  const out = munchFlatNode(parent);
  const outChild = out.children[0];
  const pos = outChild.props.positions as FlatTensor;
  assertEquals(pos.length, 64);
});
