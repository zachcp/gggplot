import { assertEquals } from "@std/assert";
import { facetCellLayouts } from "../src/compile/facet_layout.ts";

Deno.test("facet rectangles reserve strips and spacing without overlap", () => {
  const cells = facetCellLayouts(400, 300, 2, 2, 16, 24);
  assertEquals(cells.map((cell) => cell.panel), [
    [0, 24, 192, 142],
    [208, 24, 400, 142],
    [0, 182, 192, 300],
    [208, 182, 400, 300],
  ]);
  for (const cell of cells) {
    assertEquals(cell.strip[3], cell.panel[1]);
    assertEquals(cell.panel[0] >= cell.cell[0], true);
    assertEquals(cell.panel[2] <= cell.cell[2], true);
  }
});

Deno.test("facet rectangles recompute from responsive CSS pixel dimensions", () => {
  const narrow = facetCellLayouts(240, 180, 1, 3, 12, 20);
  const wide = facetCellLayouts(600, 180, 1, 3, 12, 20);
  assertEquals(narrow[0].panel[2], 72);
  assertEquals(wide[0].panel[2], 192);
  assertEquals(narrow[2].panel[2], 240);
  assertEquals(wide[2].panel[2], 600);
});
