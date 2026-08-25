// Regression tests for gggplot-i5m.21: a legend key stack grew downward from
// y = -0.76 by a fixed step with no upper bound, so its tail ran off the +1
// edge of the guide overlay and was silently lost.
//
// Two independent limits are enforced here, and they were BOTH being ignored:
//
//   THE PALETTE — CATEGORICAL_PALETTE holds 8 hues, and every level past that
//   is drawn in the same OTHER_COLOR. Listing them individually printed rows
//   with identical swatches and different labels, which claims distinctions
//   the plot cannot draw. Measured before the fix: 14 levels produced 14 keys
//   whose swatches 8..13 were all rgba(137,135,129).
//
//   THE CANVAS — measured overflow thresholds before the fix (800px wide):
//   h=600 at 16 levels, h=300 at 15, h=200 at 10, h=160 at 8, h=120 at 6.
//   A palette-capped 9-row legend fits down to h=200 but not below, so short
//   canvases still need truncation.
import { assertEquals } from "@std/assert";
import { geomPoint, ggplot } from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";
import { CATEGORICAL_PALETTE, OTHER_COLOR } from "../src/scale/palette.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";

function findNodes(node: RenderNode, component: string): RenderNode[] {
  return [
    ...(node.component === component ? [node] : []),
    ...(node.children ?? []).flatMap((child) => findNodes(child, component)),
  ];
}

/** The legend's key-label node: rows and their normalized y positions. */
function legendKeys(levels: number, height: number) {
  const cats = Array.from({ length: levels }, (_, i) => `c${i}`);
  const tree = compile(
    ggplot(
      { x: cats.map((_, i) => i), y: cats.map((_, i) => i), g: cats },
      { x: "x", y: "y", color: "g" },
    ).add(geomPoint()).build(),
    { layout: { width: 800, height, measureText: approximateTextMeasurer } },
  ) as RenderNode;

  const node = findNodes(tree, "Label").find((candidate) => {
    const labels = candidate.props.labels as string[] | undefined;
    return !!labels?.some((text) => /^(c\d+|Other|\+\d+ more)/.test(text));
  });
  const labels = (node?.props.labels ?? []) as string[];
  const ys = ((node?.props.positions ?? []) as [number, number][])
    .map(([, y]) => y);
  // Legend swatches: the Point node whose colours are plain hex strings.
  const swatches = findNodes(tree, "Point").find((candidate) =>
    Array.isArray(candidate.props.colors)
  );
  return {
    labels,
    ys,
    colors: (swatches?.props.colors ?? []) as string[],
    offCanvas: ys.filter((y) => y > 1).length,
  };
}

Deno.test("a legend within the palette is unchanged", () => {
  const { labels, colors, offCanvas } = legendKeys(4, 300);
  assertEquals(labels, ["c0", "c1", "c2", "c3"]);
  assertEquals(colors.length, 4);
  assertEquals(new Set(colors).size, 4, "four distinct swatches");
  assertEquals(offCanvas, 0);
});

Deno.test("levels past the palette collapse into one counted Other row", () => {
  // 14 levels: 8 the palette can distinguish, plus one row standing for 6.
  const { labels, colors } = legendKeys(14, 300);
  assertEquals(labels.length, CATEGORICAL_PALETTE.length + 1);
  assertEquals(labels.at(-1), "Other (6)");
  assertEquals(colors.at(-1), OTHER_COLOR);
  // No two visible swatches may claim to be distinguishable when they are not.
  assertEquals(new Set(colors).size, colors.length);
});

Deno.test("the Other row counts every folded level, however many", () => {
  assertEquals(legendKeys(30, 300).labels.at(-1), "Other (22)");
  assertEquals(legendKeys(9, 300).labels.at(-1), "Other (1)");
});

Deno.test("no key runs off the overlay, at any level count or canvas height", () => {
  // Every combination below overflowed before the fix except the smallest.
  for (const levels of [4, 9, 14, 30]) {
    for (const height of [600, 300, 200, 160, 120]) {
      const { ys, offCanvas } = legendKeys(levels, height);
      assertEquals(
        offCanvas,
        0,
        `${levels} levels at h=${height}: ${offCanvas} key(s) past +1`,
      );
      assertEquals(
        ys.length > 0,
        true,
        `${levels} at h=${height} drew no keys`,
      );
    }
  }
});

Deno.test("a truncated legend says how many rows it dropped", () => {
  // h=120 cannot fit even the palette-capped 9 rows, so the last row is spent
  // reporting the cut rather than being silently lost.
  const { labels, offCanvas } = legendKeys(30, 120);
  assertEquals(offCanvas, 0);
  assertEquals(/^\+\d+ more$/.test(labels.at(-1) ?? ""), true, labels.at(-1));
  // The count must agree with the palette-capped total (8 + Other = 9).
  const hidden = Number((labels.at(-1) as string).match(/\d+/)![0]);
  assertEquals(labels.length - 1 + hidden, CATEGORICAL_PALETTE.length + 1);
});

Deno.test("a legend that fits gets no +N more row", () => {
  const { labels } = legendKeys(9, 300);
  assertEquals(labels.some((text) => text.endsWith("more")), false);
});
