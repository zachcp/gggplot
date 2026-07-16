import { assertEquals, assertStringIncludes } from "@std/assert";
// Headless pipeline: DSL → compile → emit, no UseGPU runtime import.
import {
  annotate,
  coordFlip,
  coordPolar,
  facetGrid,
  facetWrap,
  geomAbline,
  geomArea,
  geomBar,
  geomBoxplot,
  geomCol,
  geomErrorbar,
  geomHistogram,
  geomHline,
  geomLine,
  geomPath,
  geomPoint,
  geomPolygon,
  geomRibbon,
  geomSmooth,
  geomText,
  geomTile,
  geomVline,
  ggplot,
  labels,
  scaleColor,
  scaleColorGradient2,
  scaleColorViridis,
  scaleFill,
  scaleLinetype,
  scaleLinewidth,
  scaleXContinuous,
  scaleXDiscrete,
  scaleXLog10,
  scaleXSqrt,
  scaleYContinuous,
  theme,
  themeClassic,
  themeGrey,
} from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";
import { emitSource } from "../src/emit/mod.ts";
import { asFactor, asNumeric, columnValues, ingest } from "../src/data/mod.ts";
import { applyStat } from "../src/stat/mod.ts";
import { groupColumnsOf, groupKeyAt, sliceRows } from "../src/group/mod.ts";
import { CATEGORICAL_PALETTE } from "../src/scale/palette.ts";
import {
  scaleAlphaValue,
  scaleColorValue,
  scaleLinetypeValue,
  scaleLinewidthValue,
  scaleShapeValue,
  scaleSizeValue,
  trainScales,
} from "../src/scale/mod.ts";
import { dodgeBars, jitter, stackBars } from "../src/position/mod.ts";
import type { DataFrame, Layer } from "../src/ir/types.ts";

const data = { x: [0, 1, 2], y: [10, 20, 30] };
const values = (frame: DataFrame, column: string) =>
  columnValues(frame, column);

function facetGridNode(tree: RenderNode): RenderNode {
  return tree.component === "FacetGrid"
    ? tree
    : tree.children.find((c) => c.component === "FacetGrid")!;
}

function findNodes(
  tree: RenderNode,
  component: RenderNode["component"],
): RenderNode[] {
  return [
    ...(tree.component === component ? [tree] : []),
    ...tree.children.flatMap((child) => findNodes(child, component)),
  ];
}

Deno.test("compile builds an Embedded > Cartesian tree with a Point mark", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(geomPoint()).build();
  const tree = compile(spec);

  assertEquals(tree.component, "Embedded");
  assertEquals(tree.props.normalize, true);
  const panel = tree.children[0];
  assertEquals(panel.component, "Cartesian");
  // range is trained from the data extents
  assertEquals(panel.props.range, [[0, 2], [10, 30]]);

  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(point?.props.positions, [[0, 10], [1, 20], [2, 30]]);
});

Deno.test("ggplot accepts row-store data at the DSL boundary", () => {
  const spec = ggplot([
    { x: 0, y: 10 },
    { x: 1, y: 20 },
    { x: 2, y: 30 },
  ], { x: "x", y: "y" }).add(geomPoint()).build();
  const tree = compile(spec);
  const point = tree.children[0].children.find((c) => c.component === "Point");

  assertEquals(point?.props.positions, [
    [0, 10],
    [1, 20],
    [2, 30],
  ]);
});

Deno.test("layer data overrides accept row-store data at the DSL boundary", () => {
  const spec = ggplot({ x: [0], y: [0] }, { x: "x", y: "y" }).add(
    geomPoint({
      data: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
    }),
  ).build();
  const tree = compile(spec);
  const point = tree.children[0].children.find((c) => c.component === "Point");

  assertEquals(point?.props.positions, [[1, 2], [3, 4]]);
});

Deno.test("ggplot asFactor override makes numeric-coded groups discrete", () => {
  const spec = ggplot({
    cyl: [4, 6, 4, 6],
    x: [0, 0, 1, 1],
    y: [10, 20, 11, 21],
  }, {
    x: "x",
    y: "y",
    color: "cyl",
  }, {
    columns: { cyl: asFactor(["4", "6"]) },
  }).add(geomLine()).build();
  const tree = compile(spec);
  const lines = tree.children[0].children.filter((c) => c.component === "Line");

  assertEquals(lines.length, 2);
  assertEquals(lines.map((line) => line.props.positions), [
    [[0, 10], [1, 11]],
    [[0, 20], [1, 21]],
  ]);
});

Deno.test("ggplot asFactor override preserves declared scale level order", () => {
  const spec = ggplot({
    cyl: [4, 6, 8],
    x: [0, 1, 2],
    y: [10, 20, 30],
  }, {
    x: "x",
    y: "y",
    color: "cyl",
  }, {
    columns: { cyl: asFactor(["8", "6", "4"]) },
  }).add(geomPoint()).build();
  const trained = trainScales(spec, [{
    data: spec.data,
    mapping: spec.mapping,
  }]);

  assertEquals(trained.get("color")?.domain, ["8", "6", "4"]);
});

Deno.test("sliced data preserves asFactor scale metadata", () => {
  const spec = ggplot({
    cyl: [4, 6, 8, 4],
    x: [0, 1, 2, 3],
    y: [10, 20, 30, 40],
  }, {
    x: "x",
    y: "y",
    color: "cyl",
  }, {
    columns: { cyl: asFactor(["8", "6", "4"]) },
  }).add(geomPoint()).build();
  const sliced = sliceRows(spec.data, [0, 2]);
  const trained = trainScales(spec, [{ data: sliced, mapping: spec.mapping }]);

  assertEquals(trained.get("color")?.domain, ["8", "6", "4"]);
});

Deno.test("geom_line sorting preserves typed column metadata", () => {
  const spec = ggplot({
    x: ["2", "1"],
    y: [20, 10],
    cyl: [4, 4],
  }, {
    x: "x",
    y: "y",
    color: "cyl",
  }, {
    columns: { x: asNumeric(), cyl: asFactor(["4"]) },
  }).add(geomLine()).build();
  const tree = compile(spec);
  const line = tree.children[0].children.find((c) => c.component === "Line");

  assertEquals(line?.props.positions, [[1, 10], [2, 20]]);
  assertEquals(line?.props.colors, [
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[0],
  ]);
});

Deno.test("compile trains a discrete x scale and maps categories to level indices", () => {
  const factorData = { grp: ["b", "a", "c", "a"], y: [10, 20, 30, 40] };
  const spec = ggplot(factorData, { x: "grp", y: "y" }).add(geomPoint())
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  // levels default-sort alphabetically: a, b, c → domain span [0, 2]
  assertEquals(panel.props.range, [[0, 2], [10, 40]]);

  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(point?.props.positions, [[1, 10], [0, 20], [2, 30], [0, 40]]);
});

Deno.test("scaleXDiscrete domain fixes explicit level ordering", () => {
  const factorData = { grp: ["b", "a", "c"], y: [1, 2, 3] };
  const spec = ggplot(factorData, { x: "grp", y: "y" })
    .add(geomPoint(), scaleXDiscrete({ domain: ["c", "b", "a"] }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(point?.props.positions, [[1, 1], [2, 2], [0, 3]]);
});

Deno.test("stat_count tallies rows per distinct x value and maps y to count", () => {
  const countLayer: Layer = {
    geom: "bar",
    stat: "count",
    position: "identity",
    params: {},
  };
  const data = { grp: ["a", "b", "a", "a", "b"] };
  const result = applyStat(countLayer, { x: "grp" }, data);

  assertEquals(result.mapping.y, "count");
  assertEquals(values(result.data, "grp"), ["a", "b"]);
  assertEquals(values(result.data, "count"), [3, 2]);
});

Deno.test("weighted stat_count keeps fractional counts on the CPU path", () => {
  const layer: Layer = {
    geom: "bar",
    stat: "count",
    position: "identity",
    params: { weight: "mass" },
  };
  const result = applyStat(
    layer,
    { x: "kind", fill: "group" },
    { kind: ["a", "a", "b"], group: ["x", "x", "y"], mass: [0.25, 1.5, 2] },
  );

  assertEquals(values(result.data, "count"), [1.75, 2]);
});

Deno.test("stat_count leaves an explicit y mapping untouched", () => {
  const countLayer: Layer = {
    geom: "bar",
    stat: "count",
    position: "identity",
    params: {},
  };
  const data = { grp: ["a", "b", "a"] };
  const result = applyStat(countLayer, { x: "grp", y: "existing" }, data);

  assertEquals(result.mapping.y, "existing");
});

Deno.test("stat_count aggregates per effective fill group and preserves fill data", () => {
  const countLayer: Layer = {
    geom: "bar",
    stat: "count",
    position: "stack",
    params: {},
  };
  const countData = {
    cls: ["a", "a", "a", "b", "b"],
    drv: ["f", "f", "4", "4", "4"],
  };
  const result = applyStat(countLayer, { x: "cls", fill: "drv" }, countData);

  assertEquals(values(result.data, "cls"), ["a", "a", "b"]);
  assertEquals(values(result.data, "drv"), ["f", "4", "4"]);
  assertEquals(values(result.data, "count"), [2, 1, 2]);
});

Deno.test("geom_bar with fill stacks stat_count output by fill group and emits a legend", () => {
  const barData = {
    cls: ["a", "a", "a", "b", "b"],
    drv: ["f", "f", "4", "4", "4"],
  };
  const spec = ggplot(barData, { x: "cls", fill: "drv" }).add(geomBar())
    .build();
  const tree = compile(spec);

  const polygon = tree.children[0].children.find((c) =>
    c.component === "Polygon"
  );
  assertEquals(polygon?.props.positions, [
    [[-0.45, 0], [-0.45, 2], [0.45, 2], [0.45, 0]],
    [[-0.45, 2], [-0.45, 3], [0.45, 3], [0.45, 2]],
    [[0.55, 0], [0.55, 2], [1.45, 2], [1.45, 0]],
  ]);
  assertEquals(polygon?.props.fills, [
    CATEGORICAL_PALETTE[1],
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[0],
  ]);

  const labels = tree.children.filter((c) => c.component === "Label").map((c) =>
    c.props.labels
  );
  assertEquals(labels, [["fill"], ["4", "f"]]);
});

Deno.test("stackBars identity mode leaves bars unstacked at a shared 0 baseline", () => {
  const bars = [{ x: 0, y: 3, groupKey: "p" }, { x: 0, y: 5, groupKey: "q" }];
  const placed = stackBars(bars, 1, "identity");
  assertEquals(placed.map((b) => [b.y0, b.y1, b.xOffset]), [[0, 3, 0], [
    0,
    5,
    0,
  ]]);
});

Deno.test("dodgeBars keeps a group's slot stable across different x values", () => {
  const bars = [
    { x: 0, y: 1, groupKey: "p" },
    { x: 0, y: 2, groupKey: "q" },
    { x: 1, y: 3, groupKey: "q" },
    { x: 1, y: 4, groupKey: "p" },
  ];
  const placed = dodgeBars(bars, 1);
  // p is always the left slot (-0.25), q always the right slot (+0.25), regardless of row order
  assertEquals(placed.map((b) => b.xOffset), [-0.25, 0.25, 0.25, -0.25]);
});

Deno.test("jitter stays within the requested amplitude", () => {
  for (let i = 0; i < 50; i++) {
    const j = jitter(10, 0.5);
    assertEquals(Math.abs(j - 10) <= 0.5, true);
  }
});

Deno.test("geom_text renders a Label with per-point positions and text", () => {
  const labelData = { x: [0, 1], y: [10, 20], name: ["Alice", "Bob"] };
  const spec = ggplot(labelData, { x: "x", y: "y", label: "name" }).add(
    geomText(),
  ).build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const label = panel.children.find((c) => c.component === "Label");
  assertEquals(label?.props.positions, [[0, 10], [1, 20]]);
  assertEquals(label?.props.labels, ["Alice", "Bob"]);

  const src = emitSource(tree, "LabeledChart");
  assertStringIncludes(src, "Label");
  assertStringIncludes(src, "Alice");
});

Deno.test("geom_errorbar renders a stem plus top/bottom caps per row", () => {
  const errData = { x: [0, 2], lo: [1, 3], hi: [5, 9] };
  const spec = ggplot(errData, { x: "x", ymin: "lo", ymax: "hi" }).add(
    geomErrorbar(),
  ).build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const line = panel.children.find((c) => c.component === "Line");
  assertEquals(line?.props.positions, [
    [[-0.9, 5], [0.9, 5]],
    [[0, 5], [0, 1]],
    [[-0.9, 1], [0.9, 1]],
    [[1.1, 9], [2.9, 9]],
    [[2, 9], [2, 3]],
    [[1.1, 3], [2.9, 3]],
  ]);
});

Deno.test("geom_boxplot renders a box plus median/whisker/cap segments", () => {
  const boxData = { x: [0], lo: [2], mid: [5], up: [8], ymin: [0], ymax: [10] };
  const spec = ggplot(boxData, {
    x: "x",
    lower: "lo",
    middle: "mid",
    upper: "up",
    ymin: "ymin",
    ymax: "ymax",
  })
    .add(geomBoxplot())
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const box = panel.children.find((c) => c.component === "Polygon");
  assertEquals(box?.props.positions, [
    [[-0.375, 2], [-0.375, 8], [0.375, 8], [0.375, 2]],
  ]);

  const line = panel.children.find((c) => c.component === "Line");
  assertEquals(line?.props.positions, [
    [[-0.375, 5], [0.375, 5]],
    [[0, 8], [0, 10]],
    [[-0.1875, 10], [0.1875, 10]],
    [[0, 2], [0, 0]],
    [[-0.1875, 0], [0.1875, 0]],
  ]);
});

Deno.test("geom_tile renders full-resolution cells centered on (x,y), widening the domain past the edge cells", () => {
  const gridData = { x: [0, 2, 0, 2], y: [0, 0, 1, 1], val: [1, 2, 3, 4] };
  const spec = ggplot(gridData, { x: "x", y: "y", fill: "val" }).add(geomTile())
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  // x resolution 2, y resolution 1 -> half-cell padding of 1 and 0.5 on each side
  assertEquals(panel.props.range, [[-1, 3], [-0.5, 1.5]]);

  const polygon = panel.children.find((c) => c.component === "Polygon");
  assertEquals(polygon?.props.positions, [
    [[-1, -0.5], [-1, 0.5], [1, 0.5], [1, -0.5]],
    [[1, -0.5], [1, 0.5], [3, 0.5], [3, -0.5]],
    [[-1, 0.5], [-1, 1.5], [1, 1.5], [1, 0.5]],
    [[1, 0.5], [1, 1.5], [3, 1.5], [3, 0.5]],
  ]);
  assertEquals((polygon?.props.fills as string[]).length, 4);
});

Deno.test("geom_tile cells tile edge-to-edge with no gaps by default", () => {
  const gridData = { x: [0, 1], y: [0, 0] };
  const spec = ggplot(gridData, { x: "x", y: "y" }).add(
    geomTile({ fill: "#000000" }),
  ).build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const polygon = panel.children.find((c) => c.component === "Polygon");
  const loops = polygon?.props.positions as [number, number][][];
  // tile0's right edge (x=0.5) meets tile1's left edge (x=0.5) exactly
  assertEquals(loops[0][2][0], loops[1][0][0]);
});

Deno.test("geom_polygon renders row-ordered x/y positions as a Polygon loop", () => {
  const polyData = { x: [0, 1, 0], y: [0, 0, 1] };
  const spec = ggplot(polyData, { x: "x", y: "y" })
    .add(geomPolygon({ fill: "#123456" }))
    .build();
  const tree = compile(spec);

  const polygon = tree.children[0].children.find((c) =>
    c.component === "Polygon"
  );
  assertEquals(polygon?.props.positions, [[0, 0], [1, 0], [0, 1]]);
  assertEquals(polygon?.props.fill, "#123456");
});

Deno.test("geom_polygon splits grouped polygons and maps fill per group", () => {
  const polyData = {
    x: [0, 1, 0, 2, 3, 2],
    y: [0, 0, 1, 0, 0, 1],
    id: ["left", "left", "left", "right", "right", "right"],
    cls: ["a", "a", "a", "b", "b", "b"],
  };
  const spec = ggplot(polyData, { x: "x", y: "y", group: "id", fill: "cls" })
    .add(
      geomPolygon(),
      scaleFill({ domain: ["a", "b"], range: ["#aaaaaa", "#bbbbbb"] }),
    )
    .build();
  const tree = compile(spec);

  const polygon = tree.children[0].children.find((c) =>
    c.component === "Polygon"
  );
  assertEquals(polygon?.props.positions, [
    [[0, 0], [1, 0], [0, 1]],
    [[2, 0], [3, 0], [2, 1]],
  ]);
  assertEquals(polygon?.props.fills, ["#aaaaaa", "#bbbbbb"]);
});

Deno.test("geom_col defaults to stacking bars sharing an x by their fill group", () => {
  const barData = {
    x: ["a", "a", "b", "b"],
    y: [3, 5, 2, 4],
    grp: ["p", "q", "p", "q"],
  };
  const spec = ggplot(barData, { x: "x", y: "y", fill: "grp" }).add(geomCol())
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  // full bar widths widen x; stacked totals (8 at x=a, 6 at x=b) widen y
  assertEquals(panel.props.range, [[-0.45, 1.45], [0, 8]]);

  const polygon = panel.children.find((c) => c.component === "Polygon");
  assertEquals(polygon?.props.positions, [
    [[-0.45, 0], [-0.45, 3], [0.45, 3], [0.45, 0]],
    [[-0.45, 3], [-0.45, 8], [0.45, 8], [0.45, 3]],
    [[0.55, 0], [0.55, 2], [1.45, 2], [1.45, 0]],
    [[0.55, 2], [0.55, 6], [1.45, 6], [1.45, 2]],
  ]);
  assertEquals(polygon?.props.fills, [
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[1],
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[1],
  ]);
});

Deno.test("geom_col position=dodge places same-x bars side by side instead of stacking", () => {
  const barData = {
    x: ["a", "a", "b", "b"],
    y: [3, 5, 2, 4],
    grp: ["p", "q", "p", "q"],
  };
  const spec = ggplot(barData, { x: "x", y: "y", fill: "grp" })
    .add(geomCol({ position: "dodge" }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  // dodge doesn't stack, so the y range is just the raw row extent
  assertEquals(panel.props.range, [[-0.45, 1.45], [2, 5]]);

  const polygon = panel.children.find((c) => c.component === "Polygon");
  assertEquals(polygon?.props.positions, [
    [[-0.45, 0], [-0.45, 3], [0, 3], [0, 0]],
    [[0, 0], [0, 5], [0.45, 5], [0.45, 0]],
    [[0.55, 0], [0.55, 2], [1, 2], [1, 0]],
    [[1, 0], [1, 4], [1.4500000000000002, 4], [1.4500000000000002, 0]],
  ]);
});

Deno.test("geom_col position=fill normalizes each x's stack to proportions summing to 1", () => {
  const barData = { x: ["a", "a"], y: [2, 6], grp: ["p", "q"] };
  const spec = ggplot(barData, { x: "x", y: "y", fill: "grp" })
    .add(geomCol({ position: "fill" }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  assertEquals(panel.props.range, [[-0.45, 0.45], [0, 1]]);

  const polygon = panel.children.find((c) => c.component === "Polygon");
  assertEquals(polygon?.props.positions, [
    [[-0.45, 0], [-0.45, 0.25], [0.45, 0.25], [0.45, 0]],
    [[-0.45, 0.25], [-0.45, 1], [0.45, 1], [0.45, 0.25]],
  ]);
});

Deno.test("geom_point position=jitter nudges positions within the configured amount", () => {
  const data3 = { x: [0, 0, 0], y: [0, 0, 0] };
  const spec = ggplot(data3, { x: "x", y: "y" })
    .add(geomPoint({ position: "jitter", width: 0.3, height: 0.2 }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const point = panel.children.find((c) => c.component === "Point");
  const positions = point?.props.positions as [number, number][];
  assertEquals(positions.length, 3);
  for (const [x, y] of positions) {
    assertEquals(Math.abs(x) <= 0.3, true);
    assertEquals(Math.abs(y) <= 0.2, true);
  }
});

Deno.test("coord_flip swizzles rendered axes to yx without touching mark positions or domains", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(geomPoint(), coordFlip())
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  assertEquals(panel.component, "Cartesian");
  assertEquals(panel.props.axes, "yx");
  // range/positions stay in original x/y order -- only rendered axes swap
  assertEquals(panel.props.range, [[0, 2], [10, 30]]);
  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(point?.props.positions, [[0, 10], [1, 20], [2, 30]]);

  const grid = panel.children.find((c) => c.component === "Grid");
  assertEquals(grid?.props.axes, "yx");
});

Deno.test("coord_polar selects the Polar view and passes through bend/on params", () => {
  const spec = ggplot(data, { x: "x", y: "y" })
    .add(geomPoint(), coordPolar({ bend: 0.5, on: "y" }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  assertEquals(panel.component, "Polar");
  assertEquals(panel.props.bend, 0.5);
  assertEquals(panel.props.on, "y");
  assertEquals(panel.props.range, [[0, 2], [10, 30]]);
});

Deno.test("coord_polar theta:'y' reassigns the angle to y, same projection swap as coord_flip", () => {
  const spec = ggplot(data, { x: "x", y: "y" })
    .add(geomPoint(), coordPolar({ theta: "y", bend: 0.5 }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  assertEquals(panel.component, "Polar");
  assertEquals(panel.props.axes, "yx");
  assertEquals(panel.props.bend, 0.5);
  // reassigning theta doesn't touch mark positions or the trained domain
  assertEquals(panel.props.range, [[0, 2], [10, 30]]);
  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(point?.props.positions, [[0, 10], [1, 20], [2, 30]]);
});

Deno.test("coord_polar munches Polygon edges for curved bar wedges", () => {
  const spec = ggplot({ x: ["a", "b"], y: [2, 3] }, { x: "x", y: "y" })
    .add(geomCol(), coordPolar())
    .build();
  const tree = compile(spec);
  const panel = tree.children[0];
  const polygon = panel.children.find((c) => c.component === "Polygon");

  const positions = polygon?.props.positions as [number, number][][];
  assertEquals(panel.component, "Polar");
  assertEquals(positions.length, 2);
  // geom_col rectangles have 4 edges; munching inserts 16 points per edge.
  assertEquals(positions[0].length, 64);
  assertEquals(positions[0][0], [-0.45, 0]);
  assertEquals(positions[0][16], [-0.45, 2]);
});

Deno.test("coord_polar uses explicit Line rings/spokes instead of Cartesian Grid", () => {
  const spec = ggplot({ x: ["a", "b"], y: [2, 3] }, { x: "x", y: "y" })
    .add(geomCol(), coordPolar())
    .build();
  const tree = compile(spec);
  const panel = tree.children[0];

  assertEquals(panel.children.find((c) => c.component === "Grid"), undefined);
  const grid = panel.children.find((c) => c.component === "Line");
  const positions = grid?.props.positions as [number, number][][];
  assertEquals(grid?.props.zBias, 1);
  assertEquals(positions.length, 16);
  assertEquals(positions[0].length, 96);
  assertEquals(positions[4].length, 32);
});

Deno.test("geom_line sorts by x before connecting, unlike geom_path", () => {
  const unsorted = { x: [2, 0, 1], y: [30, 10, 20] };

  const lineSpec = ggplot(unsorted, { x: "x", y: "y" }).add(geomLine()).build();
  const lineTree = compile(lineSpec);
  const line = lineTree.children[0].children.find((c) =>
    c.component === "Line"
  );
  assertEquals(line?.props.positions, [[0, 10], [1, 20], [2, 30]]);

  const pathSpec = ggplot(unsorted, { x: "x", y: "y" }).add(geomPath()).build();
  const pathTree = compile(pathSpec);
  const path = pathTree.children[0].children.find((c) =>
    c.component === "Line"
  );
  assertEquals(path?.props.positions, [[2, 30], [0, 10], [1, 20]]);
});

Deno.test("group aesthetic splits geom_line into one connected Line per group", () => {
  const grouped = {
    x: [0, 1, 0, 1],
    y: [10, 20, 15, 25],
    grp: ["a", "a", "b", "b"],
  };
  const spec = ggplot(grouped, { x: "x", y: "y", group: "grp" }).add(geomLine())
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const lines = panel.children.filter((c) => c.component === "Line");
  assertEquals(lines.length, 2);
  assertEquals(lines.map((l) => l.props.positions), [
    [[0, 10], [1, 20]],
    [[0, 15], [1, 25]],
  ]);
});

Deno.test("linetype splits connected lines and lowers a compact dash binding per group", () => {
  const grouped = {
    x: [0, 1, 2, 0, 1, 2],
    y: [1, 2, 3, 10, 20, 30],
    // Numeric categorical codes are common in real datasets (mtcars$am). A
    // linetype mapping remains discrete and must still split the Line marks.
    style: [0, 0, 0, 1, 1, 1],
    thickness: [0, 5, 10, 0, 5, 10],
  };
  const spec = ggplot(grouped, {
    x: "x",
    y: "y",
    linetype: "style",
    linewidth: "thickness",
  }).add(geomLine()).build();
  const tree = compile(spec);
  const lines = tree.children[0].children.filter((c) => c.component === "Line");

  assertEquals(lines.length, 2);
  // Level 0 is solid (no dash property); level 1 gets the second dash
  // palette entry. Neither case creates a row-shaped stat output.
  assertEquals(lines[0].props.dash, undefined);
  assertEquals(lines[1].props.dash, [8, 5]);
  assertEquals(lines.map((line) => line.props.widths), [
    [1, 3.5, 6],
    [1, 3.5, 6],
  ]);
});

Deno.test("literal linetype and linewidth lower on ordinary and reference Line marks", () => {
  const spec = ggplot(data, { x: "x", y: "y" })
    .add(
      geomLine({ linetype: "dotdash", linewidth: 3 }),
      geomHline({ yintercept: 20, linetype: "dotted", linewidth: 4 }),
    )
    .build();
  const lines = compile(spec).children[0].children.filter((c) =>
    c.component === "Line"
  );

  assertEquals(lines[0].props.width, 3);
  assertEquals(lines[0].props.dash, [1, 4, 8, 4]);
  assertEquals(lines[1].props.width, 4);
  assertEquals(lines[1].props.dash, [1, 4]);
});

Deno.test("effective grouping defaults to mapped discrete aesthetics", () => {
  const grouped = {
    x: [0, 1, 0, 1],
    y: [10, 20, 15, 25],
    color: ["b", "b", "a", "a"],
    shape: ["circle", "circle", "square", "square"],
  };

  assertEquals(groupColumnsOf({ x: "x", y: "y" }, grouped), []);
  assertEquals(
    groupColumnsOf({ x: "x", y: "y", group: "shape", color: "color" }, grouped),
    ["shape"],
  );
  assertEquals(groupColumnsOf({ x: "x", y: "y", color: "color" }, grouped), [
    "color",
  ]);
  assertEquals(
    groupColumnsOf({ x: "x", y: "y", color: "color", shape: "shape" }, grouped),
    ["color", "shape"],
  );
  assertEquals(
    groupColumnsOf({ x: "x", y: "y", linetype: "shape" }, grouped),
    ["shape"],
  );
  assertEquals(groupKeyAt(grouped, ["color", "shape"], 0), "b\0circle");
});

Deno.test("color aesthetic alone splits geom_line into one connected Line per group", () => {
  const grouped = {
    x: [0, 1, 2, 0, 1, 2],
    y: [1, 2, 3, 10, 20, 30],
    g: ["a", "a", "a", "b", "b", "b"],
  };
  const spec = ggplot(grouped, { x: "x", y: "y", color: "g" }).add(geomLine())
    .build();
  const tree = compile(spec);

  const lines = tree.children[0].children.filter((c) => c.component === "Line");
  assertEquals(lines.length, 2);
  assertEquals(lines.map((l) => l.props.positions), [
    [[0, 1], [1, 2], [2, 3]],
    [[0, 10], [1, 20], [2, 30]],
  ]);
  assertEquals(lines.map((l) => l.props.colors), [
    [CATEGORICAL_PALETTE[0], CATEGORICAL_PALETTE[0], CATEGORICAL_PALETTE[0]],
    [CATEGORICAL_PALETTE[1], CATEGORICAL_PALETTE[1], CATEGORICAL_PALETTE[1]],
  ]);
});

Deno.test("inheritAes: false ignores the plot's top-level mapping", () => {
  const both = { x: [1, 2], y: [10, 20], x2: [100, 200], y2: [1, 2] };
  const spec = ggplot(both, { x: "x", y: "y" })
    .add(geomPoint({ inheritAes: false, mapping: { x: "x2", y: "y2" } }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(point?.props.positions, [[100, 1], [200, 2]]);
});

Deno.test("annotate('segment', ...) renders a literal Line ignoring the plot's mapping", () => {
  const spec = ggplot(data, { x: "x", y: "y" })
    .add(
      geomPoint(),
      annotate("segment", { x: 0, y: 10, xend: 2, yend: 30, color: "#ff0000" }),
    )
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const line = panel.children.find((c) => c.component === "Line");
  assertEquals(line?.props.positions, [[[0, 10], [2, 30]]]);
  assertEquals(line?.props.color, "#ff0000");
});

Deno.test("annotate('rect', ...) renders a literal rectangle Polygon", () => {
  const spec = ggplot(data, { x: "x", y: "y" })
    .add(
      geomPoint(),
      annotate("rect", {
        xmin: 0,
        xmax: 1,
        ymin: 10,
        ymax: 20,
        fill: "#00ff00",
      }),
    )
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const polygon = panel.children.find((c) => c.component === "Polygon");
  assertEquals(polygon?.props.positions, [[[0, 10], [0, 20], [1, 20], [
    1,
    10,
  ]]]);
  assertEquals(polygon?.props.fill, "#00ff00");
});

Deno.test("annotate('text', ...) places a literal Label independent of the plot's mapping", () => {
  const spec = ggplot(data, { x: "x", y: "y", color: "x" })
    .add(geomPoint(), annotate("text", { x: 1, y: 25, label: "peak" }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const label = panel.children.find((c) => c.component === "Label");
  assertEquals(label?.props.positions, [[1, 25]]);
  assertEquals(label?.props.labels, ["peak"]);
});

Deno.test("geom_hline draws a full-width reference line at each yintercept", () => {
  const spec = ggplot(data, { x: "x", y: "y" })
    .add(geomPoint(), geomHline({ yintercept: [15, 25], color: "#000000" }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const [xDomain] = panel.props.range as [[number, number], [number, number]];
  const line = panel.children.find((c) => c.component === "Line");
  assertEquals(line?.props.positions, [
    [[xDomain[0], 15], [xDomain[1], 15]],
    [[xDomain[0], 25], [xDomain[1], 25]],
  ]);
});

Deno.test("geom_vline draws a full-height reference line at xintercept", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(
    geomPoint(),
    geomVline({ xintercept: 1 }),
  ).build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const [, yDomain] = panel.props.range as [[number, number], [number, number]];
  const line = panel.children.find((c) => c.component === "Line");
  assertEquals(line?.props.positions, [[[1, yDomain[0]], [1, yDomain[1]]]]);
});

Deno.test("geom_abline draws y = slope*x + intercept spanning the panel's x domain", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(
    geomPoint(),
    geomAbline({ slope: 2, intercept: 1 }),
  ).build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const [xDomain] = panel.props.range as [[number, number], [number, number]];
  const line = panel.children.find((c) => c.component === "Line");
  assertEquals(line?.props.positions, [
    [xDomain[0], 2 * xDomain[0] + 1],
    [xDomain[1], 2 * xDomain[1] + 1],
  ]);
});

Deno.test("annotate() and reference-line layers render in every facet panel", () => {
  const facetData = {
    x: [0, 1, 0, 1],
    y: [10, 20, 30, 40],
    g: ["a", "a", "b", "b"],
  };
  const spec = ggplot(facetData, { x: "x", y: "y" })
    .add(geomPoint(), geomHline({ yintercept: 25 }), facetWrap(["g"]))
    .build();
  const tree = compile(spec);

  const grid = facetGridNode(tree);
  const panels = grid.children;
  assertEquals(panels.length, 2);
  for (const panelEmbed of panels) {
    const panel = panelEmbed.children[0];
    const line = panel.children.find((c) => c.component === "Line");
    assertEquals(line !== undefined, true);
  }
});

Deno.test("geom_area fills a closed band from a 0 baseline to y", () => {
  const areaData = { x: [0, 1, 2], y: [10, 20, 15] };
  const spec = ggplot(areaData, { x: "x", y: "y" }).add(geomArea()).build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const polygon = panel.children.find((c) => c.component === "Polygon");
  assertEquals(polygon?.props.positions, [
    [0, 10],
    [1, 20],
    [2, 15],
    [2, 0],
    [1, 0],
    [0, 0],
  ]);
});

Deno.test("geom_ribbon fills a closed band between ymin and ymax", () => {
  const ribbonData = { x: [0, 1, 2], lo: [5, 8, 6], hi: [10, 20, 15] };
  const spec = ggplot(ribbonData, { x: "x", ymin: "lo", ymax: "hi" })
    .add(geomRibbon())
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const polygon = panel.children.find((c) => c.component === "Polygon");
  assertEquals(polygon?.props.positions, [
    [0, 10],
    [1, 20],
    [2, 15],
    [2, 6],
    [1, 8],
    [0, 5],
  ]);
});

Deno.test("geom_ribbon's ymin/ymax widen the trained y domain beyond a plain y mapping", () => {
  const ribbonData = { x: [0, 1, 2], lo: [5, 8, 6], hi: [10, 20, 15] };
  const spec = ggplot(ribbonData, { x: "x", ymin: "lo", ymax: "hi" })
    .add(geomRibbon())
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  assertEquals(panel.props.range, [[0, 2], [5, 20]]);
});

Deno.test("scaleXLog10 transforms both the trained domain and mark positions", () => {
  const logData = { x: [1, 10, 100], y: [1, 2, 3] };
  const spec = ggplot(logData, { x: "x", y: "y" }).add(
    geomPoint(),
    scaleXLog10(),
  ).build();
  const tree = compile(spec);

  const panel = tree.children[0];
  assertEquals(panel.props.range, [[0, 2], [1, 3]]);

  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(point?.props.positions, [[0, 1], [1, 2], [2, 3]]);
});

Deno.test("scaleXSqrt transforms both the trained domain and mark positions", () => {
  const sqrtData = { x: [0, 4, 9], y: [1, 2, 3] };
  const spec = ggplot(sqrtData, { x: "x", y: "y" }).add(
    geomPoint(),
    scaleXSqrt(),
  ).build();
  const tree = compile(spec);

  const panel = tree.children[0];
  assertEquals(panel.props.range, [[0, 3], [1, 3]]);

  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(point?.props.positions, [[0, 1], [2, 2], [3, 3]]);
});

Deno.test("explicit scale domain overrides the auto-trained data extent (user limits)", () => {
  const limitData = { x: [1, 2, 3], y: [10, 20, 30] };
  const spec = ggplot(limitData, { x: "x", y: "y" })
    .add(geomPoint(), scaleXContinuous({ domain: [0, 100] }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  assertEquals(panel.props.range, [[0, 100], [10, 30]]);
  // positions stay at their real data values regardless of the view's limits
  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(point?.props.positions, [[1, 10], [2, 20], [3, 30]]);
});

Deno.test("scale expand pads the trained domain by a multiplicative + additive amount", () => {
  const expandData = { x: [0, 10], y: [0, 1] };
  const spec = ggplot(expandData, { x: "x", y: "y" })
    .add(geomPoint(), scaleXContinuous({ expand: [0.1, 1] }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  // span 10 * 0.1 = 1, + additive 1 = 2 padding on each side
  assertEquals(panel.props.range, [[-2, 12], [0, 1]]);
});

Deno.test("continuous size scale maps mark radius via a mapped size column", () => {
  const sized = { x: [0, 1, 2], y: [0, 1, 2], weight: [0, 5, 10] };
  const spec = ggplot(sized, { x: "x", y: "y", size: "weight" }).add(
    geomPoint(),
  ).build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const point = panel.children.find((c) => c.component === "Point");
  // default size range [1,6] over domain [0,10]: 0->1, 5->3.5, 10->6
  assertEquals(point?.props.sizes, [1, 3.5, 6]);
});

Deno.test("scaleSizeValue/scaleAlphaValue interpolate across their default and custom ranges", () => {
  const scale = {
    aes: "size" as const,
    kind: "continuous" as const,
    domain: [0, 10] as [number, number],
  };
  assertEquals(scaleSizeValue(scale, 0), 1);
  assertEquals(scaleSizeValue(scale, 10), 6);
  assertEquals(scaleAlphaValue(scale, 0), 0.1);
  assertEquals(scaleAlphaValue(scale, 10), 1);

  const customRange = { ...scale, range: [10, 20] as [number, number] };
  assertEquals(scaleSizeValue(customRange, 5), 15);
});

Deno.test("linetype and linewidth scales train, map, and expose custom ranges", () => {
  const scale = {
    aes: "linewidth" as const,
    kind: "continuous" as const,
    domain: [0, 10] as [number, number],
  };
  assertEquals(scaleLinewidthValue(scale, 0), 1);
  assertEquals(scaleLinewidthValue(scale, 10), 6);
  assertEquals(scaleLinewidthValue({ ...scale, range: [2, 4] }, 5), 3);

  const dashScale = {
    aes: "linetype" as const,
    kind: "discrete" as const,
    domain: ["a", "b"],
    range: [[], [3, 2]],
  };
  assertEquals(scaleLinetypeValue(dashScale, "a"), undefined);
  assertEquals(scaleLinetypeValue(dashScale, "b"), [3, 2]);

  const spec = ggplot(
    { x: [0, 1], y: [0, 1], type: ["a", "b"], weight: [0, 10] },
    { x: "x", y: "y", linetype: "type", linewidth: "weight" },
  ).add(
    scaleLinetype({ range: [[], [3, 2]] }),
    scaleLinewidth({ range: [2, 4] }),
  )
    .build();
  const scales = trainScales(spec, [{
    data: spec.data,
    mapping: spec.mapping,
  }]);
  assertEquals(scales.get("linetype")?.range, [[], [3, 2]]);
  assertEquals(scales.get("linewidth")?.range, [2, 4]);
});

Deno.test("linetype and linewidth mappings emit Line legend swatches", () => {
  const spec = ggplot(
    {
      x: [0, 1, 0, 1],
      y: [1, 2, 3, 4],
      type: ["a", "a", "b", "b"],
      weight: [0, 10, 0, 10],
    },
    { x: "x", y: "y", linetype: "type", linewidth: "weight" },
  ).add(geomLine()).build();
  const tree = compile(spec);
  const legendLines = tree.children.filter((node) =>
    node.component === "Line" && node.props.color === "#3b82f6"
  );
  assertEquals(legendLines.length, 5);
  assertEquals(legendLines[1].props.dash, [8, 5]);
  assertEquals(legendLines.slice(2).map((line) => line.props.width), [
    1,
    3.5,
    6,
  ]);
});

Deno.test("continuous size mapping emits a legend guide with scaled swatches", () => {
  const sized = { x: [0, 1, 2], y: [1, 2, 3], mag: [0, 5, 10] };
  const spec = ggplot(sized, { x: "x", y: "y", size: "mag" }).add(geomPoint())
    .build();
  const tree = compile(spec);

  const legendSwatch = tree.children.find((c) =>
    c.component === "Point" && Array.isArray(c.props.sizes) &&
    (c.props.sizes as unknown[]).length === 3
  );
  assertEquals(legendSwatch?.props.sizes, [1, 3.5, 6]);

  const labels = tree.children.filter((c) => c.component === "Label").map((c) =>
    c.props.labels
  );
  assertEquals(labels, [["size"], ["0", "5", "10"]]);
});

Deno.test("scaleShapeValue assigns a fixed glyph palette by discrete level", () => {
  const scale = {
    aes: "shape" as const,
    kind: "discrete" as const,
    domain: ["a", "b", "c"],
    range: ["circle", "square", "triangle"],
  };
  assertEquals(scaleShapeValue(scale, "a"), "circle");
  assertEquals(scaleShapeValue(scale, "b"), "square");
  assertEquals(scaleShapeValue(scale, "c"), "triangle");
});

Deno.test("shape mapping splits point marks and emits a shape legend", () => {
  const shaped = {
    x: [0, 1, 2, 3],
    y: [1, 2, 3, 4],
    grp: ["b", "a", "b", "a"],
  };
  const spec = ggplot(shaped, { x: "x", y: "y", shape: "grp" }).add(geomPoint())
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const markPoints = panel.children.filter((c) => c.component === "Point");
  assertEquals(markPoints.map((p) => p.props.shape), ["square", "circle"]);

  const legendPoints = tree.children.filter((c) =>
    c.component === "Point" && c.props.size === 7
  );
  assertEquals(legendPoints.map((p) => p.props.shape), ["circle", "square"]);
  const labels = tree.children.filter((c) => c.component === "Label").map((c) =>
    c.props.labels
  );
  assertEquals(labels, [["shape"], ["a", "b"]]);
});

Deno.test("geomPoint alpha param passes through as a flat opacity", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(geomPoint({ alpha: 0.4 }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(point?.props.opacity, 0.4);
});

Deno.test("stat_bin buckets continuous x into fixed-width bins with counts and density", () => {
  const binLayer: Layer = {
    geom: "bar",
    stat: "bin",
    position: "identity",
    params: { binwidth: 2 },
  };
  const data = { x: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };
  const result = applyStat(binLayer, { x: "x" }, data);

  assertEquals(result.mapping.y, "count");
  assertEquals(values(result.data, "x"), [1, 3, 5, 7, 9]);
  assertEquals(values(result.data, "count"), [2, 2, 2, 2, 2]);
  assertEquals(values(result.data, "density"), [0.1, 0.1, 0.1, 0.1, 0.1]);
});

Deno.test("stat_bin honors an explicit bin count and conserves total row count", () => {
  const binLayer: Layer = {
    geom: "bar",
    stat: "bin",
    position: "identity",
    params: { bins: 4 },
  };
  const data = { x: [0, 1, 2, 3] };
  const result = applyStat(binLayer, { x: "x" }, data);

  assertEquals(values(result.data, "count").length, 4);
  assertEquals(
    (values(result.data, "count") as number[]).reduce((a, b) => a + b, 0),
    4,
  );
});

Deno.test("weighted stat_bin keeps fractional bin counts and finite weights", () => {
  const layer: Layer = {
    geom: "bar",
    stat: "bin",
    position: "stack",
    params: { binwidth: 2, weight: "mass" },
  };
  const result = applyStat(
    layer,
    { x: "x", fill: "group" },
    {
      x: [0, 2, 4, 0, 2],
      group: ["a", "a", "a", "b", "b"],
      mass: [0.5, 1.25, 3, 2, Number.NaN],
    },
  );

  assertEquals(values(result.data, "count"), [0.5, 4.25, 2, 0]);
  assertEquals(values(result.data, "density"), [
    0.5 / (4.75 * 2),
    4.25 / (4.75 * 2),
    0.5,
    0,
  ]);
});

Deno.test("stat_bin bins per effective fill group and preserves fill data", () => {
  const binLayer: Layer = {
    geom: "bar",
    stat: "bin",
    position: "stack",
    params: { binwidth: 2 },
  };
  const binData = { x: [0, 1, 2, 3, 0, 1], g: ["a", "a", "a", "a", "b", "b"] };
  const result = applyStat(binLayer, { x: "x", fill: "g" }, binData);

  assertEquals(values(result.data, "x"), [1, 3, 1, 3]);
  assertEquals(values(result.data, "g"), ["a", "a", "b", "b"]);
  assertEquals(values(result.data, "count"), [2, 2, 2, 0]);
});

Deno.test("stat_bin uses asNumeric metadata from the DSL boundary", () => {
  const binLayer: Layer = {
    geom: "bar",
    stat: "bin",
    position: "identity",
    params: { binwidth: 2 },
  };
  const spec = ggplot(
    {
      x: ["0", "1", "bad", "2", "3"],
    },
    { x: "x" },
    {
      columns: { x: asNumeric() },
    },
  ).build();
  const result = applyStat(binLayer, spec.mapping, spec.data);

  assertEquals(values(result.data, "x"), [1, 3]);
  assertEquals(values(result.data, "count"), [2, 2]);
});

Deno.test("geomHistogram lowers to geomBar with stat_bin", () => {
  const histData = { x: [0, 1, 2, 3, 4, 5], g: ["a", "a", "a", "b", "b", "b"] };
  const histogram = ggplot(histData, { x: "x", fill: "g" })
    .add(geomHistogram({ binwidth: 2, position: "dodge" }))
    .build();
  const explicit = ggplot(histData, { x: "x", fill: "g" })
    .add(geomBar({ stat: "bin", binwidth: 2, position: "dodge" }))
    .build();

  assertEquals(histogram.layers[0].geom, "bar");
  assertEquals(histogram.layers[0].stat, "bin");
  assertEquals(histogram.layers[0].params.binwidth, 2);
  assertEquals(histogram.layers[0].position, "dodge");
  assertEquals(compile(histogram), compile(explicit));
});

Deno.test("geomHistogram forces stat_bin even if stat is supplied", () => {
  const spec = ggplot({ x: [0, 1, 2] }, { x: "x" })
    .add(geomHistogram({ stat: "count", bins: 3 }))
    .build();

  assertEquals(spec.layers[0].stat, "bin");
  assertEquals(spec.layers[0].params.bins, 3);
});

Deno.test("resident compile lowers an eligible histogram without stat rows", () => {
  const spec = ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
    .add(geomHistogram({ binwidth: 2, fill: "#ff0000" }))
    .add(scaleYContinuous({ domain: [0, 4] }))
    .build();
  const tree = compile(spec, { resident: true });
  const resident = findNodes(tree, "ResidentHistogram");

  assertEquals(resident.length, 1);
  assertEquals(resident[0].props.x, "x");
  assertEquals(resident[0].props.group, undefined);
  assertEquals((resident[0].props.options as { binwidth: number }).binwidth, 2);
  assertEquals(
    (resident[0].props.options as { autoDomain: boolean }).autoDomain,
    true,
  );
  assertEquals(Object.keys(resident[0].props.data as Record<string, unknown>), [
    "x",
  ]);
});

Deno.test("resident compile preserves declared dodge and fill grid layouts", () => {
  for (const position of ["dodge", "fill"] as const) {
    const spec = ggplot(
      { x: [0, 1, 2, 3], group: ["a", "a", "b", "b"] },
      { x: "x", group: "group" },
    ).add(
      geomHistogram({ binwidth: 2, position }),
      scaleYContinuous({ domain: [0, 4] }),
    ).build();
    const resident = findNodes(
      compile(spec, { resident: true }),
      "ResidentHistogram",
    );
    assertEquals(resident.length, 1);
    assertEquals(
      (resident[0].props.options as { position: string }).position,
      position,
    );
  }
});

Deno.test("resident compile uses a bounded-summary view for automatic y domains", () => {
  const spec = ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
    .add(geomHistogram({ binwidth: 2 }))
    .build();
  const tree = compile(spec, { resident: true });

  assertEquals(findNodes(tree, "ResidentHistogramView").length, 1);
  assertEquals(findNodes(tree, "Polygon").length, 0);
});

Deno.test("resident compile preserves CPU fallback outside the standalone cartesian contract", () => {
  const spec = ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
    .add(geomHistogram({ binwidth: 2 }))
    .add(coordPolar())
    .build();
  const tree = compile(spec, { resident: true });

  assertEquals(findNodes(tree, "ResidentHistogram").length, 0);
  assertEquals(findNodes(tree, "ResidentHistogramView").length, 0);
  assertEquals(findNodes(tree, "Polygon").length > 0, true);
});

Deno.test("discrete color scale assigns fixed categorical palette slots by level", () => {
  const grouped = {
    x: [0, 1, 2, 3],
    y: [1, 2, 3, 4],
    grp: ["b", "a", "b", "a"],
  };
  const spec = ggplot(grouped, { x: "x", y: "y", color: "grp" }).add(
    geomPoint(),
  ).build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const point = panel.children.find((c) => c.component === "Point");
  // levels sort to [a, b] → a=slot0 (blue), b=slot1 (aqua)
  assertEquals(point?.props.colors, [
    CATEGORICAL_PALETTE[1],
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[1],
    CATEGORICAL_PALETTE[0],
  ]);
});

Deno.test("discrete color mapping emits a legend guide with swatches and labels", () => {
  const grouped = {
    x: [0, 1, 2, 3],
    y: [1, 2, 3, 4],
    grp: ["b", "a", "b", "a"],
  };
  const spec = ggplot(grouped, { x: "x", y: "y", color: "grp" }).add(
    geomPoint(),
  ).build();
  const tree = compile(spec);

  const legendSwatch = tree.children.find((c) =>
    c.component === "Point" && c.props.size === 7
  );
  assertEquals(legendSwatch?.props.colors, [
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[1],
  ]);

  const labels = tree.children.filter((c) => c.component === "Label").map((c) =>
    c.props.labels
  );
  assertEquals(labels, [["color"], ["a", "b"]]);
});

Deno.test("continuous color scale interpolates the sequential ramp across the domain", () => {
  const data2 = { x: [0, 1], y: [0, 1], val: [0, 10] };
  const perLayer = [{
    data: ingest(data2),
    mapping: { x: "x", y: "y", color: "val" },
  }];
  const spec = ggplot(data2, { x: "x", y: "y", color: "val" }).build();
  const scales = trainScales(spec, perLayer);
  const colorScale = scales.get("color");

  assertEquals(colorScale?.domain, [0, 10]);
  assertEquals(scaleColorValue(colorScale, 0), "#cde2fb"); // lightest ramp step
  assertEquals(scaleColorValue(colorScale, 10), "#0d366b"); // darkest ramp step
});

Deno.test("viridis and gradient2 builders preserve serializable ramps through color lowering", () => {
  const paletteData = { x: [0, 1, 2], y: [0, 1, 2], value: [0, 5, 10] };
  const viridis = ggplot(paletteData, { x: "x", y: "y", color: "value" })
    .add(geomPoint(), scaleColorViridis())
    .build();
  const viridisPoint = compile(viridis).children[0].children.find((node) =>
    node.component === "Point"
  );
  assertEquals(viridisPoint?.props.colors, ["#440154", "#23908c", "#fde725"]);

  const diverging = ggplot(paletteData, { x: "x", y: "y", color: "value" })
    .add(geomPoint(), scaleColorGradient2())
    .build();
  const divergingPoint = compile(diverging).children[0].children.find((node) =>
    node.component === "Point"
  );
  assertEquals(divergingPoint?.props.colors, ["#b2182b", "#f7f7f7", "#2166ac"]);
});

Deno.test("scaleColor domain fixes explicit categorical color assignment", () => {
  const grouped = { x: [0, 1], y: [1, 2], grp: ["b", "a"] };
  const spec = ggplot(grouped, { x: "x", y: "y", color: "grp" })
    .add(
      geomPoint(),
      scaleColor({ domain: ["a", "b"], range: ["#111111", "#222222"] }),
    )
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(point?.props.colors, ["#222222", "#111111"]);
});

Deno.test("mapped aesthetics train scales instead of treating strings as visual literals", () => {
  const literalWords = { x: [0, 1], y: [1, 2], shade: ["red", "blue"] };
  const spec = ggplot(literalWords, { x: "x", y: "y", color: "shade" })
    .add(geomPoint())
    .build();
  const tree = compile(spec);

  const point = tree.children[0].children.find((c) => c.component === "Point");
  // The words "blue"/"red" are data values. They train a discrete scale and
  // map to palette slots, rather than passing through as CSS color names.
  assertEquals(point?.props.colors, [
    CATEGORICAL_PALETTE[1],
    CATEGORICAL_PALETTE[0],
  ]);
  assertEquals(point?.props.color, undefined);

  const legendSwatch = tree.children.find((c) =>
    c.component === "Point" && c.props.size === 7
  );
  assertEquals(legendSwatch?.props.colors, [
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[1],
  ]);
});

Deno.test("fixed layer params pass through as literal visual settings without guides", () => {
  const hasColorColumn = {
    x: [0, 1],
    y: [1, 2],
    color: ["red", "blue"],
    mag: [10, 20],
  };
  const spec = ggplot(hasColorColumn, { x: "x", y: "y" })
    .add(geomPoint({ color: "red", size: 9 }))
    .build();
  const tree = compile(spec);

  const point = tree.children[0].children.find((c) => c.component === "Point");
  assertEquals(point?.props.color, "red");
  assertEquals(point?.props.size, 9);
  assertEquals(point?.props.colors, undefined);
  assertEquals(point?.props.sizes, undefined);
  assertEquals(tree.children.filter((c) => c.component === "Label").length, 0);
});

Deno.test("color and fill mappings keep independent scales in the same plot", () => {
  const mixed = {
    x: [0, 1],
    y: [0, 1],
    grp: ["a", "b"],
    heat: ["low", "high"],
  };
  const spec = ggplot(mixed, { x: "x", y: "y", color: "grp", fill: "heat" })
    .add(
      geomPoint(),
      geomTile(),
      scaleColor({ domain: ["a", "b"], range: ["#111111", "#222222"] }),
      scaleFill({ domain: ["high", "low"], range: ["#aaaaaa", "#bbbbbb"] }),
    )
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const point = panel.children.find((c) => c.component === "Point");
  const tile = panel.children.find((c) => c.component === "Polygon");

  assertEquals(point?.props.colors, ["#111111", "#222222"]);
  assertEquals(tile?.props.fills, ["#bbbbbb", "#aaaaaa"]);

  const labels = tree.children.filter((c) => c.component === "Label").map((c) =>
    c.props.labels
  );
  assertEquals(labels, [["color"], ["a", "b"], ["fill"], ["high", "low"]]);
});

Deno.test("labels() overrides legend titles and emits plot title text", () => {
  const grouped = { x: [0, 1], y: [1, 2], grp: ["b", "a"] };
  const spec = ggplot(grouped, { x: "x", y: "y", color: "grp" })
    .add(
      labels({
        title: "Penguins",
        subtitle: "By species",
        caption: "Source: demo",
        color: "Species",
      }),
    )
    .add(geomPoint())
    .build();
  const tree = compile(spec);

  const labelTexts = tree.children.filter((c) => c.component === "Label").map((
    c,
  ) => c.props.labels);
  assertEquals(labelTexts, [["Penguins"], ["By species"], ["Source: demo"], [
    "Species",
  ], ["a", "b"]]);

  const src = emitSource(tree, "LabeledPlot");
  assertStringIncludes(src, "Penguins");
  assertStringIncludes(src, "Species");
});

Deno.test("labels() renames facet strip variables", () => {
  const facetData = { cyl: ["4", "6", "4"], x: [1, 2, 3], y: [10, 20, 30] };
  const spec = ggplot(facetData, { x: "x", y: "y" })
    .add(geomPoint(), facetWrap(["cyl"]), labels({ cyl: "Cylinders" }))
    .build();
  const tree = compile(spec);

  const facet = facetGridNode(tree);
  const stripLabels = facet.children.map((embed) =>
    embed.children.find((c) => c.component === "Label")?.props.labels
  );
  assertEquals(stripLabels, [["Cylinders: 4"], ["Cylinders: 6"]]);
});

Deno.test("stat_smooth (lm) fits an exact line through noise-free data, with a zero-width CI band", () => {
  const smoothLayer: Layer = {
    geom: "smooth",
    stat: "smooth",
    position: "identity",
    params: { n: 5 },
  };
  const linData = { x: [0, 1, 2, 3, 4], y: [1, 3, 5, 7, 9] }; // y = 2x + 1, no residual
  const result = applyStat(smoothLayer, { x: "x", y: "y" }, linData);

  assertEquals(result.mapping.y, "y");
  assertEquals(result.mapping.ymin, "ymin");
  assertEquals(result.mapping.ymax, "ymax");
  assertEquals(values(result.data, "x"), [0, 1, 2, 3, 4]);
  assertEquals(values(result.data, "y"), [1, 3, 5, 7, 9]);
  // zero residual variance -> the CI band collapses onto the fitted line
  assertEquals(values(result.data, "ymin"), [1, 3, 5, 7, 9]);
  assertEquals(values(result.data, "ymax"), [1, 3, 5, 7, 9]);
});

Deno.test("stat_smooth se:false omits the CI band columns/mapping", () => {
  const smoothLayer: Layer = {
    geom: "smooth",
    stat: "smooth",
    position: "identity",
    params: { n: 3, se: false },
  };
  const linData = { x: [0, 1, 2, 3, 4], y: [1, 3, 5, 7, 9] };
  const result = applyStat(smoothLayer, { x: "x", y: "y" }, linData);

  assertEquals(values(result.data, "x"), [0, 2, 4]);
  assertEquals(values(result.data, "y"), [1, 5, 9]);
  assertEquals(result.data.ymin, undefined);
  assertEquals(result.mapping.ymin, undefined);
});

Deno.test("geom_smooth renders a Line plus a CI Ribbon Polygon", () => {
  const smoothData = { x: [0, 1, 2, 3, 4], y: [1, 3, 5, 7, 9] };
  const spec = ggplot(smoothData, { x: "x", y: "y" }).add(geomSmooth({ n: 5 }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const line = panel.children.find((c) => c.component === "Line");
  assertEquals(line?.props.positions, [[0, 1], [1, 3], [2, 5], [3, 7], [4, 9]]);

  const polygon = panel.children.find((c) => c.component === "Polygon");
  assertEquals(polygon?.props.positions, [
    [0, 1],
    [1, 3],
    [2, 5],
    [3, 7],
    [4, 9],
    [4, 9],
    [3, 7],
    [2, 5],
    [1, 3],
    [0, 1],
  ]);
  assertEquals(polygon?.props.fill, "#c7d2fe");
});

Deno.test("geom_smooth se:false skips the Ribbon Polygon entirely", () => {
  const smoothData = { x: [0, 1, 2, 3, 4], y: [1, 3, 5, 7, 9] };
  const spec = ggplot(smoothData, { x: "x", y: "y" }).add(
    geomSmooth({ n: 5, se: false }),
  ).build();
  const tree = compile(spec);

  const panel = tree.children[0];
  assertEquals(
    panel.children.find((c) => c.component === "Polygon"),
    undefined,
  );
  const line = panel.children.find((c) => c.component === "Line");
  assertEquals(line?.props.positions, [[0, 1], [1, 3], [2, 5], [3, 7], [4, 9]]);
});

Deno.test("geom_smooth fits and renders one line per effective color group", () => {
  const smoothData = {
    x: [0, 1, 2, 0, 1, 2],
    y: [1, 1, 1, 10, 20, 30],
    g: ["flat", "flat", "flat", "steep", "steep", "steep"],
  };
  const spec = ggplot(smoothData, { x: "x", y: "y", color: "g" })
    .add(geomSmooth({ n: 3, se: false }))
    .build();
  const tree = compile(spec);

  const lines = tree.children[0].children.filter((c) => c.component === "Line");
  assertEquals(lines.length, 2);
  assertEquals(lines.map((l) => l.props.positions), [
    [[0, 1], [1, 1], [2, 1]],
    [[0, 10], [1, 20], [2, 30]],
  ]);
  assertEquals(lines.map((l) => l.props.color), [
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[1],
  ]);
});

Deno.test("stat_summary aggregates y per x group by mean (default)", () => {
  const summaryLayer: Layer = {
    geom: "point",
    stat: "summary",
    position: "identity",
    params: {},
  };
  const data = { grp: ["a", "a", "b", "b", "b"], val: [10, 20, 4, 5, 9] };
  const result = applyStat(summaryLayer, { x: "grp", y: "val" }, data);

  assertEquals(values(result.data, "grp"), ["a", "b"]);
  assertEquals(values(result.data, "val"), [15, 6]);
  assertEquals(result.mapping, { x: "grp", y: "val" });
});

Deno.test("stat_summary aggregates y per x and effective color group", () => {
  const summaryLayer: Layer = {
    geom: "point",
    stat: "summary",
    position: "identity",
    params: {},
  };
  const summaryData = {
    day: ["mon", "mon", "mon", "mon"],
    series: ["a", "a", "b", "b"],
    val: [1, 3, 10, 14],
  };
  const result = applyStat(summaryLayer, {
    x: "day",
    y: "val",
    color: "series",
  }, summaryData);

  assertEquals(values(result.data, "day"), ["mon", "mon"]);
  assertEquals(values(result.data, "series"), ["a", "b"]);
  assertEquals(values(result.data, "val"), [2, 12]);
});

Deno.test("stat_summary supports fun: median", () => {
  const summaryLayer: Layer = {
    geom: "point",
    stat: "summary",
    position: "identity",
    params: { fun: "median" },
  };
  const data = { grp: ["a", "a", "a", "a"], val: [1, 2, 3, 10] };
  const result = applyStat(summaryLayer, { x: "grp", y: "val" }, data);

  assertEquals(values(result.data, "val"), [2.5]);
});

Deno.test("stat_summary uses asNumeric metadata from the DSL boundary", () => {
  const summaryLayer: Layer = {
    geom: "point",
    stat: "summary",
    position: "identity",
    params: {},
  };
  const spec = ggplot(
    {
      grp: ["a", "a", "b", "b"],
      val: ["10", "bad", "4", "6"],
    },
    { x: "grp", y: "val" },
    {
      columns: { val: asNumeric() },
    },
  ).build();
  const result = applyStat(summaryLayer, spec.mapping, spec.data);

  assertEquals(values(result.data, "grp"), ["a", "b"]);
  assertEquals(values(result.data, "val"), [10, 5]);
});

Deno.test("stat_summary routes built-in sum/min/max aggregators", () => {
  const data = { grp: ["a", "a", "b", "b"], val: [4, 10, 1, 8] };
  const cases: Array<[string, number[]]> = [
    ["sum", [14, 9]],
    ["min", [4, 1]],
    ["max", [10, 8]],
  ];
  for (const [fun, expected] of cases) {
    const summaryLayer: Layer = {
      geom: "point",
      stat: "summary",
      position: "identity",
      params: { fun },
    };
    const result = applyStat(summaryLayer, { x: "grp", y: "val" }, data);

    assertEquals(values(result.data, "grp"), ["a", "b"]);
    assertEquals(values(result.data, "val"), expected);
  }
});

Deno.test("stat_summary supports a custom aggregator function", () => {
  const summaryLayer: Layer = {
    geom: "point",
    stat: "summary",
    position: "identity",
    params: { fun: (vs: number[]) => Math.max(...vs) - Math.min(...vs) },
  };
  const data = { grp: ["a", "a", "a"], val: [4, 10, 1] };
  const result = applyStat(summaryLayer, { x: "grp", y: "val" }, data);

  assertEquals(values(result.data, "val"), [9]);
});

Deno.test("default theme renders no background Polygon, unstyled Grid/Axis", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(geomPoint()).build();
  const tree = compile(spec);

  const panel = tree.children[0];
  assertEquals(
    panel.children.find((c) => c.component === "Polygon"),
    undefined,
  );
  const grid = panel.children.find((c) => c.component === "Grid");
  assertEquals(grid?.props, { axes: "xy", width: 1, zBias: 1 });
  const axis = panel.children.find((c) =>
    c.component === "Axis" && c.props.axis === "x"
  );
  assertEquals(axis?.props, { axis: "x", width: 2, zBias: 1 });
});

Deno.test("themeGrey adds a full-panel background Polygon and a white grid color", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(geomPoint(), themeGrey())
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  const bg = panel.children.find((c) => c.component === "Polygon");
  assertEquals(bg?.props.fill, "#ebebeb");
  assertEquals(bg?.props.depth, 1);
  assertEquals(bg?.props.depthWrite, false);
  // background spans the trained x/y range
  assertEquals(bg?.props.positions, [[0, 10], [0, 30], [2, 30], [2, 10]]);
  // it's drawn before the Grid/marks so it renders underneath
  assertEquals(panel.children[0].component, "Polygon");

  const grid = panel.children.find((c) => c.component === "Grid");
  assertEquals(grid?.props.color, "#ffffff");
  assertEquals(grid?.props.zBias, 1);
});

Deno.test("themeClassic omits the Grid node entirely", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(geomPoint(), themeClassic())
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  assertEquals(panel.children.find((c) => c.component === "Grid"), undefined);
  assertEquals(panel.children.filter((c) => c.component === "Axis").length, 2);
});

Deno.test("theme() merges over a prior theme_*() instead of replacing it", () => {
  const spec = ggplot(data, { x: "x", y: "y" })
    .add(geomPoint(), themeGrey(), theme({ axisColor: "#ff0000" }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0];
  // themeGrey's background survives even though theme() was applied after
  assertEquals(
    panel.children.find((c) => c.component === "Polygon")?.props.fill,
    "#ebebeb",
  );
  const axis = panel.children.find((c) => c.component === "Axis");
  assertEquals(axis?.props.color, "#ff0000");
});

Deno.test("theme fontFamily/fontSize/textColor style geom_text's Label unless the layer overrides them", () => {
  const labelData = { x: [0], y: [0], name: ["Hi"] };
  const spec = ggplot(labelData, { x: "x", y: "y", label: "name" })
    .add(
      geomText(),
      theme({ fontFamily: "Georgia", fontSize: 20, textColor: "#112233" }),
    )
    .build();
  const tree = compile(spec);

  const label = tree.children[0].children.find((c) => c.component === "Label");
  assertEquals(label?.props.family, "Georgia");
  assertEquals(label?.props.size, 20);
  assertEquals(label?.props.color, "#112233");

  const overridden = ggplot(labelData, { x: "x", y: "y", label: "name" })
    .add(
      geomText({ size: 8, color: "#000000" }),
      theme({ fontSize: 20, textColor: "#112233" }),
    )
    .build();
  const overriddenLabel = compile(overridden).children[0].children.find((c) =>
    c.component === "Label"
  );
  assertEquals(overriddenLabel?.props.size, 8);
  assertEquals(overriddenLabel?.props.color, "#000000");
});

Deno.test("emitSource produces UseGPU Live source with a classic pragma", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(geomPoint()).build();
  const src = emitSource(compile(spec), "MyChart");

  assertStringIncludes(src, "@jsx createElement");
  assertStringIncludes(src, 'from "@use-gpu/plot"');
  assertStringIncludes(src, "export const MyChart");
  assertStringIncludes(src, "<Point");
});

Deno.test("facet_wrap partitions data into panels laid out in an auto-sized grid", () => {
  const facetData = {
    cyl: ["4", "6", "8", "4", "6"],
    x: [1, 2, 3, 4, 5],
    y: [10, 20, 30, 40, 50],
  };
  const spec = ggplot(facetData, { x: "x", y: "y" })
    .add(geomPoint(), facetWrap(["cyl"]))
    .build();
  const tree = compile(spec);

  assertEquals(tree.component, "Embedded");
  const facet = facetGridNode(tree);
  // 3 distinct cyl levels -> ncol = ceil(sqrt(3)) = 2, nrow = ceil(3/2) = 2
  assertEquals(facet.props.nrow, 2);
  assertEquals(facet.props.ncol, 2);
  assertEquals(facet.children.length, 3);

  const panels = facet.children.map((embed) =>
    embed.children.find((c) => c.component === "Cartesian")
  );
  // scales are shared/fixed across panels: the full x/y extent, not each panel's own
  for (const panel of panels) {
    assertEquals(panel?.props.range, [[1, 5], [10, 50]]);
  }

  const points = panels.map((panel) =>
    panel?.children.find((c) => c.component === "Point")
  );
  assertEquals(points[0]?.props.positions, [[1, 10], [4, 40]]); // cyl: 4 (rows 0, 3)
  assertEquals(points[1]?.props.positions, [[2, 20], [5, 50]]); // cyl: 6 (rows 1, 4)
  assertEquals(points[2]?.props.positions, [[3, 30]]); // cyl: 8 (row 2)

  const labels = facet.children.map((embed) =>
    embed.children.find((c) => c.component === "Label")
  );
  assertEquals(labels.map((l) => l?.props.labels), [["cyl: 4"], ["cyl: 6"], [
    "cyl: 8",
  ]]);
});

Deno.test("facet_wrap honors an explicit ncol", () => {
  const facetData = {
    grp: ["a", "b", "c", "d"],
    x: [1, 2, 3, 4],
    y: [1, 2, 3, 4],
  };
  const spec = ggplot(facetData, { x: "x", y: "y" })
    .add(geomPoint(), facetWrap(["grp"], 4))
    .build();
  const tree = compile(spec);
  const facet = facetGridNode(tree);

  assertEquals(facet.props.ncol, 4);
  assertEquals(facet.props.nrow, 1);
  assertEquals(facet.children.length, 4);
});

Deno.test("faceted plots keep plot-level color legends outside FacetGrid", () => {
  const facetData = {
    grp: ["a", "a", "b", "b"],
    cls: ["x", "y", "x", "y"],
    x: [1, 2, 3, 4],
    y: [10, 20, 30, 40],
  };
  const spec = ggplot(facetData, { x: "x", y: "y", color: "cls" })
    .add(geomPoint(), facetWrap(["grp"]), labels({ color: "Class" }))
    .build();
  const tree = compile(spec);
  const facet = facetGridNode(tree);

  assertEquals(tree.component, "Embedded");
  assertEquals(facet.children.length, 2);
  const legendSwatch = tree.children.find((c) =>
    c.component === "Point" && c.props.size === 7
  );
  assertEquals(legendSwatch?.props.colors, [
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[1],
  ]);

  const plotLevelLabels = tree.children.filter((c) => c.component === "Label")
    .map((c) => c.props.labels);
  assertEquals(plotLevelLabels, [["Class"], ["x", "y"]]);
});

Deno.test("facet_grid crosses row and column variables into a full panel grid, including empty combinations", () => {
  const facetData = {
    r: ["lo", "lo", "hi"],
    c: ["L", "R", "L"],
    x: [1, 2, 3],
    y: [10, 20, 30],
  };
  const spec = ggplot(facetData, { x: "x", y: "y" })
    .add(geomPoint(), facetGrid(["r"], ["c"]))
    .build();
  const tree = compile(spec);

  assertEquals(tree.component, "Embedded");
  const facet = facetGridNode(tree);
  assertEquals(facet.props.nrow, 2); // r: hi, lo
  assertEquals(facet.props.ncol, 2); // c: L, R
  assertEquals(facet.children.length, 4);

  const labels = facet.children.map((embed) =>
    embed.children.find((c) => c.component === "Label")?.props.labels
  );
  assertEquals(labels, [
    ["r: hi, c: L"],
    ["r: hi, c: R"],
    ["r: lo, c: L"],
    ["r: lo, c: R"],
  ]);

  const points = facet.children.map((embed) =>
    embed.children.find((c) => c.component === "Cartesian")?.children.find((
      c,
    ) => c.component === "Point")
  );
  assertEquals(points[0]?.props.positions, [[3, 30]]); // r: hi, c: L -> row 2
  assertEquals(points[1], undefined); // r: hi, c: R -> no matching rows, no Point node
  assertEquals(points[2]?.props.positions, [[1, 10]]); // r: lo, c: L -> row 0
  assertEquals(points[3]?.props.positions, [[2, 20]]); // r: lo, c: R -> row 1
});

Deno.test("facet partitions before stats, so stat_count aggregates within each panel", () => {
  const facetData = {
    grp: ["a", "a", "a", "b", "b"],
    cat: ["x", "x", "y", "x", "y"],
  };
  const spec = ggplot(facetData, { x: "cat" })
    .add(geomCol({ stat: "count" }), facetWrap(["grp"]))
    .build();
  const tree = compile(spec);
  const facet = facetGridNode(tree);

  const panels = facet.children.map((embed) =>
    embed.children.find((c) => c.component === "Cartesian")?.children.find((
      c,
    ) => c.component === "Polygon")
  );
  // panel "a": cat=x (x2), cat=y (x1) -> 2 bars; panel "b": cat=x (x1), cat=y (x1) -> 2 bars
  assertEquals((panels[0]?.props.positions as unknown[]).length, 2);
  assertEquals((panels[1]?.props.positions as unknown[]).length, 2);
});

Deno.test("emitSource inlines a standalone FacetGrid definition for faceted specs", () => {
  const facetData = { grp: ["a", "b"], x: [1, 2], y: [10, 20] };
  const spec = ggplot(facetData, { x: "x", y: "y" }).add(
    geomPoint(),
    facetWrap(["grp"]),
  ).build();
  const src = emitSource(compile(spec), "FacetedChart");

  assertStringIncludes(src, "<FacetGrid");
  assertStringIncludes(src, "const FacetGrid = (");
  assertStringIncludes(
    src,
    'import { LayoutContext } from "@use-gpu/workbench"',
  );
  assertStringIncludes(src, "provide, useContext");
});
