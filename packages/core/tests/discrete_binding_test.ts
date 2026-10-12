// gggplot-81r: discrete color on the GPU. A point layer's factor color binds
// as level codes through a small lookup; the lookup matches the CPU mapping
// (palette folding, explicit ranges, levels outside the domain, missing
// values), and a level reorder or palette swap re-lowers nothing.
import { assert, assertEquals } from "@std/assert";
import {
  assembleRoot,
  createRootCaches,
  plotSpec,
  prepareRoot,
} from "../src/components/root_assembly.ts";
import { layerFromProps } from "../src/components/geom_layer.ts";
import { GeomPoint } from "../src/components/geoms.ts";
import { ScaleFill } from "../src/components/plot_parts.ts";
import { componentProbe } from "../src/components/probe.ts";
import { buildFacetPanels, type RenderNode } from "../src/compile/mod.ts";
import type { SpecPart } from "../src/dsl/base.ts";
import { ingest, type InputData } from "../src/data/mod.ts";
import { NA_COLOR } from "../src/scale/mapping.ts";
import { parseColorRGBA } from "../src/color/mod.ts";
import {
  discreteColorLookup,
  isDiscreteGpuBindable,
} from "../src/render/scale_bindings.ts";
import { baselineName, compileBaseline } from "./support/compile_baseline.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";

const LAYOUT = {
  width: 640,
  height: 400,
  measureText: approximateTextMeasurer,
};

function find(tree: RenderNode, component: string): RenderNode | undefined {
  if (tree.component === component) return tree;
  for (const child of tree.children) {
    const found = find(child, component);
    if (found) return found;
  }
}

/** The component path's per-vertex colors, as the WGSL computes them. */
function gpuColors(raw: InputData, parts: SpecPart[]): number[][] {
  const data = ingest(raw);
  const base = plotSpec(
    data,
    { x: "x", y: "y", fill: "g" },
    undefined,
    undefined,
    parts,
  );
  const layers = [{
    kind: "layer" as const,
    id: 1,
    layer: layerFromProps(GeomPoint.layerProps({})),
  }];
  const caches = createRootCaches();
  const root = prepareRoot(
    base,
    layers,
    buildFacetPanels(base.facet, base.data, base.labels),
    caches,
  )!;
  const { tree } = assembleRoot(
    base,
    layers,
    buildFacetPanels(base.facet, base.data, base.labels),
    LAYOUT,
    caches,
  )!;
  const point = find(tree, "BoundPoint");
  assert(point, "the factor fill binds on the GPU");
  const { codes, levels } = point.props.color as {
    codes: Uint32Array;
    levels: string[];
  };
  const scale = root.trained.guideScales.fill;
  assert(isDiscreteGpuBindable(scale));
  const lookup = discreteColorLookup(scale, levels);
  // The NA color is an f32 uniform on the GPU.
  const na = parseColorRGBA(NA_COLOR).map(Math.fround);
  return Array.from(point.owners!, (owner) => {
    const code = codes[owner];
    return code >= levels.length
      ? [na[0], na[1], na[2], 1]
      : [...lookup.slice(code * 4, code * 4 + 3), 1];
  });
}

const quiet = <T>(f: () => T): T => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return f();
  } finally {
    console.warn = warn;
  }
};

const rows = (levels: (string | null)[]) => ({
  x: levels.map((_, i) => i),
  y: levels.map((_, i) => i % 3),
  g: levels,
});

const CASES: Array<[string, InputData, SpecPart[]]> = [
  [
    "default palette with a missing value",
    rows(["a", "b", "c", null, "a"]) as never,
    [],
  ],
  // More levels than the categorical palette: the extras fold to "Other".
  [
    "palette folding",
    rows(
      Array.from({ length: 24 }, (_, i) => `l${String(i).padStart(2, "0")}`),
    ),
    [],
  ],
  // A declared domain reorders and drops "c": its rows map to NA.
  ["declared domain subset", rows(["a", "b", "c", "a"]), [
    ScaleFill.part({ domain: ["b", "a"] }),
  ]],
  ["explicit range", rows(["a", "b", "a"]), [
    ScaleFill.part({ range: ["#112233", "#ddeeff"] }),
  ]],
];

for (const [name, data, parts] of CASES) {
  Deno.test(`discrete GPU color matches the CPU: ${name}`, () => {
    quiet(() =>
      assertEquals(
        gpuColors(data, parts),
        compileBaseline(
          baselineName("discrete", name),
        ),
      )
    );
  });
}

Deno.test("a level reorder or palette swap re-lowers no mark", () => {
  const data = ingest(rows(["a", "b", "c", "a", "b"]));
  const layers = [{
    kind: "layer" as const,
    id: 1,
    layer: layerFromProps(GeomPoint.layerProps({})),
  }];
  const caches = createRootCaches();
  const assemble = (parts: SpecPart[]) => {
    const base = plotSpec(
      data,
      { x: "x", y: "y", fill: "g" },
      undefined,
      undefined,
      parts,
    );
    return assembleRoot(
      base,
      layers,
      buildFacetPanels(base.facet, base.data, base.labels),
      LAYOUT,
      caches,
    )!;
  };
  const before = find(assemble([]).tree, "BoundPoint")!;
  componentProbe.reset();
  const reordered = find(
    assemble([ScaleFill.part({ domain: ["c", "b", "a"] })]).tree,
    "BoundPoint",
  )!;
  const swapped = find(
    assemble([ScaleFill.part({ range: ["#000000", "#777777", "#ffffff"] })])
      .tree,
    "BoundPoint",
  )!;
  assertEquals(componentProbe.statCalls, 0);
  assertEquals(componentProbe.lowerCalls, 0);
  // The very same mark props: nothing for the GPU to re-upload but the lookup
  // BoundPoint rebuilds from the new scale.
  assert(reordered.props === before.props);
  assert(swapped.props === before.props);
});
