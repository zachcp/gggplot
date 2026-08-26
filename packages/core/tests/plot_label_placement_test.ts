// Regression tests for gggplot-5ze: plot title/subtitle/caption/tag are
// anchored a fixed 4% in from a canvas edge, so they must be ALIGNED to that
// edge rather than centred on it.
//
// use.GPU's Label defaults to placement 'center', and its vertex shader
// offsets each glyph quad by `(placement - 1) * 0.5 * shape`. With 'center'
// that is -shape/2, so the label reaches half its PIXEL width either side of
// the anchor — while the anchor is a fixed FRACTION of the canvas. Any title
// wider than 8% of the canvas therefore hangs off the left edge. Measured on
// the #model-inspection route (912px canvases), the title's leftmost inked
// column was 0 before this fix and 38 after, against a 36.5px anchor.
import { assertEquals } from "@std/assert";
import { geomPoint, ggplot, labels as plotLabels } from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";

function findNodes(node: RenderNode, component: string): RenderNode[] {
  return [
    ...(node.component === component ? [node] : []),
    ...(node.children ?? []).flatMap((child) => findNodes(child, component)),
  ];
}

/** The overlay Label carrying exactly this text. */
function labelFor(tree: RenderNode, text: string): RenderNode {
  const match = findNodes(tree, "Label").filter((node) =>
    Array.isArray(node.props.labels) &&
    (node.props.labels as string[]).includes(text)
  );
  assertEquals(match.length, 1, `expected one Label carrying "${text}"`);
  return match[0];
}

const treeWith = (parts: Parameters<typeof plotLabels>[0]) =>
  compile(
    ggplot({ x: [0, 1, 2], y: [0, 1, 2] }, { x: "x", y: "y" })
      .add(geomPoint(), plotLabels(parts)).build(),
  ) as RenderNode;

Deno.test("left-corner plot text is left-aligned, not centred on its anchor", () => {
  const tree = treeWith({
    title: "Parameter bytes by tensor",
    subtitle: "a subtitle",
    caption: "a caption",
  });
  for (const text of ["Parameter bytes by tensor", "a subtitle", "a caption"]) {
    assertEquals(labelFor(tree, text).props.placement, "left", text);
  }
});

Deno.test("the right-corner tag is right-aligned so it cannot overflow", () => {
  const tree = treeWith({ tag: "A" });
  const tag = labelFor(tree, "A");
  assertEquals(tag.props.placement, "right");
  // Anchored on the right side of the canvas, mirroring the left corner.
  assertEquals((tag.props.positions as [number, number][])[0][0], 0.92);
});

Deno.test("title placement does not depend on title length or canvas size", () => {
  // The anchor is a fixed fraction; only the alignment keeps a long title on
  // canvas. Both must hold for any string.
  const short = labelFor(treeWith({ title: "n" }), "n");
  const long = labelFor(
    treeWith({
      title: "an extremely long plot title that far exceeds the panel",
    }),
    "an extremely long plot title that far exceeds the panel",
  );
  assertEquals(short.props.placement, long.props.placement);
  assertEquals(
    (short.props.positions as [number, number][])[0],
    (long.props.positions as [number, number][])[0],
  );
});

Deno.test("axis tick labels stay centred, which is correct for them", () => {
  // A tick label straddles its tick on purpose — this fix must not leak into
  // the guides, so their absent placement is the assertion.
  const tree = treeWith({ title: "t" });
  const ticks = findNodes(tree, "Label").filter((node) =>
    Array.isArray(node.props.labels) &&
    (node.props.labels as string[]).length > 2
  );
  assertEquals(ticks.length > 0, true, "expected tick label nodes");
  for (const tick of ticks) assertEquals(tick.props.placement, undefined);
});
