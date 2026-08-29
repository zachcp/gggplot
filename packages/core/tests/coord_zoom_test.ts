import { assert, assertEquals, assertThrows } from "@std/assert";
import {
  coordCartesian,
  geomBoxplot,
  geomPoint,
  ggplot,
  scaleXContinuous,
  scaleYContinuous,
} from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";

/**
 * gggplot-b06: coord_cartesian(xlim=, ylim=) zooms without removing rows.
 *
 * ggplot2 draws a sharp line here, and gggplot only had one side of it:
 *
 *   scale_x_continuous(limits=)  removes rows, so stats change
 *   coord_cartesian(xlim=)       zooms, so stats do not
 *
 * The canonical case is a boxplot: zooming must show the same summary, while
 * scale limits legitimately recompute it from the surviving rows.
 */

const DATA = { x: [0, 1, 2, 3, 10], y: [0, 1, 2, 3, 10] };

const treeOf = (spec: Parameters<typeof compile>[0]) =>
  compile(spec) as RenderNode;

function find(node: RenderNode, component: string): RenderNode | undefined {
  if (node.component === component) return node;
  for (const child of node.children) {
    const hit = find(child, component);
    if (hit) return hit;
  }
}

function collect(node: RenderNode, component: string, out: RenderNode[] = []) {
  if (node.component === component) out.push(node);
  for (const child of node.children) collect(child, component, out);
  return out;
}

/** Every position value carried by the marks of this component. */
function positions(node: RenderNode, component: string): number[] {
  return collect(node, component).flatMap((mark) => {
    const tensor = mark.props.positions as { array: Float32Array } | undefined;
    return tensor ? Array.from(tensor.array) : [];
  });
}

Deno.test("coord limits narrow the view range", () => {
  const zoomed = treeOf(
    ggplot(DATA, { x: "x", y: "y" })
      .add(geomPoint(), coordCartesian({ xlim: [0, 3], ylim: [0, 3] })).build(),
  );
  assertEquals(find(zoomed, "Cartesian")!.props.range, [[0, 3], [0, 3]]);
});

Deno.test("coord limits keep every row, unlike a scale domain", () => {
  const plain = treeOf(
    ggplot(DATA, { x: "x", y: "y" }).add(geomPoint()).build(),
  );
  const zoomed = treeOf(
    ggplot(DATA, { x: "x", y: "y" })
      .add(geomPoint(), coordCartesian({ xlim: [0, 3] })).build(),
  );
  const censored = treeOf(
    ggplot(DATA, { x: "x", y: "y" })
      .add(geomPoint(), scaleXContinuous({ domain: [0, 3] })).build(),
  );
  assertEquals(
    positions(zoomed, "Point").length,
    positions(plain, "Point").length,
    "zooming dropped rows",
  );
  assert(
    positions(censored, "Point").length < positions(plain, "Point").length,
    "a scale domain should still censor",
  );
});

Deno.test("zooming does not change stat output; a scale domain does", () => {
  // The boxplot case from the bead. The zoomed summary must be identical to
  // the unzoomed one, because the outlier still reaches the stat.
  const data = {
    g: Array.from({ length: 12 }, () => "a"),
    v: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 400],
  };
  const summaryOf = (spec: Parameters<typeof compile>[0]) =>
    JSON.stringify(positions(treeOf(spec), "Line"));

  const plain = summaryOf(
    ggplot(data, { x: "g", y: "v" }).add(geomBoxplot()).build(),
  );
  const zoomed = summaryOf(
    ggplot(data, { x: "g", y: "v" })
      .add(geomBoxplot(), coordCartesian({ ylim: [0, 12] })).build(),
  );
  // The same numeric window expressed as a SCALE domain censors the outlier
  // before stat_boxplot runs, so the summary genuinely changes. That contrast
  // is the point: the two spellings must not be interchangeable.
  const censored = summaryOf(
    ggplot(data, { x: "g", y: "v" })
      .add(geomBoxplot(), scaleYContinuous({ domain: [0, 12] })).build(),
  );
  assertEquals(zoomed, plain, "zoom changed the boxplot summary");
  assert(
    censored !== plain,
    "a scale domain should have recomputed the summary without the outlier",
  );
});

Deno.test("zoomed marks are clipped to the panel", () => {
  // Without a scissor the retained out-of-view marks just draw over the axes
  // and margins, which is what the pre-b06 "narrow the range" behaviour did.
  const zoomed = treeOf(
    ggplot(DATA, { x: "x", y: "y" })
      .add(geomPoint(), coordCartesian({ xlim: [0, 3] })).build(),
  );
  const box = find(zoomed, "ScissorBox");
  assert(box, "expected a ScissorBox around the zoomed marks");
  assertEquals(box.props.range, [[0, 3], [0, 10]]);
  assert(
    collect(box, "Point").length > 0,
    "the marks must be INSIDE the scissor box",
  );
});

Deno.test("guides stay outside the scissor box", () => {
  // Axes live at the panel edge; clipping them to the same box would eat them.
  const zoomed = treeOf(
    ggplot(DATA, { x: "x", y: "y" })
      .add(geomPoint(), coordCartesian({ xlim: [0, 3] })).build(),
  );
  const box = find(zoomed, "ScissorBox")!;
  assertEquals(collect(box, "Axis").length, 0);
  assert(collect(zoomed, "Axis").length > 0, "the plot still has axes");
});

Deno.test("no scissor box is added when nothing is zoomed", () => {
  const plain = treeOf(
    ggplot(DATA, { x: "x", y: "y" }).add(geomPoint(), coordCartesian()).build(),
  );
  assertEquals(find(plain, "ScissorBox"), undefined);
});

Deno.test("limits never reach the renderer as a view trait", () => {
  // They are a compiler input, already folded into the range.
  const zoomed = treeOf(
    ggplot(DATA, { x: "x", y: "y" })
      .add(geomPoint(), coordCartesian({ xlim: [0, 3] })).build(),
  );
  assertEquals("limits" in find(zoomed, "Cartesian")!.props, false);
});

Deno.test("malformed limits are rejected at the DSL boundary", () => {
  assertThrows(() => coordCartesian({ xlim: [1] }), TypeError);
  assertThrows(() => coordCartesian({ xlim: [1, "2"] }), TypeError);
  assertThrows(() => coordCartesian({ ylim: [NaN, 2] }), TypeError);
  assertThrows(() => coordCartesian({ xlim: [3, 1] }), RangeError);
});
