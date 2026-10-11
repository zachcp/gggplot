// gggplot-2gu: every plot-level change invalidates only what it must. Each row
// changes one part over warm caches and asserts the minimal work (stats run,
// layers re-lowered, tensors re-uploaded) and that the cached result equals a
// cold assembly of the changed plot.
import { assert, assertEquals } from "@std/assert";
import {
  assembleRoot as assembleRootOrNull,
  createRootCaches,
  plotSpec,
  type RootCaches,
} from "../src/components/root_assembly.ts";
import { layerFromProps } from "../src/components/geom_layer.ts";
import { GeomPoint } from "../src/components/geoms.ts";
import {
  CoordCartesian,
  Labs,
  ScaleColor,
  ScaleFill,
  ScaleXContinuous,
  ScaleYLog10,
  ThemeOverrides,
} from "../src/components/plot_parts.ts";
import { componentProbe } from "../src/components/probe.ts";
import {
  buildFacetPanels,
  prepareSignature,
  type RenderNode,
} from "../src/compile/mod.ts";
import type { SpecPart } from "../src/dsl/base.ts";
import { ingest } from "../src/data/mod.ts";
import type { Aes, Layer } from "../src/ir/types.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";

const data = ingest({
  x: [1, 2, 3, 4, 5, 6],
  y: [2, 5, 3, 8, 4, 9],
  v: [0.1, 0.4, 0.2, 0.9, 0.5, 0.7],
  g: ["a", "b", "c", "a", "b", "c"],
});
const MAPPING: Aes = { x: "x", y: "y" };
// A points-only plot, so both layers bind on the GPU: fill continuously
// (gggplot-fbq), color through a factor lookup (gggplot-81r).
const point = layerFromProps(GeomPoint.layerProps({ mapping: { fill: "v" } }));
const dots = layerFromProps(
  GeomPoint.layerProps({ mapping: { color: "g" }, size: 2 }),
);
const LAYERS: Layer[] = [point, dots];

const LAYOUT = {
  width: 640,
  height: 400,
  measureText: approximateTextMeasurer,
};

function assemble(caches: RootCaches, parts: SpecPart[]) {
  const base = plotSpec(data, MAPPING, undefined, undefined, parts);
  return assembleRootOrNull(
    base,
    LAYERS.map((layer, i) => ({ kind: "layer" as const, id: i + 1, layer })),
    buildFacetPanels(base.facet, base.data, base.labels),
    LAYOUT,
    caches,
  )!;
}

/** Every mark's position array, by mark key. */
function markArrays(tree: RenderNode): Map<string, unknown> {
  const out = new Map<string, unknown>();
  const walk = (node: RenderNode) => {
    const positions = node.props.positions as { array?: unknown } | undefined;
    if (node.key?.startsWith("layer-") && positions?.array) {
      out.set(node.key, positions.array);
    }
    node.children.forEach(walk);
  };
  walk(tree);
  return out;
}

interface Row {
  change: string;
  /** What the change invalidates, in the classifier's terms. */
  tier: "view" | "uniform" | "lookup" | "lower" | "stat";
  parts: SpecPart[];
  stats: number;
  lowered: number;
  /** Marks whose position bytes changed (and so re-upload). */
  uploads: number;
}

const ROWS: Row[] = [
  {
    change: "theme",
    tier: "view",
    parts: [ThemeOverrides.part({ gridColor: "#dddddd" })],
    stats: 0,
    lowered: 0,
    uploads: 0,
  },
  {
    change: "labels",
    tier: "view",
    parts: [Labs.part({ title: "A title" })],
    stats: 0,
    lowered: 0,
    uploads: 0,
  },
  {
    // coord_cartesian zooms the view: no row leaves, so no stat reruns. The
    // layers re-lower against the zoomed panel, but their data-space
    // positions are byte-identical and keep their tensors.
    change: "coord_cartesian(ylim)",
    tier: "view",
    parts: [CoordCartesian.part({ ylim: [0, 6] })],
    stats: 0,
    lowered: 2,
    uploads: 0,
  },
  {
    // The bound fill reaches the GPU through refs: a uniform write only.
    change: "continuous fill palette (bound)",
    tier: "uniform",
    parts: [ScaleFill.part({ range: ["#000000", "#ffffff"] })],
    stats: 0,
    lowered: 0,
    uploads: 0,
  },
  {
    // Level order rewrites the bound color lookup; nothing is filtered or
    // re-lowered.
    change: "discrete color level order",
    tier: "lookup",
    parts: [ScaleColor.part({ domain: ["c", "b", "a"] })],
    stats: 0,
    lowered: 0,
    uploads: 0,
  },
  {
    // Scale limits censor rows before the stat (ggplot2's scale limits).
    change: "x scale limits",
    tier: "stat",
    parts: [ScaleXContinuous.part({ domain: [1, 4] })],
    stats: 2,
    lowered: 2,
    uploads: 2,
  },
  {
    // A position transform re-runs the stat (finding 3). Conservative until
    // transforms apply before the stat (gggplot-xg07).
    change: "y log10 transform",
    tier: "stat",
    parts: [ScaleYLog10.part({})],
    stats: 2,
    lowered: 2,
    uploads: 2,
  },
];

for (const row of ROWS) {
  Deno.test(`${row.change} invalidates ${row.tier} only`, () => {
    const caches = createRootCaches();
    const before = assemble(caches, []);
    componentProbe.reset();
    const after = assemble(caches, row.parts);
    assertEquals(
      {
        stats: componentProbe.statCalls,
        lowered: componentProbe.lowerCalls,
      },
      { stats: row.stats, lowered: row.lowered },
    );
    const was = markArrays(before.tree);
    const now = markArrays(after.tree);
    assert(now.size > 0);
    const uploads = [...now].filter(([key, array]) => was.get(key) !== array)
      .length;
    assertEquals(uploads, row.uploads, "marks re-uploaded");
    // Reusing the caches changes nothing about the answer.
    assertEquals(after.tree, assemble(createRootCaches(), row.parts).tree);
  });
}

Deno.test("the stat tier is exactly prepareSignature", () => {
  const sig = (parts: SpecPart[], layer: Layer = dots) =>
    prepareSignature(
      plotSpec(data, MAPPING, undefined, undefined, parts),
      layer,
      { faceted: false, standalone: false },
    );
  const none = sig([]);
  for (const row of ROWS) {
    assertEquals(
      sig(row.parts) !== none,
      row.tier === "stat",
      `${row.change}: signature moves iff it is a stat change`,
    );
  }
  // Discrete limits censor by level set, so their order does not count.
  assertEquals(
    sig([ScaleXContinuous.part({ kind: "discrete", domain: ["b", "a"] })]),
    sig([ScaleXContinuous.part({ kind: "discrete", domain: ["a", "b"] })]),
  );
});
