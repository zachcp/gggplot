// gggplot-lcy.7: node-budget and render-tree coverage for EVERY supported 3D
// topology.
//
// node_budget_test.ts covers the 2D families thoroughly and the 3D modes not at
// all. The gap mattered because the 3D modes lower through different code paths
// than their 2D siblings — surface_3d.ts's shared face path, line.ts's threeD
// branch, text.ts's lowerText3d — and nothing asserted those paths stay at one
// mark node per layer.
//
// The case table is checked AGAINST THE REGISTRY rather than hand-maintained:
// adding a 3D mode to a geom without adding a case here fails
// "every 3D-capable geom is covered". Two earlier tests in this epic broke by
// naming geoms that later gained 3D modes; deriving the expectation from
// GEOM_REGISTRY is what stops that recurring.
import { assertEquals } from "@std/assert";
import {
  aes,
  geomArea,
  geomCol,
  geomLine,
  geomPath,
  geomPoint,
  geomPolygon,
  geomRect,
  geomRibbon,
  geomSegment,
  geomSurface,
  geomText,
  geomVoxel,
  ggplot,
} from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import { GEOM_REGISTRY } from "../src/geom/mod.ts";
import type { GGSpec } from "../src/dsl/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";

/** Every component name the compiler may use for a MARK (not a guide). */
const MARK_COMPONENTS = new Set<string>([
  "Point",
  "Line",
  "ChunkedLine",
  "ChunkedFace",
  "Label",
]);

function findAllRaw(
  tree: RenderNode,
  match: (n: RenderNode) => boolean,
): RenderNode[] {
  return [
    ...(match(tree) ? [tree] : []),
    ...tree.children.flatMap((child) => findAllRaw(child, match)),
  ];
}

/**
 * Marks live inside the panel's Cartesian node; legend swatches reuse the same
 * component names as siblings of it. Scope every search the same way
 * node_budget_test.ts does, for the same reason.
 */
function markNodes(tree: RenderNode): RenderNode[] {
  const panels = findAllRaw(tree, (n) => n.component === "Cartesian");
  return panels.flatMap((panel) =>
    findAllRaw(panel, (n) => MARK_COMPONENTS.has(n.component))
  );
}

const rows = {
  x: [0, 1, 2, 0, 1, 2],
  y: [0, 1, 2, 1, 2, 3],
  z: [0, 1, 2, 2, 1, 0],
  g: ["a", "a", "a", "b", "b", "b"],
};

/** geom_surface declares a grid contract: every (x, y) pair exactly once. */
function gridRows(n: number) {
  const x: number[] = [], y: number[] = [], z: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      x.push(i);
      y.push(j);
      z.push((i * j) % 3);
    }
  }
  return { x, y, z };
}

/**
 * One case per 3D-capable geom. `component` is the single mark node the layer
 * is budgeted to produce — the whole point of the rule is that this is one node
 * however many rows, groups, or boxes the geom expands to internally.
 */
const CASES: { geom: string; component: string; spec: () => GGSpec }[] = [
  {
    geom: "point",
    component: "Point",
    spec: () =>
      ggplot(rows, aes({ x: "x", y: "y", z: "z" })).add(geomPoint()).build(),
  },
  {
    geom: "line",
    component: "ChunkedLine",
    spec: () =>
      ggplot(rows, aes({ x: "x", y: "y", z: "z", group: "g" })).add(geomLine())
        .build(),
  },
  {
    geom: "path",
    component: "ChunkedLine",
    spec: () =>
      ggplot(rows, aes({ x: "x", y: "y", z: "z", group: "g" })).add(geomPath())
        .build(),
  },
  {
    geom: "segment",
    component: "ChunkedLine",
    spec: () =>
      ggplot(
        {
          ...rows,
          xe: [1, 2, 3, 1, 2, 3],
          ye: [1, 2, 3, 2, 3, 4],
          ze: [1, 2, 3, 3, 2, 1],
        },
        aes({ x: "x", y: "y", z: "z", xend: "xe", yend: "ye", zend: "ze" }),
      ).add(geomSegment()).build(),
  },
  {
    geom: "text",
    component: "Label",
    spec: () =>
      ggplot(
        { ...rows, l: ["a", "b", "c", "d", "e", "f"] },
        aes({ x: "x", y: "y", z: "z", label: "l" }),
      ).add(geomText()).build(),
  },
  {
    geom: "area",
    component: "ChunkedFace",
    spec: () =>
      ggplot(rows, aes({ x: "x", y: "y", z: "z", group: "g" })).add(geomArea())
        .build(),
  },
  {
    geom: "col",
    component: "ChunkedFace",
    spec: () =>
      ggplot(rows, aes({ x: "x", y: "y", z: "z" })).add(geomCol()).build(),
  },
  {
    geom: "polygon",
    component: "ChunkedFace",
    spec: () =>
      ggplot(rows, aes({ x: "x", y: "y", z: "z", group: "g" })).add(
        geomPolygon(),
      ).build(),
  },
  {
    geom: "ribbon",
    component: "ChunkedFace",
    spec: () =>
      ggplot(
        { ...rows, lo: [0, 0, 0, 1, 1, 1], hi: [1, 2, 3, 2, 3, 4] },
        aes({ x: "x", ymin: "lo", ymax: "hi", z: "z", group: "g" }),
      ).add(geomRibbon()).build(),
  },
  {
    geom: "rect",
    component: "ChunkedFace",
    spec: () =>
      ggplot(
        { x0: [0, 2], x1: [1, 3], y0: [0, 2], y1: [1, 3], z: [0, 1] },
        aes({ xmin: "x0", xmax: "x1", ymin: "y0", ymax: "y1", z: "z" }),
      ).add(geomRect()).build(),
  },
  {
    geom: "surface",
    component: "ChunkedFace",
    spec: () =>
      ggplot(gridRows(4), aes({ x: "x", y: "y", z: "z" })).add(geomSurface())
        .build(),
  },
  {
    geom: "voxel",
    component: "ChunkedFace",
    spec: () =>
      ggplot(rows, aes({ x: "x", y: "y", z: "z" })).add(geomVoxel({ bins: 3 }))
        .build(),
  },
];

Deno.test("every 3D-capable geom is covered by a node-budget case", () => {
  const capable = Object.entries(
    GEOM_REGISTRY as unknown as Record<
      string,
      { modes?: { dimensions: number }[] }
    >,
  )
    .filter(([, def]) =>
      (def.modes ?? []).some((mode) => mode.dimensions === 3)
    )
    .map(([name]) => name)
    .sort();
  assertEquals(
    CASES.map((c) => c.geom).sort(),
    capable,
    "a geom gained or lost a 3D mode — add or remove its case above",
  );
});

for (const { geom, component, spec } of CASES) {
  Deno.test(`node budget: 3D geom_${geom} is exactly 1 ${component} node`, () => {
    const marks = markNodes(compile(spec()));
    assertEquals(
      marks.map((m) => m.component),
      [component],
      `geom_${geom} in 3D must lower to a single ${component} mark`,
    );
  });
}

Deno.test("every 3D mark carries vec4 positions and a resolved depth policy", () => {
  for (const { geom, spec } of CASES) {
    const [mark] = markNodes(compile(spec()));
    const positions = mark.props.positions as
      | { dims?: number }
      | readonly unknown[]
      | undefined;
    // geom_text passes plain [x, y, z, w] tuples rather than a packed tensor
    // (gggplot-frg): use.gpu's Label reads a parsed array directly, and the
    // packed form does not draw. Both shapes are four-component positions.
    if (Array.isArray(positions)) {
      assertEquals(
        (positions[0] as number[]).length,
        4,
        `geom_${geom} tuple positions must be vec4`,
      );
    } else {
      assertEquals(
        (positions as { dims?: number }).dims,
        4,
        `geom_${geom} tensor positions must be vec4`,
      );
    }
    // depthTest is what every 3D policy resolves to; an unset value would mean
    // the mark never went through depthProps at all.
    assertEquals(
      mark.props.depthTest,
      true,
      `geom_${geom} must carry a resolved depth policy`,
    );
  }
});
