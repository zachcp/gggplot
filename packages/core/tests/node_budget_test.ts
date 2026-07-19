// Tests for gggplot-tzc.8's NODE-BUDGET rule (epic acceptance #3): one mark
// node per renderer-compatible style batch per layer. Sanctioned exceptions,
// per the epic and tzc.3/tzc.4's own inline comments, are ONLY:
//   - per-shape Point splits (geom/point.ts's `if (shapes) { ... }` branch)
//   - per-dash ChunkedLine splits (geom/line.ts's packChunkedLineNodes)
// plus two pre-existing, deliberate multi-node layer outputs that are NOT a
// violation of "one node per style batch" (each part is legitimately a
// different style batch, not an over-split of the same one): geom_boxplot's
// median/whisker Line alongside its box ChunkedFace, and geom_label's
// background ChunkedFace + border Line alongside geom_text's own Label glyph
// nodes. gggplot-cct converted both to FlatTensor positions (see
// nested_array_tripwire_test.ts, which now has no remaining exemptions
// either) — the node-COUNT shape here was never in question, only the
// nested-array positions, and that gap is now closed.
//
// Two complementary strategies:
//  1. Dedicated single-layer specs with KNOWN expected node counts (the
//     RenderTree has no explicit per-layer boundary marker — marks from every
//     layer in a compile() call concatenate into one flat list per panel —
//     so exact-count assertions need a spec whose layer count/composition is
//     controlled here, not inferred from an arbitrary multi-layer fixture).
//  2. A sweep over the SAME spec-building functions capture_geom_fixtures.ts
//     uses for the checked-in fixture set ("the fixture spec set"), asserting
//     only the closed set of expected mark component names ever appears.
import { assertEquals } from "@std/assert";
import {
  aes,
  annotate,
  geomArea,
  geomBar,
  geomBoxplot,
  geomCol,
  geomCurve,
  geomErrorbar,
  geomHex,
  geomLine,
  geomPoint,
  geomPolygon,
  geomRibbon,
  geomRug,
  geomSmooth,
  geomSpoke,
  geomStep,
  geomTile,
  geomViolin,
  ggplot,
} from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";
import { cases, residentCases } from "../../../scripts/capture_geom_fixtures.ts";

const MARK_COMPONENTS = new Set<RenderNode["component"]>([
  "Point",
  "ChunkedLine",
  "ChunkedFace",
  // Legacy/not-yet-converted mark component names that still legitimately
  // appear on RenderTree nodes today (guides ALSO use Line/Polygon, so this
  // set alone can't distinguish guide vs mark use — see the per-family tests
  // below for that; this list is only used by the fixture-set sweep to catch
  // an ENTIRELY unexpected component name appearing on a mark-shaped node).
  "Line",
  "Polygon",
  "Label",
]);

function findAllRaw(
  tree: RenderNode,
  component: RenderNode["component"],
): RenderNode[] {
  return [
    ...(tree.component === component ? [tree] : []),
    ...tree.children.flatMap((child) => findAllRaw(child, component)),
  ];
}

/**
 * Legend swatches (compile/guides.ts's legendNodes) deliberately reuse the
 * SAME component names as marks (Point/Line/Polygon) for their key glyphs,
 * but live as SIBLINGS of the panel's Cartesian/Polar node at the outer
 * Embedded level (see compile/mod.ts's non-faceted return), never nested
 * inside it. The node-budget rule is about MARK nodes (one per layer's own
 * style batch) — legend/guide swatches aren't marks and aren't subject to
 * it, so this scopes every search to inside the Cartesian/Polar view
 * node(s) only, the same scoping nested_array_tripwire_test.ts uses for the
 * same reason.
 */
function findAll(tree: RenderNode, component: RenderNode["component"]): RenderNode[] {
  const panels = [
    ...findAllRaw(tree, "Cartesian"),
    ...findAllRaw(tree, "Polar"),
  ];
  return panels.flatMap((panel) => findAllRaw(panel, component));
}

function countBy(
  tree: RenderNode,
  predicate: (n: RenderNode) => boolean,
): number {
  return (predicate(tree) ? 1 : 0) +
    tree.children.reduce((sum, child) => sum + countBy(child, predicate), 0);
}

// ---------------------------------------------------------------------------
// 1. One node per layer — the default rule, per convertible geom family.
// ---------------------------------------------------------------------------

Deno.test("node budget: single geom_point layer (no shape mapping) is exactly 1 Point node", () => {
  const spec = ggplot({ x: [1, 2, 3], y: [3, 1, 2] }, aes({ x: "x", y: "y" }))
    .add(geomPoint()).build();
  const tree = compile(spec);
  assertEquals(findAll(tree, "Point").length, 1);
});

Deno.test("node budget: single grouped geom_line layer (no linetype mapping) is exactly 1 ChunkedLine node", () => {
  const spec = ggplot(
    { x: [1, 2, 1, 2], y: [1, 2, 3, 4], g: ["a", "a", "b", "b"] },
    aes({ x: "x", y: "y", color: "g" }),
  ).add(geomLine()).build();
  const tree = compile(spec);
  // Grouping by color (uniform dash across groups) must NOT split the node —
  // color is a per-vertex tensor attribute, not a renderer-incompatible
  // style trait. Multiple groups pack into ONE ChunkedLine via concatPacked.
  assertEquals(findAll(tree, "ChunkedLine").length, 1);
});

Deno.test("node budget: single geom_bar layer, grouped by fill, is exactly 1 ChunkedFace node", () => {
  const spec = ggplot(
    { cls: ["a", "a", "b", "b"], drv: ["x", "y", "x", "y"] },
    aes({ x: "cls", fill: "drv" }),
  ).add(geomBar()).build();
  const tree = compile(spec);
  assertEquals(findAll(tree, "ChunkedFace").length, 1);
});

Deno.test("node budget: single geom_col layer is exactly 1 ChunkedFace node", () => {
  const spec = ggplot({ cls: ["a", "b", "c"], n: [3, 5, 2] }, aes({ x: "cls", y: "n" }))
    .add(geomCol()).build();
  assertEquals(findAll(compile(spec), "ChunkedFace").length, 1);
});

Deno.test("node budget: single geom_area layer (multi-group, position stack) is exactly 1 ChunkedFace node", () => {
  const spec = ggplot(
    { x: [1, 2, 1, 2], y: [1, 2, 3, 4], g: ["a", "a", "b", "b"] },
    aes({ x: "x", y: "y", fill: "g" }),
  ).add(geomArea({ position: "stack" })).build();
  assertEquals(findAll(compile(spec), "ChunkedFace").length, 1);
});

Deno.test("node budget: single geom_ribbon layer is exactly 1 ChunkedFace node", () => {
  const spec = ggplot(
    { x: [1, 2, 3], lo: [0, 0, 0], hi: [2, 3, 1] },
    aes({ x: "x", ymin: "lo", ymax: "hi" }),
  ).add(geomRibbon()).build();
  assertEquals(findAll(compile(spec), "ChunkedFace").length, 1);
});

Deno.test("node budget: single geom_polygon layer (multi-group) is exactly 1 ChunkedFace node", () => {
  const spec = ggplot(
    { x: [0, 1, 0, 5, 6, 5], y: [0, 1, 1, 0, 1, 1], g: ["a", "a", "a", "b", "b", "b"] },
    aes({ x: "x", y: "y", group: "g" }),
  ).add(geomPolygon()).build();
  assertEquals(findAll(compile(spec), "ChunkedFace").length, 1);
});

Deno.test("node budget: single geom_tile layer is exactly 1 ChunkedFace node", () => {
  const spec = ggplot(
    { x: [1, 2, 1, 2], y: [1, 1, 2, 2], z: [0.1, 0.4, 0.7, 1] },
    aes({ x: "x", y: "y", fill: "z" }),
  ).add(geomTile()).build();
  assertEquals(findAll(compile(spec), "ChunkedFace").length, 1);
});

Deno.test("node budget: single geom_hex layer is exactly 1 ChunkedFace node", () => {
  const spec = ggplot(
    { x: [1, 2, 1, 2], y: [1, 1, 2, 2] },
    aes({ x: "x", y: "y" }),
  ).add(geomHex()).build();
  assertEquals(findAll(compile(spec), "ChunkedFace").length, 1);
});

Deno.test("node budget: single geom_violin layer (multi-group) is exactly 1 ChunkedFace node", () => {
  // NOTE: fill (or color/group) must be mapped alongside x for stat_ydensity
  // to preserve per-x-group rows at all (group/mod.ts's groupColumnsOf keys
  // off color/fill/shape/linetype/group, never x itself) — an x-only mapping
  // silently produces zero density rows and thus zero ChunkedFace loops, a
  // pre-existing gap unrelated to tzc.8 flagged separately (not this bead's
  // scope: no per-row FlatTensor packing bug, no data even reaches packing).
  const spec = ggplot(
    {
      grp: ["a", "a", "a", "a", "b", "b", "b", "b"],
      v: [1, 2, 3, 10, 2, 3, 4, 12],
    },
    aes({ x: "grp", y: "v", fill: "grp" }),
  ).add(geomViolin()).build();
  assertEquals(findAll(compile(spec), "ChunkedFace").length, 1);
});

Deno.test("node budget: single geom_smooth layer (fitted line + SE ribbon) is exactly 1 ChunkedLine + 1 ChunkedFace — two DIFFERENT style batches, not an over-split", () => {
  const spec = ggplot(
    { x: [1, 2, 3, 4, 5], y: [1, 3, 2, 5, 4] },
    aes({ x: "x", y: "y" }),
  ).add(geomSmooth({ method: "loess" })).build();
  const tree = compile(spec);
  assertEquals(findAll(tree, "ChunkedLine").length, 1);
  assertEquals(findAll(tree, "ChunkedFace").length, 1);
});

Deno.test("node budget: single geom_boxplot layer is exactly 1 ChunkedFace (box) + 1 Line (median/whisker) — a DIFFERENT style batch, not an over-split; both now carry FlatTensor positions (gggplot-cct)", () => {
  const spec = ggplot(
    { grp: ["a", "a", "a", "a", "b", "b", "b", "b"], v: [1, 2, 3, 10, 2, 3, 4, 12] },
    aes({ x: "grp", y: "v" }),
  ).add(geomBoxplot()).build();
  const tree = compile(spec);
  assertEquals(findAll(tree, "ChunkedFace").length, 1);
  assertEquals(findAll(tree, "Line").length, 1);
});

Deno.test("node budget: single geom_errorbar layer (stems only) is exactly 1 Line node", () => {
  const spec = ggplot(
    { x: [1, 2, 3], lo: [0, 1, 0], hi: [2, 3, 2] },
    aes({ x: "x", ymin: "lo", ymax: "hi" }),
  ).add(geomErrorbar()).build();
  assertEquals(findAll(compile(spec), "Line").length, 1);
});

Deno.test("node budget: single annotate('segment') layer (N disjoint rows) is exactly 1 Line node", () => {
  const spec = ggplot({ x: [0, 5], y: [0, 5] }, aes({ x: "x", y: "y" }))
    .add(annotate("segment", { x: 1, y: 1, xend: 4, yend: 4 }))
    .build();
  assertEquals(findAll(compile(spec), "Line").length, 1);
});

Deno.test("node budget: single geom_curve layer (N tessellated rows) is exactly 1 Line node", () => {
  const spec = ggplot(
    { x: [0, 1], y: [0, 1], xend: [1, 2], yend: [1, 0] },
    aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
  ).add(geomCurve()).build();
  assertEquals(findAll(compile(spec), "Line").length, 1);
});

Deno.test("node budget: single geom_spoke layer is exactly 1 Line node", () => {
  const spec = ggplot(
    { x: [0, 1], y: [0, 1], angle: [0.1, 0.5], radius: [1, 2] },
    aes({ x: "x", y: "y", angle: "angle", radius: "radius" }),
  ).add(geomSpoke()).build();
  assertEquals(findAll(compile(spec), "Line").length, 1);
});

Deno.test("node budget: single geom_rug layer is exactly 1 Line node", () => {
  const spec = ggplot({ x: [1, 2, 3] }, aes({ x: "x" })).add(geomRug()).build();
  const layout = {
    width: 400,
    height: 300,
    measureText: (_t: string, size: number) => ({ width: size, height: size }),
  };
  assertEquals(findAll(compile(spec, { layout }), "Line").length, 1);
});

// ---------------------------------------------------------------------------
// 2. Sanctioned exceptions: per-shape Point, per-dash ChunkedLine.
// ---------------------------------------------------------------------------

Deno.test("node budget SANCTIONED EXCEPTION: geom_point mapped to 3 distinct shapes splits into exactly 3 Point nodes", () => {
  const spec = ggplot(
    { x: [1, 2, 3, 4, 5, 6], y: [1, 2, 3, 4, 5, 6], s: ["circle", "square", "triangle", "circle", "square", "triangle"] },
    aes({ x: "x", y: "y", shape: "s" }),
  ).add(geomPoint()).build();
  const tree = compile(spec);
  assertEquals(findAll(tree, "Point").length, 3);
});

Deno.test("node budget SANCTIONED EXCEPTION: geom_point mapped to 1 shape value stays 1 Point node (shape mapping alone isn't the trigger — DISTINCT values are)", () => {
  const spec = ggplot(
    { x: [1, 2, 3], y: [1, 2, 3], s: ["circle", "circle", "circle"] },
    aes({ x: "x", y: "y", shape: "s" }),
  ).add(geomPoint()).build();
  assertEquals(findAll(compile(spec), "Point").length, 1);
});

Deno.test("node budget SANCTIONED EXCEPTION: geom_line mapped to 2 distinct linetypes splits into exactly 2 ChunkedLine nodes", () => {
  const spec = ggplot(
    {
      x: [1, 2, 3, 1, 2, 3],
      y: [1, 2, 1, 3, 4, 3],
      lt: ["solid", "solid", "solid", "dashed", "dashed", "dashed"],
    },
    aes({ x: "x", y: "y", linetype: "lt" }),
  ).add(geomLine()).build();
  const tree = compile(spec);
  assertEquals(findAll(tree, "ChunkedLine").length, 2);
});

Deno.test("node budget SANCTIONED EXCEPTION: geom_line grouped by BOTH color and linetype, but only 2 distinct linetypes, still buckets into exactly 2 ChunkedLine nodes (color doesn't add nodes, linetype does)", () => {
  const spec = ggplot(
    {
      x: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3],
      y: [1, 2, 1, 3, 4, 3, 5, 6, 5, 7, 8, 7],
      g: ["a", "a", "a", "b", "b", "b", "c", "c", "c", "d", "d", "d"],
      lt: ["solid", "solid", "solid", "dashed", "dashed", "dashed", "solid", "solid", "solid", "dashed", "dashed", "dashed"],
    },
    aes({ x: "x", y: "y", color: "g", linetype: "lt" }),
  ).add(geomLine()).build();
  const tree = compile(spec);
  assertEquals(findAll(tree, "ChunkedLine").length, 2);
});

// ---------------------------------------------------------------------------
// 3. Multi-layer spec: total node count is the SUM of each layer's own
// expected count — proves compile() doesn't merge/split ACROSS layers.
// ---------------------------------------------------------------------------

Deno.test("node budget: a 3-layer spec (area + line + step, matching line_step_area's fixture composition) totals 1 ChunkedFace + 2 ChunkedLine", () => {
  const spec = ggplot({ x: [1, 2, 3, 4], y: [3, 1, 4, 2] }, aes({ x: "x", y: "y" }))
    .add(geomArea({ fill: "#ddd" }))
    .add(geomLine())
    .add(geomStep({ direction: "hv" }))
    .build();
  const tree = compile(spec);
  assertEquals(findAll(tree, "ChunkedFace").length, 1);
  assertEquals(findAll(tree, "ChunkedLine").length, 2);
});

Deno.test("node budget: a 2-layer spec (point + grouped line) totals exactly 1 Point + 1 ChunkedLine, no cross-layer bleed", () => {
  const spec = ggplot(
    { x: [1, 2, 3, 1, 2, 3], y: [1, 2, 3, 4, 5, 6], g: ["a", "a", "a", "b", "b", "b"] },
    aes({ x: "x", y: "y", color: "g" }),
  ).add(geomPoint()).add(geomLine()).build();
  const tree = compile(spec);
  assertEquals(findAll(tree, "Point").length, 1);
  assertEquals(findAll(tree, "ChunkedLine").length, 1);
});

// ---------------------------------------------------------------------------
// 4. Fixture-spec-set sweep: every case capture_geom_fixtures.ts builds (the
// SAME spec-building functions the checked-in fixtures were generated from)
// only ever emits mark nodes from the closed component set, and resident
// cases never leak a CPU mark node alongside their ResidentProduct.
// ---------------------------------------------------------------------------

Deno.test("node budget: every fixture-set spec's mark nodes are drawn from the known component set", () => {
  for (const { name, build } of cases) {
    const tree = compile(build());
    const unexpected = new Set<string>();
    (function walk(n: RenderNode) {
      if (
        ["Point", "ChunkedLine", "ChunkedFace"].includes(n.component) === false &&
        n.component !== "Line" && n.component !== "Polygon" && n.component !== "Label" &&
        // Guides/structure/panel scaffolding — not mark nodes, not part of
        // this budget rule at all.
        !["Plot", "Embedded", "Cartesian", "Polar", "Axis", "Grid",
          "FacetPanel", "PanelViewport", "RadialViewport", "FacetGrid",
          "ResidentProduct"].includes(n.component)
      ) {
        unexpected.add(n.component);
      }
      n.children.forEach(walk);
    })(tree);
    assertEquals(unexpected.size, 0, `${name}: unexpected component(s) ${[...unexpected]}`);
  }
});

Deno.test("node budget: every resident-eligible fixture-set spec emits ResidentProduct with NO sibling CPU mark node for the same layer", () => {
  for (const { name, build } of residentCases) {
    const tree = compile(build(), { resident: true });
    const residentCount = countBy(tree, (n) => n.component === "ResidentProduct");
    const markCount = findAll(tree, "Point").length +
      findAll(tree, "ChunkedLine").length + findAll(tree, "ChunkedFace").length;
    if (name === "resident_histogram_cpu_fallback") {
      // Deliberately gated OFF resident (mapped fill) — the CPU fallback
      // case; asserted by resident_conformance_test.ts already. Skipped here.
      continue;
    }
    assertEquals(residentCount >= 1, true, `${name}: expected a ResidentProduct node`);
    assertEquals(markCount, 0, `${name}: resident layer must not ALSO emit a CPU mark node`);
  }
});
