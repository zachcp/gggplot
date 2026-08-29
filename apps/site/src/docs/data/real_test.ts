// Import the semantic stages directly: @gggplot/core also exports the browser
// Live backend, which is intentionally not initialized by a Deno data test.
import { compile } from "../../../../../packages/core/src/compile/mod.ts";
import { geomLine, ggplot } from "../../../../../packages/core/src/dsl/mod.ts";
import { loadStaticDataset } from "./real.ts";
import type { RenderNode } from "../../../../../packages/core/src/compile/rendertree.ts";

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

function findNodes(tree: RenderNode, component: string): RenderNode[] {
  return [
    ...(tree.component === component ? [tree] : []),
    ...tree.children.flatMap((child) => findNodes(child, component)),
  ];
}

Deno.test("the lazily loaded mtcars asset remains typed and supports numeric linetype grouping", async () => {
  const csv = await Deno.readTextFile(
    new URL("../../../public/data/mtcars.csv", import.meta.url),
  );
  const data = await loadStaticDataset(
    "mtcars",
    // deno-lint-ignore require-await -- must match typeof fetch.
    async () => new Response(csv, { status: 200 }),
  );
  assertEquals(data.mpg.type, "numeric");
  assertEquals(data.am.type, "numeric");
  assertEquals(data.mpg.values.length, 32);

  const spec = ggplot(data, {
    x: "wt",
    y: "mpg",
    linetype: "am",
    linewidth: "hp",
  }).add(geomLine()).build();
  const panel = findNodes(compile(spec), "Cartesian")[0];
  // gggplot-tzc.3: grouped geom_line lowers to ChunkedLine nodes, one per dash
  // batch — the two linetype (am) levels are two distinct dash patterns, so
  // they stay two separate nodes. widths is now a FlatTensor(f32), not an Array.
  const lines = panel.children.filter((node) =>
    node.component === "ChunkedLine"
  );
  assertEquals(lines.length, 2);
  assertEquals(
    (lines[0].props.widths as { array?: Float32Array }).array instanceof
      Float32Array,
    true,
  );
  assertEquals(
    lines.some((line) => JSON.stringify(line.props.dash) === "[8,5]"),
    true,
  );
});
