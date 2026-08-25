// Regression tests for gggplot-wjw: a declared position-scale domain is
// ggplot2's scale `limits`, so it must REMOVE rows outside it, not merely
// narrow the view.
//
// Before the fix, a declared domain narrowed the panel range but left every
// row in the data, and nothing downstream clips (there is no scissor in the
// render layer), so an out-of-range mark drew outside the panel over the axes
// and margins.
import { assertEquals } from "@std/assert";
import {
  geomErrorbar,
  geomHistogram,
  geomPoint,
  ggplot,
  scaleXContinuous,
  scaleXDiscrete,
  scaleYContinuous,
  scaleZContinuous,
} from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";
import { censorToScaleLimits } from "../src/scale/censor.ts";
import { ingest } from "../src/data/mod.ts";

function findNodes(node: RenderNode, component: string): RenderNode[] {
  return [
    ...(node.component === component ? [node] : []),
    ...(node.children ?? []).flatMap((child) => findNodes(child, component)),
  ];
}

/** Per-row coordinates of the first mark node of the given component. */
function coords(tree: RenderNode, component: string): number[] {
  const tensor = findNodes(tree, component)[0]?.props.positions as
    | { array: ArrayLike<number> }
    | undefined;
  return tensor ? Array.from(tensor.array) : [];
}

const rowsOf = (tree: RenderNode, component: string): number =>
  (findNodes(tree, component)[0]?.props.positions as { length?: number })
    ?.length ?? 0;

Deno.test("a continuous domain removes rows outside it", () => {
  // The bead's own repro: x = 10 is neither dropped nor clamped before the fix.
  const tree = compile(
    ggplot({ x: [0, 1, 10], y: [0, 1, 2] }, { x: "x", y: "y" })
      .add(geomPoint(), scaleXContinuous({ domain: [0, 1] })).build(),
  ) as RenderNode;
  assertEquals(rowsOf(tree, "Point"), 2);
  assertEquals(coords(tree, "Point"), [0, 0, 1, 1]);
});

Deno.test("a domain wider than the data removes nothing", () => {
  const tree = compile(
    ggplot({ x: [0, 1, 10], y: [0, 1, 2] }, { x: "x", y: "y" })
      .add(geomPoint(), scaleXContinuous({ domain: [0, 20] })).build(),
  ) as RenderNode;
  assertEquals(rowsOf(tree, "Point"), 3);
  assertEquals(coords(tree, "Point"), [0, 0, 1, 1, 10, 2]);
});

Deno.test("censoring runs before the stat, so limits change what it bins", () => {
  // This is the reason limits cannot be implemented as a scissor: a clip would
  // hide the outlier while stat_bin still counted it.
  const build = (domain?: [number, number]) => {
    const base = ggplot({ x: [0, 1, 2, 3, 50] }, { x: "x" });
    return compile(
      (domain
        ? base.add(geomHistogram({ binwidth: 1 }), scaleXContinuous({ domain }))
        : base.add(geomHistogram({ binwidth: 1 }))).build(),
    ) as RenderNode;
  };
  const wide = rowsOf(build(), "ChunkedFace");
  const censored = rowsOf(build([0, 3]), "ChunkedFace");
  // Without limits the empty bins spanning 3..50 dominate the geometry; with
  // them the histogram covers only the four retained rows.
  assertEquals(wide > censored, true, `${wide} should exceed ${censored}`);
  assertEquals(censored, 12);
});

Deno.test("a discrete domain removes rows whose level it omits", () => {
  const tree = compile(
    ggplot(
      { g: ["a", "b", "c"], y: [1, 2, 3] },
      { x: "g", y: "y" },
    ).add(geomPoint(), scaleXDiscrete({ domain: ["a", "b"] })).build(),
  ) as RenderNode;
  assertEquals(rowsOf(tree, "Point"), 2);
});

Deno.test("limits censor every column on their axis, not just the primary one", () => {
  // An errorbar whose ymax escapes the limits is as out-of-range as a point
  // whose y does, so the whole y family is tested — matching the column
  // families scale training already widens the domain over.
  const frame = { x: [0, 1], y: [1, 1], ymin: [0, 0], ymax: [2, 99] };
  const mapping = { x: "x", y: "y", ymin: "ymin", ymax: "ymax" };
  const spec = ggplot(frame, mapping)
    .add(geomErrorbar(), scaleYContinuous({ domain: [0, 10] })).build();

  // Row 1 is retained by y (1 is in range) and by ymin (0 is), and excluded
  // only by ymax = 99 — so this fails if the family is not swept.
  const censored = censorToScaleLimits(spec, mapping, ingest(frame));
  assertEquals(censored.x.values, [0]);
  assertEquals(censored.ymax.values, [2]);

  // And it reaches the rendered mark: one stem instead of two.
  const stems = coords(compile(spec) as RenderNode, "Line");
  const uncensored = coords(
    compile(ggplot(frame, mapping).add(geomErrorbar()).build()) as RenderNode,
    "Line",
  );
  assertEquals(stems.length < uncensored.length, true);
});

Deno.test("a z domain censors in 3D", () => {
  const tree = compile(
    ggplot(
      { x: [0, 1, 2], y: [0, 1, 2], z: [0, 1, 50] },
      { x: "x", y: "y", z: "z" },
    ).add(geomPoint(), scaleZContinuous({ domain: [0, 10] })).build(),
  ) as RenderNode;
  assertEquals(rowsOf(tree, "Point"), 2);
});

Deno.test("missing values are left to gggplot-bab, not censored here", () => {
  // null/NaN means "no position", which is a different defect with a different
  // fix. Folding it in would make a future "Removed N rows" count ambiguous.
  const frame = { x: [0, null, 1], y: [0, 1, 1] };
  const censored = censorToScaleLimits(
    ggplot(frame as never, { x: "x", y: "y" })
      .add(geomPoint(), scaleXContinuous({ domain: [0, 1] })).build(),
    { x: "x", y: "y" },
    ingest(frame as never),
  );
  assertEquals(censored.x.values.length, 3, "the null row is retained");
});

Deno.test("no declared domain returns the same frame, allocating nothing", () => {
  const data = ingest({ x: [0, 1, 10], y: [0, 1, 2] });
  const spec = ggplot({ x: [0, 1, 10], y: [0, 1, 2] }, { x: "x", y: "y" })
    .add(geomPoint()).build();
  assertEquals(
    censorToScaleLimits(spec, { x: "x", y: "y" }, data) === data,
    true,
  );
});
