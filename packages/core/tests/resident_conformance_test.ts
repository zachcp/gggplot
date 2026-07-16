import { assertEquals } from "@std/assert";
import {
  coordPolar,
  facetWrap,
  geomHistogram,
  geomPoint,
  ggplot,
  scaleXContinuous,
  scaleYContinuous,
} from "../src/dsl/mod.ts";
import { asFactor } from "../src/data/mod.ts";
import { compile } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";

function nodes(
  tree: RenderNode,
  component: RenderNode["component"],
): RenderNode[] {
  return [
    ...(tree.component === component ? [tree] : []),
    ...tree.children.flatMap((child) => nodes(child, component)),
  ];
}

Deno.test("resident conformance: automatic histogram has no CPU stat rows", () => {
  const spec = ggplot({ x: [0, 1, 2, 3, null] }, { x: "x" })
    .add(geomHistogram({ binwidth: 2 }))
    .build();
  const tree = compile(spec, { resident: true });
  const view = nodes(tree, "ResidentHistogramView");

  assertEquals(view.length, 1);
  assertEquals(
    (view[0].props.data as Record<string, unknown>).count,
    undefined,
  );
  assertEquals(
    (view[0].props.options as { autoDomain: boolean }).autoDomain,
    true,
  );
});

Deno.test("resident conformance: declared factor group preserves dense grid shape", () => {
  const spec = ggplot(
    { x: [0, 1, 2, 3], group: ["a", "a", "b", "b"] },
    { x: "x", group: "group" },
    { columns: { group: asFactor(["a", "b", "c"]) } },
  ).add(geomHistogram({ bins: 2 })).build();
  const tree = compile(spec, { resident: true });
  const view = nodes(tree, "ResidentHistogramView");

  assertEquals(view.length, 1);
  assertEquals(
    (view[0].props.options as { groupsCount: number }).groupsCount,
    3,
  );
});

Deno.test("resident conformance: facets and computed fill remain CPU fallback", () => {
  const faceted = ggplot({ x: [0, 1], panel: ["a", "b"] }, { x: "x" })
    .add(geomHistogram({ bins: 2 }))
    .add(facetWrap(["panel"]))
    .build();
  const computed = ggplot({ x: [0, 1], fill: ["a", "b"] }, {
    x: "x",
    fill: "fill",
  })
    .add(geomHistogram({ bins: 2 }))
    .build();
  const polar = ggplot({ x: [0, 1] }, { x: "x" })
    .add(geomHistogram({ bins: 2 }))
    .add(coordPolar())
    .build();

  for (const spec of [faceted, computed, polar]) {
    const tree = compile(spec, { resident: true });
    assertEquals(nodes(tree, "ResidentHistogram").length, 0);
    assertEquals(nodes(tree, "ResidentHistogramView").length, 0);
  }
});

Deno.test("resident conformance: weighted histogram deliberately selects CPU", () => {
  const spec = ggplot(
    { x: [0, 1, 2], mass: [0.25, 1.5, 2] },
    { x: "x" },
  ).add(
    geomHistogram({ bins: 2, weight: "mass" }),
    scaleXContinuous({ domain: [0, 2] }),
    scaleYContinuous({ domain: [0, 3] }),
  ).build();
  const tree = compile(spec, { resident: true });

  assertEquals(nodes(tree, "ResidentHistogram").length, 0);
  assertEquals(nodes(tree, "ResidentHistogramView").length, 0);
  assertEquals(nodes(tree, "Polygon").length > 0, true);
});

Deno.test("resident conformance: unrelated layered marks preserve CPU render tree", () => {
  const spec = ggplot({ x: [0, 1], y: [2, 3] }, { x: "x" })
    .add(geomHistogram({ bins: 2 }))
    .add(geomPoint({ mapping: { y: "y" } }))
    .build();
  const tree = compile(spec, { resident: true });

  assertEquals(nodes(tree, "ResidentHistogram").length, 0);
  assertEquals(nodes(tree, "Point").length, 1);
});
