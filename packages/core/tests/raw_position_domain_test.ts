// Tests for gggplot-tzc.7: raw data-space positions for continuous linear
// scales (Phase-3 starter). Blocked-by/coordinates-with gggplot-tzc.5's
// PackCache (compile/pack_cache.ts).
//
// THE GATE (per the bead's authoritative NOTES amendment #1): reference
// IDENTITY, not numeric equality. For an eligible axis (trained scale
// kind === 'continuous', no transform), the Stage A pack key already
// excludes the continuous domain (see pack_cache.ts's scaleKeyFor — folds in
// only `scale.kind`, never `scale.domain`, for x/y aesthetics other than
// discrete) because scalePosition (scale/mapping.ts) for that kind is a pure
// per-row identity — `Number(raw)` — that never reads scale.domain at all.
// So packed positions were ALREADY raw data values before this bead; the
// remaining gap this bead closes is proving it end-to-end with the
// reference-identity proof standard the design review mandated, plus
// documenting the CPU-residency rows this exempts (log/sqrt/discrete) in
// docs/RESIDENCY_MATRIX.md.
//
// AUDIT FINDING (bead step 1): scalePosition for kind==='continuous' (no
// transform) is `transformFor(undefined)(Number(raw))` === `Number(raw)` —
// literal identity, in data units, with NO expansion or clamping performed
// per-row. Axis expansion (scale.expand) is applied exactly once, in
// scale/training.ts, to the TRAINED SCALE's domain field (which flows to the
// Cartesian view node's `range` via compile/coordinates.ts's numericRange) —
// never inside scalePosition/packing. This is exactly the "any non-identity
// must be accounted for in the DOMAIN, never in per-row packing" contract.
import {
  assertEquals,
  assertNotStrictEquals,
  assertStrictEquals,
} from "@std/assert";
import {
  aes,
  geomPoint,
  ggplot,
  scaleXContinuous,
  scaleXDiscrete,
  scaleXLog10,
  scaleYContinuous,
} from "../src/dsl/mod.ts";
import { compile, createPackCache } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";
import type { FlatTensor } from "../src/compile/rendertree.ts";
import { ingest } from "../src/data/mod.ts";

function findNodes(
  tree: RenderNode,
  component: RenderNode["component"],
): RenderNode[] {
  return [
    ...(tree.component === component ? [tree] : []),
    ...tree.children.flatMap((child) => findNodes(child, component)),
  ];
}

function findNode(
  tree: RenderNode,
  component: RenderNode["component"],
): RenderNode {
  const hits = findNodes(tree, component);
  if (hits.length === 0) throw new Error(`no ${component} node found`);
  return hits[0];
}

function positionsOf(n: RenderNode): FlatTensor {
  return n.props.positions as FlatTensor;
}

// ---------------------------------------------------------------------------
// THE GATE TEST: continuous-linear domain change is view-only.
// ---------------------------------------------------------------------------

Deno.test("tzc.7 gate: continuous-linear domain change leaves mark positions ===, only Cartesian range differs", () => {
  const typed = ingest({ x: [1, 2, 3, 4], y: [10, 20, 15, 25] });
  const buildSpec = (xDomain: [number, number]) =>
    ggplot(typed, aes({ x: "x", y: "y" }))
      .add(geomPoint(), scaleXContinuous({ domain: xDomain }))
      .build();
  const cache = createPackCache();

  const treeA = compile(buildSpec([0, 10]), { packCache: cache });
  const treeB = compile(buildSpec([0, 1000]), { packCache: cache });

  const pointA = findNode(treeA, "Point");
  const pointB = findNode(treeB, "Point");

  // Reference identity — not numeric equality — across a domain change.
  assertStrictEquals(positionsOf(pointA).array, positionsOf(pointB).array);
  assertStrictEquals(positionsOf(pointA), positionsOf(pointB));

  // Only the view node's range prop differs.
  const cartesianA = findNode(treeA, "Cartesian");
  const cartesianB = findNode(treeB, "Cartesian");
  assertEquals(cartesianA.props.range, [[0, 10], [10, 25]]);
  assertEquals(cartesianB.props.range, [[0, 1000], [10, 25]]);
  assertNotStrictEquals(cartesianA.props.range, cartesianB.props.range);
});

Deno.test("tzc.7 gate: mixed axes — eligible x stays ===, y (also continuous-linear) also ===, across independent x/y domain changes", () => {
  const typed = ingest({ x: [1, 2, 3], y: [5, 6, 7] });
  const buildSpec = (xDomain: [number, number], yDomain: [number, number]) =>
    ggplot(typed, aes({ x: "x", y: "y" }))
      .add(
        geomPoint(),
        scaleXContinuous({ domain: xDomain }),
        scaleYContinuous({ domain: yDomain }),
      )
      .build();
  const cache = createPackCache();

  const treeA = compile(buildSpec([0, 10], [0, 10]), { packCache: cache });
  const treeB = compile(buildSpec([0, 999], [0, 999]), { packCache: cache });

  const pointA = findNode(treeA, "Point");
  const pointB = findNode(treeB, "Point");
  assertStrictEquals(positionsOf(pointA).array, positionsOf(pointB).array);
});

Deno.test("tzc.7 gate: a same-spec recompile with an UNCHANGED domain still hits the cache (baseline sanity)", () => {
  const typed = ingest({ x: [1, 2, 3], y: [1, 2, 3] });
  const spec = ggplot(typed, aes({ x: "x", y: "y" }))
    .add(geomPoint(), scaleXContinuous({ domain: [0, 5] }))
    .build();
  const cache = createPackCache();

  const tree1 = compile(spec, { packCache: cache });
  const tree2 = compile(spec, { packCache: cache });
  assertStrictEquals(
    positionsOf(findNode(tree1, "Point")).array,
    positionsOf(findNode(tree2, "Point")).array,
  );
});

// ---------------------------------------------------------------------------
// Ineligible axes: discrete-domain (level order) changes MUST still recompute
// — proving eligibility is genuinely gated per-axis, not a blanket exemption.
// This is a correctness check for "discrete keeps CPU index mapping", not a
// performance regression: scalePosition indexes into scale.domain for
// discrete, so a level-order change changes packed index values, and the
// Stage A key deliberately folds discrete's domain in (pack_cache.ts's
// scaleKeyFor) to reflect that.
// ---------------------------------------------------------------------------

Deno.test("tzc.7: a discrete axis's level-order (domain) change is NOT reference-identical — it genuinely repacks", () => {
  const typed = ingest({ x: ["a", "b", "c"], y: [1, 2, 3] });
  const buildSpec = (order: string[]) =>
    ggplot(typed, aes({ x: "x", y: "y" }))
      .add(geomPoint(), scaleXDiscrete({ domain: order }))
      .build();
  const cache = createPackCache();

  const treeA = compile(buildSpec(["a", "b", "c"]), { packCache: cache });
  const treeB = compile(buildSpec(["c", "b", "a"]), { packCache: cache });

  const pointA = findNode(treeA, "Point");
  const pointB = findNode(treeB, "Point");
  // Level order flips which index each row packs to, so this must NOT be ===.
  assertEquals(
    positionsOf(pointA).array === positionsOf(pointB).array,
    false,
  );
  // "a" is index 0 under order A but index 2 under order B: values differ too.
  assertEquals(Array.from(positionsOf(pointA).array), [0, 1, 1, 2, 2, 3]);
  assertEquals(Array.from(positionsOf(pointB).array), [2, 1, 1, 2, 0, 3]);
});

// ---------------------------------------------------------------------------
// log/sqrt: EXCLUDED from the "eligible" (raw-value) set per the bead's
// eligibility rule (kind === 'continuous' && no transform). scalePosition
// still applies its CPU pre-transform (Math.log10) per row, keyed by
// `scale.kind` ("log"), which is a DIFFERENT key string than a continuous
// axis over the same column would produce — so a log route is never
// accidentally satisfied by a continuous route's cache entry (or vice
// versa), and correctness (transformed values, not raw) is preserved.
// ---------------------------------------------------------------------------

Deno.test("tzc.7: a log-scale axis packs CPU pre-transformed (log10) values, not raw data values", () => {
  const typed = ingest({ x: [1, 10, 100], y: [1, 2, 3] });
  const spec = ggplot(typed, aes({ x: "x", y: "y" }))
    .add(geomPoint(), scaleXLog10())
    .build();
  const tree = compile(spec, { packCache: createPackCache() });
  const point = findNode(tree, "Point");
  // log10(1)=0, log10(10)=1, log10(100)=2 — pre-transformed, not [1,10,100].
  const xs = Array.from(positionsOf(point).array).filter((_, i) => i % 2 === 0);
  assertEquals(xs, [0, 1, 2]);
});
