import { assertEquals } from "@std/assert";
import {
  coordPolar,
  facetWrap,
  geomBar,
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

/** Generic resident-product nodes, optionally filtered to the standalone view form. */
function residentNodes(
  tree: RenderNode,
  view?: boolean,
): RenderNode[] {
  return nodes(tree, "ResidentProduct").filter((n) =>
    view === undefined ? true : Boolean(n.props.view) === view
  );
}

Deno.test("resident conformance: automatic histogram has no CPU stat rows", () => {
  const spec = ggplot({ x: [0, 1, 2, 3, null] }, { x: "x" })
    .add(geomHistogram({ binwidth: 2 }))
    .build();
  const tree = compile(spec, { resident: true });
  const view = residentNodes(tree, true);

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
  const view = residentNodes(tree, true);

  assertEquals(view.length, 1);
  assertEquals(
    (view[0].props.options as { groupsCount: number }).groupsCount,
    3,
  );
});

Deno.test("resident conformance: categorical stat_count keeps factor ids resident", () => {
  const spec = ggplot(
    { category: ["a", "b", "a", "c"], group: ["x", "x", "y", "y"] },
    { x: "category", group: "group" },
    {
      columns: {
        category: asFactor(["a", "b", "c", "empty"]),
        group: asFactor(["x", "y"]),
      },
    },
  ).add(geomBar({ position: "dodge" })).build();
  const view = residentNodes(compile(spec, { resident: true }), true);
  assertEquals(view.length, 1);
  assertEquals(view[0].props.product, "@gggplot/core:stat_count@1");
  assertEquals(
    (view[0].props.options as { valuesCount: number }).valuesCount,
    4,
  );
  assertEquals(
    (view[0].props.options as { groupsCount: number }).groupsCount,
    2,
  );
  assertEquals(
    (view[0].props.data as Record<string, unknown>).count,
    undefined,
  );
});

Deno.test("resident conformance: mapped fill and weight keep stat_count on CPU", () => {
  const mapped = ggplot({ x: ["a", "b"], fill: ["x", "y"] }, {
    x: "x",
    fill: "fill",
  })
    .add(geomBar()).build();
  const weighted = ggplot({ x: ["a", "b"], weight: [1, 2] }, { x: "x" })
    .add(geomBar({ weight: "weight" })).build();
  for (const spec of [mapped, weighted]) {
    assertEquals(residentNodes(compile(spec, { resident: true })).length, 0);
  }
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
    assertEquals(residentNodes(tree).length, 0);
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

  assertEquals(residentNodes(tree).length, 0);
  // gggplot-tzc.4: geom_histogram's CPU-fallback bars are a ChunkedFace node.
  assertEquals(nodes(tree, "ChunkedFace").length > 0, true);
});

Deno.test("resident conformance: unrelated layered marks preserve CPU render tree", () => {
  const spec = ggplot({ x: [0, 1], y: [2, 3] }, { x: "x" })
    .add(geomHistogram({ bins: 2 }))
    .add(geomPoint({ mapping: { y: "y" } }))
    .build();
  const tree = compile(spec, { resident: true });

  assertEquals(residentNodes(tree).length, 0);
  assertEquals(nodes(tree, "Point").length, 1);
});
