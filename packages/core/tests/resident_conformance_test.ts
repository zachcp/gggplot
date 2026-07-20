import { assertEquals } from "@std/assert";
import {
  coordPolar,
  execution,
  facetWrap,
  geomBar,
  geomHistogram,
  geomPoint,
  geomTile,
  ggplot,
  scaleFill,
  scaleXContinuous,
  scaleYContinuous,
} from "../src/dsl/mod.ts";
import { asFactor } from "../src/data/mod.ts";
import { CATEGORICAL_PALETTE } from "../src/scale/palette.ts";
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

Deno.test("resident conformance: default-scaled factor fill is resident-eligible", () => {
  const spec = ggplot({ x: ["a", "b"], fill: ["x", "y"] }, {
    x: "x",
    fill: "fill",
  })
    .add(geomBar()).build();
  const view = residentNodes(compile(spec, { resident: true }), true);
  assertEquals(view.length, 1);
  assertEquals(view[0].props.product, "@gggplot/core:stat_count@1");
  // fill drives grouping: one group per factor level, one palette color each.
  assertEquals(
    (view[0].props.options as { groupsCount: number }).groupsCount,
    2,
  );
  assertEquals(view[0].props.group, "fill");
  assertEquals((view[0].props.paletteColors as string[]).length, 2);
});

Deno.test("resident conformance: weighted bars keep stat_count on CPU", () => {
  const weighted = ggplot({ x: ["a", "b"], weight: [1, 2] }, { x: "x" })
    .add(geomBar({ weight: "weight" })).build();
  assertEquals(residentNodes(compile(weighted, { resident: true })).length, 0);
});

Deno.test("resident conformance: a custom fill scale forces CPU fallback", () => {
  const spec = ggplot({ x: ["a", "b"], fill: ["x", "y"] }, {
    x: "x",
    fill: "fill",
  })
    .add(geomBar(), scaleFill({ range: ["#111111", "#222222"] }))
    .build();
  assertEquals(residentNodes(compile(spec, { resident: true })).length, 0);
});

Deno.test("resident conformance: facets and polar remain CPU fallback", () => {
  const faceted = ggplot({ x: [0, 1], panel: ["a", "b"] }, { x: "x" })
    .add(geomHistogram({ bins: 2 }))
    .add(facetWrap(["panel"]))
    .build();
  const polar = ggplot({ x: [0, 1] }, { x: "x" })
    .add(geomHistogram({ bins: 2 }))
    .add(coordPolar())
    .build();

  for (const spec of [faceted, polar]) {
    const tree = compile(spec, { resident: true });
    assertEquals(residentNodes(tree).length, 0);
  }
});

Deno.test("resident conformance: histogram fill palette follows trained level order", () => {
  // Auto factor: column.levels is appearance order (b, a) but the trained fill
  // scale (and legend) uses sorted domain (a, b). The palette must be indexed
  // by GPU group id (column.levels), each level taking its trained color, so
  // bar colors match legend swatches.
  const spec = ggplot(
    { x: [0, 1, 2, 3], cohort: ["b", "b", "a", "a"] },
    { x: "x", fill: "cohort" },
  ).add(geomHistogram({ binwidth: 2 })).build();
  const view = residentNodes(compile(spec, { resident: true }), true);
  assertEquals(view.length, 1);
  assertEquals(view[0].props.group, "cohort");
  // group id 0 = "b" (appearance-first) → trained domain index 1 → palette[1];
  // group id 1 = "a" → trained domain index 0 → palette[0].
  assertEquals(view[0].props.paletteColors, [
    CATEGORICAL_PALETTE[1],
    CATEGORICAL_PALETTE[0],
  ]);
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

Deno.test("resident conformance: binned tile strip is resident-eligible standalone", () => {
  const spec = ggplot({ x: [0, 1, 2, 3], row: ["a", "b", "a", "b"] }, {
    x: "x",
    fill: "row",
  })
    .add(geomTile({ stat: "bin", bins: 2 })).build();
  const view = residentNodes(compile(spec, { resident: true }), true);
  assertEquals(view.length, 1);
  assertEquals(view[0].props.product, "@gggplot/core:stat_bin_tiles@1");
  assertEquals(view[0].props.group, "row");
  assertEquals(
    (view[0].props.options as { groupsCount: number }).groupsCount,
    2,
  );
  // fill drives per-row palette colors, tiles never stack.
  assertEquals((view[0].props.paletteColors as string[]).length, 2);
  assertEquals(
    (view[0].props.options as { position: string }).position,
    "identity",
  );
  // No CPU tile lowering remains in the tree.
  assertEquals(nodes(compile(spec, { resident: true }), "ChunkedFace").length, 0);
});

Deno.test("resident conformance: tile strip falls back to CPU when ineligible", () => {
  // Mapped y: the strip's rows must come from grouping, not a y aesthetic.
  const mappedY = ggplot(
    { x: [0, 1, 2, 3], y: ["a", "b", "a", "b"] },
    { x: "x", y: "y", fill: "y" },
  ).add(geomTile({ stat: "bin", bins: 2 })).build();
  assertEquals(residentNodes(compile(mappedY, { resident: true })).length, 0);

  // Custom fill scale: palette authority stays with the CPU compiler.
  const customScale = ggplot(
    { x: [0, 1, 2, 3], row: ["a", "b", "a", "b"] },
    { x: "x", fill: "row" },
  )
    .add(
      geomTile({ stat: "bin", bins: 2 }),
      scaleFill({ range: ["#111111", "#222222"] }),
    )
    .build();
  assertEquals(
    residentNodes(compile(customScale, { resident: true })).length,
    0,
  );

  // No factor grouping at all: a group-less strip is just a histogram.
  const ungrouped = ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
    .add(geomTile({ stat: "bin", bins: 2 })).build();
  assertEquals(residentNodes(compile(ungrouped, { resident: true })).length, 0);

  // Default identity stat: plain geom_tile never takes the resident path.
  const identity = ggplot(
    { x: [0, 1], y: [0, 1], fill: ["a", "b"] },
    { x: "x", y: "y", fill: "fill" },
  ).add(geomTile()).build();
  assertEquals(residentNodes(compile(identity, { resident: true })).length, 0);
});

Deno.test("resident conformance: execution({ resident: false }) is the typed opt-out", () => {
  const optOut = ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
    .add(geomHistogram({ bins: 2 }), execution({ resident: false }))
    .build();
  assertEquals(optOut.execution?.resident, false);
  assertEquals(residentNodes(compile(optOut, { resident: true })).length, 0);

  // The former stringly theme key is inert: execution policy no longer
  // lives in the styling object (gggplot-4se).
  const themeKey = ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
    .add(geomHistogram({ bins: 2 }))
    .build();
  themeKey.theme = { ...themeKey.theme, resident: false };
  assertEquals(
    residentNodes(compile(themeKey, { resident: true }), true).length,
    1,
  );
});
