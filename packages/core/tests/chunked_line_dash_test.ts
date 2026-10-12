// Tests for gggplot-xc9: ChunkedLine's dash material (render/chunked_line.tsx).
//
// Deno has no real WebGPU device (see gpu_instrument_test.ts's module doc for
// the same limitation), and ChunkedLine's live function body calls
// @use-gpu/live hooks that require a mounted Live fiber, so it cannot be
// invoked directly here. This tests the pure uniform/arc-length derivation
// the dash material is built from, and the RenderTree wiring of dashed and
// solid lines. (The emitted-module checks went with the frozen emitter in
// gggplot-vnh.11; the doc site's dashed examples cover the live material.)
import { assertEquals } from "@std/assert";
import {
  computeArcLengths,
  packDashUniforms,
} from "../src/render/chunked_line.tsx";
import type { FlatTensor } from "../src/compile/rendertree.ts";
import { geomLine, ggplot } from "../src/dsl/mod.ts";

import type { RenderNode } from "../src/compile/rendertree.ts";
import { assembleTree } from "./support/assemble.ts";

function findNodes(tree: RenderNode, component: string): RenderNode[] {
  return [
    ...(tree.component === component ? [tree] : []),
    ...tree.children.flatMap((child) => findNodes(child, component)),
  ];
}

// ---------------------------------------------------------------------------
// packDashUniforms
// ---------------------------------------------------------------------------

Deno.test("packDashUniforms: no dash (undefined or empty) returns null -- solid lines must not touch MaterialContext", () => {
  assertEquals(packDashUniforms(undefined), null);
  assertEquals(packDashUniforms([]), null);
});

Deno.test("packDashUniforms: 'dashed' [8,5] packs into a zero-padded vec4 with count and total", () => {
  assertEquals(packDashUniforms([8, 5]), {
    array: [8, 5, 0, 0],
    count: 2,
    total: 13,
  });
});

Deno.test("packDashUniforms: 'dotdash' [1,4,8,4] fills all four slots", () => {
  assertEquals(packDashUniforms([1, 4, 8, 4]), {
    array: [1, 4, 8, 4],
    count: 4,
    total: 17,
  });
});

Deno.test("packDashUniforms: a pattern longer than MAX_DASH_SEGMENTS truncates to the first 4 segments", () => {
  const result = packDashUniforms([1, 2, 3, 4, 5, 6]);
  assertEquals(result, {
    array: [1, 2, 3, 4],
    count: 4,
    total: 10, // truncated tail (5, 6) is excluded from the total too
  });
});

// ---------------------------------------------------------------------------
// computeArcLengths
// ---------------------------------------------------------------------------

function tensor(values: number[]): FlatTensor {
  return {
    array: Float32Array.from(values),
    format: "vec2<f32>",
    dims: 2,
    length: values.length / 2,
    size: [values.length / 2],
  };
}

Deno.test("computeArcLengths: cumulative distance along a single chunk, starting at 0", () => {
  // (0,0) -> (3,4) -> (3,8): leg lengths 5, then 4.
  const positions = tensor([0, 0, 3, 4, 3, 8]);
  const arcs = computeArcLengths(positions, Uint32Array.of(3));
  assertEquals(Array.from(arcs.array), [0, 5, 9]);
  assertEquals(arcs.format, "f32");
  assertEquals(arcs.dims, 1);
  assertEquals(arcs.length, 3);
  assertEquals(arcs.size, [3]);
});

Deno.test("computeArcLengths: resets to 0 at each chunk's first vertex", () => {
  // Chunk 0: (0,0) -> (10,0)  (length 10)
  // Chunk 1: (5,5) -> (5,9)   (length 4) -- must NOT carry over chunk 0's 10
  const positions = tensor([0, 0, 10, 0, 5, 5, 5, 9]);
  const arcs = computeArcLengths(positions, Uint32Array.of(2, 2));
  assertEquals(Array.from(arcs.array), [0, 10, 0, 4]);
});

Deno.test("computeArcLengths: a single-vertex chunk stays at 0 (no leg to accumulate)", () => {
  const positions = tensor([1, 1, 4, 5, 9, 9]);
  const arcs = computeArcLengths(positions, Uint32Array.of(1, 1, 1));
  assertEquals(Array.from(arcs.array), [0, 0, 0]);
});

// ---------------------------------------------------------------------------
// End-to-end: dashed vs. solid geom_line
// ---------------------------------------------------------------------------

Deno.test("gggplot-xc9: a dashed geom_line's ChunkedLine node carries a 'dash' prop; a solid one does not", () => {
  const spec = ggplot(
    {
      x: [0, 1, 2, 0, 1, 2],
      y: [1, 2, 1, 3, 4, 3],
      grp: [
        "a",
        "a",
        "a",
        "b",
        "b",
        "b",
      ],
    },
    { x: "x", y: "y", group: "grp", linetype: "grp" },
  ).add(geomLine()).build();
  const tree = assembleTree(spec);
  const lines = findNodes(tree, "ChunkedLine");

  assertEquals(lines.length, 2);
  const withDash = lines.filter((n) => n.props.dash !== undefined);
  const withoutDash = lines.filter((n) => n.props.dash === undefined);
  assertEquals(withDash.length, 1);
  assertEquals(withoutDash.length, 1);
  assertEquals(withDash[0].props.dash, [8, 5]);
});
