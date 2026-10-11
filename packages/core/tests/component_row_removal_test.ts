// gggplot-6q9: row removals and missing-position semantics hold on the
// component path. The root's assembly (assembleRoot) runs the plot the parts
// describe; it must drop the same rows, report the same diagnostics, and keep
// reporting them when its prepared layers come from cache.
import { assertEquals } from "@std/assert";
import {
  assembleRoot,
  createRootCaches,
  plotSpec,
  type RootCaches,
} from "../src/components/root_assembly.ts";
import { layerFromProps } from "../src/components/geom_layer.ts";
import {
  GeomBar,
  GeomCol,
  GeomPath,
  GeomPoint,
  GeomTile,
  type NamedGeom,
} from "../src/components/geoms.ts";
import { FacetWrap, ScaleXContinuous } from "../src/components/plot_parts.ts";
import { componentProbe } from "../src/components/probe.ts";
import {
  buildFacetPanels,
  compile,
  type RenderNode,
  rowRemovalsOf,
} from "../src/compile/mod.ts";
import type { SpecPart } from "../src/dsl/base.ts";
import { ingest, type InputData } from "../src/data/mod.ts";
import type { Aes, GGSpec, Layer } from "../src/ir/types.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";

const LAYOUT = {
  width: 640,
  height: 400,
  measureText: approximateTextMeasurer,
};

const layer = (
  // deno-lint-ignore no-explicit-any
  component: NamedGeom<any>,
  props: Record<string, unknown> = {},
) => layerFromProps(component.layerProps(props));

interface Plot {
  data: InputData;
  mapping: Aes;
  layers: Layer[];
  parts?: SpecPart[];
}

/** The spec the root builds from these parts, with its layers. */
function specOf({ data, mapping, layers, parts = [] }: Plot): GGSpec {
  const spec = plotSpec(ingest(data), mapping, undefined, undefined, parts);
  return { ...spec, layers };
}

/** Assemble through the component root's path, console warnings captured. */
function assemble(plot: Plot, caches: RootCaches = createRootCaches()) {
  const spec = specOf(plot);
  const base = { ...spec, layers: [] };
  return assembleRoot(
    base,
    spec.layers.map((layer, i) => ({
      kind: "layer" as const,
      id: i + 1,
      layer,
    })),
    buildFacetPanels(base.facet, base.data, base.labels),
    LAYOUT,
    caches,
  );
}

/** What compile() reports for the same plot. */
function compiled(plot: Plot) {
  const original = console.warn;
  console.warn = () => {};
  try {
    return compile(specOf(plot), { layout: LAYOUT }) as RenderNode;
  } finally {
    console.warn = original;
  }
}

const PLOTS: Record<string, Plot> = {
  "nothing dropped": {
    data: { x: [0, 1, 2], y: [0, 1, 2] },
    mapping: { x: "x", y: "y" },
    layers: [layer(GeomPoint)],
  },
  "outside limits": {
    data: { x: [0, 1, 50, 99], y: [0, 1, 2, 3] },
    mapping: { x: "x", y: "y" },
    layers: [layer(GeomPoint)],
    parts: [ScaleXContinuous.part({ domain: [0, 10] })],
  },
  "missing positions": {
    data: { x: [0, null, 2], y: [0, 1, NaN] } as never,
    mapping: { x: "x", y: "y" },
    layers: [layer(GeomPoint)],
  },
  "both reasons, counted once each": {
    data: { x: [0, null, 50, 1, null], y: [0, 1, 2, 3, 4] } as never,
    mapping: { x: "x", y: "y" },
    layers: [layer(GeomPoint)],
    parts: [ScaleXContinuous.part({ domain: [0, 10] })],
  },
  "summed across facet panels": {
    data: {
      x: [0, 50, 0, 50, 0, 50],
      y: [0, 1, 2, 3, 4, 5],
      g: ["a", "a", "b", "b", "c", "c"],
    },
    mapping: { x: "x", y: "y" },
    layers: [layer(GeomPoint)],
    parts: [
      ScaleXContinuous.part({ domain: [0, 10] }),
      FacetWrap.part({ vars: ["g"] }),
    ],
  },
  "per layer": {
    data: { x: [0, 50, 99], y: [1, 2, 3] },
    mapping: { x: "x", y: "y" },
    layers: [layer(GeomPoint), layer(GeomBar)],
    parts: [ScaleXContinuous.part({ domain: [0, 10] })],
  },
};

Deno.test("the component path reports compile()'s diagnostics", () => {
  for (const [name, plot] of Object.entries(PLOTS)) {
    assertEquals(
      assemble(plot).diagnostics,
      rowRemovalsOf(compiled(plot)),
      name,
    );
  }
  assertEquals(assemble(PLOTS["nothing dropped"]).diagnostics, []);
  assertEquals(assemble(PLOTS["both reasons, counted once each"]).diagnostics, [
    { layer: 0, geom: "point", reason: "missing-position", rows: 2 },
    { layer: 0, geom: "point", reason: "outside-limits", rows: 1 },
  ]);
  assertEquals(assemble(PLOTS["summed across facet panels"]).diagnostics, [
    { layer: 0, geom: "point", reason: "outside-limits", rows: 3 },
  ]);
});

Deno.test("cached layers keep reporting their removals", () => {
  // A re-assembly over unchanged parts (a resize, a sibling's change) takes
  // every prepared layer from cache; the removals it recorded must come back
  // with it, or the diagnostics would flicker empty.
  const spec = specOf(PLOTS["both reasons, counted once each"]);
  const base = { ...spec, layers: [] };
  const layers = spec.layers.map((layer, i) => ({
    kind: "layer" as const,
    id: i + 1,
    layer,
  }));
  const panels = buildFacetPanels(base.facet, base.data, base.labels);
  const caches = createRootCaches();
  const first = assembleRoot(base, layers, panels, LAYOUT, caches);
  const stats = componentProbe.statCalls;
  const second = assembleRoot(
    base,
    layers,
    panels,
    { ...LAYOUT, width: 800 },
    caches,
  );
  assertEquals(componentProbe.statCalls, stats, "no layer re-prepared");
  assertEquals(second.diagnostics, first.diagnostics);
  assertEquals(second.diagnostics.length, 2);
});

Deno.test("assembly itself does not warn; the root warns on change", () => {
  const warnings: unknown[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args);
  try {
    assemble(PLOTS["outside limits"]);
  } finally {
    console.warn = original;
  }
  assertEquals(warnings, []);
});

const MARKS = new Set([
  "Point",
  "ChunkedLine",
  "ChunkedFace",
  "Line",
  "Polygon",
]);

/** Packed coordinates of the first in-panel mark node. */
function markCoords(tree: RenderNode): number[] {
  let found: number[] | null = null;
  const walk = (node: RenderNode, inPanel: boolean) => {
    const panel = inPanel || node.component === "Cartesian" ||
      node.component === "Polar";
    if (panel && MARKS.has(node.component) && found === null) {
      const positions = node.props.positions as
        | { array: ArrayLike<number> }
        | undefined;
      if (positions?.array) found = Array.from(positions.array);
    }
    for (const child of node.children ?? []) walk(child, panel);
  };
  walk(tree, false);
  return found ?? [];
}

Deno.test("missing positions drop or keep rows per geom, as compile does", () => {
  const cases: Array<[string, Plot]> = [
    ["point drops", {
      data: { x: [0, 1, 2], y: [0, NaN, 2] },
      mapping: { x: "x", y: "y" },
      layers: [layer(GeomPoint)],
    }],
    ["col drops", {
      data: { x: [0, 1, 2], y: [1, NaN, 3] },
      mapping: { x: "x", y: "y" },
      layers: [layer(GeomCol)],
    }],
    ["tile keeps a missing z", {
      data: { x: [0, 1], y: [0, 0], z: [1, NaN] },
      mapping: { x: "x", y: "y", fill: "z" },
      layers: [layer(GeomTile)],
    }],
    ["path keeps the gap", {
      data: { x: [0, 1, 2, 3], y: [0, NaN, 2, 3] },
      mapping: { x: "x", y: "y" },
      layers: [layer(GeomPath)],
    }],
  ];
  for (const [name, plot] of cases) {
    assertEquals(
      markCoords(assemble(plot).tree),
      markCoords(compiled(plot)),
      name,
    );
  }
  // The point case, pinned: the NaN row is gone, not drawn at y = 0.
  assertEquals(markCoords(assemble(cases[0][1]).tree).length, 4);
});
