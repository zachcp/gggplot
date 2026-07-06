import { assertEquals, assertStringIncludes } from "@std/assert";
// Headless pipeline: DSL → compile → emit, no UseGPU runtime import.
import { geomPoint, ggplot } from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import { emitSource } from "../src/emit/mod.ts";

const data = { x: [0, 1, 2], y: [10, 20, 30] };

Deno.test("compile builds a Plot > Cartesian tree with a Point mark", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(geomPoint()).build();
  const tree = compile(spec);

  assertEquals(tree.component, "Plot");
  const panel = tree.children[0];
  assertEquals(panel.component, "Cartesian");
  // range is trained from the data extents
  assertEquals(panel.props.range, [[0, 2], [10, 30]]);

  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(point?.props.positions, [[0, 10], [1, 20], [2, 30]]);
});

Deno.test("emitSource produces UseGPU Live source with a classic pragma", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(geomPoint()).build();
  const src = emitSource(compile(spec), "MyChart");

  assertStringIncludes(src, "@jsx createElement");
  assertStringIncludes(src, 'from "@use-gpu/plot"');
  assertStringIncludes(src, "export const MyChart");
  assertStringIncludes(src, "<Point");
});
