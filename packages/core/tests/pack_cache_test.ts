// Tests for gggplot-tzc.5: the staged geometry cache (compile/pack_cache.ts).
// Cache-boundary only — no mounted Live components; assertions run directly
// against compile()'s RenderTree output. Kept in its own file (rather than
// pipeline_test.ts) per the bead's scope fence, to leave that file untouched
// for tzc.6.
import { assertEquals, assertStrictEquals } from "@std/assert";
import {
  aes,
  coordPolar,
  geomCol,
  geomLine,
  geomPoint,
  geomPolygon,
  ggplot,
} from "../src/dsl/mod.ts";
import { compile, createPackCache } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";
import type { FlatTensor, MarkTopology } from "../src/compile/rendertree.ts";
import { ingest } from "../src/data/mod.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";

function findNodes(
  tree: RenderNode,
  component: RenderNode["component"],
): RenderNode[] {
  return [
    ...(tree.component === component ? [tree] : []),
    ...tree.children.flatMap((child) => findNodes(child, component)),
  ];
}

function positionsOf(n: RenderNode): FlatTensor {
  return n.props.positions as FlatTensor;
}

function topologyOf(n: RenderNode): MarkTopology {
  return n.props.topology as MarkTopology;
}

// ---------------------------------------------------------------------------
// 1. Cartesian points
// ---------------------------------------------------------------------------

Deno.test("pack cache: Cartesian points are reference-identical across a same-spec recompile and a DSL-rebuilt spec", () => {
  const typed = ingest({ x: [0, 1, 2, 3], y: [0, 1, 4, 9] });
  const buildSpec = () =>
    ggplot(typed, aes({ x: "x", y: "y" })).add(geomPoint()).build();
  const cache = createPackCache();

  // (a) compile the SAME spec object twice.
  const spec = buildSpec();
  const treeA1 = compile(spec, { packCache: cache });
  const treeA2 = compile(spec, { packCache: cache });
  const pointA1 = findNodes(treeA1, "Point")[0];
  const pointA2 = findNodes(treeA2, "Point")[0];
  assertStrictEquals(positionsOf(pointA1).array, positionsOf(pointA2).array);
  assertStrictEquals(positionsOf(pointA1), positionsOf(pointA2));

  // (b) compile a DSL-REBUILT spec (fresh GG/Layer objects) over the SAME
  // already-ingested TypedDataFrame, against the SAME cache.
  const rebuilt = buildSpec();
  const treeB = compile(rebuilt, { packCache: cache });
  const pointB = findNodes(treeB, "Point")[0];
  assertStrictEquals(positionsOf(pointA1).array, positionsOf(pointB).array);
  assertStrictEquals(positionsOf(pointA1), positionsOf(pointB));
});

// ---------------------------------------------------------------------------
// 2. Grouped ChunkedLine — chunks Uint32Array === too
// ---------------------------------------------------------------------------

Deno.test("pack cache: grouped ChunkedLine (positions AND chunks) are reference-identical across recompile and DSL rebuild", () => {
  const typed = ingest({
    x: [0, 1, 2, 0, 1, 2],
    y: [0, 1, 2, 5, 4, 3],
    g: ["a", "a", "a", "b", "b", "b"],
  });
  const buildSpec = () =>
    ggplot(typed, aes({ x: "x", y: "y", color: "g" }))
      .add(geomLine())
      .build();
  const cache = createPackCache();

  const spec = buildSpec();
  const treeA1 = compile(spec, { packCache: cache });
  const treeA2 = compile(spec, { packCache: cache });
  const lineA1 = findNodes(treeA1, "ChunkedLine")[0];
  const lineA2 = findNodes(treeA2, "ChunkedLine")[0];
  assertStrictEquals(positionsOf(lineA1).array, positionsOf(lineA2).array);
  assertStrictEquals(topologyOf(lineA1).chunks, topologyOf(lineA2).chunks);

  const rebuilt = buildSpec();
  const treeB = compile(rebuilt, { packCache: cache });
  const lineB = findNodes(treeB, "ChunkedLine")[0];
  assertStrictEquals(positionsOf(lineA1).array, positionsOf(lineB).array);
  assertStrictEquals(topologyOf(lineA1).chunks, topologyOf(lineB).chunks);
});

// ---------------------------------------------------------------------------
// 3. Polar munched loops — Stage B hit
// ---------------------------------------------------------------------------

Deno.test("pack cache: polar-munched ChunkedFace loops are reference-identical across recompile and DSL rebuild (Stage B hit)", () => {
  const typed = ingest({ x: ["a", "b"], y: [2, 3] });
  const buildSpec = () =>
    ggplot(typed, aes({ x: "x", y: "y" }))
      .add(geomCol(), coordPolar())
      .build();
  const cache = createPackCache();

  const spec = buildSpec();
  const treeA1 = compile(spec, { packCache: cache });
  const treeA2 = compile(spec, { packCache: cache });
  const faceA1 = findNodes(treeA1, "ChunkedFace")[0];
  const faceA2 = findNodes(treeA2, "ChunkedFace")[0];
  // Sanity: this really did go through the munch path (>4 verts per rect).
  assertEquals(topologyOf(faceA1).kind, "loops");
  assertEquals(positionsOf(faceA1).length > 8, true);
  assertStrictEquals(positionsOf(faceA1).array, positionsOf(faceA2).array);
  assertStrictEquals(topologyOf(faceA1).chunks, topologyOf(faceA2).chunks);

  const rebuilt = buildSpec();
  const treeB = compile(rebuilt, { packCache: cache });
  const faceB = findNodes(treeB, "ChunkedFace")[0];
  assertStrictEquals(positionsOf(faceA1).array, positionsOf(faceB).array);
  assertStrictEquals(topologyOf(faceA1).chunks, topologyOf(faceB).chunks);
});

// ---------------------------------------------------------------------------
// 4. Concave ChunkedFace — Stage C is vacuous (tzc.4 took the upstream
// mount-time concave path; no CPU-triangulated indices exist in the compiler
// at all), so "indices identity" reduces to: topology.indices is absent, and
// the loop positions/colors/chunks are reference-identical like every other
// ChunkedFace. See this bead's bd note for the explicit tzc.4 confirmation.
// ---------------------------------------------------------------------------

Deno.test("pack cache: concave ChunkedFace loops are reference-identical across recompile and DSL rebuild (Stage C vacuous)", () => {
  // An L-shape (concave) polygon, one group/loop.
  const typed = ingest({
    x: [0, 2, 2, 1, 1, 0],
    y: [0, 0, 1, 1, 2, 2],
  });
  const buildSpec = () =>
    ggplot(typed, aes({ x: "x", y: "y" })).add(geomPolygon()).build();
  const cache = createPackCache();

  const spec = buildSpec();
  const treeA1 = compile(spec, { packCache: cache });
  const treeA2 = compile(spec, { packCache: cache });
  const faceA1 = findNodes(treeA1, "ChunkedFace")[0];
  const faceA2 = findNodes(treeA2, "ChunkedFace")[0];
  // Stage C vacuity: no derived/triangulated indices ever attached — the
  // upstream mount-time concave source (tzc.4) computes them from final
  // positions at render time, never on the compiler's RenderTree.
  assertEquals(topologyOf(faceA1).indices, undefined);
  assertStrictEquals(positionsOf(faceA1).array, positionsOf(faceA2).array);
  assertStrictEquals(
    faceA1.props.colors as FlatTensor,
    faceA2.props.colors as FlatTensor,
  );

  const rebuilt = buildSpec();
  const treeB = compile(rebuilt, { packCache: cache });
  const faceB = findNodes(treeB, "ChunkedFace")[0];
  assertStrictEquals(positionsOf(faceA1).array, positionsOf(faceB).array);
  assertEquals(topologyOf(faceB).indices, undefined);
});

// ---------------------------------------------------------------------------
// Mandatory multi-column invalidation test
// ---------------------------------------------------------------------------
//
// GRANULARITY, STATED EXPLICITLY: this cache's Stage A entry is the whole
// RenderNode[] one layer's lower() produces for one panel — i.e. every
// companion tensor a single packMarkRows call bundles (positions, colors,
// sizes, ...) shares ONE retained-row mask and is packed together as one
// atomic unit (see pack_cache.ts's Stage A doc comment). Position is
// therefore NOT independently cached from color WITHIN one node: invalidating
// a layer's color column recomputes that whole node, so the position tensor's
// IDENTITY also changes (even though its VALUES don't) — this is the
// documented, deliberate choice for this pass (true independent per-
// aesthetic caching would require plumbing the cache through every geom's
// internal packing calls). What IS guaranteed, and asserted below: (1) the
// color tensor's identity changes; (2) an UNRELATED layer (never mapped to
// the invalidated column) is completely unaffected.
Deno.test("pack cache: invalidate(colorColumn) misses only entries depending on it — unrelated layer's tensors stay ===", () => {
  const typed = ingest({
    x: [0, 1, 2, 3],
    y: [0, 1, 4, 9],
    c: ["a", "b", "a", "b"],
    s: [1, 2, 3, 4],
  });
  const spec = ggplot(typed, aes({ x: "x", y: "y" }))
    .add(
      geomPoint({ mapping: aes({ color: "c", size: "s" }) }),
      geomLine(), // unrelated layer: never mapped to "c" or "s"
    )
    .build();
  const cache = createPackCache();

  const tree1 = compile(spec, { packCache: cache });
  const point1 = findNodes(tree1, "Point")[0];
  const line1 = findNodes(tree1, "ChunkedLine")[0];
  const positions1 = positionsOf(point1);
  const colors1 = point1.props.colors as FlatTensor;
  const sizes1 = point1.props.sizes as FlatTensor;
  const linePositions1 = positionsOf(line1);

  cache.invalidate(typed.c);

  const tree2 = compile(spec, { packCache: cache });
  const point2 = findNodes(tree2, "Point")[0];
  const line2 = findNodes(tree2, "ChunkedLine")[0];

  // (1) The invalidated aesthetic's tensor changes identity...
  assertEquals(
    (point2.props.colors as FlatTensor).array === colors1.array,
    false,
  );
  // ...with the SAME values (recomputed, not corrupted).
  assertEquals(
    Array.from((point2.props.colors as FlatTensor).array),
    Array.from(colors1.array),
  );
  // Documented granularity: position (and every other companion in the same
  // packMarkRows bundle) is NOT independently cached from color, so its
  // identity also changes here — asserted explicitly per this bead's
  // "assert whichever the design guarantees" contract.
  assertEquals(
    positionsOf(point2).array === positions1.array,
    false,
  );
  assertEquals(
    (point2.props.sizes as FlatTensor).array === sizes1.array,
    false,
  );
  assertEquals(
    Array.from(positionsOf(point2).array),
    Array.from(positions1.array),
  );

  // (2) The unrelated layer (geomLine, never mapped to "c"/"s") is untouched.
  assertStrictEquals(positionsOf(line2).array, linePositions1.array);
});

// ---------------------------------------------------------------------------
// theme.textColor-only change: mark tensors ===, guides differ.
// ---------------------------------------------------------------------------

Deno.test("pack cache: a theme.textColor-only change leaves mark tensors === while guide Label color differs", () => {
  const typed = ingest({ x: [0, 1, 2, 3], y: [0, 1, 4, 9] });
  const spec1 = ggplot(typed, aes({ x: "x", y: "y" })).add(geomPoint())
    .build();
  const spec2 = {
    ...spec1,
    theme: { ...spec1.theme, textColor: "#ff00ff" },
  };
  const cache = createPackCache();
  const layout = { width: 400, height: 300, measureText: approximateTextMeasurer };

  const tree1 = compile(spec1, { packCache: cache, layout });
  const tree2 = compile(spec2, { packCache: cache, layout });

  const point1 = findNodes(tree1, "Point")[0];
  const point2 = findNodes(tree2, "Point")[0];
  assertStrictEquals(positionsOf(point1).array, positionsOf(point2).array);
  assertStrictEquals(
    point1.props.colors as FlatTensor,
    point2.props.colors as FlatTensor,
  );

  const label1 = findNodes(tree1, "Label")[0];
  const label2 = findNodes(tree2, "Label")[0];
  assertEquals(label1.props.color, "#0b0b0b");
  assertEquals(label2.props.color, "#ff00ff");
});

// ---------------------------------------------------------------------------
// One layer's size-param change: only that layer's affected tensors change.
// ---------------------------------------------------------------------------

Deno.test("pack cache: one layer's literal size-param change only invalidates that layer", () => {
  const typed = ingest({ x: [0, 1, 2], y: [0, 1, 2] });
  const buildSpec = (size: number) =>
    ggplot(typed, aes({ x: "x", y: "y" }))
      .add(
        geomPoint({ size }),
        geomLine(),
      )
      .build();
  const cache = createPackCache();

  const tree1 = compile(buildSpec(3), { packCache: cache });
  const point1 = findNodes(tree1, "Point")[0];
  const line1 = findNodes(tree1, "ChunkedLine")[0];

  const tree2 = compile(buildSpec(9), { packCache: cache });
  const point2 = findNodes(tree2, "Point")[0];
  const line2 = findNodes(tree2, "ChunkedLine")[0];

  // The point layer's own literal `size` prop changes (its packed
  // representation is a per-node uniform, not a tensor, for an unmapped
  // literal size — see geom/point.ts) — either way the layer's Stage A key
  // (which folds in the whole layer.params object, see pack_cache.ts's
  // stableStringify) differs, so its WHOLE node bundle is recomputed. Same
  // documented coarse granularity as the multi-column invalidation test
  // above: position isn't independently cached from a sibling param within
  // one layer's node, so it changes identity here too even though its
  // VALUES don't depend on size at all.
  assertEquals(point1.props.size, 3);
  assertEquals(point2.props.size, 9);
  assertEquals(
    positionsOf(point1).array === positionsOf(point2).array,
    false,
  );
  assertEquals(
    Array.from(positionsOf(point1).array),
    Array.from(positionsOf(point2).array),
  );
  // What's actually being tested here: the OTHER layer (geomLine, no size
  // param, no dependency on the point layer's params at all) is completely
  // untouched — proving Stage A invalidation is scoped per layer.
  assertStrictEquals(positionsOf(line1).array, positionsOf(line2).array);
});

// ---------------------------------------------------------------------------
// Uncached path is unaffected: identical output whether or not a packCache
// is supplied (byte-for-byte, matching the fixtures' --check contract).
// ---------------------------------------------------------------------------

Deno.test("pack cache: an uncached compile (no packCache) still produces byte-identical positions to a cached one", () => {
  const typed = ingest({ x: [0, 1, 2], y: [3, 1, 4] });
  const spec = ggplot(typed, aes({ x: "x", y: "y" })).add(geomPoint())
    .build();

  const uncached = findNodes(compile(spec), "Point")[0];
  const cached = findNodes(compile(spec, { packCache: createPackCache() }), "Point")[0];
  assertEquals(
    Array.from(positionsOf(uncached).array),
    Array.from(positionsOf(cached).array),
  );
});
