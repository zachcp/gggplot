import { assert, assertEquals, assertStrictEquals } from "@std/assert";
import { reuseUnchanged } from "../src/compile/stable_tensors.ts";
import type { RenderNode } from "../src/compile/mod.ts";
import { geomLine, geomPoint, ggplot } from "../src/dsl/mod.ts";
import { ingest } from "../src/data/mod.ts";
import { assembleTree } from "./support/assemble.ts";

Deno.test("reuseUnchanged returns prev for byte-equal typed arrays", () => {
  const prev = Float32Array.of(1, 2, 3);
  assertStrictEquals(reuseUnchanged(Float32Array.of(1, 2, 3), prev), prev);
  const changed = Float32Array.of(1, 2, 4);
  assertStrictEquals(reuseUnchanged(changed, prev), changed);
  // Same bytes, different element type: not interchangeable.
  const ints = Uint32Array.of(1, 2, 3);
  assertStrictEquals(reuseUnchanged(ints, Int32Array.of(1, 2, 3)), ints);
});

Deno.test("reuseUnchanged keeps unchanged parts of a changed structure", () => {
  const positions = { array: Float32Array.of(0, 0, 1, 1), dims: 2 };
  const prev = { positions, colors: { array: Float32Array.of(1, 0, 0, 1) } };
  const next = {
    positions: { array: Float32Array.of(0, 0, 1, 1), dims: 2 },
    colors: { array: Float32Array.of(0, 0, 1, 1) },
  };
  const out = reuseUnchanged(next, prev);
  assert(out !== prev);
  assertStrictEquals(out.positions, positions);
  assertStrictEquals(out.colors, next.colors);
  // A missing or extra key is a change.
  const extra = reuseUnchanged({ ...prev, size: 1 }, prev);
  assert(extra !== prev);
  assertStrictEquals(extra.positions, positions);
});

Deno.test("reuseUnchanged on lowered marks: a fixed-color change keeps positions", () => {
  const data = ingest({ x: [1, 2, 3, 4], y: [4, 1, 3, 2] });
  const lower = (color: string) =>
    assembleTree(
      ggplot(data, { x: "x", y: "y" })
        .add(geomPoint({ color }))
        .add(geomLine({ color: "#ef4444" }))
        .build(),
    );
  const marks = (tree: RenderNode): RenderNode[] =>
    tree.component === "Point" || tree.component === "ChunkedLine"
      ? [tree]
      : tree.children.flatMap(marks);
  const before = marks(lower("#3b82f6"));
  const after = reuseUnchanged(marks(lower("#22c55e")), before);
  assertEquals(after.length, 2);
  const [point, line] = after;
  // The line is untouched, so it comes back whole.
  assertStrictEquals(line, before[1]);
  // The point's positions are reused; its color is new.
  assertStrictEquals(point.props.positions, before[0].props.positions);
  assert(point.props.color !== before[0].props.color);
});
