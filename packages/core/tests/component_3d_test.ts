// gggplot-so9h: 3D on the component path. The root's prepare/train/layout
// builds the same two-pass Scene3D tree compile() does (orbit content with
// camera-aware axes, flat overlay, depth policies), from the same parts: the
// only differences are the component path's mark keys and owners.
import { assertEquals } from "@std/assert";
import {
  createRootCaches,
  layoutRoot,
  plotSpec,
  prepareRoot,
} from "../src/components/root_assembly.ts";
import { layerFromProps } from "../src/components/geom_layer.ts";
import {
  GeomLine,
  GeomPoint,
  GeomSurface,
  GeomText,
  GeomVoxel,
  type NamedGeom,
} from "../src/components/geoms.ts";
import {
  Camera3d,
  CoordCartesian,
  Labs,
} from "../src/components/plot_parts.ts";
import {
  buildFacetPanels,
  compile,
  type RenderNode,
} from "../src/compile/mod.ts";
import type { SpecPart } from "../src/dsl/base.ts";
import { ingest } from "../src/data/mod.ts";
import type { Aes } from "../src/ir/types.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";
import { componentProbe } from "../src/components/probe.ts";

const LAYOUT = {
  width: 640,
  height: 420,
  measureText: approximateTextMeasurer,
};

// A complete 4 x 4 grid, so geom_surface has its height field.
const data = ingest({
  x: Array.from({ length: 16 }, (_, i) => i % 4),
  y: Array.from({ length: 16 }, (_, i) => Math.floor(i / 4)),
  z: Array.from({ length: 16 }, (_, i) => Math.sin(i / 3)),
  g: Array.from({ length: 16 }, (_, i) => ["a", "b"][i % 2]),
  label: Array.from({ length: 16 }, (_, i) => `p${i}`),
});

/** Strip what only the component path adds: mark keys and owners. */
function plain(node: RenderNode): unknown {
  return {
    component: node.component,
    props: node.props,
    children: node.children.map(plain),
  };
}

// deno-lint-ignore no-explicit-any
type Geom = NamedGeom<any>;

function both(
  layers: Array<[Geom, Record<string, unknown>]>,
  mapping: Aes,
  parts: SpecPart[] = [],
) {
  const built = layers.map(([geom, props]) =>
    layerFromProps(geom.layerProps(props))
  );
  const base = plotSpec(data, mapping, undefined, undefined, parts);
  const caches = createRootCaches();
  const root = prepareRoot(
    base,
    built.map((layer, i) => ({ kind: "layer" as const, id: i + 1, layer })),
    buildFacetPanels(base.facet, base.data, base.labels),
    caches,
  )!;
  const component = layoutRoot(root, LAYOUT, caches).tree;
  const spec = { ...base, layers: built };
  const compiled = compile(spec, { layout: LAYOUT });
  return { component, compiled };
}

const XYZ: Aes = { x: "x", y: "y", z: "z" };

const CASES: Array<
  [string, Array<[Geom, Record<string, unknown>]>, Aes, SpecPart[]]
> = [
  [
    "points and paths",
    [[GeomPoint, { mapping: { color: "g" } }], [
      GeomLine,
      { mapping: { group: "g" } },
    ]],
    XYZ,
    [],
  ],
  ["a surface", [[GeomSurface, { mapping: { fill: "z" } }]], XYZ, []],
  ["binned voxels", [[GeomVoxel, { bins: 3 }]], XYZ, []],
  [
    "text at world positions",
    [[GeomText, {
      mapping: { label: "label" },
    }]],
    XYZ,
    [],
  ],
  ["a camera, an axis swizzle and labels", [[GeomPoint, {}]], XYZ, [
    Camera3d.part({ bearing: 0.6, pitch: 0.4 }),
    CoordCartesian.part({ axes: "xzy" }),
    Labs.part({ title: "Helix", x: "east", z: "up" }),
  ]],
];

for (const [name, layers, mapping, parts] of CASES) {
  Deno.test(`3D on the component path matches compile(): ${name}`, () => {
    const { component, compiled } = both(layers, mapping, parts);
    assertEquals(component.component, "Scene3D");
    assertEquals(plain(component), plain(compiled));
  });
}

Deno.test("a 3D resize re-lowers nothing and keeps every tensor", () => {
  const layer = layerFromProps(
    GeomPoint.layerProps({ mapping: { color: "g" } }),
  );
  const base = plotSpec(data, XYZ, undefined, undefined, []);
  const caches = createRootCaches();
  const root = prepareRoot(
    base,
    [{ kind: "layer", id: 1, layer }],
    buildFacetPanels(base.facet, base.data, base.labels),
    caches,
  )!;
  const arrays = (tree: RenderNode) => {
    const out: unknown[] = [];
    const walk = (node: RenderNode) => {
      const positions = node.props.positions as { array?: unknown } | undefined;
      if (node.key?.startsWith("layer-") && positions?.array) {
        out.push(positions.array);
      }
      node.children.forEach(walk);
    };
    walk(tree);
    return out;
  };
  const before = arrays(layoutRoot(root, LAYOUT, caches).tree);
  componentProbe.reset();
  const after = arrays(
    layoutRoot(root, { ...LAYOUT, width: 900, height: 600 }, caches).tree,
  );
  assertEquals(componentProbe.lowerCalls, 0);
  assertEquals(before.length > 0, true, "the 3D marks are keyed per layer");
  assertEquals(after.every((array, i) => array === before[i]), true);
});
