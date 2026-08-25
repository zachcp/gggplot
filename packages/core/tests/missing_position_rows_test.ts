// Regression tests for gggplot-bab: geoms whose rows are independent marks
// used to plot a row with no position at a fabricated coordinate.
//
// The mechanism is shared with gggplot-ybv: ingest() turns NaN into null, and
// scalePosition maps null onto a finite coordinate (Number(null) === 0), so a
// finiteness test on the SCALED value never fires. Measured before this fix,
// geom_point compiled [0, NaN, 2] to positions [0,0, 1,0, 2,2] — row 1 drawn
// at y = 0, a coordinate its data never had.
//
// The fix is PER GEOM, declared by GeomDefinition.dropsMissingPositions, and
// that is the substance of this bead rather than an implementation detail. A
// blanket filter was implemented and measured first: it broke exactly four
// tests, each asserting that a missing value carries structural meaning —
// geom_surface's complete-grid contract, geom_polygon's ring, the interval
// family. For those geoms the gap IS the information, so they must keep the
// row. These tests pin both halves.
import { assertEquals } from "@std/assert";
import {
  geomCol,
  geomPath,
  geomPoint,
  geomTile,
  ggplot,
} from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";
import { GEOM_REGISTRY } from "../src/geom/mod.ts";

const MARKS = new Set([
  "Point",
  "ChunkedLine",
  "ChunkedFace",
  "Line",
  "Polygon",
]);

/** Packed coordinates of the first in-panel mark node. */
function markCoords(spec: Parameters<typeof compile>[0]): number[] {
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
  walk(compile(spec) as RenderNode, false);
  return found ?? [];
}

Deno.test("geom_point drops a row with no position instead of drawing it at 0", () => {
  const build = (y: number[]) =>
    ggplot({ x: [0, 1, 2], y }, { x: "x", y: "y" }).add(geomPoint()).build();
  assertEquals(markCoords(build([0, 1, 2])), [0, 0, 1, 1, 2, 2]);
  // Before the fix this was [0,0, 1,0, 2,2] — same length, fabricated middle.
  assertEquals(markCoords(build([0, Number.NaN, 2])), [0, 0, 2, 2]);
});

Deno.test("row-independent geoms drop the row; the mark count falls", () => {
  const cases: Array<[string, (y: number[]) => Parameters<typeof compile>[0]]> =
    [
      [
        "tile",
        (y) =>
          ggplot({ x: [0, 1, 2], y }, { x: "x", y: "y" }).add(geomTile())
            .build(),
      ],
      [
        "col",
        (y) =>
          ggplot({ x: ["a", "b", "c"], y }, { x: "x", y: "y" }).add(geomCol())
            .build(),
      ],
    ];
  for (const [name, build] of cases) {
    const clean = markCoords(build([0, 1, 2])).length;
    const holed = markCoords(build([0, Number.NaN, 2])).length;
    assertEquals(holed < clean, true, `${name}: ${holed} should be < ${clean}`);
  }
});

Deno.test("topological geoms keep the row, because the gap is the information", () => {
  // geom_path must BREAK at a missing value, not join across it, so the row
  // has to survive lowering. ggplot2 does the same.
  assertEquals(GEOM_REGISTRY.path.dropsMissingPositions, undefined);
  assertEquals(GEOM_REGISTRY.line.dropsMissingPositions, undefined);
  assertEquals(GEOM_REGISTRY.polygon.dropsMissingPositions, undefined);
  assertEquals(GEOM_REGISTRY.surface.dropsMissingPositions, undefined);
  assertEquals(GEOM_REGISTRY.area.dropsMissingPositions, undefined);

  // And behaviourally: the filter must not run for them.
  const holed = markCoords(
    ggplot({ x: [0, 1, 2], y: [0, Number.NaN, 2] }, { x: "x", y: "y" })
      .add(geomPath()).build(),
  );
  const clean = markCoords(
    ggplot({ x: [0, 1, 2], y: [0, 1, 2] }, { x: "x", y: "y" })
      .add(geomPath()).build(),
  );
  assertEquals(holed.length, clean.length, "geom_path must keep every row");
});

Deno.test("the row-independent set is declared, not inferred", () => {
  // A new geom defaults to keeping rows, which is the safe direction: keeping
  // a row is a visible artifact, dropping one from a topological geom silently
  // rewrites the shape.
  for (const geom of ["point", "dotplot", "bar", "col", "tile", "rect"]) {
    assertEquals(
      GEOM_REGISTRY[geom as keyof typeof GEOM_REGISTRY].dropsMissingPositions,
      true,
      geom,
    );
  }
});

Deno.test("dropping a row keeps per-row aesthetics aligned", () => {
  // The filter runs on the frame, so every parallel column moves together —
  // this is exactly what made the per-geom index remapping unnecessary.
  const frame = (y: number[]) => ({
    x: [0, 1, 2],
    y,
    grp: ["one", "two", "three"],
  });
  const colorsOf = (y: number[]) => {
    let found: number[] = [];
    const walk = (node: RenderNode) => {
      if (node.component === "Point" && node.props.colors) {
        const tensor = node.props.colors as { array: ArrayLike<number> };
        if (tensor.array) found = Array.from(tensor.array);
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(
      compile(
        ggplot(frame(y), { x: "x", y: "y", color: "grp" }).add(geomPoint())
          .build(),
      ) as RenderNode,
    );
    return found;
  };
  const clean = colorsOf([0, 1, 2]);
  const holed = colorsOf([0, Number.NaN, 2]);
  assertEquals(holed.length, 8, "two surviving rows, vec4 each");
  // The survivors must keep their OWN colours: rows 0 and 2 of the clean run.
  assertEquals(holed.slice(0, 4), clean.slice(0, 4));
  assertEquals(holed.slice(4, 8), clean.slice(8, 12));
});
