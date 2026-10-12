// A resize that changes the break count must remount the Grid: @use-gpu/plot's
// Grid memoizes its LineLayer on the shader binding alone, so a mounted Grid
// keeps drawing its old line count (found by the vnh.3 component-root spike).
import { assert, assertEquals } from "@std/assert";
import type { RenderNode } from "../src/compile/mod.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";
import { geomPoint, ggplot } from "../src/dsl/mod.ts";
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
