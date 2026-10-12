// A resize that changes the break count must remount the Grid: @use-gpu/plot's
// Grid memoizes its LineLayer on the shader binding alone, so a mounted Grid
// keeps drawing its old line count (found by the vnh.3 component-root spike).
import { assert, assertEquals } from "@std/assert";
import type { RenderNode } from "../src/compile/mod.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";
import { coordCartesian, geomCol, geomPoint, ggplot } from "../src/dsl/mod.ts";
import { assembleTree } from "./support/assemble.ts";

const spec = ggplot({ x: [1.9, 4.1], y: [15, 27] }, { x: "x", y: "y" })
  .add(geomPoint())
  .build();

function gridKeys(width: number): string[] {
  const tree = assembleTree(spec, {
    layout: { width, height: 360, measureText: approximateTextMeasurer },
  });
  const keys: string[] = [];
  const walk = (node: RenderNode) => {
    if (node.component === "Grid") keys.push(node.key ?? "");
    node.children.forEach(walk);
  };
  walk(tree);
  return keys;
}

Deno.test("Grid nodes are keyed by their line count", () => {
  const narrow = gridKeys(520);
  const wide = gridKeys(601);
  assertEquals(narrow.length, 2);
  assert(narrow.every((key) => /^grid-[xy]-\d+$/.test(key)));
  // A different tick count gives a different key, so the Grid remounts.
  assert(
    narrow.some((key, i) => key !== wide[i]),
    `${narrow} vs ${wide}`,
  );
});

/** Each Grid's lines on its own axis, from its range and division. */
function gridLines(tree: RenderNode, axis: 0 | 1): number[][] {
  const lines: number[][] = [];
  const walk = (node: RenderNode) => {
    const division = (axis === 0 ? node.props.first : node.props.second) as
      | { divide: number }
      | null;
    if (node.component === "Grid" && division) {
      const [lo, hi] = (node.props.range as number[][])[axis];
      lines.push(
        Array.from(
          { length: division.divide + 1 },
          (_, i) => lo + (hi - lo) * i / division.divide,
        ),
      );
    }
    node.children.forEach(walk);
  };
  walk(tree);
  return lines;
}

/** Every Label node's text. */
function labelSets(tree: RenderNode): string[][] {
  const sets: string[][] = [];
  const walk = (node: RenderNode) => {
    if (node.component === "Label") sets.push(node.props.labels as string[]);
    node.children.forEach(walk);
  };
  walk(tree);
  return sets;
}

Deno.test("grid lines sit on the breaks the axis labels, up a stack's total", () => {
  // gggplot-ovcn. No one bar passes 9, but the stacks reach 18: the y axis
  // labels 0..15 from the stacked domain, and the grid must draw those same
  // lines, not stop at the single-bar scale's 8.
  const stacked = ggplot(
    { x: ["a", "a", "b", "b"], y: [9, 9, 4, 3], g: ["p", "q", "p", "q"] },
    { x: "x", y: "y", fill: "g" },
  ).add(geomCol({ position: "stack" })).build();
  const tree = assembleTree(stacked);
  const [yLines] = gridLines(tree, 1);
  assertEquals(yLines.map(String), ["0", "5", "10", "15"]);
  assert(
    labelSets(tree).some((labels) =>
      labels.join() === yLines.map(String).join()
    ),
    `a y axis labels the grid's lines ${yLines}: ${
      JSON.stringify(labelSets(tree))
    }`,
  );
});

Deno.test("under coord_cartesian zoom, labels and grid break the zoomed view", () => {
  // ggplot2 breaks the zoomed limits. Labels from the unzoomed domain spread
  // 0..100 across a panel showing 0..60, and the grid matched neither.
  const zoomed = ggplot({ x: [0, 1, 2], y: [0, 50, 100] }, { x: "x", y: "y" })
    .add(geomPoint(), coordCartesian({ ylim: [0, 60] }))
    .build();
  const tree = assembleTree(zoomed);
  const [yLines] = gridLines(tree, 1);
  assertEquals(yLines.at(-1), 60);
  assert(
    labelSets(tree).some((labels) =>
      labels.join() === yLines.map(String).join()
    ),
    `a y axis labels the grid's lines ${yLines}: ${
      JSON.stringify(labelSets(tree))
    }`,
  );
});
