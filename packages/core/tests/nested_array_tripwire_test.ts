// Tests for gggplot-tzc.8's NESTED-ARRAY + OWNERS TRIPWIRE (epic acceptance
// #1): walks every fixture RenderTree and asserts no MARK node carries
// array-of-arrays positions, and no node anywhere carries an 'owners' key
// (owners is compiler-internal per geom/shared.ts's PackedGeometry — it must
// never survive onto a RenderTree node; MarkTopology has no owners field at
// the type level at all, enforced separately by mark_tensor_test.ts).
//
// SCOPE: "mark node" means a node inside a panel's Cartesian/Polar subtree
// whose component is one this epic's node-budget rule governs (Point,
// ChunkedLine, ChunkedFace, plus the legacy Line/Polygon component names
// still used by geoms tzc.3/tzc.4 route through packUniformChunks/
// packFaceLoops — e.g. errorbar's stems, segment/curve/spoke/rug/refline).
// Guide/annotation/legend nodes (Grid/Axis/Label swatches, legend Point/
// Line/Polygon key glyphs, the theme-background Polygon, polar grid lines)
// are OUT of this rule by construction — they live outside the panel
// subtree or are a different, non-mark semantic — and ARE allowed to stay
// nested, matching the epic's "exemptions... enumerated explicitly" clause
// for guides.
//
// gggplot-cct closed the epic's last two mark-position gaps (geom/boxplot.ts's
// median/whisker Line via packUniformChunks, geom/text.ts's geom_label
// background/border via packFaceLoops/packUniformChunks), so this tripwire no
// longer carries any cct-tracked exemptions: every mark node in the
// fixture-set walk below must carry FlatTensor positions, full stop.
import { assertEquals } from "@std/assert";
import { compile } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";
import { cases, residentCases } from "../../../scripts/capture_geom_fixtures.ts";

const PANEL_COMPONENTS: ReadonlySet<RenderNode["component"]> = new Set([
  "Cartesian",
  "Polar",
]);

const MARK_COMPONENTS: ReadonlySet<RenderNode["component"]> = new Set([
  "Point",
  "ChunkedLine",
  "ChunkedFace",
  "Line",
  "Polygon",
]);

/** compile/mod.ts's theme.background guide: the only Polygon node with a
 * 'depthWrite' prop (see the `guides.push(node("Polygon", {..., depth: 1,
 * depthWrite: false}))` call). Not a mark — the full-panel background fill. */
function isThemeBackgroundPolygon(n: RenderNode): boolean {
  return n.component === "Polygon" && "depthWrite" in n.props;
}

/** compile/coordinates.ts's polarGridLines guide: the only Line node with
 * zBias === -1 (no packUniformChunks-based mark Line ever sets zBias; the
 * one mark Line that DOES set zBias — geom/text.ts's geom_label border —
 * uses zBias: 1, not -1). Not a mark — polar coord's ring/spoke grid. */
function isPolarGridLinesGuide(n: RenderNode): boolean {
  return n.component === "Line" && n.props.zBias === -1;
}

function isGuideNode(n: RenderNode): boolean {
  return isThemeBackgroundPolygon(n) || isPolarGridLinesGuide(n);
}

function findMarkNodes(tree: RenderNode): RenderNode[] {
  const panels: RenderNode[] = [];
  (function collectPanels(n: RenderNode) {
    if (PANEL_COMPONENTS.has(n.component)) panels.push(n);
    n.children.forEach(collectPanels);
  })(tree);

  const marks: RenderNode[] = [];
  for (const panel of panels) {
    (function collectMarks(n: RenderNode) {
      if (MARK_COMPONENTS.has(n.component) && !isGuideNode(n)) marks.push(n);
      n.children.forEach(collectMarks);
    })(panel);
  }
  return marks;
}

function isNestedArrayPositions(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  const first = value[0];
  // A FlatTensor's own 'array' field is a Float32Array, never a plain array,
  // so any FlatTensor-carrying node's 'positions' prop fails Array.isArray
  // entirely (positions itself is `{array, format, dims, ...}`, an object,
  // not an array) — nested-array detection is exactly Array.isArray(value).
  return Array.isArray(first);
}

const layout = { width: 640, height: 480, measureText: approximateTextMeasurer };

Deno.test("nested-array tripwire: every fixture-set spec's mark nodes carry FlatTensor positions", () => {
  for (const { name, build } of [...cases, ...residentCases]) {
    for (const compiled of [compile(build()), compile(build(), { layout })]) {
      const marks = findMarkNodes(compiled);
      for (const mark of marks) {
        assertEquals(
          isNestedArrayPositions(mark.props.positions),
          false,
          `${name}: mark node "${mark.component}" carries nested [[x,y],...] positions — every mark in packages/core/src/geom must carry FlatTensor positions (gggplot-tzc acceptance #1) — props: ${
            JSON.stringify(Object.keys(mark.props))
          }`,
        );
      }
    }
  }
});

Deno.test("nested-array tripwire: no RenderTree node anywhere carries an 'owners' key (compiler-internal, must never be emitted)", () => {
  for (const { build } of [...cases, ...residentCases]) {
    for (const compiled of [compile(build()), compile(build(), { layout })]) {
      (function walk(n: RenderNode) {
        assertEquals(
          "owners" in n.props,
          false,
          `node "${n.component}" carries an 'owners' prop — owners is compiler-internal (geom/shared.ts's PackedGeometry) and must be stripped before a node reaches RenderTree`,
        );
        const topology = n.props.topology;
        if (topology && typeof topology === "object") {
          assertEquals(
            "owners" in (topology as Record<string, unknown>),
            false,
            `node "${n.component}"'s topology prop carries an 'owners' key`,
          );
        }
        n.children.forEach(walk);
      })(compiled);
    }
  }
});

// ---------------------------------------------------------------------------
// Positive controls: confirm the walker/matcher itself actually catches a
// genuine nested-array mark node, so a bug in the matcher can't silently
// make every case above vacuously pass.
// ---------------------------------------------------------------------------

Deno.test("nested-array tripwire SELF-TEST: a synthetic node with plain nested positions is correctly flagged", () => {
  const fakeMark: RenderNode = {
    component: "Line",
    props: { positions: [[[0, 0], [1, 1]], [[2, 2], [3, 3]]] },
    children: [],
  };
  assertEquals(isNestedArrayPositions(fakeMark.props.positions), true);
});

Deno.test("nested-array tripwire SELF-TEST: a FlatTensor-carrying node is correctly recognized as NOT nested", () => {
  const flatMark: RenderNode = {
    component: "Point",
    props: {
      positions: {
        array: new Float32Array([0, 0, 1, 1]),
        format: "vec2",
        dims: 2,
        length: 2,
        size: [2],
        version: 0,
      },
    },
    children: [],
  };
  assertEquals(isNestedArrayPositions(flatMark.props.positions), false);
});
