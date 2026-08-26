// Regression tests for gggplot-ybv: 2D geom_text and geom_label used to draw a
// glyph for a row with no position.
//
// The mechanism is worth stating, because the bug is invisible at the call
// site: ingest() turns NaN into null, and scalePosition maps null onto a
// perfectly finite coordinate — Number(null) === 0 on a continuous scale,
// String(null).indexOf() === -1 on a discrete one. So lowerText's
// `every(Number.isFinite)` check on the SCALED value could never fire for a
// missing input, and the row was drawn at the origin instead of dropped.
// The fix tests the RAW value first, via shared.ts's isMissingPosition.
//
// The 3D path already did this (gggplot-lcy.11, covered in text_3d_test.ts);
// these tests pin the 2D path to the same behaviour.
import { assertEquals } from "@std/assert";
import { geomLabel, geomText, ggplot } from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";
import { isMissingPosition } from "../src/geom/shared.ts";

const mapping = { x: "x", y: "y", label: "label" };
const layout = {
  width: 640,
  height: 480,
  measureText: approximateTextMeasurer,
};

function findNodes(node: RenderNode, component: string): RenderNode[] {
  return [
    ...(node.component === component ? [node] : []),
    ...(node.children ?? []).flatMap((child) => findNodes(child, component)),
  ];
}

/** The in-panel mark Label node: its positions are a packed vec2 FlatTensor,
 * unlike the axis/title guide Labels, whose positions are plain arrays. */
function markLabel(spec: Parameters<typeof compile>[0]): RenderNode {
  const marks = findNodes(compile(spec, { layout }), "Label").filter(
    (node) => !Array.isArray(node.props.positions),
  );
  assertEquals(marks.length, 1, "expected exactly one mark Label node");
  return marks[0];
}

/** Unpack a mark Label's vec4 colour FlatTensor into per-row RGBA tuples. */
function vec4s(node: RenderNode): number[][] {
  const tensor = node.props.colors as { array: ArrayLike<number> };
  const flat = Array.from(tensor.array);
  const out: number[][] = [];
  for (let i = 0; i < flat.length; i += 4) out.push(flat.slice(i, i + 4));
  return out;
}

/** Unpack the vec2 FlatTensor a mark Label carries into [x,y] pairs. */
function anchors(node: RenderNode): [number, number][] {
  const tensor = node.props.positions as { array: ArrayLike<number> };
  const flat = Array.from(tensor.array);
  const out: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
  return out;
}

Deno.test("geom_text drops a row whose y is NaN rather than drawing it at 0", () => {
  const node = markLabel(
    ggplot(
      { x: [0, 1, 2], y: [0, Number.NaN, 2], label: ["a", "b", "c"] },
      mapping,
    )
      .add(geomText()).build(),
  );
  // Before the fix: labels ["a","b","c"] at (0,0),(1,0),(2,2) — "b" placed at
  // y=0, a coordinate its data never had.
  assertEquals(node.props.labels, ["a", "c"]);
  assertEquals(anchors(node), [[0, 0], [2, 2]]);
});

Deno.test("geom_text drops a row whose x is null", () => {
  const node = markLabel(
    ggplot(
      { x: [0, null, 2], y: [0, 1, 2], label: ["a", "b", "c"] } as never,
      mapping,
    ).add(geomText()).build(),
  );
  assertEquals(node.props.labels, ["a", "c"]);
  assertEquals(anchors(node), [[0, 0], [2, 2]]);
});

Deno.test("geom_label drops a row with no position", () => {
  const node = markLabel(
    ggplot(
      { x: [0, 1, 2], y: [0, Number.NaN, 2], label: ["a", "b", "c"] },
      mapping,
    )
      .add(geomLabel()).build(),
  );
  assertEquals(node.props.labels, ["a", "c"]);
  assertEquals(anchors(node), [[0, 0], [2, 2]]);
});

Deno.test("dropping a row keeps the surviving labels aligned with their aesthetics", () => {
  // The drop happens before packing, so a per-row aesthetic must be filtered
  // by the same retained set. If it were not, "c" would silently inherit
  // "b"'s colour — an off-by-one that no count-based assertion would catch,
  // so this compares the actual colours against the undropped baseline.
  const frame = (y: number[]) => ({
    x: [0, 1, 2],
    y,
    label: ["a", "b", "c"],
    grp: ["one", "two", "three"],
  });
  const build = (y: number[]) =>
    markLabel(
      ggplot(frame(y), { ...mapping, color: "grp" }).add(geomText()).build(),
    );

  const clean = vec4s(build([0, 1, 2]));
  const holed = build([0, Number.NaN, 2]);
  assertEquals(holed.props.labels, ["a", "c"]);
  // "c" must keep its OWN colour (clean row 2), not slide into "b"'s.
  assertEquals(vec4s(holed), [clean[0], clean[2]]);
});

Deno.test("a fully-positioned dataset is unaffected", () => {
  const node = markLabel(
    ggplot({ x: [0, 1, 2], y: [0, 1, 2], label: ["a", "b", "c"] }, mapping)
      .add(geomText()).build(),
  );
  assertEquals(node.props.labels, ["a", "b", "c"]);
  assertEquals(anchors(node), [[0, 0], [1, 1], [2, 2]]);
});

Deno.test("isMissingPosition covers what scalePosition would silently accept", () => {
  // null and NaN are the two forms a missing position arrives in (ingest
  // normalises NaN to null, but geoms are also called with raw frames).
  for (const missing of [null, undefined, Number.NaN]) {
    assertEquals(
      isMissingPosition(missing),
      true,
      `${String(missing)} is missing`,
    );
  }
  // Infinities have no plottable coordinate either.
  assertEquals(isMissingPosition(Number.POSITIVE_INFINITY), true);
  assertEquals(isMissingPosition(Number.NEGATIVE_INFINITY), true);
  // Zero is a real position, not a missing one — the distinction the scaled
  // finiteness check could not make.
  assertEquals(isMissingPosition(0), false);
  assertEquals(isMissingPosition(-1.5), false);
  // Discrete positions arrive as strings and are the scale's business, not
  // this predicate's: only the absence of a value counts as missing here.
  assertEquals(isMissingPosition("a"), false);
});
