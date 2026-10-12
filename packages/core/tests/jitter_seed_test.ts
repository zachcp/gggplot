// gggplot-plrj: jitter is seeded, so a jittered layer lowers identically on
// every render and on both paths; the seed parameter picks another draw.
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import type { RenderNode } from "../src/compile/mod.ts";
import { geomJitter, geomPoint, ggplot } from "../src/dsl/mod.ts";
import { seededRandom } from "../src/position/mod.ts";
import { assembleTree } from "./support/assemble.ts";

const data = { x: [1, 1, 2, 2, 3, 3], y: [1, 2, 3, 4, 5, 6] };

function positions(seed?: number): number[] {
  const tree = assembleTree(
    ggplot(data, { x: "x", y: "y" })
      .add(geomJitter(seed === undefined ? {} : { seed }))
      .build(),
  );
  let found: number[] = [];
  const walk = (node: RenderNode) => {
    const p = node.props.positions as { array?: Float32Array } | undefined;
    if (node.component === "Point" && p?.array) found = Array.from(p.array);
    node.children.forEach(walk);
  };
  walk(tree);
  return found;
}

Deno.test("a jittered layer lowers to the same positions every time", () => {
  assertEquals(positions(), positions());
  assertEquals(positions(7), positions(7));
});

Deno.test("the seed picks another draw, still within the amplitude", () => {
  const a = positions(1), b = positions(2);
  assertNotEquals(a, b);
  for (let i = 0; i < b.length; i += 2) {
    assert(Math.abs(b[i] - data.x[i / 2]) <= 0.41);
  }
});

Deno.test("jitterdodge is seeded too", () => {
  const dodged = (seed: number) =>
    assembleTree(
      ggplot({ ...data, g: ["a", "b", "a", "b", "a", "b"] }, {
        x: "x",
        y: "y",
        color: "g",
      }).add(geomPoint({ position: "jitterdodge", seed })).build(),
    );
  assertEquals(JSON.stringify(dodged(3)), JSON.stringify(dodged(3)));
});

Deno.test("the seeded stream is uniform on [0, 1)", () => {
  const random = seededRandom(42);
  let sum = 0;
  for (let i = 0; i < 10_000; i++) {
    const v = random();
    assert(v >= 0 && v < 1);
    sum += v;
  }
  assert(Math.abs(sum / 10_000 - 0.5) < 0.02);
});
