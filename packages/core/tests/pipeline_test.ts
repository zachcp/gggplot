import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
// Headless pipeline: DSL → compile → emit, no UseGPU runtime import.
import {
  annotate,
  coordFixed,
  coordFlip,
  coordPolar,
  coordRadial,
  facetGrid,
  facetWrap,
  geomAbline,
  geomArea,
  geomBar,
  geomBin2d,
  geomBlank,
  geomBoxplot,
  geomCol,
  geomContour,
  geomContourFilled,
  geomCount,
  geomCrossbar,
  geomCurve,
  geomDensity,
  geomDensity2d,
  geomDensity2dFilled,
  geomDotplot,
  geomEcdf,
  geomErrorbar,
  geomErrorbarh,
  geomFreqpoly,
  geomFunction,
  geomHex,
  geomHistogram,
  geomHline,
  geomJitter,
  geomLabel,
  geomLine,
  geomLinerange,
  geomPath,
  geomPoint,
  geomPointrange,
  geomPolygon,
  geomQq,
  geomQqLine,
  geomQuantile,
  geomRibbon,
  geomRug,
  geomSmooth,
  geomSpoke,
  geomStep,
  geomText,
  geomTile,
  geomViolin,
  geomVline,
  geomWaffle,
  ggplot,
  guideBins,
  guideColourbar,
  guideColoursteps,
  labels,
  scaleAlpha,
  scaleColor,
  scaleColorGradient2,
  scaleColorViridis,
  scaleFill,
  scaleLinetype,
  scaleLinewidth,
  scaleStroke,
  scaleXContinuous,
  scaleXDiscrete,
  scaleXLog10,
  scaleXSqrt,
  scaleYContinuous,
  statAlign,
  statConnect,
  statEcdf,
  statEllipse,
  statFunction,
  statSum,
  statSummary2d,
  statSummaryBin,
  statSummaryHex,
  statUnique,
  statWaffle,
  theme,
  themeBw,
  themeClassic,
  themeDark,
  themeGrey,
  themeLight,
  themeLinedraw,
  themeTest,
  themeVoid,
} from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import { facetCellLayouts } from "../src/compile/facet_layout.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";
import { emitSource } from "../src/emit/mod.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";
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
import {
  dodge2Bars,
  dodgeBars,
  jitter,
  nudge,
  stackBars,
} from "../src/position/mod.ts";
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

function plotPanel(tree: RenderNode): RenderNode {
  return findNodes(tree, "Cartesian")[0] ?? findNodes(tree, "Polar")[0];
}

// gggplot-tzc.3: point/line/segment/curve/spoke/rug/refline/errorbar-stem/
// smooth-fitted-line/text-position marks now carry a FlatTensor 'positions'
// (interleaved [x0,y0,x1,y1,...]) — plus a MarkTopology 'topology' for
// chunked/polyline nodes — instead of a nested [number,number][] array, and
// a FlatTensor(vec4) 'colors' instead of an array of hex strings. These
// decode helpers convert a packed node's props back to the plain shapes
// this file's assertions were already written against, so most assertions
// stay a direct statement of the expected geometry rather than every
// literal being rewritten against raw tensor bytes.
function decodePositions(positions: unknown): [number, number][] {
  const t = positions as { array: Float32Array; dims: number; length: number };
  const out: [number, number][] = [];
  for (let i = 0; i < t.length; i++) {
    out.push([t.array[i * t.dims], t.array[i * t.dims + 1]]);
  }
  return out;
}

/** Splits a chunked/polyline node's flat positions back into one array per topology chunk (or a single chunk, when 'topology' is absent/chunkless). */
function decodeChunks(node: RenderNode): [number, number][][] {
  const flat = decodePositions(node.props.positions);
  const topology = node.props.topology as { chunks?: Uint32Array } | undefined;
  const lens = topology?.chunks ? Array.from(topology.chunks) : [flat.length];
  const out: [number, number][][] = [];
  let i = 0;
  for (const len of lens) {
    out.push(flat.slice(i, i + len));
    i += len;
  }
  return out;
}

function decodeScalars(tensor: unknown): number[] {
  const t = tensor as { array: Float32Array } | undefined;
  return t ? Array.from(t.array) : [];
}

/** Round a nested position array to `places` decimals — the packed positions
 * round-trip through Float32, so exact float64 literals (Math.PI, log10/sqrt
 * outputs) need tolerant comparison. */
function round(
  points: [number, number][],
  places = 4,
): [number, number][] {
  const f = 10 ** places;
  return points.map(([x, y]) => [Math.round(x * f) / f, Math.round(y * f) / f]);
}

/** assertEquals over decoded positions, tolerant of Float32 round-off. */
function assertPositions(
  actual: unknown,
  expected: [number, number][],
  places = 4,
) {
  assertEquals(round(decodePositions(actual), places), round(expected, places));
}

/** assertEquals over a chunked/loop node's decoded per-chunk positions (see decodeChunks), tolerant of Float32 round-off. */
function assertChunks(
  node: RenderNode,
  expected: [number, number][][],
  places = 4,
) {
  assertEquals(
    decodeChunks(node).map((loop) => round(loop, places)),
    expected.map((loop) => round(loop, places)),
  );
}

const roundScalars = (xs: number[], places = 4): number[] => {
  const f = 10 ** places;
  return xs.map((x) => Math.round(x * f) / f);
};

/** assertEquals over a decoded f32 scalar tensor, tolerant of Float32 round-off. */
function assertScalars(actual: unknown, expected: number[], places = 4) {
  assertEquals(
    roundScalars(decodeScalars(actual), places),
    roundScalars(expected, places),
  );
}

/**
 * gggplot-tzc.4: a ChunkedFace node's 'colors' tensor is per-VERTEX (each
 * loop's uniform fill expanded across its own vertices via expandByOwners —
 * see geom/shared.ts's packFaceLoops). Sample one representative color per
 * topology chunk (a loop's own vertices all share one color) to recover the
 * pre-tzc.4 "one fill string per Polygon loop" shape most assertions here
 * were already written against.
 */
function decodeChunkColors(node: RenderNode, withAlpha = false): string[] {
  const topology = node.props.topology as { chunks?: Uint32Array } | undefined;
  const flat = decodeColors(node.props.colors, withAlpha);
  const lens = topology?.chunks ? Array.from(topology.chunks) : [flat.length];
  const out: string[] = [];
  let i = 0;
  for (const len of lens) {
    out.push(flat[i]);
    i += len;
  }
  return out;
}

/** vec4 0..1 floats back to "#rrggbb" (or "#rrggbbaa" when alpha isn't 1, or always when `withAlpha`) — the hex-string shape colorsOf/packColorsRGBA/colorWithAlpha produced pre-tzc.3. */
function decodeColors(tensor: unknown, withAlpha = false): string[] {
  const t = tensor as { array: Float32Array; length: number } | undefined;
  if (!t) return [];
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(
      2,
      "0",
    );
  const out: string[] = [];
  for (let i = 0; i < t.length; i++) {
    const r = t.array[i * 4], g = t.array[i * 4 + 1], b = t.array[i * 4 + 2],
      a = t.array[i * 4 + 3];
    out.push(
      `#${toHex(r)}${toHex(g)}${toHex(b)}${withAlpha || a < 1 ? toHex(a) : ""}`,
    );
  }
  return out;
}

Deno.test("compile builds an Embedded > Cartesian tree with a Point mark", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(geomPoint()).build();
  const tree = compile(spec);

  assertEquals(tree.component, "Embedded");
  assertEquals(tree.props.normalize, true);
  const panel = plotPanel(tree);
  assertEquals(panel.component, "Cartesian");
  // range is trained from the data extents
  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(panel.props.range, [[0, 2], [10, 30]]);
  assertEquals(decodePositions(point!.props.positions), [[0, 10], [1, 20], [
    2,
    30,
  ]]);
});

Deno.test("ggplot accepts row-store data at the DSL boundary", () => {
  const spec = ggplot([
    { x: 0, y: 10 },
    { x: 1, y: 20 },
    { x: 2, y: 30 },
  ], { x: "x", y: "y" }).add(geomPoint()).build();
  const tree = compile(spec);
  const point = plotPanel(tree).children.find((c) => c.component === "Point");

  assertEquals(decodePositions(point!.props.positions), [
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
  const point = plotPanel(tree).children.find((c) => c.component === "Point");

  assertEquals(decodePositions(point!.props.positions), [[1, 2], [3, 4]]);
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
  // gggplot-tzc.3: grouped geom_line lowers to ChunkedLine nodes; two color
  // groups share one solid-dash batch, so they concat into ONE node with two
  // topology chunks.
  const lines = plotPanel(tree).children.filter((c) =>
    c.component === "ChunkedLine"
  );

  assertEquals(lines.length, 1);
  assertEquals(decodeChunks(lines[0]), [
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
  const line = plotPanel(tree).children.find((c) =>
    c.component === "ChunkedLine"
  );

  assertEquals(decodeChunks(line!), [[[1, 10], [2, 20]]]);
  assertEquals(decodeColors(line!.props.colors), [
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[0],
  ]);
});

Deno.test("compile trains a discrete x scale and maps categories to level indices", () => {
  const factorData = { grp: ["b", "a", "c", "a"], y: [10, 20, 30, 40] };
  const spec = ggplot(factorData, { x: "grp", y: "y" }).add(geomPoint())
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  // levels default-sort alphabetically: a, b, c → domain span [0, 2]
  assertEquals(panel.props.range, [[0, 2], [10, 40]]);

  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(decodePositions(point!.props.positions), [[1, 10], [0, 20], [
    2,
    30,
  ], [0, 40]]);
});

Deno.test("scaleXDiscrete domain fixes explicit level ordering", () => {
  const factorData = { grp: ["b", "a", "c"], y: [1, 2, 3] };
  const spec = ggplot(factorData, { x: "grp", y: "y" })
    .add(geomPoint(), scaleXDiscrete({ domain: ["c", "b", "a"] }))
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(decodePositions(point!.props.positions), [[1, 1], [2, 2], [
    0,
    3,
  ]]);
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

  // gggplot-tzc.4: geom_bar lowers to a single ChunkedFace node — one loop
  // (topology chunk) per bar.
  const faces = plotPanel(tree).children.filter((c) =>
    c.component === "ChunkedFace"
  );
  assertEquals(faces.length, 1);
  assertChunks(faces[0], [
    [[-0.45, 0], [-0.45, 2], [0.45, 2], [0.45, 0]],
    [[-0.45, 2], [-0.45, 3], [0.45, 3], [0.45, 2]],
    [[0.55, 0], [0.55, 2], [1.45, 2], [1.45, 0]],
  ]);
  assertEquals(decodeChunkColors(faces[0]), [
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

Deno.test("silhouette stacking centers bars and area bands around zero", () => {
  const bars = [
    { x: 0, y: 2, groupKey: "a" },
    { x: 0, y: 4, groupKey: "b" },
    { x: 1, y: 1, groupKey: "a" },
    { x: 1, y: 3, groupKey: "b" },
  ];
  assertEquals(
    stackBars(bars, 1, "silhouette").map(({ y0, y1 }) => [y0, y1]),
    [[-3, -1], [-1, 3], [-2, -1], [-1, 2]],
  );

  const spec = ggplot({
    x: [0, 1, 2, 0, 1, 2],
    y: [2, 1, 2, 4, 3, 2],
    group: ["a", "a", "a", "b", "b", "b"],
  }, { x: "x", y: "y", fill: "group" }).add(
    geomArea({ position: "stack", offset: "silhouette" }),
  ).build();
  const tree = compile(spec);
  // gggplot-tzc.4: geom_area silhouette bands pack into a single ChunkedFace
  // node — one loop (topology chunk) per group.
  const face = findNodes(tree, "ChunkedFace")[0];
  const bands = decodeChunks(face).filter((loop) => loop.length === 6);
  assertEquals(bands.length, 2);
  assertEquals(bands[0], [
    [0, -1],
    [1, -1],
    [2, 0],
    [2, -2],
    [1, -2],
    [0, -3],
  ]);
  assertEquals(bands[1], [
    [0, 3],
    [1, 2],
    [2, 2],
    [2, 0],
    [1, -1],
    [0, -1],
  ]);
  assertStringIncludes(emitSource(tree, "StreamgraphChart"), "<ChunkedFace");
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

  const panel = plotPanel(tree);
  const label = panel.children.find((c) => c.component === "Label");
  assertEquals(decodePositions(label!.props.positions), [[0, 10], [1, 20]]);
  assertEquals(label?.props.labels, ["Alice", "Bob"]);

  const src = emitSource(tree, "LabeledChart");
  assertStringIncludes(src, "Label");
  assertStringIncludes(src, "Alice");
});

Deno.test("geom_label emits measured backgrounds, borders, and text in z order", () => {
  const tree = compile(
    ggplot(
      { x: [0, 1, 2], y: [0, 1, 2], label: ["wide", null, "two\nlines"] },
      { x: "x", y: "y", label: "label" },
    ).add(geomLabel({
      size: 10,
      lineHeight: 12,
      labelPadding: 3,
      labelR: 2,
      fill: "#fef3c7",
      color: "#78350f",
      borderWidth: 2,
      alpha: 0.75,
    })).build(),
    {
      layout: {
        width: 200,
        height: 100,
        measureText: (text) => ({ width: text.length * 5, height: 10 }),
      },
    },
  );
  // gggplot-cct: the background box packs into a single ChunkedFace node
  // (packFaceLoops) and the border into a flat Line (packUniformChunks).
  const box = findNodes(tree, "ChunkedFace")[0];
  const border = findNodes(tree, "Line").find((node) =>
    node.props.color === "#78350f"
  )!;
  const labels = findNodes(tree, "Label").find((node) =>
    (node.props.labels as unknown[])?.includes("wide")
  )!;
  assertEquals([box.props.zBias, border.props.zBias, labels.props.zBias], [
    0,
    1,
    2,
  ]);
  assertEquals(
    [box.props.opacity, border.props.opacity, labels.props.opacity],
    [0.75, 0.75, 0.75],
  );
  assertEquals(border.props.width, 2);
  const loops = decodeChunks(box);
  assertEquals(loops.length, 2);
  assertEquals(labels.props.labels, ["wide", "two\nlines"]);
  const height = (loop: [number, number][]) =>
    Math.max(...loop.map(([, y]) => y)) - Math.min(...loop.map(([, y]) => y));
  assertEquals(height(loops[1]) > height(loops[0]), true);
  assertEquals(decodeChunkColors(box), ["#fef3c7", "#fef3c7"]);
  assertStringIncludes(emitSource(tree, "LabelBoxChart"), "<ChunkedFace");
});

Deno.test("geom_label rotates its boxes and retains mapped styling after missing labels", () => {
  const data = {
    x: [0, 1, 2],
    y: [0, 1, 2],
    label: ["a", null, "ccc"],
    fill: ["first", "missing", "third"],
    color: ["one", "missing", "three"],
  };
  const make = (angle: number) =>
    compile(
      ggplot(data, {
        x: "x",
        y: "y",
        label: "label",
        fill: "fill",
        color: "color",
      }).add(geomLabel({ angle, size: 10, labelPadding: 0, labelR: 0 }))
        .build(),
      {
        layout: {
          width: 100,
          height: 100,
          measureText: (text) => ({ width: text.length * 10, height: 10 }),
        },
      },
    );
  // gggplot-cct: the background box packs into a ChunkedFace node.
  const baseNode = findNodes(make(0), "ChunkedFace")[0];
  const turnedNode = findNodes(make(90), "ChunkedFace")[0];
  const baseLoops = decodeChunks(baseNode);
  const turnedLoops = decodeChunks(turnedNode);
  assertEquals(baseLoops.length, 2);
  assertEquals(decodeChunkColors(baseNode).length, 2);
  const base = baseLoops[0];
  const turned = turnedLoops[0];
  const span = (loop: [number, number][], axis: 0 | 1) =>
    Math.max(...loop.map((point) => point[axis])) -
    Math.min(...loop.map((point) => point[axis]));
  assertEquals(
    Math.round(span(base, 0) * 1e6),
    Math.round(span(turned, 1) * 1e6),
  );
  assertEquals(
    Math.round(span(base, 1) * 1e6),
    Math.round(span(turned, 0) * 1e6),
  );
  assertEquals(
    findNodes(make(45), "Label").filter((node) => node.props.angle === 45)
      .flatMap((node) => node.props.labels as string[]),
    ["a", "ccc"],
  );
});

Deno.test("geom_label validates box sizes while geom_text remains text-only", () => {
  const data = { x: [0], y: [0], label: ["a"] };
  assertThrows(
    () =>
      compile(
        ggplot(data, { x: "x", y: "y", label: "label" }).add(
          geomLabel({ labelPadding: -1 }),
        ).build(),
      ),
    TypeError,
    "non-negative CSS-pixel",
  );
  const textTree = compile(
    ggplot(data, { x: "x", y: "y", label: "label" }).add(geomText()).build(),
  );
  assertEquals(findNodes(textTree, "Polygon").length, 0);
});

Deno.test("geom_text and axis guides preserve GPU-native text rotation", () => {
  const tree = compile(
    ggplot({ x: [1], y: [2], label: ["tilted"] }, {
      x: "x",
      y: "y",
      label: "label",
    }).add(
      geomText({ angle: 35 }),
      theme({ axisTextXAngle: 45, axisTitleYAngle: -90 }),
    ).build(),
  );
  assertEquals(
    findNodes(tree, "Label").some((n) => n.props.angle === 35),
    true,
  );
  assertEquals(
    findNodes(tree, "Label").some((n) => n.props.angle === 45),
    true,
  );
  assertEquals(
    findNodes(tree, "Label").some((n) => n.props.angle === -90),
    true,
  );
});

Deno.test("geom_errorbar renders a stem plus top/bottom caps per row", () => {
  const errData = { x: [0, 2], lo: [1, 3], hi: [5, 9] };
  const spec = ggplot(errData, { x: "x", ymin: "lo", ymax: "hi" }).add(
    geomErrorbar(),
  ).build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  const line = panel.children.find((c) => c.component === "Line");
  assertEquals(decodeChunks(line!), [
    [[-0.5, 5], [0.5, 5]],
    [[0, 5], [0, 1]],
    [[-0.5, 1], [0.5, 1]],
    [[1.5, 9], [2.5, 9]],
    [[2, 9], [2, 3]],
    [[1.5, 3], [2.5, 3]],
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

  const panel = plotPanel(tree);
  // gggplot-tzc.4: the box loop packs into a ChunkedFace node.
  const box = panel.children.find((c) => c.component === "ChunkedFace");
  assertChunks(box!, [
    [[-0.375, 2], [-0.375, 8], [0.375, 8], [0.375, 2]],
  ]);

  const line = panel.children.find((c) => c.component === "Line");
  // gggplot-cct: the median/whisker Line packs into a FlatTensor via
  // packUniformChunks (row-disjoint 2-point segments), like errorbar.ts's stems.
  assertChunks(line!, [
    [[-0.375, 5], [0.375, 5]],
    [[0, 8], [0, 10]],
    [[-0.1875, 10], [0.1875, 10]],
    [[0, 2], [0, 0]],
    [[-0.1875, 0], [0.1875, 0]],
  ]);
});

Deno.test("geom_boxplot computes compact grouped quartiles and whiskers from raw y", () => {
  const raw = {
    group: ["a", "a", "a", "a", "a", "b", "b", "b"],
    y: [1, 2, 3, 4, 100, 10, 20, 30],
  };
  const layer: Layer = {
    geom: "boxplot",
    stat: "boxplot",
    position: "identity",
    params: {},
  };
  const result = applyStat(layer, { x: "group", y: "y" }, ingest(raw));
  assertEquals(values(result.data, "lower"), [2, 15]);
  assertEquals(values(result.data, "middle"), [3, 20]);
  assertEquals(values(result.data, "upper"), [4, 25]);
  assertEquals(values(result.data, "ymin"), [1, 10]);
  assertEquals(values(result.data, "ymax"), [4, 30]);
  assertEquals(
    findNodes(
      compile(ggplot(raw, { x: "group", y: "y" }).add(geomBoxplot()).build()),
      "ChunkedFace",
    ).length > 0,
    true,
  );
});

Deno.test("density, violin, and dotplot stats emit dense deterministic products", () => {
  const densityTree = compile(
    ggplot({
      value: [0, 1, 2, 10, 11, 12],
      group: ["a", "a", "a", "b", "b", "b"],
    }, { x: "value", color: "group" }).add(
      geomDensity({ n: 16 }),
    ).build(),
  );
  // gggplot-tzc.3: geom_density lowers via lowerLine → ChunkedLine; the two
  // solid-dash color groups concat into one node with two 16-vertex chunks.
  const densityChunks = findNodes(densityTree, "ChunkedLine").flatMap((node) =>
    decodeChunks(node)
  ).filter((chunk) => chunk.length === 16);
  assertEquals(densityChunks.length, 2);

  const violinTree = compile(
    ggplot({
      group: ["a", "a", "a", "b", "b", "b"],
      value: [0, 1, 2, 10, 11, 12],
    }, { x: "group", y: "value", fill: "group" }).add(
      geomViolin({ n: 12 }),
    ).build(),
  );
  // gggplot-tzc.4: geom_violin's group loops pack into a single ChunkedFace
  // node — two groups here, each a 24-vertex mirrored density loop.
  assertEquals(
    findNodes(violinTree, "ChunkedFace").flatMap((node) => decodeChunks(node))
      .filter((loop) => loop.length === 24).length,
    2,
  );

  const dots = findNodes(
    compile(
      ggplot({ value: [0.01, 0.02, 0.9] }, { x: "value" }).add(
        geomDotplot({ binwidth: 0.1 }),
      ).build(),
    ),
    "Point",
  )[0];
  assertPositions(dots.props.positions, [
    [0.06, 1],
    [0.06, 2],
    [0.86, 1],
  ]);
});

// gggplot-8vu: stat_ydensity's density value axis (y) sits alongside the
// categorical position axis (x), which is not part of IMPLICIT_GROUP_AES.
// With only x/y mapped (no color/fill/shape/linetype), the stat must still
// compute one density curve per x level, carry the x column through in its
// output data, and surface it as an effective `group` so geom_violin's
// splitByEffectiveGroup-based lowering renders one loop per x level instead
// of silently dropping the mark.
Deno.test("stat_ydensity groups by a bare discrete x when no color/fill is mapped (gggplot-8vu)", () => {
  const raw = {
    category: ["a", "a", "a", "b", "b", "b"],
    value: [0, 1, 2, 10, 11, 12],
  };
  const violinLayer: Layer = {
    geom: "violin",
    stat: "ydensity",
    position: "identity",
    params: { n: 8 },
  };
  const result = applyStat(violinLayer, { x: "category", y: "value" }, raw);

  // The position axis is promoted to an effective group and carried through
  // as an output column, and the stat's returned mapping surfaces it via
  // `group` so downstream lowering can split marks by it.
  assertEquals(result.mapping.x, "category");
  assertEquals(result.mapping.group, "category");
  const categoryOut = values(result.data, "category");
  assertEquals(new Set(categoryOut), new Set(["a", "b"]));
  // One 8-sample density curve per x level (16 rows total), not one pooled
  // curve across both levels.
  assertEquals(categoryOut.length, 16);
  assertEquals(categoryOut.filter((v) => v === "a").length, 8);
  assertEquals(categoryOut.filter((v) => v === "b").length, 8);

  // Compiled end to end, geom_violin must actually render — previously this
  // produced zero ChunkedFace marks because the output data lacked the x
  // column entirely while the mapping still named it.
  const tree = compile(
    ggplot(raw, { x: "category", y: "value" }).add(
      geomViolin({ n: 8 }),
    ).build(),
  );
  const violinFaces = findNodes(tree, "ChunkedFace").filter((node) =>
    !node.props.guideKind
  );
  assertEquals(violinFaces.length, 1);
  // One mirrored 16-vertex loop (2 * n) per x level — two levels here.
  const loops = decodeChunks(violinFaces[0]).filter((loop) =>
    loop.length === 16
  );
  assertEquals(loops.length, 2);
});

Deno.test("2D bin and hex products count observed cells and lower distinct topology", () => {
  const points = { x: [0, 0.1, 0.9, 1], y: [0, 0.1, 0.9, 1] };
  // gggplot-tzc.4: geom_tile/geom_hex cells pack into a single ChunkedFace
  // node — one topology chunk (loop) per cell, not one node per cell.
  const tileFaces = findNodes(
    compile(
      ggplot(points, { x: "x", y: "y" }).add(geomBin2d({ bins: 2 })).build(),
    ),
    "ChunkedFace",
  ).filter((node) => !node.props.guideKind);
  assertEquals(tileFaces.length, 1);
  const tileLoops = decodeChunks(tileFaces[0]);
  assertEquals(tileLoops.length, 2);
  assertEquals(tileLoops[0].length, 4);
  assertEquals(
    decodeChunkColors(tileFaces[0]).every((c) => typeof c === "string"),
    true,
  );

  const hexFaces = findNodes(
    compile(
      ggplot(points, { x: "x", y: "y" }).add(geomHex({ bins: 2 })).build(),
    ),
    "ChunkedFace",
  ).filter((node) => !node.props.guideKind);
  assertEquals(hexFaces.length, 1);
  const hexLoops = decodeChunks(hexFaces[0]);
  assertEquals(hexLoops.length, 2);
  assertEquals(hexLoops[0].length, 6);
});

Deno.test("2D summary stats reduce z in rectangular and hex cells", () => {
  const data = {
    x: [0, 0.1, 0.9, 1, 1],
    y: [0, 0.1, 0.9, 1, 1],
    z: [1, 3, 10, 20, null],
  };
  const spec = ggplot(data, { x: "x", y: "y", z: "z" }).add(
    statSummary2d({ bins: 2, fun: "mean" }),
  ).build();
  const result = applyStat(spec.layers[0], spec.mapping, spec.data);
  assertEquals(values(result.data, "value"), [2, 15]);
  assertEquals(values(result.data, "count"), [2, 2]);
  assertEquals(result.mapping.fill, "value");
  // gggplot-tzc.4: cells pack into a single ChunkedFace node — assert cell
  // count via topology chunks, not node count.
  assertEquals(
    findNodes(compile(spec), "ChunkedFace").filter((node) =>
      !node.props.guideKind
    ).flatMap((node) => decodeChunks(node)).length,
    2,
  );

  for (
    const part of [
      statSummaryHex({ bins: 2, fun: "sum" }),
      statSummaryBin({ bins: 2, fun: "max" }),
    ]
  ) {
    const tree = compile(
      ggplot(data, { x: "x", y: "y", z: "z" }).add(part).build(),
    );
    assertEquals(
      findNodes(tree, "ChunkedFace").filter((node) => !node.props.guideKind)
        .flatMap((node) => decodeChunks(node)).length,
      2,
    );
    assertStringIncludes(emitSource(tree, "Summary2dChart"), "ChunkedFace");
  }
});

Deno.test("2D summary stats support built-ins, grouping, custom reducers, and validation", () => {
  const data = ingest({
    x: [0, 0, 0, 0],
    y: [0, 0, 0, 0],
    z: [1, 2, 3, 4],
    group: ["a", "a", "b", "b"],
  });
  for (
    const [fun, expected] of [
      ["mean", [1.5, 3.5]],
      ["median", [1.5, 3.5]],
      ["sum", [3, 7]],
      ["min", [1, 3]],
      ["max", [2, 4]],
    ] as const
  ) {
    const layer = ggplot(data, { x: "x", y: "y", z: "z", fill: "group" }).add(
      statSummary2d({ bins: 1, fun }),
    ).build().layers[0];
    const result = applyStat(
      layer,
      { x: "x", y: "y", z: "z", fill: "group" },
      data,
    );
    assertEquals(values(result.data, "value"), [...expected]);
    assertEquals(result.mapping.fill, "group");
  }
  const custom = ggplot(data, { x: "x", y: "y", z: "z" }).add(
    statSummary2d({ bins: 1, fun: (items: number[]) => items.length }),
  ).build();
  assertEquals(
    values(
      applyStat(custom.layers[0], custom.mapping, custom.data).data,
      "value",
    ),
    [4],
  );
  assertThrows(
    () => emitSource(compile(custom), "CustomSummary"),
    TypeError,
    "cannot serialize a custom 2D summary reducer",
  );
  const literalFill = ggplot(data, { x: "x", y: "y", z: "z" }).add(
    statSummary2d({ bins: 1, fill: "#ef4444" }),
  ).build();
  const literalResult = applyStat(
    literalFill.layers[0],
    literalFill.mapping,
    literalFill.data,
  );
  assertEquals(literalResult.mapping.fill, undefined);
  assertEquals(
    decodeChunkColors(findNodes(compile(literalFill), "ChunkedFace")[0])[0],
    "#ef4444",
  );

  const boundary = ggplot(
    { x: [0.1, 0.9, 1.1], y: [0.1, 0.9, 1.1], z: [1, 2, 3] },
    { x: "x", y: "y", z: "z" },
  ).add(statSummary2d({ bins: 99, binwidth: [1, 1], boundary: [0, 0] }))
    .build();
  const boundaryResult = applyStat(
    boundary.layers[0],
    boundary.mapping,
    boundary.data,
  );
  assertEquals(values(boundaryResult.data, "x"), [0.5, 1.5]);
  assertEquals(values(boundaryResult.data, "count"), [2, 1]);

  const hex = ggplot(
    { x: [0.1, 1.1], y: [0.6, 0.6], z: [1, 2] },
    { x: "x", y: "y", z: "z" },
  ).add(statSummaryHex({ binwidth: [1, 1], boundary: [0, 0] })).build();
  const hexResult = applyStat(hex.layers[0], hex.mapping, hex.data);
  assertEquals(values(hexResult.data, "y"), [0.5, 1]);
  assertThrows(
    () =>
      compile(
        ggplot(data, { x: "x", y: "y", z: "z" }).add(
          statSummary2d({ fun: "mode" }),
        ).build(),
      ),
    TypeError,
    "unsupported 2D summary reducer",
  );
});

Deno.test("2D summary binwidth precedence, boundaries, constants, empties, and resident fallback are deliberate", () => {
  const data = { x: [0.2, 0.8, 1.2], y: [0.2, 0.8, 1.2], z: [1, 2, 3] };
  const spec = ggplot(data, { x: "x", y: "y", z: "z" }).add(
    statSummary2d({ bins: 99, binwidth: [1, 1], boundary: [0, 0], fun: "sum" }),
  ).build();
  const result = applyStat(spec.layers[0], spec.mapping, spec.data);
  assertEquals(values(result.data, "x"), [0.5, 1.5]);
  assertEquals(values(result.data, "value"), [3, 3]);
  assertEquals(
    findNodes(compile(spec, { resident: true }), "ResidentProduct").length,
    0,
  );

  const constant = ggplot({ x: [2, 2], y: [3, 3], z: [4, 6] }, {
    x: "x",
    y: "y",
    z: "z",
  }).add(statSummary2d({ fun: "mean" })).build();
  assertEquals(
    values(
      applyStat(constant.layers[0], constant.mapping, constant.data).data,
      "value",
    ),
    [5],
  );

  const empty = ggplot({ x: [0], y: [0], z: [Number.NaN] }, {
    x: "x",
    y: "y",
    z: "z",
  }).add(statSummary2d()).build();
  assertEquals(
    values(applyStat(empty.layers[0], empty.mapping, empty.data).data, "value"),
    [],
  );
  assertThrows(
    () =>
      compile(
        ggplot(data, { x: "x", y: "y", z: "z" }).add(
          statSummary2d({ weight: 1 }),
        ).build(),
      ),
    TypeError,
    "do not support weights",
  );
});

Deno.test("QQ, ellipse, and function stats emit deterministic line/point products", () => {
  const qq = findNodes(
    compile(
      ggplot({ sample: [3, 1, 2] }, { y: "sample" }).add(geomQq()).build(),
    ),
    "Point",
  )[0];
  assertEquals(decodePositions(qq.props.positions).length, 3);
  assertEquals(
    decodePositions(qq.props.positions).map((point) => point[1]),
    [1, 2, 3],
  );

  // gggplot-tzc.3: qqline/ellipse/function all lower via lowerLine →
  // ChunkedLine; each single-group case is one node with one chunk.
  const qqLine = decodeChunks(
    findNodes(
      compile(
        ggplot({ sample: [1, 2, 3, 4] }, { y: "sample" }).add(geomQqLine())
          .build(),
      ),
      "ChunkedLine",
    )[0],
  ).find((chunk) => chunk.length === 2)!;
  assertEquals(qqLine.map((point) => point[1]), [1.75, 3.25]);

  const ellipse = decodeChunks(
    findNodes(
      compile(
        ggplot({ x: [0, 1, 2, 3], y: [0, 1, 1, 2] }, { x: "x", y: "y" }).add(
          statEllipse({ n: 12 }),
        ).build(),
      ),
      "ChunkedLine",
    )[0],
  ).find((chunk) => chunk.length === 13)!;
  assertEquals(ellipse.length, 13);

  const fn = decodeChunks(
    findNodes(
      compile(
        ggplot({}, {}).add(statFunction((x) => x * x, { xlim: [-1, 1], n: 3 }))
          .build(),
      ),
      "ChunkedLine",
    )[0],
  ).find((chunk) => chunk.length === 3)!;
  assertEquals(fn, [[-1, 1], [0, 0], [1, 1]]);
});

Deno.test("QQ lines and ellipses preserve effective color groups", () => {
  // gggplot-tzc.3: the two solid color groups concat into ONE ChunkedLine
  // node with two chunks — assert on the chunks, not on node count.
  const groupedQq = findNodes(
    compile(
      ggplot(
        {
          sample: [1, 2, 3, 10, 20, 30],
          group: ["a", "a", "a", "b", "b", "b"],
        },
        { y: "sample", color: "group" },
      ).add(geomQqLine()).build(),
    ),
    "ChunkedLine",
  ).flatMap((node) => decodeChunks(node)).filter((chunk) =>
    chunk.length === 2
  );
  assertEquals(groupedQq.length, 2);
  assertEquals(
    groupedQq.map((chunk) => chunk.map((point) => point[1])),
    [[1.5, 2.5], [15, 25]],
  );

  const groupedEllipse = findNodes(
    compile(
      ggplot(
        {
          x: [0, 1, 2, 10, 11, 12],
          y: [0, 1, 0, 10, 11, 10],
          group: ["a", "a", "a", "b", "b", "b"],
        },
        { x: "x", y: "y", color: "group" },
      ).add(statEllipse({ n: 8 })).build(),
    ),
    "ChunkedLine",
  ).flatMap((node) => decodeChunks(node)).filter((chunk) =>
    chunk.length === 9
  );
  assertEquals(groupedEllipse.length, 2);
});

Deno.test("contour stats extract isoline segments and stepped filled grid bands", () => {
  const grid = {
    x: [0, 1, 0, 1],
    y: [0, 0, 1, 1],
    z: [0, 1, 1, 2],
  };
  // gggplot-tzc.3: geom_contour lowers via lowerSegment → one 'Line' node
  // whose disjoint 2-point isoline segments are packed as uniform chunks.
  const contour = findNodes(
    compile(
      ggplot(grid, { x: "x", y: "y", z: "z" }).add(
        geomContour({ breaks: [0.5, 1.5] }),
      ).build(),
    ),
    "Line",
  ).flatMap((node) => decodeChunks(node)).find((chunk) => chunk.length === 2)!;
  assertEquals(contour.length, 2);

  // gggplot-tzc.4: geomContourFilled lowers via geom "tile" → lowerTile,
  // whose cells pack into a single ChunkedFace node.
  const filledFace = findNodes(
    compile(
      ggplot(grid, { x: "x", y: "y", z: "z" }).add(
        geomContourFilled({ breaks: [0.5, 1.5] }),
      ).build(),
    ),
    "ChunkedFace",
  ).filter((node) => !node.props.guideKind)[0];
  const filled = decodeChunks(filledFace);
  assertEquals(filled.length, 4);
  assertEquals(new Set(decodeChunkColors(filledFace)).size, 3);
});

Deno.test("geom_tile renders full-resolution cells centered on (x,y), widening the domain past the edge cells", () => {
  const gridData = { x: [0, 2, 0, 2], y: [0, 0, 1, 1], val: [1, 2, 3, 4] };
  const spec = ggplot(gridData, { x: "x", y: "y", fill: "val" }).add(geomTile())
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  // x resolution 2, y resolution 1 -> half-cell padding of 1 and 0.5 on each side
  assertEquals(panel.props.range, [[-1, 3], [-0.5, 1.5]]);

  // gggplot-tzc.4: geom_tile cells pack into a single ChunkedFace node.
  const face = panel.children.find((c) => c.component === "ChunkedFace");
  assertEquals(decodeChunks(face!), [
    [[-1, -0.5], [-1, 0.5], [1, 0.5], [1, -0.5]],
    [[1, -0.5], [1, 0.5], [3, 0.5], [3, -0.5]],
    [[-1, 0.5], [-1, 1.5], [1, 1.5], [1, 0.5]],
    [[1, 0.5], [1, 1.5], [3, 1.5], [3, 0.5]],
  ]);
  assertEquals(
    decodeChunkColors(face!).every((fill) => typeof fill === "string"),
    true,
  );
});

Deno.test("geom_tile cells tile edge-to-edge with no gaps by default", () => {
  const gridData = { x: [0, 1], y: [0, 0] };
  const spec = ggplot(gridData, { x: "x", y: "y" }).add(
    geomTile({ fill: "#000000" }),
  ).build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  const face = panel.children.find((c) => c.component === "ChunkedFace");
  const loops = decodeChunks(face!);
  // tile0's right edge (x=0.5) meets tile1's left edge (x=0.5) exactly
  assertEquals(loops[0][2][0], loops[1][0][0]);
});

Deno.test("geom_polygon renders row-ordered x/y positions as a Polygon loop", () => {
  const polyData = { x: [0, 1, 0], y: [0, 0, 1] };
  const spec = ggplot(polyData, { x: "x", y: "y" })
    .add(geomPolygon({ fill: "#123456" }))
    .build();
  const tree = compile(spec);

  // gggplot-tzc.4: geom_polygon lowers to a single ChunkedFace node.
  const face = plotPanel(tree).children.find((c) =>
    c.component === "ChunkedFace"
  );
  assertEquals(decodeChunks(face!), [[[0, 0], [1, 0], [0, 1]]]);
  assertEquals(decodeChunkColors(face!), ["#123456"]);
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

  const face = plotPanel(tree).children.find((c) =>
    c.component === "ChunkedFace"
  );
  assertEquals(decodeChunks(face!), [
    [[0, 0], [1, 0], [0, 1]],
    [[2, 0], [3, 0], [2, 1]],
  ]);
  assertEquals(decodeChunkColors(face!), ["#aaaaaa", "#bbbbbb"]);
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

  const panel = plotPanel(tree);
  // full bar widths widen x; stacked totals (8 at x=a, 6 at x=b) widen y
  assertEquals(panel.props.range, [[-0.45, 1.45], [0, 8]]);

  // gggplot-tzc.4: geom_col/geom_bar bars pack into a single ChunkedFace node.
  const face = panel.children.find((c) => c.component === "ChunkedFace");
  assertChunks(face!, [
    [[-0.45, 0], [-0.45, 3], [0.45, 3], [0.45, 0]],
    [[-0.45, 3], [-0.45, 8], [0.45, 8], [0.45, 3]],
    [[0.55, 0], [0.55, 2], [1.45, 2], [1.45, 0]],
    [[0.55, 2], [0.55, 6], [1.45, 6], [1.45, 2]],
  ]);
  assertEquals(decodeChunkColors(face!), [
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

  const panel = plotPanel(tree);
  // dodge doesn't stack, so the y range is just the raw row extent
  assertEquals(panel.props.range, [[-0.45, 1.45], [0, 5]]);

  // gggplot-tzc.4: geom_col/geom_bar bars pack into a single ChunkedFace
  // node; positions round-trip through Float32, so the last chunk's
  // 1.4500000000000002 float64 literal needs tolerant comparison.
  const face = panel.children.find((c) => c.component === "ChunkedFace");
  assertEquals(
    decodeChunks(face!).map((loop) => round(loop)),
    [
      [[-0.45, 0], [-0.45, 3], [0, 3], [0, 0]],
      [[0, 0], [0, 5], [0.45, 5], [0.45, 0]],
      [[0.55, 0], [0.55, 2], [1, 2], [1, 0]],
      [[1, 0], [1, 4], [1.45, 4], [1.45, 0]],
    ].map((loop) => round(loop as [number, number][])),
  );
});

Deno.test("geom_col position=fill normalizes each x's stack to proportions summing to 1", () => {
  const barData = { x: ["a", "a"], y: [2, 6], grp: ["p", "q"] };
  const spec = ggplot(barData, { x: "x", y: "y", fill: "grp" })
    .add(geomCol({ position: "fill" }))
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  assertEquals(panel.props.range, [[-0.45, 0.45], [0, 1]]);

  const face = panel.children.find((c) => c.component === "ChunkedFace");
  assertChunks(face!, [
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

  const panel = plotPanel(tree);
  const point = panel.children.find((c) => c.component === "Point");
  const positions = decodePositions(point!.props.positions);
  assertEquals(positions.length, 3);
  for (const [x, y] of positions) {
    assertEquals(Math.abs(x) <= 0.3, true);
    assertEquals(Math.abs(y) <= 0.2, true);
  }
});

Deno.test("new position products support variable-width dodge2 and fixed nudge", () => {
  assertEquals(
    dodge2Bars(
      [
        { x: 0, y: 2, groupKey: "a", width: 0.4 },
        { x: 0, y: 3, groupKey: "b", width: 0.6 },
      ],
      1,
      0,
    ).map(({ xOffset, width }) => [xOffset, width]),
    [
      [-0.3, 0.4],
      [0.2, 0.6],
    ],
  );
  assertEquals(nudge([[1, 2], [3, 4]], 0.5, -1), [[1.5, 1], [3.5, 3]]);
  const point = findNodes(
    compile(
      ggplot(data, { x: "x", y: "y" }).add(
        geomPoint({ position: "nudge", x: 2, y: -3 }),
      ).build(),
    ),
    "Point",
  )[0];
  assertPositions(point.props.positions, [[2, 7], [3, 17], [4, 27]]);

  // gggplot-tzc.4: dodge2'd bars pack into a single ChunkedFace node.
  const dodge2Face = findNodes(
    compile(
      ggplot(
        { x: ["a", "a"], y: [2, 3], group: ["one", "two"] },
        { x: "x", y: "y", fill: "group" },
      ).add(geomCol({ position: "dodge2", width: 0.8, padding: 0 })).build(),
    ),
    "ChunkedFace",
  )[0];
  const dodge2 = decodeChunks(dodge2Face);
  assertEquals(dodge2.length, 2);
  assertEquals(dodge2[0].length, 4);

  const jitterDodged = findNodes(
    compile(
      ggplot(
        { x: [0, 0], y: [1, 1], group: ["one", "two"] },
        { x: "x", y: "y", color: "group" },
      ).add(
        geomPoint({
          position: "jitterdodge",
          dodgeWidth: 0.8,
          jitterWidth: 0,
          jitterHeight: 0,
        }),
      ).build(),
    ),
    "Point",
  );
  assertPositions(jitterDodged[0].props.positions, [[-0.2, 1], [0.2, 1]]);
});

Deno.test("coord_flip swizzles rendered axes to yx without touching mark positions or domains", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(geomPoint(), coordFlip())
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  assertEquals(panel.component, "Cartesian");
  assertEquals(panel.props.axes, "yx");
  // range/positions stay in original x/y order -- only rendered axes swap
  assertEquals(panel.props.range, [[0, 2], [10, 30]]);
  const point = panel.children.find((c) => c.component === "Point");
  assertPositions(point!.props.positions, [[0, 10], [1, 20], [2, 30]]);

  const grid = panel.children.find((c) => c.component === "Grid");
  assertEquals(grid?.props.axes, "yx");
});

Deno.test("coord_polar selects the Polar view and passes through bend/on params", () => {
  const spec = ggplot(data, { x: "x", y: "y" })
    .add(geomPoint(), coordPolar({ bend: 0.5, on: "y" }))
    .build();
  const tree = compile(spec);

  const radial = tree.children[0];
  assertEquals(radial.component, "RadialViewport");
  const panel = radial.children[0];
  assertEquals(panel.component, "Polar");
  assertEquals(panel.props.bend, 0.5);
  assertEquals(panel.props.on, "y");
  assertEquals(panel.props.range, [[-Math.PI, Math.PI], [10, 30]]);
  const point = panel.children.find((c) => c.component === "Point");
  assertPositions(point!.props.positions, [
    [-Math.PI, 10],
    [0, 20],
    [Math.PI, 30],
  ]);
  const src = emitSource(tree, "CircularPolar");
  assertStringIncludes(src, "const RadialViewport");
  assertStringIncludes(src, "useCombinedMatrixTransform");
});

Deno.test("coord_radial and coord_fixed preserve their declarative view transforms", () => {
  const radial = compile(
    ggplot(data, { x: "x", y: "y" }).add(
      geomPoint(),
      coordRadial({ end: Math.PI, donut: 0.3, rotateAngle: true }),
    ).build(),
  ).children[0].children[0];
  assertEquals(radial.component, "Polar");
  assertEquals(radial.props.end, Math.PI);
  assertEquals(radial.props.donut, 0.3);
  assertEquals(radial.props.rotateAngle, true);

  const fixedTree = compile(
    ggplot(data, { x: "x", y: "y" }).add(
      geomPoint(),
      coordFixed(2),
    ).build(),
  );
  const fixed = plotPanel(fixedTree);
  assertEquals(fixedTree.children[0].component, "PanelViewport");
  assertEquals(fixedTree.children[0].props.bounds, [-0.72, -0.66, 0.92, 0.68]);
  assertEquals(fixed.component, "Cartesian");
  assertEquals(fixed.props.ratio, 2);
  assertEquals(fixed.props.fixed, true);
});

Deno.test("coord_polar theta:'y' reassigns the angle to y, same projection swap as coord_flip", () => {
  const spec = ggplot(data, { x: "x", y: "y" })
    .add(geomPoint(), coordPolar({ theta: "y", bend: 0.5 }))
    .build();
  const tree = compile(spec);

  const panel = tree.children[0].children[0];
  assertEquals(panel.component, "Polar");
  assertEquals(panel.props.axes, "yx");
  assertEquals(panel.props.bend, 0.5);
  assertEquals(panel.props.range, [[0, 2], [-Math.PI, Math.PI]]);
  const point = panel.children.find((c) => c.component === "Point");
  assertPositions(point!.props.positions, [
    [0, -Math.PI],
    [1, 0],
    [2, Math.PI],
  ]);
});

Deno.test("coord_polar munches Polygon edges for curved bar wedges", () => {
  const spec = ggplot({ x: ["a", "b"], y: [2, 3] }, { x: "x", y: "y" })
    .add(geomCol(), coordPolar())
    .build();
  const tree = compile(spec);
  const panel = tree.children[0].children[0];
  // gggplot-tzc.4: geom_col's bar loops pack into a single ChunkedFace node;
  // munching (compile/coordinates.ts's munchFlatNode) subdivides each loop's
  // edges the same way it did for the legacy nested-array Polygon path.
  // Positions round-trip through Float32 now, so exact float64 literal
  // comparison needs the file's tolerant `round` helper.
  const face = panel.children.find((c) => c.component === "ChunkedFace");
  const loops = decodeChunks(face!);
  assertEquals(panel.component, "Polar");
  assertEquals(loops.length, 2);
  // geom_col rectangles have 4 edges; munching inserts 16 points per edge.
  assertEquals(loops[0].length, 64);
  assertEquals(round([loops[0][0]]), round([[-Math.PI, 0]]));
  assertEquals(round([loops[0][16]]), round([[-Math.PI, 2]]));
});

Deno.test("coord_polar uses explicit Line rings/spokes instead of Cartesian Grid", () => {
  const spec = ggplot({ x: ["a", "b"], y: [2, 3] }, { x: "x", y: "y" })
    .add(geomCol(), coordPolar())
    .build();
  const tree = compile(spec);
  const panel = tree.children[0].children[0];

  assertEquals(panel.children.find((c) => c.component === "Grid"), undefined);
  const grid = panel.children.find((c) => c.component === "Line");
  const positions = grid?.props.positions as [number, number][][];
  assertEquals(grid?.props.zBias, -1);
  assertEquals(positions.length, 16);
  assertEquals(positions[0].length, 96);
  assertEquals(positions[4].length, 32);
});

Deno.test("geom_line sorts by x before connecting, unlike geom_path", () => {
  const unsorted = { x: [2, 0, 1], y: [30, 10, 20] };

  const lineSpec = ggplot(unsorted, { x: "x", y: "y" }).add(geomLine()).build();
  const lineTree = compile(lineSpec);
  const line = plotPanel(lineTree).children.find((c) =>
    c.component === "ChunkedLine"
  );
  assertEquals(decodeChunks(line!), [[[0, 10], [1, 20], [2, 30]]]);

  const pathSpec = ggplot(unsorted, { x: "x", y: "y" }).add(geomPath()).build();
  const pathTree = compile(pathSpec);
  const path = plotPanel(pathTree).children.find((c) =>
    c.component === "ChunkedLine"
  );
  assertEquals(decodeChunks(path!), [[[2, 30], [0, 10], [1, 20]]]);
});

Deno.test("group aesthetic packs geom_line groups into one ChunkedLine per dash batch", () => {
  const grouped = {
    x: [0, 1, 0, 1],
    y: [10, 20, 15, 25],
    grp: ["a", "a", "b", "b"],
  };
  const spec = ggplot(grouped, { x: "x", y: "y", group: "grp" }).add(geomLine())
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  // gggplot-tzc.3: two solid-dash groups concat into ONE ChunkedLine node
  // carrying one topology chunk per group — no plain 'Line' mark is emitted.
  assertEquals(panel.children.filter((c) => c.component === "Line").length, 0);
  const lines = panel.children.filter((c) => c.component === "ChunkedLine");
  assertEquals(lines.length, 1);
  assertEquals(decodeChunks(lines[0]), [
    [[0, 10], [1, 20]],
    [[0, 15], [1, 25]],
  ]);
});

Deno.test("gggplot-tzc.3 mandatory: a grouped geom_line lowers to ChunkedLine while an hline annotation stays a plain Line in the same spec", () => {
  // The single authoritative guide-vs-mark separation test: a data-driven
  // grouped line mark must select the ChunkedLine component (chunked flat
  // topology), while the reference-line annotation in the SAME spec keeps the
  // plain 'Line' component — proving the global REGISTRY 'Line' mapping is
  // untouched by the mark conversion, so guides/annotations are unaffected.
  const grouped = {
    x: [0, 1, 0, 1],
    y: [10, 20, 15, 25],
    grp: ["a", "a", "b", "b"],
  };
  const spec = ggplot(grouped, { x: "x", y: "y", group: "grp" })
    .add(geomLine(), geomHline({ yintercept: 18 }))
    .build();
  const panel = plotPanel(compile(spec));

  const chunked = panel.children.filter((c) => c.component === "ChunkedLine");
  const plainLines = panel.children.filter((c) => c.component === "Line");

  // Exactly one ChunkedLine (both solid groups, one dash batch, two chunks)…
  assertEquals(chunked.length, 1);
  assertEquals(decodeChunks(chunked[0]), [
    [[0, 10], [1, 20]],
    [[0, 15], [1, 25]],
  ]);
  // …and exactly one plain 'Line' for the hline reference annotation.
  assertEquals(plainLines.length, 1);
  const [xDomain] = panel.props.range as [[number, number], [number, number]];
  assertEquals(decodeChunks(plainLines[0]), [
    [[xDomain[0], 18], [xDomain[1], 18]],
  ]);
});

Deno.test("gggplot-tzc.3 acceptance: a 3-group solid-dash geom_line layer lowers to exactly one ChunkedLine node", () => {
  // Node-budget guarantee (tzc.8 enumerates this): three color groups that
  // all share one dash pattern (solid) concat into ONE ChunkedLine node with
  // three topology chunks — NOT three nodes.
  const threeGroups = {
    x: [0, 1, 0, 1, 0, 1],
    y: [0, 1, 2, 3, 4, 5],
    grp: ["a", "a", "b", "b", "c", "c"],
  };
  const spec = ggplot(threeGroups, { x: "x", y: "y", color: "grp" })
    .add(geomLine())
    .build();
  const panel = plotPanel(compile(spec));
  const chunked = panel.children.filter((c) => c.component === "ChunkedLine");
  assertEquals(chunked.length, 1);
  assertEquals((chunked[0].props.topology as { chunks: Uint32Array }).chunks
    .length, 3);
  assertEquals(decodeChunks(chunked[0]).length, 3);
});

Deno.test("gggplot-tzc.3 mandatory: geom_point with mapped color+size drops a mid-column invalid row consistently across the packed positions, colors, and sizes tensors", () => {
  // Mirrors tzc.1's packMarkRows mid-data alignment test, exercised end-to-end
  // through lowerPoint. The realistic in-pipeline source of a non-finite
  // scaled position is a log10 scale applied to a non-positive value
  // (log10(0) = -Infinity) — here the MIDDLE row's x. packMarkRows (the sole
  // mask builder) must drop that row from positions AND its companion
  // color/size tensors at the SAME packed slot, so the surviving rows stay
  // mutually aligned (a color/size can never land on the wrong point).
  const aligned = {
    x: [1, 10, 0, 1000], // row index 2 -> log10(0) = -Infinity (invalid)
    y: [5, 6, 7, 8],
    grp: ["a", "b", "c", "d"], // 4 distinct colors
    mag: [10, 20, 30, 40], // 4 distinct sizes
  };
  const spec = ggplot(aligned, { x: "x", y: "y", color: "grp", size: "mag" })
    .add(geomPoint(), scaleXLog10())
    .build();
  const point = plotPanel(compile(spec)).children.find((c) =>
    c.component === "Point"
  )!;

  // Row 2 (log10(0) = -Infinity x) is gone; rows 0,1,3 survive in order,
  // at log10 x-positions 0, 1, 3.
  assertPositions(point.props.positions, [[0, 5], [1, 6], [3, 8]]);
  // grp levels sort [a,b,c,d] -> slots 0,1,2,3; row 2 (level c/slot2) dropped,
  // proving the colors tensor walked the SAME mask as positions.
  assertEquals(decodeColors(point.props.colors), [
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[1],
    CATEGORICAL_PALETTE[3],
  ]);
  // Sizes 10/20/40 survive (30 dropped): 3 packed slots, strictly increasing.
  const sizes = decodeScalars(point.props.sizes);
  assertEquals(sizes.length, 3);
  assertEquals(sizes[0] < sizes[1] && sizes[1] < sizes[2], true);
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
  // gggplot-tzc.3: distinct dash patterns are the sanctioned per-batch split,
  // so the two linetype levels stay TWO separate ChunkedLine nodes.
  const lines = plotPanel(tree).children.filter((c) =>
    c.component === "ChunkedLine"
  );

  assertEquals(lines.length, 2);
  // Level 0 is solid (no dash property); level 1 gets the second dash
  // palette entry. Neither case creates a row-shaped stat output.
  assertEquals(lines[0].props.dash, undefined);
  assertEquals(lines[1].props.dash, [8, 5]);
  assertEquals(lines.map((line) => decodeScalars(line.props.widths)), [
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
  const panel = plotPanel(compile(spec));
  // gggplot-tzc.3: geom_line is a ChunkedLine (widths FlatTensor); the hline
  // reference line stays a plain 'Line' with a literal width.
  const chunked = panel.children.find((c) => c.component === "ChunkedLine")!;
  const refLine = panel.children.find((c) => c.component === "Line")!;

  assertEquals(decodeScalars(chunked.props.widths), [3, 3, 3]);
  assertEquals(chunked.props.dash, [1, 4, 8, 4]);
  assertEquals(refLine.props.width, 4);
  assertEquals(refLine.props.dash, [1, 4]);
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

Deno.test("color aesthetic alone packs geom_line groups into one ChunkedLine with per-group chunks", () => {
  const grouped = {
    x: [0, 1, 2, 0, 1, 2],
    y: [1, 2, 3, 10, 20, 30],
    g: ["a", "a", "a", "b", "b", "b"],
  };
  const spec = ggplot(grouped, { x: "x", y: "y", color: "g" }).add(geomLine())
    .build();
  const tree = compile(spec);

  // gggplot-tzc.3: the two solid color groups concat into ONE ChunkedLine
  // node — two topology chunks, colors repeated per vertex within each.
  const lines = plotPanel(tree).children.filter((c) =>
    c.component === "ChunkedLine"
  );
  assertEquals(lines.length, 1);
  assertEquals(decodeChunks(lines[0]), [
    [[0, 1], [1, 2], [2, 3]],
    [[0, 10], [1, 20], [2, 30]],
  ]);
  assertEquals(decodeColors(lines[0].props.colors), [
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[1],
    CATEGORICAL_PALETTE[1],
    CATEGORICAL_PALETTE[1],
  ]);
});

Deno.test("inheritAes: false ignores the plot's top-level mapping", () => {
  const both = { x: [1, 2], y: [10, 20], x2: [100, 200], y2: [1, 2] };
  const spec = ggplot(both, { x: "x", y: "y" })
    .add(geomPoint({ inheritAes: false, mapping: { x: "x2", y: "y2" } }))
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  const point = panel.children.find((c) => c.component === "Point");
  assertPositions(point!.props.positions, [[100, 1], [200, 2]]);
});

Deno.test("annotate('segment', ...) renders a literal Line ignoring the plot's mapping", () => {
  const spec = ggplot(data, { x: "x", y: "y" })
    .add(
      geomPoint(),
      annotate("segment", { x: 0, y: 10, xend: 2, yend: 30, color: "#ff0000" }),
    )
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  const line = panel.children.find((c) => c.component === "Line");
  assertEquals(decodeChunks(line!), [[[0, 10], [2, 30]]]);
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

  const panel = plotPanel(tree);
  // gggplot-tzc.4: annotate("rect", ...)/geom_rect lowers to a ChunkedFace node.
  const face = panel.children.find((c) => c.component === "ChunkedFace");
  assertEquals(decodeChunks(face!), [[[0, 10], [0, 20], [1, 20], [1, 10]]]);
  assertEquals(decodeChunkColors(face!), ["#00ff00"]);
});

Deno.test("annotate('text', ...) places a literal Label independent of the plot's mapping", () => {
  const spec = ggplot(data, { x: "x", y: "y", color: "x" })
    .add(geomPoint(), annotate("text", { x: 1, y: 25, label: "peak" }))
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  const label = panel.children.find((c) => c.component === "Label");
  assertPositions(label!.props.positions, [[1, 25]]);
  assertEquals(label?.props.labels, ["peak"]);
});

Deno.test("geom_hline draws a full-width reference line at each yintercept", () => {
  const spec = ggplot(data, { x: "x", y: "y" })
    .add(geomPoint(), geomHline({ yintercept: [15, 25], color: "#000000" }))
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  const [xDomain] = panel.props.range as [[number, number], [number, number]];
  const line = panel.children.find((c) => c.component === "Line");
  assertEquals(decodeChunks(line!), [
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

  const panel = plotPanel(tree);
  const [, yDomain] = panel.props.range as [[number, number], [number, number]];
  const line = panel.children.find((c) => c.component === "Line");
  assertEquals(decodeChunks(line!), [[[1, yDomain[0]], [1, yDomain[1]]]]);
});

Deno.test("geom_abline draws y = slope*x + intercept spanning the panel's x domain", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(
    geomPoint(),
    geomAbline({ slope: 2, intercept: 1 }),
  ).build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  const [xDomain] = panel.props.range as [[number, number], [number, number]];
  const line = panel.children.find((c) => c.component === "Line");
  assertEquals(decodeChunks(line!), [[
    [xDomain[0], 2 * xDomain[0] + 1],
    [xDomain[1], 2 * xDomain[1] + 1],
  ]]);
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

  const panel = plotPanel(tree);
  // gggplot-tzc.4: geom_area's band loop packs into a ChunkedFace node.
  const face = panel.children.find((c) => c.component === "ChunkedFace");
  assertEquals(decodeChunks(face!), [[
    [0, 10],
    [1, 20],
    [2, 15],
    [2, 0],
    [1, 0],
    [0, 0],
  ]]);
});

Deno.test("stacked geom_area cumulatively positions bands and widens y domain", () => {
  const spec = ggplot({
    x: [0, 1, 2, 0, 1, 2],
    y: [2, 1, 2, 4, 3, 2],
    group: ["a", "a", "a", "b", "b", "b"],
  }, { x: "x", y: "y", fill: "group" }).add(
    geomArea({ position: "stack" }),
  ).build();
  // gggplot-tzc.4: stacked geom_area's group bands pack into a single
  // ChunkedFace node — one loop (topology chunk) per group.
  const panel = plotPanel(compile(spec));
  const face = panel.children.find((c) => c.component === "ChunkedFace");
  const bands = decodeChunks(face!);
  assertEquals(bands.length, 2);
  assertEquals(bands[0], [
    [0, 2],
    [1, 1],
    [2, 2],
    [2, 0],
    [1, 0],
    [0, 0],
  ]);
  assertEquals(bands[1], [
    [0, 6],
    [1, 4],
    [2, 4],
    [2, 2],
    [1, 1],
    [0, 2],
  ]);
  assertEquals((panel.props.range as [number[], number[]])[1], [0, 6]);
});

Deno.test("stacked geom_area separates negative and positive baselines", () => {
  const spec = ggplot({
    x: [0, 1, 0, 1],
    y: [-2, 3, -4, 5],
    group: ["a", "a", "b", "b"],
  }, { x: "x", y: "y", fill: "group" }).add(geomArea({ position: "stack" }))
    .build();
  const panel = plotPanel(compile(spec));
  const face = panel.children.find((c) => c.component === "ChunkedFace");
  const bands = decodeChunks(face!);
  assertEquals(bands[1], [
    [0, -6],
    [1, 8],
    [1, 3],
    [0, -2],
  ]);
  assertEquals((panel.props.range as [number[], number[]])[1], [-6, 8]);
});

Deno.test("stat_align resamples mismatched groups onto a deterministic union grid", () => {
  const spec = ggplot({
    x: [0, 2, 1, 3],
    y: [0, 2, 10, 30],
    group: ["a", "a", "b", "b"],
  }, { x: "x", y: "y", fill: "group" }).add(statAlign()).build();
  const result = applyStat(spec.layers[0], spec.mapping, spec.data);
  assertEquals(columnValues(result.data, "x"), [0, 1, 2, 3, 0, 1, 2, 3]);
  assertEquals(columnValues(result.data, "y"), [0, 1, 2, 0, 0, 10, 20, 30]);
  assertEquals(columnValues(result.data, "group"), [
    "a",
    "a",
    "a",
    "a",
    "b",
    "b",
    "b",
    "b",
  ]);

  const tree = compile(spec);
  // gggplot-tzc.4: geom_area's group bands pack into a single ChunkedFace
  // node — one loop (topology chunk) per group.
  const bands = findNodes(tree, "ChunkedFace").flatMap((node) =>
    decodeChunks(node)
  ).filter((loop) => loop.length === 8);
  assertEquals(bands.length, 2);
  assertStringIncludes(emitSource(tree, "AlignedAreaChart"), "positions");
});

Deno.test("stat_align handles missing rows, duplicate policies, and explicit grids", () => {
  const spec = ggplot({
    x: [0, 0, 2, null],
    y: [1, 3, 5, 9],
    group: ["a", "a", "a", "a"],
  }, { x: "x", y: "y", group: "group" }).add(statAlign({ grid: [0, 1, 2] }))
    .build();
  const summed = applyStat(spec.layers[0], spec.mapping, spec.data);
  assertEquals(columnValues(summed.data, "y"), [4, 4.5, 5]);
  const meanLayer = {
    ...spec.layers[0],
    params: {
      ...spec.layers[0].params,
      duplicate: "mean",
      interpolation: "step",
    },
  };
  const mean = applyStat(meanLayer, spec.mapping, spec.data);
  assertEquals(columnValues(mean.data, "y"), [2, 2, 5]);
  assertThrows(
    () =>
      applyStat(
        { ...meanLayer, params: { grid: [0, Number.NaN] } },
        spec.mapping,
        spec.data,
      ),
    TypeError,
  );
});

Deno.test("stat_align isolates facet grids before interpolation", () => {
  const spec = ggplot({
    x: [0, 2, 1, 10, 12, 11],
    y: [1, 2, 3, 4, 5, 6],
    group: ["a", "a", "b", "a", "a", "b"],
    panel: ["p", "p", "p", "q", "q", "q"],
  }, { x: "x", y: "y", fill: "group" }).add(statAlign(), facetWrap(["panel"]))
    .build();
  const panels = facetGridNode(compile(spec)).children;
  const xs = panels.map((panel) =>
    findNodes(panel, "Polygon").flatMap((node) =>
      ((node.props.positions as [number, number][]) ?? []).map(([x]) => x)
    )
  );
  assertEquals(Math.max(...xs[0]) <= 2, true);
  assertEquals(Math.min(...xs[1]) >= 10, true);
});

Deno.test("geom_ribbon fills a closed band between ymin and ymax", () => {
  const ribbonData = { x: [0, 1, 2], lo: [5, 8, 6], hi: [10, 20, 15] };
  const spec = ggplot(ribbonData, { x: "x", ymin: "lo", ymax: "hi" })
    .add(geomRibbon())
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  // gggplot-tzc.4: geom_ribbon's band loop packs into a ChunkedFace node.
  const face = panel.children.find((c) => c.component === "ChunkedFace");
  assertEquals(decodeChunks(face!), [[
    [0, 10],
    [1, 20],
    [2, 15],
    [2, 6],
    [1, 8],
    [0, 5],
  ]]);
});

Deno.test("geom_ribbon's ymin/ymax widen the trained y domain beyond a plain y mapping", () => {
  const ribbonData = { x: [0, 1, 2], lo: [5, 8, 6], hi: [10, 20, 15] };
  const spec = ggplot(ribbonData, { x: "x", ymin: "lo", ymax: "hi" })
    .add(geomRibbon())
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  assertEquals(panel.props.range, [[0, 2], [5, 20]]);
});

Deno.test("scaleXLog10 transforms both the trained domain and mark positions", () => {
  const logData = { x: [1, 10, 100], y: [1, 2, 3] };
  const spec = ggplot(logData, { x: "x", y: "y" }).add(
    geomPoint(),
    scaleXLog10(),
  ).build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  assertEquals(panel.props.range, [[0, 2], [1, 3]]);

  const point = panel.children.find((c) => c.component === "Point");
  assertPositions(point!.props.positions, [[0, 1], [1, 2], [2, 3]]);
});

Deno.test("scaleXSqrt transforms both the trained domain and mark positions", () => {
  const sqrtData = { x: [0, 4, 9], y: [1, 2, 3] };
  const spec = ggplot(sqrtData, { x: "x", y: "y" }).add(
    geomPoint(),
    scaleXSqrt(),
  ).build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  assertEquals(panel.props.range, [[0, 3], [1, 3]]);

  const point = panel.children.find((c) => c.component === "Point");
  assertPositions(point!.props.positions, [[0, 1], [2, 2], [3, 3]]);
});

Deno.test("explicit scale domain overrides the auto-trained data extent (user limits)", () => {
  const limitData = { x: [1, 2, 3], y: [10, 20, 30] };
  const spec = ggplot(limitData, { x: "x", y: "y" })
    .add(geomPoint(), scaleXContinuous({ domain: [0, 100] }))
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  assertEquals(panel.props.range, [[0, 100], [10, 30]]);
  // positions stay at their real data values regardless of the view's limits
  const point = panel.children.find((c) => c.component === "Point");
  assertPositions(point!.props.positions, [[1, 10], [2, 20], [3, 30]]);
});

Deno.test("scale expand pads the trained domain by a multiplicative + additive amount", () => {
  const expandData = { x: [0, 10], y: [0, 1] };
  const spec = ggplot(expandData, { x: "x", y: "y" })
    .add(geomPoint(), scaleXContinuous({ expand: [0.1, 1] }))
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  // span 10 * 0.1 = 1, + additive 1 = 2 padding on each side
  assertEquals(panel.props.range, [[-2, 12], [0, 1]]);
});

Deno.test("continuous size scale maps mark radius via a mapped size column", () => {
  const sized = { x: [0, 1, 2], y: [0, 1, 2], weight: [0, 5, 10] };
  const spec = ggplot(sized, { x: "x", y: "y", size: "weight" }).add(
    geomPoint(),
  ).build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  const point = panel.children.find((c) => c.component === "Point");
  // default size range [1,6] over domain [0,10]: 0->1, 5->3.5, 10->6
  assertScalars(point!.props.sizes, [1, 1 + 5 / Math.sqrt(2), 6]);
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
  assertEquals(scaleSizeValue(customRange, 5), 10 + 10 / Math.sqrt(2));
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
  assertEquals(legendSwatch?.props.sizes, [1, 1 + 5 / Math.sqrt(2), 6]);

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

  const panel = plotPanel(tree);
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

  const panel = plotPanel(tree);
  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(point?.props.opacity, 0.4);
});

Deno.test("literal and mapped point stroke use an explicit compositional CPU fallback", () => {
  const literal = findNodes(
    compile(
      ggplot({ x: [1], y: [2] }, { x: "x", y: "y" }).add(
        geomPoint({
          size: 5,
          stroke: 2,
          strokeColor: "#000000",
          fill: "#ffffff",
        }),
      ).build(),
    ),
    "Point",
  );
  assertEquals(literal.length, 2);
  // gggplot-tzc.3: the two-node stroke-outline fallback is preserved, now
  // flat — sizes are per-row FlatTensors; the single-literal outer ring color
  // stays a scalar 'color' (parseColorRGBA is hex-only — literal colors are
  // not forced through the vec4 packer).
  assertScalars(literal[0].props.sizes, [9]);
  assertEquals(literal[0].props.color, "#000000");
  assertScalars(literal[1].props.sizes, [5]);
  assertEquals(
    literal.every((node) => node.props.execution === "cpu-outline-fallback"),
    true,
  );

  const mapped = findNodes(
    compile(
      ggplot(
        { x: [1, 2], y: [2, 3], border: [0, 10] },
        { x: "x", y: "y", stroke: "border" },
      ).add(geomPoint({ size: 4 }), scaleStroke({ range: [1, 3] })).build(),
    ),
    "Point",
  );
  assertScalars(mapped[0].props.sizes, [6, 10]);
  assertScalars(mapped[1].props.sizes, [4, 4]);
});

Deno.test("axis labels default from mappings and honor labels() overrides", () => {
  const defaultTree = compile(
    ggplot(data, { x: "x", y: "y" }).add(geomPoint()).build(),
  );
  const defaultOverlay = defaultTree.children.find((child) =>
    child.component === "FacetPanel" &&
    child.children.every((node) => node.component === "Label")
  )!;
  assertEquals(defaultOverlay.children.map((node) => node.props.labels), [
    ["0", "0.5", "1", "1.5", "2"],
    ["10", "15", "20", "25", "30"],
    ["x"],
    ["y"],
  ]);
  assertEquals(
    defaultOverlay.children.every((node) => node.props.zBias === 2),
    true,
  );

  const namedTree = compile(
    ggplot(data, { x: "x", y: "y" }).add(geomPoint())
      .add(labels({ x: "Weight", y: "Mileage", tag: "A" })).build(),
  );
  const namedOverlay = namedTree.children.find((child) =>
    child.component === "FacetPanel" &&
    child.children.every((node) => node.component === "Label")
  )!;
  assertEquals(namedOverlay.children.map((node) => node.props.labels), [
    ["0", "0.5", "1", "1.5", "2"],
    ["10", "15", "20", "25", "30"],
    ["Weight"],
    ["Mileage"],
  ]);
  assertEquals(
    findNodes(namedTree, "Label").some((node) =>
      (node.props.labels as string[] | undefined)?.[0] === "A"
    ),
    true,
  );
});

Deno.test("measured guide layout reserves glyph-sized margins and adapts ticks", () => {
  const tree = compile(
    ggplot(data, { x: "x", y: "y" }).add(geomPoint()).build(),
    {
      layout: {
        width: 360,
        height: 240,
        measureText: (_text, _size) => ({
          width: 40,
          height: 10,
        }),
      },
    },
  );
  const viewport = findNodes(tree, "PanelViewport")[0];
  assertEquals(viewport.props.bounds, [
    -1 + 2 * 94 / 360,
    -1 + 2 * 16 / 240,
    1 - 2 * 16 / 360,
    1 - 2 * 39 / 240,
  ]);
  const overlay = tree.children.find((child) =>
    child.component === "FacetPanel" &&
    child.children.every((node) => node.component === "Label")
  )!;
  assertEquals((overlay.children[0].props.labels as string[]).length, 4);
  assertEquals((overlay.children[1].props.labels as string[]).length, 4);
});

Deno.test("mapped alpha lowers per-point RGBA colors and emits an alpha guide", () => {
  const alphaData = { x: [0, 1, 2], y: [1, 2, 3], strength: [0, 5, 10] };
  const tree = compile(
    ggplot(alphaData, { x: "x", y: "y", alpha: "strength" })
      .add(geomPoint())
      .add(scaleAlpha({ name: "Strength" }))
      .build(),
  );
  const panel = plotPanel(tree);
  const mark = panel.children.find((child) => child.component === "Point");
  // gggplot-tzc.3: mapped alpha now folds into the packed vec4 colors tensor.
  assertEquals(decodeColors(mark!.props.colors, true), [
    "#3b82f61a",
    "#3b82f68c",
    "#3b82f6ff",
  ]);
  const guideTitles = tree.children
    .filter((child) => child.component === "Label")
    .flatMap((child) => child.props.labels as string[]);
  assertEquals(guideTitles.includes("Strength"), true);
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

Deno.test("grouped histogram retains zero bins, stacks shared centers, and keeps fill correspondence", () => {
  const spec = ggplot(
    { x: [0, 1, 2, 3, 4, 5], cohort: ["a", "a", "a", "b", "b", "b"] },
    { x: "x", fill: "cohort" },
  ).add(geomHistogram({ binwidth: 2 })).build();
  const tree = compile(spec);
  // gggplot-tzc.4: geom_histogram lowers via geom "bar" → lowerBar, whose
  // bar loops pack into a single ChunkedFace node.
  const face = plotPanel(tree).children.find((node) =>
    node.component === "ChunkedFace"
  )!;
  const roundedLoops = decodeChunks(face).map((loop) =>
    loop.map(([x, y]) => [Number(x.toFixed(6)), y])
  );

  // stat_bin emits three centers for both cohorts, including each cohort's
  // empty bin. Stacking starts b at a's accumulated top for each center.
  assertEquals(roundedLoops, [
    [[0.1, 0], [0.1, 2], [1.9, 2], [1.9, 0]],
    [[2.1, 0], [2.1, 1], [3.9, 1], [3.9, 0]],
    [[4.1, 0], [4.1, 0], [5.9, 0], [5.9, 0]],
    [[0.1, 2], [0.1, 2], [1.9, 2], [1.9, 2]],
    [[2.1, 1], [2.1, 2], [3.9, 2], [3.9, 1]],
    [[4.1, 0], [4.1, 2], [5.9, 2], [5.9, 0]],
  ]);
  assertEquals(decodeChunkColors(face), [
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[1],
    CATEGORICAL_PALETTE[1],
    CATEGORICAL_PALETTE[1],
  ]);
  assertEquals(
    findNodes(tree, "Point").some((n) => n.props.colors && n.props.size === 7),
    true,
  );
});

Deno.test("resident compile lowers an eligible histogram without stat rows", () => {
  const spec = ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
    .add(geomHistogram({ binwidth: 2, fill: "#ff0000" }))
    .add(scaleYContinuous({ domain: [0, 4] }))
    .build();
  const tree = compile(spec, { resident: true });
  const resident = findNodes(tree, "ResidentProduct");

  assertEquals(resident.length, 1);
  assertEquals(resident[0].props.product, "@gggplot/core:stat_bin@1");
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
      "ResidentProduct",
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

  const view = findNodes(tree, "ResidentProduct").filter((n) =>
    n.props.view === true
  );
  assertEquals(view.length, 1);
  assertEquals(findNodes(tree, "Polygon").length, 0);
});

Deno.test("resident compile preserves CPU fallback outside the standalone cartesian contract", () => {
  const spec = ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
    .add(geomHistogram({ binwidth: 2 }))
    .add(coordPolar())
    .build();
  const tree = compile(spec, { resident: true });

  assertEquals(findNodes(tree, "ResidentProduct").length, 0);
  // gggplot-tzc.4: geom_histogram's CPU-fallback bars are a ChunkedFace node.
  assertEquals(findNodes(tree, "ChunkedFace").length > 0, true);
});

Deno.test("default-scaled factor fills go resident with a matching palette and legend", () => {
  const spec = ggplot(
    { x: [0, 1, 2, 3], cohort: ["a", "a", "b", "b"] },
    { x: "x", fill: "cohort" },
  ).add(geomHistogram({ binwidth: 2 })).build();
  const tree = compile(spec, {
    resident: true,
    layout: { width: 640, height: 480, measureText: approximateTextMeasurer },
  });

  const resident = findNodes(tree, "ResidentProduct");
  assertEquals(resident.length, 1);
  assertEquals(findNodes(tree, "ChunkedFace").length, 0);
  // Palette is in factor-level order and matches the trained fill scale.
  assertEquals(resident[0].props.paletteColors, [
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[1],
  ]);
  // The trained fill scale still produces a legend on the standalone path.
  const legend = findNodes(tree, "Label").map((c) => c.props.labels);
  assertEquals(legend.some((l) => Array.isArray(l) && l.includes("a")), true);
});

Deno.test("a custom fill scale keeps mapped histogram fills on the CPU path", () => {
  const spec = ggplot(
    { x: [0, 1, 2, 3], cohort: ["a", "a", "b", "b"] },
    { x: "x", fill: "cohort" },
  ).add(geomHistogram({ binwidth: 2 }), scaleFill({ range: ["#111", "#222"] }))
    .build();
  const tree = compile(spec, { resident: true });

  assertEquals(findNodes(tree, "ResidentProduct").length, 0);
  assertEquals(findNodes(tree, "ChunkedFace").length > 0, true);
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

  const panel = plotPanel(tree);
  const point = panel.children.find((c) => c.component === "Point");
  // levels sort to [a, b] → a=slot0 (blue), b=slot1 (aqua)
  assertEquals(decodeColors(point!.props.colors), [
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

Deno.test("legend key boxes reserve pixel-stable space before labels", () => {
  const grouped = {
    x: [0, 1, 2],
    y: [1, 2, 3],
    grp: ["cyl 4", "cyl 6", "cyl 8"],
  };
  const width = 471;
  const tree = compile(
    ggplot(grouped, { x: "x", y: "y", color: "grp" }).add(geomPoint())
      .build(),
    {
      layout: {
        width,
        height: 360,
        measureText: (text, size) => ({
          width: text.length * size * 0.6,
          height: size,
        }),
      },
    },
  );
  const swatch = tree.children.find((node) =>
    node.component === "Point" && node.props.size === 7
  )!;
  const label = tree.children.find((node) =>
    node.component === "Label" &&
    (node.props.labels as string[])[0] === "cyl 4"
  )!;
  const swatchX = (swatch.props.positions as [number, number][])[0][0];
  const labelX = (label.props.positions as [number, number][])[0][0];
  assertEquals(Math.round((labelX - swatchX) * width / 2), 16);
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

Deno.test("continuous colorbar, coloursteps, and bins guides lower serializable swatches", () => {
  const guidesOf = (guide: ReturnType<typeof guideColourbar>) =>
    findNodes(
      compile(
        ggplot({ x: [0, 1], y: [0, 1], value: [0, 10] }, {
          x: "x",
          y: "y",
          color: "value",
        }).add(geomPoint(), scaleColor({ guide })).build(),
      ),
      "Polygon",
    ).filter((node) => node.props.guideKind);
  const bar = guidesOf(guideColourbar({ title: "Intensity" }));
  assertEquals(bar.length, 24);
  assertEquals(bar.every((node) => node.props.guideKind === "colorbar"), true);
  const steps = guidesOf(guideColoursteps({ bins: 5 }));
  assertEquals(steps.length, 5);
  const bins = guidesOf(guideBins({ bins: 4 }));
  assertEquals(bins.length, 4);
});

Deno.test("viridis and gradient2 builders preserve serializable ramps through color lowering", () => {
  const paletteData = { x: [0, 1, 2], y: [0, 1, 2], value: [0, 5, 10] };
  const viridis = ggplot(paletteData, { x: "x", y: "y", color: "value" })
    .add(geomPoint(), scaleColorViridis())
    .build();
  const viridisPoint = plotPanel(compile(viridis)).children.find((node) =>
    node.component === "Point"
  );
  assertEquals(decodeColors(viridisPoint!.props.colors), [
    "#440154",
    "#23908c",
    "#fde725",
  ]);

  const diverging = ggplot(paletteData, { x: "x", y: "y", color: "value" })
    .add(geomPoint(), scaleColorGradient2())
    .build();
  const divergingPoint = plotPanel(compile(diverging)).children.find((node) =>
    node.component === "Point"
  );
  assertEquals(decodeColors(divergingPoint!.props.colors), [
    "#b2182b",
    "#f7f7f7",
    "#2166ac",
  ]);
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

  const panel = plotPanel(tree);
  const point = panel.children.find((c) => c.component === "Point");
  assertEquals(decodeColors(point!.props.colors), ["#222222", "#111111"]);
});

Deno.test("mapped aesthetics train scales instead of treating strings as visual literals", () => {
  const literalWords = { x: [0, 1], y: [1, 2], shade: ["red", "blue"] };
  const spec = ggplot(literalWords, { x: "x", y: "y", color: "shade" })
    .add(geomPoint())
    .build();
  const tree = compile(spec);

  const point = plotPanel(tree).children.find((c) => c.component === "Point");
  // The words "blue"/"red" are data values. They train a discrete scale and
  // map to palette slots, rather than passing through as CSS color names.
  assertEquals(decodeColors(point!.props.colors), [
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

  const point = plotPanel(tree).children.find((c) => c.component === "Point");
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

  const panel = plotPanel(tree);
  const point = panel.children.find((c) => c.component === "Point");
  // gggplot-tzc.4: geom_tile's cells pack into a single ChunkedFace node.
  const tileFace = panel.children.find((c) => c.component === "ChunkedFace");

  assertEquals(decodeColors(point!.props.colors), ["#111111", "#222222"]);
  assertEquals(decodeChunkColors(tileFace!), ["#bbbbbb", "#aaaaaa"]);

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

  const stripLabels = tree.children.filter((node) => node.component === "Label")
    .map((node) => node.props.labels);
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

Deno.test("stat_smooth loess reproduces curvature and honors span, level, and se", () => {
  const data = { x: [-2, -1, 0, 1, 2], y: [4, 1, 0, 1, 4] };
  const layer = (params: Record<string, unknown>): Layer => ({
    geom: "smooth",
    stat: "smooth",
    position: "identity",
    params: { method: "loess", span: 1, robustIterations: 0, n: 5, ...params },
  });
  const fitted = applyStat(layer({}), { x: "x", y: "y" }, data);
  assertEquals(
    values(fitted.data, "y").map((value) =>
      Math.round(Number(value) * 1e9) / 1e9
    ),
    [4, 1, 0, 1, 4],
  );
  assertEquals(values(fitted.data, "ymin").length, 5);
  const narrow = applyStat(layer({ level: 0.5 }), { x: "x", y: "y" }, {
    x: [-2, -1, 0, 1, 2],
    y: [4.2, 0.8, 0.1, 1.1, 3.9],
  });
  const wide = applyStat(layer({ level: 0.99 }), { x: "x", y: "y" }, {
    x: [-2, -1, 0, 1, 2],
    y: [4.2, 0.8, 0.1, 1.1, 3.9],
  });
  assertEquals(
    Number(values(wide.data, "ymax")[2]) >
      Number(values(narrow.data, "ymax")[2]),
    true,
  );
  const noSe = applyStat(layer({ se: false }), { x: "x", y: "y" }, data);
  assertEquals(noSe.data.ymin, undefined);
});

Deno.test("stat_smooth binomial glm is deterministic, bounded, and grouped", () => {
  const data = {
    x: [-2, -2, -1, -1, 0, 0, 1, 1, 2, 2],
    y: [0, 0, 0, 1, 0, 1, 0, 1, 1, 1],
  };
  const layer: Layer = {
    geom: "smooth",
    stat: "smooth",
    position: "identity",
    params: {
      method: "glm",
      family: "binomial",
      link: "logit",
      n: 5,
      se: false,
    },
  };
  const fitted = applyStat(layer, { x: "x", y: "y" }, data);
  assertEquals(
    values(fitted.data, "y").map((value) =>
      Math.round(Number(value) * 1e6) / 1e6
    ),
    [0.116706, 0.266588, 0.5, 0.733412, 0.883294],
  );
  assertEquals(
    values(fitted.data, "y").every((value) =>
      Number(value) >= 0 && Number(value) <= 1
    ),
    true,
  );
});

Deno.test("stat_smooth methods reject invalid and unavailable contracts", () => {
  const data = { x: [0, 1, 2], y: [0, 1, 1] };
  const run = (params: Record<string, unknown>) => () =>
    applyStat(
      { geom: "smooth", stat: "smooth", position: "identity", params },
      {
        x: "x",
        y: "y",
      },
      data,
    );
  assertThrows(
    run({ method: "loess", span: 0 }),
    TypeError,
    "span must be inside",
  );
  assertThrows(
    run({ method: "glm", family: "gaussian" }),
    TypeError,
    "only family",
  );
  assertThrows(
    run({ method: "glm", maxIterations: 1 }),
    TypeError,
    "failed to converge",
  );
  assertThrows(run({ method: "gam" }), TypeError, "extension-registry adapter");
  assertThrows(run({ method: "mystery" }), TypeError, "unsupported");
  assertThrows(
    run({ method: "lm", formula: "y~poly(x,2)" }),
    TypeError,
    'formula "y~x"',
  );
});

Deno.test("geom_smooth renders a Line plus a CI Ribbon ChunkedFace", () => {
  const smoothData = { x: [0, 1, 2, 3, 4], y: [1, 3, 5, 7, 9] };
  const spec = ggplot(smoothData, { x: "x", y: "y" }).add(geomSmooth({ n: 5 }))
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  // gggplot-tzc.3: the fitted trend line is a ChunkedLine; the SE ribbon
  // (gggplot-tzc.4) packs into a ChunkedFace node.
  const line = panel.children.find((c) => c.component === "ChunkedLine");
  assertEquals(decodeChunks(line!), [[[0, 1], [1, 3], [2, 5], [3, 7], [4, 9]]]);

  const face = panel.children.find((c) => c.component === "ChunkedFace");
  assertEquals(decodeChunks(face!), [[
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
  ]]);
  assertEquals(decodeChunkColors(face!), ["#c7d2fe"]);
});

Deno.test("geom_smooth se:false skips the Ribbon Polygon entirely", () => {
  const smoothData = { x: [0, 1, 2, 3, 4], y: [1, 3, 5, 7, 9] };
  const spec = ggplot(smoothData, { x: "x", y: "y" }).add(
    geomSmooth({ n: 5, se: false }),
  ).build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  assertEquals(
    panel.children.find((c) => c.component === "ChunkedFace"),
    undefined,
  );
  const line = panel.children.find((c) => c.component === "ChunkedLine");
  assertEquals(decodeChunks(line!), [[[0, 1], [1, 3], [2, 5], [3, 7], [4, 9]]]);
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

  // gggplot-tzc.3: the two solid color groups concat into ONE ChunkedLine
  // node with per-group chunks; group color repeats per vertex.
  const lines = plotPanel(tree).children.filter((c) =>
    c.component === "ChunkedLine"
  );
  assertEquals(lines.length, 1);
  assertEquals(decodeChunks(lines[0]), [
    [[0, 1], [1, 1], [2, 1]],
    [[0, 10], [1, 20], [2, 30]],
  ]);
  assertEquals(decodeColors(lines[0].props.colors), [
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[0],
    CATEGORICAL_PALETTE[1],
    CATEGORICAL_PALETTE[1],
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

  const panel = plotPanel(tree);
  assertEquals(
    panel.children.find((c) => c.component === "Polygon"),
    undefined,
  );
  const grid = panel.children.find((c) => c.component === "Grid");
  assertEquals(grid?.props, { axes: "xy", width: 1, zBias: -1 });
  const axis = panel.children.find((c) =>
    c.component === "Axis" && c.props.axis === "x"
  );
  assertEquals(axis?.props, { axis: "x", width: 2, zBias: 0 });
});

Deno.test("themeGrey adds a full-panel background Polygon and a white grid color", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(geomPoint(), themeGrey())
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
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
  assertEquals(grid?.props.zBias, -1);
});

Deno.test("themeClassic omits the Grid node entirely", () => {
  const spec = ggplot(data, { x: "x", y: "y" }).add(geomPoint(), themeClassic())
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
  assertEquals(panel.children.find((c) => c.component === "Grid"), undefined);
  assertEquals(panel.children.filter((c) => c.component === "Axis").length, 2);
});

Deno.test("remaining named theme presets are distinct and themeVoid removes guides", () => {
  const presets = [
    themeBw(),
    themeLinedraw(),
    themeLight(),
    themeDark(),
    themeVoid(),
    themeTest(),
  ];
  assertEquals(
    new Set(presets.map((part) => part.tag === "theme" && part.value.name))
      .size,
    6,
  );
  const voidPanel = compile(
    ggplot(data, { x: "x", y: "y" }).add(
      geomPoint(),
      themeVoid(),
    ).build(),
  ).children[0];
  assertEquals(
    voidPanel.children.some((node) => node.component === "Grid"),
    false,
  );
  assertEquals(
    voidPanel.children.some((node) => node.component === "Axis"),
    false,
  );
});

Deno.test("theme() merges over a prior theme_*() instead of replacing it", () => {
  const spec = ggplot(data, { x: "x", y: "y" })
    .add(geomPoint(), themeGrey(), theme({ axisColor: "#ff0000" }))
    .build();
  const tree = compile(spec);

  const panel = plotPanel(tree);
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

  const label = plotPanel(tree).children.find((c) => c.component === "Label");
  assertEquals(label?.props.family, "Georgia");
  assertEquals(label?.props.size, 20);
  assertEquals(label?.props.color, "#112233");

  const overridden = ggplot(labelData, { x: "x", y: "y", label: "name" })
    .add(
      geomText({ size: 8, color: "#000000" }),
      theme({ fontSize: 20, textColor: "#112233" }),
    )
    .build();
  const overriddenLabel = plotPanel(compile(overridden)).children.find((c) =>
    c.component === "Label"
  );
  assertEquals(overriddenLabel?.props.size, 8);
  assertEquals(overriddenLabel?.props.color, "#000000");
});

Deno.test("text face semantics normalize theme and layer fontface fields", () => {
  const labelData = { x: [0], y: [0], name: ["Hi"] };
  const themed = ggplot(labelData, { x: "x", y: "y", label: "name" })
    .add(
      geomText(),
      theme({
        fontFamily: "Basic",
        fontWeight: "bold",
        fontStyle: "oblique",
        lineHeight: 18,
      }),
    )
    .build();
  const themedLabel = plotPanel(compile(themed)).children.find((node) =>
    node.component === "Label"
  );
  assertEquals(themedLabel?.props.family, "Basic");
  assertEquals(themedLabel?.props.weight, "bold");
  assertEquals(themedLabel?.props.style, "oblique");
  assertEquals(themedLabel?.props.lineHeight, 18);

  const overridden = ggplot(labelData, { x: "x", y: "y", label: "name" })
    .add(geomText({ fontface: "bold.italic", lineheight: 22 }))
    .build();
  const overriddenLabel = plotPanel(compile(overridden)).children.find((node) =>
    node.component === "Label"
  );
  assertEquals(overriddenLabel?.props.weight, "bold");
  assertEquals(overriddenLabel?.props.style, "italic");
  assertEquals(overriddenLabel?.props.lineHeight, 22);
});

Deno.test("mapped family and fontface split text into semantic face batches", () => {
  const labelData = {
    x: [0, 1, 2],
    y: [0, 1, 2],
    name: ["plain", "bold", "other"],
    face: ["plain", "bold", "bold"],
    typeface: ["Basic", "Basic", "Second"],
  };
  const tree = compile(
    ggplot(labelData, {
      x: "x",
      y: "y",
      label: "name",
      family: "typeface",
      fontface: "face",
    }).add(geomText({ family: "ignored", fontface: "italic" })).build(),
  );
  const labels = plotPanel(tree).children.filter((node) =>
    node.component === "Label"
  );
  assertEquals(labels.length, 3);
  assertEquals(
    labels.map((node) => [
      node.props.family,
      node.props.weight,
      node.props.style,
      node.props.labels,
    ]),
    [
      ["Basic", "normal", "normal", ["plain"]],
      ["Basic", "bold", "normal", ["bold"]],
      ["Second", "bold", "normal", ["other"]],
    ],
  );
  assertStringIncludes(emitSource(tree, "TextFaces"), 'family="Second"');
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
  assertPositions(points[0]!.props.positions, [[1, 10], [4, 40]]); // cyl: 4 (rows 0, 3)
  assertPositions(points[1]!.props.positions, [[2, 20], [5, 50]]); // cyl: 6 (rows 1, 4)
  assertPositions(points[2]!.props.positions, [[3, 30]]); // cyl: 8 (row 2)

  const labels = tree.children.filter((c) => c.component === "Label");
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
  assertEquals(facet.children.map((panel) => panel.component), [
    "FacetPanel",
    "FacetPanel",
    "FacetPanel",
    "FacetPanel",
  ]);
});

Deno.test("facets occupy guide panel bounds and center strips in reserved CSS-pixel rectangles", () => {
  const facetData = {
    grp: ["a", "b", "c", "d"],
    x: [1, 2, 3, 4],
    y: [1, 2, 3, 4],
  };
  const width = 640;
  const height = 400;
  const tree = compile(
    ggplot(facetData, { x: "x", y: "y" }).add(
      geomPoint(),
      facetWrap(["grp"], 2),
      theme({ panelSpacing: 20, stripHeight: 30 }),
      labels({ title: "Facets" }),
    ).build(),
    {
      layout: {
        width,
        height,
        measureText: (text, size) => ({
          width: text.length * size * 0.5,
          height: size,
        }),
      },
    },
  );
  const facet = facetGridNode(tree);
  const bounds = facet.props.bounds as [number, number, number, number];
  assertEquals(bounds[0] > -1, true);
  assertEquals(bounds[1] > -1, true);
  assertEquals(bounds[2] < 1, true);
  assertEquals(bounds[3] < 1, true);
  assertEquals(facet.props.gap, 20);
  assertEquals(facet.props.stripHeight, 30);

  const facetWidth = width * (bounds[2] - bounds[0]) / 2;
  const facetHeight = height * (bounds[3] - bounds[1]) / 2;
  const cells = facetCellLayouts(facetWidth, facetHeight, 2, 2, 20, 30);
  const stripNodes = findNodes(tree, "Label").filter((node) =>
    String((node.props.labels as string[] | undefined)?.[0]).startsWith("grp:")
  );
  assertEquals(stripNodes.length, 4);
  assertEquals(
    stripNodes.map((node) => node.props.positions),
    cells.map((cell) => {
      const strip = cell.strip;
      return [[
        bounds[0] + (strip[0] + strip[2]) / 2 / facetWidth *
          (bounds[2] - bounds[0]),
        bounds[1] + (strip[1] + strip[3]) / 2 / facetHeight *
          (bounds[3] - bounds[1]),
      ]];
    }),
  );
});

Deno.test("facet_wrap free scale modes train independent panel domains", () => {
  const facetData = {
    grp: ["a", "a", "b", "b"],
    x: [0, 1, 100, 200],
    y: [0, 10, 1000, 2000],
  };
  const ranges = (scales: "free" | "free_x" | "free_y") => {
    const tree = compile(
      ggplot(facetData, { x: "x", y: "y" }).add(
        geomPoint(),
        facetWrap(["grp"], undefined, scales),
      ).build(),
    );
    return facetGridNode(tree).children.map((panel) =>
      panel.children.find((node) => node.component === "Cartesian")?.props.range
    );
  };
  assertEquals(ranges("free"), [[[0, 1], [0, 10]], [[100, 200], [1000, 2000]]]);
  assertEquals(ranges("free_x"), [[[0, 1], [0, 2000]], [[100, 200], [
    0,
    2000,
  ]]]);
  assertEquals(ranges("free_y"), [[[0, 200], [0, 10]], [[0, 200], [
    1000,
    2000,
  ]]]);
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
  assertEquals(plotLevelLabels, [
    ["grp: a"],
    ["grp: b"],
    ["Class"],
    ["x", "y"],
  ]);
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

  const labels = tree.children.filter((node) => node.component === "Label")
    .map((node) => node.props.labels);
  assertEquals(labels, [
    ["hi · L"],
    ["hi · R"],
    ["lo · L"],
    ["lo · R"],
  ]);

  const points = facet.children.map((embed) =>
    embed.children.find((c) => c.component === "Cartesian")?.children.find((
      c,
    ) => c.component === "Point")
  );
  assertPositions(points[0]!.props.positions, [[3, 30]]); // r: hi, c: L -> row 2
  assertEquals(points[1], undefined); // r: hi, c: R -> no matching rows, no Point node
  assertPositions(points[2]!.props.positions, [[1, 10]]); // r: lo, c: L -> row 0
  assertPositions(points[3]!.props.positions, [[2, 20]]); // r: lo, c: R -> row 1
});

Deno.test("empty facet_grid bar combinations retain a panel but emit no empty ChunkedFace", () => {
  const facetData = {
    r: ["lo", "hi"],
    c: ["L", "R"],
    x: ["a", "b"],
  };
  const tree = compile(
    ggplot(facetData, { x: "x" }).add(
      geomBar({ fill: "#3b82f6" }),
      facetGrid(["r"], ["c"]),
    ).build(),
  );
  const facet = facetGridNode(tree);
  // gggplot-tzc.4: geom_bar's bars pack into a single ChunkedFace node per
  // panel (each panel here has at most one bar, so node count and bar count
  // coincide).
  const faces = facet.children.map((embed) =>
    embed.children.find((node) => node.component === "Cartesian")?.children
      .filter((node) => node.component === "ChunkedFace") ?? []
  );
  assertEquals(faces.map((nodes) => nodes.length), [0, 1, 1, 0]);
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

  // gggplot-tzc.4: each panel's bars pack into a single ChunkedFace node —
  // count loops (topology chunks) within it, not sibling nodes.
  const panels = facet.children.map((embed) =>
    embed.children.find((c) => c.component === "Cartesian")?.children.filter((
      c,
    ) => c.component === "ChunkedFace") ?? []
  );
  // panel "a": cat=x (x2), cat=y (x1) -> 2 bars; panel "b": cat=x (x1), cat=y (x1) -> 2 bars
  assertEquals(panels[0].flatMap((node) => decodeChunks(node)).length, 2);
  assertEquals(panels[1].flatMap((node) => decodeChunks(node)).length, 2);
});

Deno.test("emitSource inlines a standalone FacetGrid definition for faceted specs", () => {
  const facetData = { grp: ["a", "b"], x: [1, 2], y: [10, 20] };
  const spec = ggplot(facetData, { x: "x", y: "y" }).add(
    geomPoint(),
    facetWrap(["grp"]),
  ).build();
  const src = emitSource(compile(spec), "FacetedChart");

  assertStringIncludes(src, "<FacetGrid");
  assertStringIncludes(src, "<FacetPanel>");
  // Inline defs carry `: any` param annotations so the generated module
  // type-checks standalone (see the generated-module deno-check test below).
  assertStringIncludes(src, "const FacetPanel = ({ children }: any)");
  assertStringIncludes(src, "const FacetGrid = (");
  // gggplot-q24 drift tripwire: the emitted module embeds the COMPILED
  // facetCellLayouts function itself, so the emitted grid math is the live
  // backend's grid math by construction — any edit to facet_layout.ts flows
  // into emitted source automatically, and the emitted FacetGrid consumes it
  // the same way render/GGPlot.tsx's FacetGrid does (layouts[i].panel).
  assertStringIncludes(src, facetCellLayouts.toString());
  assertStringIncludes(src, "facetCellLayouts(width, height, nrow, ncol, gap, stripHeight)");
  assertStringIncludes(src, "const panel = layouts[i].panel;");
  assertStringIncludes(
    src,
    "LayoutContext, MatrixContext, TransformContext",
  );
  assertStringIncludes(
    src,
    "createElement, Fragment, provide, useAwait, useContext",
  );
  assertStringIncludes(src, "const EmittedFontHost =");
  assertStringIncludes(src, "({ fontResources }: any = {})");
});

// gggplot-tzc.6: the emit backend serializes FlatTensor/MarkTopology props as
// executable Float32Array/Uint32Array literals and inlines standalone
// ChunkedLine/ChunkedFace definitions (mirroring render/chunked_line.tsx +
// render/chunked_face.tsx) while plain guide/annotation nodes stay plot
// components. These three tests are the bead's acceptance surface.

Deno.test("gggplot-tzc.6 guide-vs-mark: an hline annotation emits a plot Line while a grouped geom line emits the inlined ChunkedLine", () => {
  const spec = ggplot(
    { x: [0, 1, 0, 1], y: [10, 20, 15, 25], grp: ["a", "a", "b", "b"] },
    { x: "x", y: "y", color: "grp" },
  ).add(geomLine(), geomHline({ yintercept: 18 })).build();
  const src = emitSource(compile(spec), "GuideVsMark");

  // The data-driven grouped line mark selects the inlined ChunkedLine, which is
  // DEFINED in-module (not a plot import) and pulls its hooks from workbench.
  assertStringIncludes(src, "<ChunkedLine");
  assertStringIncludes(src, "const ChunkedLine = (props: any)");
  assertStringIncludes(src, 'import * as Workbench from "@use-gpu/workbench"');

  // The hline reference annotation stays a plain plot Line, bound from plot.
  assertStringIncludes(src, "<Line ");
  assertStringIncludes(src, 'import * as Plot from "@use-gpu/plot"');
  const plotBinding = src.split("\n").find((line) =>
    line.startsWith("const {") && line.includes("} = Plot")
  )!;
  assertEquals(/\bLine\b/.test(plotBinding), true);
  assertEquals(plotBinding.includes("ChunkedLine"), false);
});

Deno.test("gggplot-tzc.6 mark emission: a grouped-line + stacked-bar spec emits exactly one ChunkedLine and one ChunkedFace with typed-array literals, no nested arrays in marks, and no owners", () => {
  const spec = ggplot(
    { cat: ["a", "a", "b", "b"], y: [3, 5, 2, 4], grp: ["p", "q", "p", "q"] },
    { x: "cat", y: "y", fill: "grp", color: "grp", group: "grp" },
  ).add(geomCol(), geomLine()).build();
  const tree = compile(spec);

  assertEquals(findNodes(tree, "ChunkedLine").length, 1);
  assertEquals(findNodes(tree, "ChunkedFace").length, 1);

  const src = emitSource(tree, "GroupedLineStackedBar");
  assertEquals((src.match(/<ChunkedLine\b/g) ?? []).length, 1);
  assertEquals((src.match(/<ChunkedFace\b/g) ?? []).length, 1);

  // Flat tensors serialize to executable typed-array literals — no base64.
  assertStringIncludes(src, "new Float32Array(");
  assertStringIncludes(src, "new Uint32Array(");

  // No compiler-internal owners key ever reaches the emitted source.
  assertEquals(src.includes("owners"), false);

  // Each mark node serializes a FlatTensor 'positions', never a nested
  // [[x,y],...] array (guide/legend nodes may still use nested arrays; the
  // marks must not).
  for (const tag of ["<ChunkedLine", "<ChunkedFace"]) {
    const markLine = src.split("\n").find((line) => line.includes(tag))!;
    assertStringIncludes(markLine, "positions={{ array: new Float32Array(");
    assertEquals(markLine.includes("[["), false);
  }
});

Deno.test("gggplot-tzc.6 generated module type-checks: emit to a temp .tsx and deno check it clean", async () => {
  const spec = ggplot(
    { cat: ["a", "a", "b", "b"], y: [3, 5, 2, 4], grp: ["p", "q", "p", "q"] },
    { x: "cat", y: "y", fill: "grp", color: "grp", group: "grp" },
  ).add(geomCol(), geomLine(), geomHline({ yintercept: 3 })).build();
  const src = emitSource(compile(spec), "GeneratedChart");

  // Write inside packages/core so the emitted module's bare @use-gpu/* imports
  // resolve through this package's deno.json import map, then type-check it as
  // its own standalone module — the inlined Chunked* definitions and every
  // FlatTensor/MarkTopology literal must compile.
  const packageDir = new URL("../", import.meta.url).pathname;
  const outPath = await Deno.makeTempFile({
    dir: packageDir,
    prefix: "gen_module_",
    suffix: ".tsx",
  });
  try {
    await Deno.writeTextFile(outPath, src);
    const { code, stderr } = await new Deno.Command("deno", {
      args: ["check", outPath],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(
      code,
      0,
      `deno check on the generated module failed:\n${
        new TextDecoder().decode(stderr)
      }`,
    );
  } finally {
    await Deno.remove(outPath);
  }
});

Deno.test("simple geom aliases expose their exact IR defaults", () => {
  const functionFn = (x: number) => x * x;
  const spec = ggplot(data, { x: "x", y: "y" }).add(
    geomFreqpoly(),
    geomBlank(),
    geomStep(),
    geomCurve(),
    geomSpoke(),
    geomRug(),
    geomFunction(functionFn),
    geomJitter(),
  ).build();
  assertEquals(
    spec.layers.map(({ geom, stat, position }) => ({ geom, stat, position })),
    [
      { geom: "line", stat: "bin", position: "identity" },
      { geom: "blank", stat: "identity", position: "identity" },
      { geom: "step", stat: "identity", position: "identity" },
      { geom: "curve", stat: "identity", position: "identity" },
      { geom: "spoke", stat: "identity", position: "identity" },
      { geom: "rug", stat: "identity", position: "identity" },
      { geom: "line", stat: "function", position: "identity" },
      { geom: "point", stat: "identity", position: "jitter" },
    ],
  );
  assertEquals(spec.layers[6].params.fun, functionFn);
  assertEquals(spec.layers[7].params, {});
  assertEquals(
    ggplot(data, { x: "x", y: "y" }).add(statSum()).build().layers[0].stat,
    "sum",
  );
});

Deno.test("geomBlank trains scales but emits no marks or legend keys", () => {
  const spec = ggplot({ x: [0], y: [0] }, { x: "x", y: "y" }).add(
    geomPoint(),
    geomBlank({
      data: { bx: [10], by: [20] },
      mapping: { x: "bx", y: "by" },
      inheritAes: false,
    }),
  ).build();
  const tree = compile(spec);
  assertEquals(plotPanel(tree).props.range, [[0, 10], [0, 20]]);
  assertEquals(findNodes(tree, "Point").length, 1);
  assertEquals(findNodes(tree, "Line").length, 0);
  assertEquals(findNodes(tree, "Polygon").length, 0);
});

Deno.test("geomStep expands sorted groups for hv, vh, and mid directions", () => {
  const stepData = { x: [2, 0, 1], y: [20, 0, 10] };
  // gggplot-tzc.3: geom_step lowers via lowerLine → one ChunkedLine node,
  // one chunk (single group).
  const positions = (direction: "hv" | "vh" | "mid") => {
    const tree = compile(
      ggplot(stepData, { x: "x", y: "y" }).add(geomStep({ direction }))
        .build(),
    );
    const stepNode = findNodes(tree, "ChunkedLine")[0];
    return stepNode ? decodeChunks(stepNode)[0] : undefined;
  };
  assertEquals(positions("hv"), [[0, 0], [1, 0], [1, 10], [2, 10], [2, 20]]);
  assertEquals(positions("vh"), [[0, 0], [0, 10], [1, 10], [1, 20], [2, 20]]);
  assertEquals(positions("mid"), [
    [0, 0],
    [0.5, 0],
    [0.5, 10],
    [1, 10],
    [1.5, 10],
    [1.5, 20],
    [2, 20],
  ]);
  assertThrows(
    () =>
      compile(
        ggplot(stepData, { x: "x", y: "y" }).add(
          geomStep({ direction: "diagonal" }),
        ).build(),
      ),
    TypeError,
    "direction",
  );
});

Deno.test("statConnect emits deterministic grouped sigmoid vertices", () => {
  const data = {
    round: [1, 2, 1, 2],
    rank: [3, 1, 1, 2],
    team: ["a", "a", "b", "b"],
  };
  const spec = ggplot(data, { x: "round", y: "rank", color: "team" }).add(
    statConnect({ connection: "sigmoid", samples: 4, steepness: 8 }),
  ).build();
  const result = applyStat(spec.layers[0], spec.mapping, spec.data);
  assertEquals(values(result.data, "round"), [
    1,
    1.25,
    1.5,
    1.75,
    2,
    1,
    1.25,
    1.5,
    1.75,
    2,
  ]);
  const ranks = values(result.data, "rank").map(Number);
  assertEquals(ranks[0], 3);
  assertEquals(ranks[2], 2);
  assertEquals(ranks[4], 1);
  assertEquals(values(result.data, "team"), [
    "a",
    "a",
    "a",
    "a",
    "a",
    "b",
    "b",
    "b",
    "b",
    "b",
  ]);
  const tree = compile(spec);
  // gggplot-tzc.3: the two solid teams concat into ONE ChunkedLine node with
  // two chunks (one per team).
  assertEquals(
    findNodes(tree, "ChunkedLine").flatMap((node) => decodeChunks(node)).length,
    2,
  );
  assertStringIncludes(emitSource(tree, "BumpChart"), "<ChunkedLine");

  for (const connection of ["linear", "hv", "vh", "mid"] as const) {
    const layer = ggplot({ x: [0, 1], y: [0, 1] }, { x: "x", y: "y" }).add(
      statConnect({ connection, samples: 2 }),
    ).build().layers[0];
    assertEquals(
      values(
        applyStat(layer, { x: "x", y: "y" }, { x: [0, 1], y: [0, 1] }).data,
        "x",
      ).length > 2,
      true,
    );
  }
  assertThrows(
    () =>
      compile(
        ggplot(data, { x: "round", y: "rank" }).add(
          statConnect({ connection: "arc" }),
        ).build(),
      ),
    TypeError,
    "unsupported connection",
  );
});

Deno.test("geomCurve and geomSpoke lower deterministic endpoint topology", () => {
  const curveTree = compile(
    ggplot(
      { x: [0], y: [0], xend: [2], yend: [0] },
      { x: "x", y: "y", xend: "xend", yend: "yend" },
    ).add(geomCurve()).build(),
  );
  // gggplot-tzc.3: geom_curve packs its tessellated points into one 'Line'
  // node (uniform chunk per row) — decode the chunks back.
  const curve = decodeChunks(findNodes(curveTree, "Line")[0]);
  assertEquals(curve.length, 1);
  assertEquals(curve[0].length, 33);
  assertEquals(curve[0][0], [0, 0]);
  assertEquals(curve[0][32], [2, 0]);
  assertEquals(round([curve[0][16]]), round([[1, 0.5]]));

  const spokeTree = compile(
    ggplot(
      { x: [1], y: [2], angle: [Math.PI / 2], radius: [3] },
      { x: "x", y: "y", angle: "angle", radius: "radius" },
    ).add(geomSpoke()).build(),
  );
  const spoke = decodeChunks(findNodes(spokeTree, "Line")[0]);
  assertEquals(spoke[0][0], [1, 2]);
  assertEquals(Math.round(spoke[0][1][0] * 1e5) / 1e5, 1);
  assertEquals(spoke[0][1][1], 5);
});

Deno.test("geomRug places CSS-pixel ticks on requested panel sides", () => {
  const tree = compile(
    ggplot({ x: [0, 10], y: [0, 20] }, { x: "x", y: "y" }).add(
      geomRug({ sides: "tr", length: 10 }),
    ).build(),
    {
      layout: {
        width: 100,
        height: 100,
        measureText: approximateTextMeasurer,
      },
    },
  );
  // gggplot-tzc.3: geom_rug packs its edge ticks into one 'Line' node (one
  // uniform 2-point chunk per tick).
  const rug = decodeChunks(findNodes(tree, "Line")[0]);
  assertEquals(rug.length, 4);
  assertEquals(rug[0][0], [0, 20]);
  assertEquals(rug[0][1][0], 0);
  assertEquals(rug[2][0], [10, 0]);
  assertEquals(rug[2][1][1], 0);
  assertThrows(
    () =>
      compile(
        ggplot(data, { x: "x", y: "y" }).add(geomRug({ sides: "bb" }))
          .build(),
      ),
    TypeError,
    "sides",
  );
});

Deno.test("freqpoly, function, and jitter aliases compile and emit source", () => {
  const freq = compile(
    ggplot({ x: [0, 0, 1, 2, 2, 2], g: ["a", "a", "a", "b", "b", "b"] }, {
      x: "x",
      color: "g",
    }).add(geomFreqpoly({ bins: 3 })).build(),
  );
  // gggplot-tzc.3: freqpoly/function lower via lowerLine → ChunkedLine; the
  // two solid color groups concat into one node with two chunks.
  assertEquals(
    findNodes(freq, "ChunkedLine").flatMap((node) => decodeChunks(node)).length,
    2,
  );
  const fnTree = compile(
    ggplot({ x: [-1, 1] }, { x: "x" }).add(geomFunction((x) => x * x, { n: 5 }))
      .build(),
  );
  assertEquals(decodeChunks(findNodes(fnTree, "ChunkedLine")[0])[0].length, 5);
  const jitterSpec = ggplot(data, { x: "x", y: "y" }).add(geomJitter()).build();
  assertEquals(findNodes(compile(jitterSpec), "Point").length, 1);
  assertStringIncludes(
    emitSource(compile(jitterSpec), "JitterChart"),
    "<Point",
  );
});

Deno.test("stat_sum aggregates complete tuples with weighted group-local proportions", () => {
  const sumData = ingest({
    x: [1, 1, 1, 2, 2],
    y: [3, 3, 3, 4, 4],
    group: ["a", "a", "b", "a", "a"],
    weight: [0.5, 1.5, 4, 2, Number.NaN],
  });
  const layer = ggplot(sumData, { x: "x", y: "y", color: "group" }).add(
    geomCount({ weight: "weight" }),
  ).build().layers[0];
  const result = applyStat(
    layer,
    { x: "x", y: "y", color: "group", ...layer.mapping },
    sumData,
  );
  assertEquals(values(result.data, "n"), [2, 4, 2]);
  assertEquals(values(result.data, "prop"), [0.5, 1, 0.5]);
  assertEquals(values(result.data, "group"), ["a", "b", "a"]);
  assertEquals(result.mapping.size, "n");
});

Deno.test("geomCount uses area-scaled counts, supports literal size, facets, and source emission", () => {
  const countData = {
    x: [1, 1, 1, 2],
    y: [2, 2, 2, 3],
    panel: ["a", "a", "a", "b"],
  };
  const spec = ggplot(countData, { x: "x", y: "y" }).add(geomCount()).build();
  const point = findNodes(compile(spec), "Point")[0];
  assertScalars(point.props.sizes, [6, 1]);
  assertStringIncludes(emitSource(compile(spec), "CountChart"), "sizes=");

  const literal = compile(
    ggplot(countData, { x: "x", y: "y" }).add(geomCount({ size: 9 })).build(),
  );
  assertEquals(findNodes(literal, "Point")[0].props.size, 9);

  const faceted = compile(
    ggplot(countData, { x: "x", y: "y" }).add(
      geomCount(),
      facetWrap(["panel"]),
    ).build(),
  );
  assertEquals(findNodes(faceted, "Point").length, 3); // two panels plus size legend

  const empty = applyStat(
    ggplot({ x: [], y: [] }, { x: "x", y: "y" }).add(geomCount()).build()
      .layers[0],
    { x: "x", y: "y", size: "n" },
    ingest({ x: [], y: [] }),
  );
  assertEquals(values(empty.data, "n"), []);
});

Deno.test("density2d KDE normalizes, preserves groups, and exposes computed columns", () => {
  const cloud = ingest({
    x: [-1, -0.5, 0, 2, 2.5, 3, Number.NaN],
    y: [-1, 0.2, 0.8, 2, 2.2, 3, 1],
    group: ["a", "a", "a", "b", "b", "b", "a"],
  });
  const layer = ggplot(cloud, { x: "x", y: "y", color: "group" }).add(
    geomDensity2dFilled({ n: 25, h: [0.5, 0.5], breaks: [0.02, 0.08] }),
  ).build().layers[0];
  const result = applyStat(
    layer,
    { x: "x", y: "y", color: "group" },
    cloud,
  );
  const densities = values(result.data, "density") as number[];
  const normalized = values(result.data, "ndensity") as number[];
  const counts = values(result.data, "count") as number[];
  const ns = values(result.data, "n") as number[];
  const groups = values(result.data, "group") as string[];
  assertEquals(Math.max(...normalized), 1);
  assertEquals(new Set(groups), new Set(["a", "b"]));
  assertEquals(new Set(ns), new Set([3]));
  assertEquals(
    counts.every((value, i) => Math.abs(value - 3 * densities[i]) < 1e-12),
    true,
  );
  for (const group of ["a", "b"]) {
    const indices = groups.flatMap((value, i) => value === group ? [i] : []);
    const xs = indices.map((i) => Number(values(result.data, "densityx")[i]));
    const ys = indices.map((i) => Number(values(result.data, "densityy")[i]));
    const dx = (Math.max(...xs) - Math.min(...xs)) / 24;
    const dy = (Math.max(...ys) - Math.min(...ys)) / 24;
    const integral = indices.reduce(
      (sum, i) => sum + densities[i] * dx * dy,
      0,
    );
    assertEquals(Math.abs(integral - 1) < 0.03, true);
  }
});

Deno.test("density2d line/filled constructors contour and reject invalid controls", () => {
  const cloud = { x: [-1, 0, 0.5, 1], y: [0, 1, -0.5, 0.2] };
  const lineTree = compile(
    ggplot(cloud, { x: "x", y: "y" }).add(
      geomDensity2d({ n: 16, bins: 5, contourVar: "count" }),
    ).build(),
  );
  assertEquals(findNodes(lineTree, "Line").length > 0, true);
  const filledTree = compile(
    ggplot(cloud, { x: "x", y: "y" }).add(
      geomDensity2dFilled({ n: 12, bins: 5 }),
    ).build(),
  );
  assertEquals(findNodes(filledTree, "Polygon").length > 0, true);
  assertStringIncludes(emitSource(lineTree, "Density2dChart"), "<Line");
  for (
    const opts of [{ n: 1 }, { h: [0, 1] }, { adjust: [1] }, {
      contourVar: "bad",
    }]
  ) {
    assertThrows(
      () =>
        compile(
          ggplot(cloud, { x: "x", y: "y" }).add(geomDensity2d(opts)).build(),
        ),
      TypeError,
      "density2d",
    );
  }
});

Deno.test("interval family shares orientation-aware stem, cap, box, and point topology", () => {
  const verticalData = { x: [1], y: [3], lo: [1], hi: [5] };
  const vertical = (geom: ReturnType<typeof geomLinerange>) =>
    compile(
      ggplot(verticalData, { x: "x", y: "y", ymin: "lo", ymax: "hi" }).add(geom)
        .build(),
    );
  const linerange = findNodes(vertical(geomLinerange()), "Line").find((node) =>
    node.props.width === 2
  )!;
  // gggplot-tzc.3: interval stems pack into one 'Line' node (uniform 2-point
  // chunks); the literal width stays scalar.
  assertEquals(decodeChunks(linerange), [[[1, 1], [1, 5]]]);
  const pointrange = vertical(geomPointrange({ size: 7 }));
  assertPositions(findNodes(pointrange, "Point")[0].props.positions, [[1, 3]]);
  assertEquals(findNodes(pointrange, "Point")[0].props.size, 7);
  // gggplot-tzc.4: the crossbar box packs into a ChunkedFace node.
  const crossbar = vertical(geomCrossbar({ width: 0.8 }));
  assertChunks(findNodes(crossbar, "ChunkedFace")[0], [[
    [0.6, 1],
    [0.6, 5],
    [1.4, 5],
    [1.4, 1],
  ]]);

  const horizontalData = { y: [2], x: [4], lo: [1], hi: [7] };
  const horizontal = compile(
    ggplot(horizontalData, { y: "y", x: "x", xmin: "lo", xmax: "hi" }).add(
      geomErrorbarh({ width: 1 }),
    ).build(),
  );
  const hline = findNodes(horizontal, "Line")[0];
  assertEquals(decodeChunks(hline), [
    [[7, 1.5], [7, 2.5]],
    [[7, 2], [1, 2]],
    [[1, 1.5], [1, 2.5]],
  ]);
  assertEquals(
    ggplot(horizontalData, { y: "y", xmin: "lo", xmax: "hi" }).add(
      geomErrorbarh(),
    ).build().layers[0].params.orientation,
    "y",
  );
  assertStringIncludes(emitSource(horizontal, "HorizontalIntervals"), "<Line");
});

Deno.test("interval family rejects incomplete and ambiguous orientation mappings", () => {
  assertThrows(
    () =>
      compile(
        ggplot({ x: [1], lo: [0] }, { x: "x", ymin: "lo" }).add(geomLinerange())
          .build(),
      ),
    TypeError,
    "incomplete or ambiguous",
  );
  assertThrows(
    () =>
      compile(
        ggplot(
          { x: [1], y: [2], xmin: [0], xmax: [2], ymin: [1], ymax: [3] },
          {
            x: "x",
            y: "y",
            xmin: "xmin",
            xmax: "xmax",
            ymin: "ymin",
            ymax: "ymax",
          },
        ).add(geomCrossbar()).build(),
      ),
    TypeError,
    "ambiguous",
  );
});

Deno.test("interval family preserves mapped styling, dodge, missing rows, domains, facets, and coord flip", () => {
  const intervalData = {
    x: [1, 1, null],
    y: [2, 3, 4],
    lo: [-5, -2, null],
    hi: [6, 8, 10],
    group: ["a", "b", "a"],
    width: [1, 3, 2],
    panel: ["one", "one", "two"],
  };
  const mapping = {
    x: "x",
    y: "y",
    ymin: "lo",
    ymax: "hi",
    color: "group",
    linetype: "group",
    linewidth: "width",
  } as const;
  const tree = compile(
    ggplot(intervalData, mapping).add(
      geomPointrange({ position: "dodge", dodgeWidth: 0.8, size: 6 }),
    ).build(),
  );
  // gggplot-tzc.3: each dodged group's stems are one 'Line' node with a
  // packed FlatTensor 'positions' + MarkTopology and a literal color/width.
  const intervalLines = findNodes(tree, "Line").filter((node) =>
    node.props.topology !== undefined && node.props.color !== undefined
  );
  assertEquals(intervalLines.length, 2);
  const centers = intervalLines.map((node) => decodeChunks(node)[0][0][0]);
  assertEquals(centers[0] < 1 && centers[1] > 1, true);
  assertEquals(new Set(intervalLines.map((node) => node.props.color)).size, 2);
  assertEquals(new Set(intervalLines.map((node) => node.props.width)).size, 2);
  assertEquals((plotPanel(tree).props.range as number[][])[1], [-5, 10]);

  const facetedFlipped = compile(
    ggplot(intervalData, mapping).add(
      geomLinerange(),
      facetWrap(["panel"]),
      coordFlip(),
    ).build(),
  );
  assertEquals(
    findNodes(facetedFlipped, "Cartesian").every((node) =>
      node.props.axes === "yx"
    ),
    true,
  );
  assertEquals(
    findNodes(facetedFlipped, "Line").some((node) =>
      node.props.topology !== undefined
    ),
    true,
  );
});

Deno.test("stat quantile fits deterministic grouped pinball-optimal endpoints", () => {
  const quantileData = ingest({
    x: [0, 1, 2, 0, 1, 2],
    y: [0, 1, 2, 2, 3, 4],
    group: ["a", "a", "a", "b", "b", "b"],
  });
  const layer = ggplot(quantileData, { x: "x", y: "y", color: "group" }).add(
    geomQuantile({ quantiles: [0.25, 0.5, 0.75] }),
  ).build().layers[0];
  const result = applyStat(
    layer,
    { x: "x", y: "y", color: "group" },
    quantileData,
  );
  assertEquals(values(result.data, "quantile"), [
    0.25,
    0.25,
    0.5,
    0.5,
    0.75,
    0.75,
    0.25,
    0.25,
    0.5,
    0.5,
    0.75,
    0.75,
  ]);
  assertEquals(values(result.data, "quantiley"), [
    0,
    2,
    0,
    2,
    0,
    2,
    2,
    4,
    2,
    4,
    2,
    4,
  ]);
  assertEquals(result.mapping.group, "quantileGroup");
});

Deno.test("geomQuantile handles degenerate x, emits source, and validates V1 contract", () => {
  const degenerate = { x: [1, 1, 1, 1], y: [0, 1, 2, 10] };
  const tree = compile(
    ggplot(degenerate, { x: "x", y: "y" }).add(
      geomQuantile({ quantiles: [0.5] }),
    ).build(),
  );
  // gggplot-tzc.3: geom_quantile lowers via lowerLine → ChunkedLine.
  const fitted = findNodes(tree, "ChunkedLine")[0];
  assertEquals(decodeChunks(fitted), [[[1, 1.5], [1, 1.5]]]);
  assertStringIncludes(emitSource(tree, "QuantileChart"), "<ChunkedLine");
  for (
    const opts of [{ method: "loess" }, { quantiles: [] }, {
      quantiles: [0, 0.5],
    }, { quantiles: [0.7, 0.4] }]
  ) {
    assertThrows(
      () =>
        compile(
          ggplot(degenerate, { x: "x", y: "y" }).add(geomQuantile(opts))
            .build(),
        ),
      TypeError,
    );
  }
  assertThrows(
    () =>
      compile(
        ggplot({ x: [1], y: [2] }, { x: "x", y: "y" }).add(geomQuantile())
          .build(),
      ),
    TypeError,
    "two finite rows",
  );
});

Deno.test("stat_smooth loess follows local quadratic curvature and preserves groups", () => {
  const curved = ingest({
    x: [-2, -1, 0, 1, 2, -2, -1, 0, 1, 2],
    y: [4, 1, 0, 1, 4, 5, 2, 1, 2, 5],
    group: ["a", "a", "a", "a", "a", "b", "b", "b", "b", "b"],
  });
  const layer = ggplot(curved, { x: "x", y: "y", color: "group" }).add(
    geomSmooth({
      method: "loess",
      span: 1,
      n: 5,
      robustIterations: 0,
      se: false,
    }),
  ).build().layers[0];
  const result = applyStat(layer, { x: "x", y: "y", color: "group" }, curved);
  assertEquals(
    values(result.data, "y").map((value) =>
      Math.round(Number(value) * 1e9) / 1e9
    ),
    [4, 1, 0, 1, 4, 5, 2, 1, 2, 5],
  );
  assertEquals(values(result.data, "group"), [
    "a",
    "a",
    "a",
    "a",
    "a",
    "b",
    "b",
    "b",
    "b",
    "b",
  ]);
  assertEquals(result.mapping.ymin, undefined);
});

Deno.test("stat_smooth glm fits bounded logistic probabilities and validates capabilities", () => {
  const binary = { x: [-2, -2, 0, 0, 2, 2], y: [0, 1, 0, 1, 0, 1] };
  const spec = ggplot(binary, { x: "x", y: "y" }).add(
    geomSmooth({ method: "glm", family: "binomial", link: "logit", n: 5 }),
  ).build();
  const tree = compile(spec);
  // gggplot-tzc.3: the fitted glm trend line is a ChunkedLine.
  const smoothLine = findNodes(tree, "ChunkedLine")[0];
  assertEquals(
    decodeChunks(smoothLine)[0].map(([, y]) => y),
    [0.5, 0.5, 0.5, 0.5, 0.5],
  );
  // gggplot-tzc.4: the SE ribbon packs into a ChunkedFace node.
  assertEquals(findNodes(tree, "ChunkedFace").length > 0, true);
  assertStringIncludes(emitSource(tree, "GlmSmooth"), "<ChunkedLine");

  const invalid = [
    { method: "gam" },
    { method: "glm", family: "gaussian" },
    { method: "glm", link: "probit" },
    { method: "loess", span: 0 },
    { method: "lm", formula: "y~poly(x,2)" },
  ];
  for (const opts of invalid) {
    assertThrows(
      () =>
        compile(
          ggplot(binary, { x: "x", y: "y" }).add(geomSmooth(opts)).build(),
        ),
      TypeError,
    );
  }
  assertThrows(
    () =>
      compile(
        ggplot({ x: [0, 1, 2], y: [0, 0.5, 1] }, { x: "x", y: "y" }).add(
          geomSmooth({ method: "glm" }),
        ).build(),
      ),
    TypeError,
    "0 or 1",
  );
});

Deno.test("geomLabel measures padded multiline boxes and preserves box-border-text z order", () => {
  const calls: unknown[][] = [];
  const measure = (
    text: string,
    size: number,
    family?: string,
    weight?: number | string,
    style?: string,
  ) => {
    calls.push([text, size, family, weight, style]);
    return { width: text.length * 10, height: 12 };
  };
  const spec = ggplot(
    { x: [5], y: [5], label: ["ab\nc"], family: ["Demo"], face: ["bold"] },
    { x: "x", y: "y", label: "label", family: "family", fontface: "face" },
  ).add(geomLabel({ size: 20, labelPadding: 4, labelR: 3, borderWidth: 2 }))
    .build();
  const tree = compile(spec, {
    layout: { width: 400, height: 400, measureText: measure },
  });
  const panel = plotPanel(tree);
  // gggplot-cct: the background box packs into a ChunkedFace node.
  const boxIndex = panel.children.findIndex((node) =>
    node.component === "ChunkedFace" && node.props.radius === 3
  );
  const borderIndex = panel.children.findIndex((node) =>
    node.component === "Line" && node.props.zBias === 1
  );
  const textIndex = panel.children.findIndex((node) =>
    node.component === "Label" && node.props.zBias === 2
  );
  assertEquals(
    boxIndex >= 0 && boxIndex < borderIndex && borderIndex < textIndex,
    true,
  );
  const box = panel.children[boxIndex];
  assertEquals(decodeChunks(box)[0].length, 16);
  assertEquals(decodeChunkColors(box)[0], "#ffffff");
  assertEquals(panel.children[borderIndex].props.width, 2);
  assertEquals(
    calls.some((call) =>
      call[0] === "ab" && call[1] === 20 && call[2] === "Demo" &&
      call[3] === "bold"
    ),
    true,
  );
  assertEquals(calls.some((call) => call[0] === "c"), true);
});

Deno.test("geomLabel rotates boxes, aligns mapped fills after missing rows, and leaves geomText unchanged", () => {
  const labelData = {
    x: [0, 1, 2],
    y: [0, 1, 2],
    label: ["one", null, "three"],
    fill: ["a", "b", "c"],
  };
  const compileAngle = (angle: number) =>
    compile(
      ggplot(labelData, { x: "x", y: "y", label: "label", fill: "fill" }).add(
        geomLabel({ angle, alpha: 0.6, borderColor: "#111111" }),
      ).build(),
      {
        layout: {
          width: 400,
          height: 400,
          measureText: (text, size) => ({
            width: text.length * size,
            height: size,
          }),
        },
      },
    );
  // gggplot-cct: the background box packs into a ChunkedFace node.
  const unrotated = findNodes(compileAngle(0), "ChunkedFace").find((node) =>
    node.props.radius === 2
  )!;
  const rotated45 = findNodes(compileAngle(45), "ChunkedFace").find((node) =>
    node.props.radius === 2
  )!;
  const rotated90 = findNodes(compileAngle(90), "ChunkedFace").find((node) =>
    node.props.radius === 2
  )!;
  assertEquals(decodeChunks(unrotated).length, 2);
  assertEquals(decodeChunkColors(unrotated).length, 2);
  assertEquals(unrotated.props.opacity, 0.6);
  assertEquals(rotated45.props.positions === unrotated.props.positions, false);
  assertEquals(rotated90.props.positions === unrotated.props.positions, false);
  const labels = findNodes(compileAngle(45), "Label").filter((node) =>
    node.props.angle === 45
  );
  assertEquals(labels.flatMap((node) => node.props.labels as string[]), [
    "one",
    "three",
  ]);

  const textTree = compile(
    ggplot({ x: [0], y: [0], label: ["plain"] }, {
      x: "x",
      y: "y",
      label: "label",
    }).add(geomText()).build(),
  );
  assertEquals(
    findNodes(textTree, "ChunkedFace").some((node) =>
      node.props.radius !== undefined
    ),
    false,
  );
  assertEquals(
    findNodes(textTree, "Label").some((node) =>
      (node.props.labels as string[] | undefined)?.[0] === "plain"
    ),
    true,
  );
  assertStringIncludes(
    emitSource(compileAngle(45), "LabelChart"),
    "<ChunkedFace",
  );
});

Deno.test("statEcdf collapses ties, filters non-finite values, groups, and pads semantically", () => {
  const ecdfData = ingest({
    x: [2, 1, 1, Number.NaN, 3, 3, 4],
    group: ["a", "a", "a", "a", "b", "b", "b"],
  });
  const layer =
    ggplot(ecdfData, { x: "x", color: "group" }).add(statEcdf()).build()
      .layers[0];
  const result = applyStat(layer, { x: "x", color: "group" }, ecdfData);
  assertEquals(values(result.data, "x"), [
    -Infinity,
    1,
    2,
    Infinity,
    -Infinity,
    3,
    4,
    Infinity,
  ]);
  assertEquals(values(result.data, "ecdf"), [0, 2 / 3, 1, 1, 0, 2 / 3, 1, 1]);
  assertEquals(values(result.data, "group"), [
    "a",
    "a",
    "a",
    "a",
    "b",
    "b",
    "b",
    "b",
  ]);
  const unpadded = applyStat(
    ggplot(ecdfData, { x: "x" }).add(statEcdf({ pad: false })).build()
      .layers[0],
    { x: "x" },
    ecdfData,
  );
  assertEquals(values(unpadded.data, "x"), [1, 2, 3, 4]);
  assertThrows(
    () =>
      applyStat(
        ggplot(ecdfData, { x: "x" }).add(statEcdf({ weight: "w" })).build()
          .layers[0],
        { x: "x" },
        ecdfData,
      ),
    TypeError,
    "does not support weights",
  );
});

Deno.test("geomEcdf clips padded endpoints to finite panel domains and emits monotone steps", () => {
  const spec = ggplot({ x: [1, 1, 2, 4] }, { x: "x" }).add(geomEcdf()).build();
  const tree = compile(spec);
  assertEquals(plotPanel(tree).props.range, [[1, 4], [0, 1]]);
  // gggplot-tzc.3: geom_ecdf lowers via lowerLine (step) → ChunkedLine.
  const line = findNodes(tree, "ChunkedLine")[0];
  const positions = decodeChunks(line)[0];
  assertEquals(
    positions.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)),
    true,
  );
  assertEquals(positions.at(-1), [4, 1]);
  assertEquals(
    positions.every((position, index) =>
      index === 0 || position[1] >= positions[index - 1][1]
    ),
    true,
  );
  assertStringIncludes(emitSource(tree, "EcdfChart"), "<ChunkedLine");
});

Deno.test("statUnique retains stable first exact rows and runs independently in facets", () => {
  const uniqueData = ingest({
    x: [1, 1, 1, 2, 2],
    y: [3, 3, 4, null, null],
    facet: ["a", "a", "a", "b", "b"],
  });
  const layer =
    ggplot(uniqueData, { x: "x", y: "y" }).add(statUnique()).build().layers[0];
  const result = applyStat(layer, { x: "x", y: "y" }, uniqueData);
  assertEquals(values(result.data, "x"), [1, 1, 2]);
  assertEquals(values(result.data, "y"), [3, 4, null]);
  assertEquals(result.mapping, { x: "x", y: "y" });
  const faceted = compile(
    ggplot({ x: [1, 1, 1, 1], y: [2, 2, 2, 2], facet: ["a", "a", "b", "b"] }, {
      x: "x",
      y: "y",
    })
      .add(statUnique(), facetWrap(["facet"])).build(),
  );
  assertEquals(
    findNodes(faceted, "Point").filter((node) => node.props.size === 5).length,
    2,
  );
});

Deno.test("geomWaffle expands weighted groups into core tiles with ordinary fill guides", () => {
  const waffleData = {
    status: ["resolved", "progress", "blocked", "new"],
    count: [58, 27, 9, 6],
  };
  const spec = ggplot(waffleData, { fill: "status" }).add(
    geomWaffle({ weight: "count", rows: 10, maxCells: 100 }),
  ).build();
  const result = applyStat(spec.layers[0], spec.mapping, spec.data);
  assertEquals(values(result.data, "waffleX").slice(0, 12), [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
  ]);
  assertEquals(values(result.data, "waffleY").slice(0, 12), [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    0,
    1,
  ]);
  assertEquals(values(result.data, "status").length, 100);
  assertEquals(values(result.data, "status").slice(56, 60), [
    "resolved",
    "resolved",
    "progress",
    "progress",
  ]);
  assertEquals(result.mapping.x, "waffleX");
  assertEquals(result.mapping.y, "waffleY");

  const tree = compile(spec);
  // gggplot-tzc.4: geomWaffle lowers via geom "tile" → lowerTile, whose
  // cells pack into a single ChunkedFace node.
  const waffleFace = findNodes(tree, "ChunkedFace").filter((node) =>
    !node.props.guideKind
  )[0];
  const tiles = decodeChunks(waffleFace).filter((loop) => loop.length === 4);
  assertEquals(tiles.length, 100);
  assertEquals(
    new Set(decodeChunkColors(waffleFace)).size,
    4,
  );
  assertStringIncludes(emitSource(tree, "WaffleChart"), "<ChunkedFace");
});

Deno.test("statWaffle supports unit rows, panel isolation, and bounded validation", () => {
  const unitSpec = ggplot({ group: ["a", "a", "b"] }, { fill: "group" })
    .add(statWaffle({ rows: 2 })).build();
  const unit = applyStat(unitSpec.layers[0], unitSpec.mapping, unitSpec.data);
  assertEquals(values(unit.data, "waffleX"), [0, 0, 1]);
  assertEquals(values(unit.data, "waffleY"), [0, 1, 0]);

  const faceted = compile(
    ggplot({ facet: ["a", "b"], count: [2, 1] }, {})
      .add(
        geomWaffle({ weight: "count", rows: 10 }),
        facetWrap(["facet"]),
      ).build(),
  );
  // gggplot-tzc.4: each panel's waffle cells pack into a single ChunkedFace
  // node (one loop per cell) — count nodes here since each panel has
  // exactly one ChunkedFace node regardless of its cell count.
  assertEquals(
    facetGridNode(faceted).children.slice(0, 2).map((embed) =>
      embed.children.find((node) => node.component === "Cartesian")?.children
        .filter((node) =>
          node.component === "ChunkedFace" && !node.props.guideKind
        )
        .length ?? 0
    ),
    [1, 1],
  );
  for (const count of [2, 1]) {
    const panel = ggplot({ count: [count] }, {}).add(
      geomWaffle({ weight: "count", rows: 10 }),
    ).build();
    const result = applyStat(panel.layers[0], panel.mapping, panel.data);
    assertEquals(values(result.data, "waffleX"), Array(count).fill(0));
    assertEquals(
      values(result.data, "waffleY"),
      Array.from({ length: count }, (_, index) => index),
    );
  }

  const run = (count: number, opts: Record<string, unknown> = {}) => {
    const spec = ggplot({ count: [count] }, {}).add(
      geomWaffle({ weight: "count", ...opts }),
    ).build();
    return () => applyStat(spec.layers[0], spec.mapping, spec.data);
  };
  assertThrows(run(-1), TypeError, "non-negative");
  assertThrows(run(1.5), TypeError, "integers");
  assertThrows(run(11, { maxCells: 10 }), RangeError, "exceeds");
  assertThrows(run(1, { rows: 0 }), TypeError, "positive integer");
  assertThrows(run(1, { direction: "row" }), TypeError, "direction");
  assertEquals(values(run(0)().data, "waffleX"), []);
});

// ---------------------------------------------------------------------------
// gggplot-tzc.4 acceptance checks: exactly one ChunkedFace node per layer for
// a stacked multi-group bar layer, a mandatory no-owners-on-RenderTree walk
// covering every converted face family, and confirmation that no nested
// mark-position 'Polygon' node remains in any converted family.
// ---------------------------------------------------------------------------

Deno.test("stacked 3-group geom_col lowers to exactly one ChunkedFace node per layer", () => {
  const spec = ggplot({
    x: ["a", "a", "a", "b", "b", "b"],
    y: [1, 2, 3, 4, 5, 6],
    grp: ["p", "q", "r", "p", "q", "r"],
  }, { x: "x", y: "y", fill: "grp" }).add(geomCol()).build();
  const tree = compile(spec);

  const faces = findNodes(tree, "ChunkedFace").filter((n) =>
    !n.props.guideKind
  );
  assertEquals(faces.length, 1);
  // 2 x-positions x 3 stacked groups = 6 bar loops in the one node.
  assertEquals(decodeChunks(faces[0]).length, 6);
});

/** Recursively collects every RenderNode in a tree, including the root. */
function allNodes(n: RenderNode): RenderNode[] {
  return [n, ...n.children.flatMap(allNodes)];
}

Deno.test("no RenderTree node ever carries a compiler-internal owners field, across every converted face family", () => {
  const specs = [
    // bar/col
    ggplot({ x: ["a", "b"], y: [1, 2] }, { x: "x", y: "y" }).add(geomCol())
      .build(),
    // tile
    ggplot({ x: [0, 1], y: [0, 1] }, { x: "x", y: "y" }).add(geomTile())
      .build(),
    // rect (annotate)
    ggplot(data, { x: "x", y: "y" }).add(
      geomPoint(),
      annotate("rect", { xmin: 0, xmax: 1, ymin: 10, ymax: 20 }),
    ).build(),
    // area/ribbon
    ggplot({ x: [0, 1, 2], y: [1, 2, 3] }, { x: "x", y: "y" }).add(geomArea())
      .build(),
    // polygon
    ggplot({ x: [0, 1, 0], y: [0, 0, 1] }, { x: "x", y: "y" }).add(
      geomPolygon(),
    ).build(),
    // violin
    ggplot({
      group: ["a", "a", "a", "b", "b", "b"],
      value: [0, 1, 2, 10, 11, 12],
    }, { x: "group", y: "value", fill: "group" }).add(geomViolin({ n: 8 }))
      .build(),
    // boxplot
    ggplot({
      x: [0],
      lo: [2],
      mid: [5],
      up: [8],
      ymin: [0],
      ymax: [10],
    }, { x: "x", lower: "lo", middle: "mid", upper: "up", ymin: "ymin", ymax: "ymax" })
      .add(geomBoxplot()).build(),
    // errorbar/crossbar box
    ggplot({ x: [1], y: [3], lo: [1], hi: [5] }, {
      x: "x",
      y: "y",
      ymin: "lo",
      ymax: "hi",
    }).add(geomCrossbar({ width: 0.8 })).build(),
    // hex
    ggplot({ x: [0, 0.1, 0.9, 1], y: [0, 0.1, 0.9, 1] }, { x: "x", y: "y" })
      .add(geomHex({ bins: 2 })).build(),
    // smooth SE ribbon
    ggplot({ x: [0, 1, 2, 3, 4], y: [1, 3, 5, 7, 9] }, { x: "x", y: "y" }).add(
      geomSmooth({ n: 5 }),
    ).build(),
    // label box (gggplot-cct)
    ggplot({ x: [0], y: [0], label: ["hi"] }, { x: "x", y: "y", label: "label" })
      .add(geomLabel()).build(),
  ];

  for (const spec of specs) {
    const tree = compile(spec);
    for (const node of allNodes(tree)) {
      assertEquals(
        "owners" in node.props,
        false,
        `unexpected 'owners' prop on a ${node.component} RenderTree node`,
      );
    }
  }
});

Deno.test("converted face families emit no nested-Polygon mark nodes", () => {
  const specs: [string, RenderNode][] = [
    ["bar/col", compile(
      ggplot({ x: ["a", "b"], y: [1, 2] }, { x: "x", y: "y" }).add(geomCol())
        .build(),
    )],
    ["tile", compile(
      ggplot({ x: [0, 1], y: [0, 1] }, { x: "x", y: "y" }).add(geomTile())
        .build(),
    )],
    ["area", compile(
      ggplot({ x: [0, 1, 2], y: [1, 2, 3] }, { x: "x", y: "y" }).add(geomArea())
        .build(),
    )],
    ["polygon", compile(
      ggplot({ x: [0, 1, 0], y: [0, 0, 1] }, { x: "x", y: "y" }).add(
        geomPolygon(),
      ).build(),
    )],
    ["boxplot", compile(
      ggplot({
        x: [0],
        lo: [2],
        mid: [5],
        up: [8],
        ymin: [0],
        ymax: [10],
      }, {
        x: "x",
        lower: "lo",
        middle: "mid",
        upper: "up",
        ymin: "ymin",
        ymax: "ymax",
      }).add(geomBoxplot()).build(),
    )],
    ["hex", compile(
      ggplot({ x: [0, 0.1, 0.9, 1], y: [0, 0.1, 0.9, 1] }, { x: "x", y: "y" })
        .add(geomHex({ bins: 2 })).build(),
    )],
    ["label", compile(
      ggplot({ x: [0], y: [0], label: ["hi"] }, {
        x: "x",
        y: "y",
        label: "label",
      }).add(geomLabel()).build(),
    )],
  ];
  for (const [label, tree] of specs) {
    const marks = findNodes(tree, "Polygon").filter((n) => !n.props.guideKind);
    assertEquals(marks.length, 0, `${label} should not emit a mark 'Polygon' node`);
  }
});
