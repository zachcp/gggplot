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
import type { GGSpec } from "../src/ir/types.ts";
import {
  findNodes as nodes,
  residentPlansOf,
  residentTreeOf,
} from "./support/assemble.ts";

/** The products the component root would host, as {product, ...props}. */
function residentNodes(spec: GGSpec) {
  return residentPlansOf(spec).map((plan) => ({
    props: { product: plan.product, ...plan.props } as Record<string, unknown>,
  }));
}

Deno.test("resident conformance: automatic histogram has no CPU stat rows", () => {
  const spec = ggplot({ x: [0, 1, 2, 3, null] }, { x: "x" })
    .add(geomHistogram({ binwidth: 2 }))
    .build();
  const view = residentNodes(spec);

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
  const view = residentNodes(spec);

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
  const view = residentNodes(spec);
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
  const view = residentNodes(spec);
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
  assertEquals(residentNodes(weighted).length, 0);
});

Deno.test("resident conformance: a custom fill scale forces CPU fallback", () => {
  const spec = ggplot({ x: ["a", "b"], fill: ["x", "y"] }, {
    x: "x",
    fill: "fill",
  })
    .add(geomBar(), scaleFill({ range: ["#111111", "#222222"] }))
    .build();
  assertEquals(residentNodes(spec).length, 0);
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
    assertEquals(residentNodes(spec).length, 0);
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
  const view = residentNodes(spec);
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
  const tree = residentTreeOf(spec);

  assertEquals(residentNodes(spec).length, 0);
  // gggplot-tzc.4: geom_histogram's CPU-fallback bars are a ChunkedFace node.
  assertEquals(nodes(tree, "ChunkedFace").length > 0, true);
});

Deno.test("resident conformance: unrelated layered marks preserve CPU render tree", () => {
  const spec = ggplot({ x: [0, 1], y: [2, 3] }, { x: "x" })
    .add(geomHistogram({ bins: 2 }))
    .add(geomPoint({ mapping: { y: "y" } }))
    .build();
  const tree = residentTreeOf(spec);

  assertEquals(residentNodes(spec).length, 0);
  assertEquals(nodes(tree, "Point").length, 1);
});

Deno.test("resident conformance: binned tile strip is resident-eligible standalone", () => {
  const spec = ggplot({ x: [0, 1, 2, 3], row: ["a", "b", "a", "b"] }, {
    x: "x",
    fill: "row",
  })
    .add(geomTile({ stat: "bin", bins: 2 })).build();
  const view = residentNodes(spec);
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
  assertEquals(
    nodes(residentTreeOf(spec), "ChunkedFace").length,
    0,
  );
});

Deno.test("resident conformance: tile strip falls back to CPU when ineligible", () => {
  // Mapped y: the strip's rows must come from grouping, not a y aesthetic.
  const mappedY = ggplot(
    { x: [0, 1, 2, 3], y: ["a", "b", "a", "b"] },
    { x: "x", y: "y", fill: "y" },
  ).add(geomTile({ stat: "bin", bins: 2 })).build();
  assertEquals(residentNodes(mappedY).length, 0);

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
    residentNodes(customScale).length,
    0,
  );

  // No factor grouping at all: a group-less strip is just a histogram.
  const ungrouped = ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
    .add(geomTile({ stat: "bin", bins: 2 })).build();
  assertEquals(residentNodes(ungrouped).length, 0);

  // Default identity stat: plain geom_tile never takes the resident path.
  const identity = ggplot(
    { x: [0, 1], y: [0, 1], fill: ["a", "b"] },
    { x: "x", y: "y", fill: "fill" },
  ).add(geomTile()).build();
  assertEquals(residentNodes(identity).length, 0);
});

Deno.test("resident conformance: execution({ resident: false }) is the typed opt-out", () => {
  const optOut = ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
    .add(geomHistogram({ bins: 2 }), execution({ resident: false }))
    .build();
  assertEquals(optOut.execution?.resident, false);
  assertEquals(residentNodes(optOut).length, 0);

  // The former stringly theme key is inert: execution policy no longer
  // lives in the styling object (gggplot-4se).
  const themeKey = ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
    .add(geomHistogram({ bins: 2 }))
    .build();
  themeKey.theme = { ...themeKey.theme, resident: false };
  assertEquals(
    residentNodes(themeKey).length,
    1,
  );
});

Deno.test("resident conformance: the root trains y from the product's read-back maximum", () => {
  // gggplot-vnh.5.1: the standalone views that used to size their own y range
  // are gone; the root reads the summary and trains the panel's y axis.
  const spec = ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
    .add(geomHistogram({ binwidth: 2 }))
    .build();
  const yRange = (tree: ReturnType<typeof residentTreeOf>) =>
    (nodes(tree, "Cartesian")[0].props.range as number[][])[1];
  assertEquals(yRange(residentTreeOf(spec, 4)), [0, 4]);
  assertEquals(yRange(residentTreeOf(spec, 5000)), [0, 5000]);
  assertEquals(nodes(residentTreeOf(spec), "Axis").length, 2);
  const mark = nodes(residentTreeOf(spec), "ProductMark")[0];
  // Drawn only at the data version whose maximum trained the axis.
  assertEquals(mark.props.domainVersion, 1);

  // position fill owns [0, 1] whatever the maximum.
  const fill = ggplot(
    { x: [0, 1, 2, 3], g: ["a", "b", "a", "b"] },
    { x: "x", fill: "g" },
  ).add(geomHistogram({ binwidth: 2, position: "fill" })).build();
  assertEquals(yRange(residentTreeOf(fill, 5000)), [0, 1]);

  // A declared domain needs no summary.
  const pinned = ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
    .add(geomHistogram({ binwidth: 2 }), scaleYContinuous({ domain: [0, 9] }))
    .build();
  assertEquals(residentPlansOf(pinned).map((plan) => plan.summary), [false]);
  assertEquals(yRange(residentTreeOf(pinned)), [0, 9]);
});
