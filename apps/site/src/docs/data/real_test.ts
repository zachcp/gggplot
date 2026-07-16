// Import the semantic stages directly: @gggplot/core also exports the browser
// Live backend, which is intentionally not initialized by a Deno data test.
import { compile } from "../../../../../packages/core/src/compile/mod.ts";
import { geomLine, ggplot } from "../../../../../packages/core/src/dsl/mod.ts";
import { loadStaticDataset } from "./real.ts";

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

Deno.test("the lazily loaded mtcars asset remains typed and supports numeric linetype grouping", async () => {
  const csv = await Deno.readTextFile(
    new URL("../../../public/data/mtcars.csv", import.meta.url),
  );
  const data = await loadStaticDataset(
    "mtcars",
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
  const lines = compile(spec).children[0].children.filter((node) =>
    node.component === "Line"
  );
  assertEquals(lines.length, 2);
  assertEquals(lines[0].props.widths instanceof Array, true);
  assertEquals(
    lines.some((line) => JSON.stringify(line.props.dash) === "[8,5]"),
    true,
  );
});
