# Facet panel layout semantics

Contract date: 2026-07-17

All panels, strips, axes, marks, text, and the shared legend render within one
top-level Use.GPU canvas. The compiler emits a single `Embedded` tree;
`FacetGrid` assigns responsive CSS-pixel rectangles and `FacetPanel` contributes
to the same virtual-layer reconciler.

## Axis and strip matrix

| Facet | Scales | Domains                      | Axis text policy                                    | Strips                                                      |
| ----- | ------ | ---------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| wrap  | fixed  | shared x/y                   | shared exterior x/y                                 | one combined strip per occupied cell                        |
| wrap  | free_x | x per panel, shared y        | x belongs to each panel; y remains exterior/shared  | one combined strip per occupied cell                        |
| wrap  | free_y | shared x, y per panel        | y belongs to each panel; x remains exterior/shared  | one combined strip per occupied cell                        |
| wrap  | free   | x/y per panel                | both axes belong to each panel                      | one combined strip per occupied cell                        |
| grid  | fixed  | shared x/y                   | x on exterior bottom row; y on exterior left column | crossed row/column values; empty combinations retain a cell |
| grid  | free_x | x per column/panel, shared y | local x; exterior/shared y                          | same as fixed                                               |
| grid  | free_y | shared x, y per row/panel    | exterior/shared x; local y                          | same as fixed                                               |
| grid  | free   | x/y per panel                | local x/y                                           | same as fixed                                               |

The current RenderTree records the selected policy as `FacetGrid.axisPolicy`.
Axes and grids are panel-local drawing primitives; fixed-scale textual guides
and titles are a single exterior overlay. Free-scale domains are trained per
panel. A future richer grid-strip renderer may visually coalesce repeated row
and column strips without changing panel membership or scale semantics.

## Rectangle model

`facetCellLayouts(width, height, nrow, ncol, gap, stripHeight)` is the canonical
responsive layout function. It returns non-overlapping cell, strip, and panel
rectangles in CSS pixels. Defaults are 24 px panel spacing and a 24 px strip.
`theme({panelSpacing, stripHeight})` overrides them. The strip is reserved above
the drawable panel rather than painted over marks. A partial final wrap row
retains full-grid column widths. Crossed grid combinations retain rectangles
even when their data slice is empty.

If the available cell height is smaller than the requested strip, the strip is
clamped to the cell; the panel becomes empty rather than acquiring negative
dimensions. Hosts should treat a drawable panel smaller than 24×24 CSS px as a
compact/empty field and avoid promising readable ticks. Geometry is recomputed
from `LayoutContext` on resize, so no device-pixel ratio is baked into layout.

## Coordinates, clipping, and legends

- `coord_flip` swaps projected x/y semantics before axis policy is interpreted;
  free_x/free_y continue to name data aesthetics, while the displayed side is
  swapped by the coordinate projection.
- `coord_fixed` applies its ratio inside each panel rectangle; it never changes
  grid membership or consumes strip/legend space.
- Panel transforms bound marks to their panel viewport. Grid/background depth
  remains below marks and text; sibling panels do not share a data transform.
- Legends are trained once at plot level and remain outside `FacetGrid`, so an
  empty combination cannot duplicate or retrain a legend.
- Live and emitted backends use the same RenderTree properties and equivalent
  CSS-pixel rectangle formula. Source-emission tests pin the standalone helper.

## Fixtures

The gallery fixtures `FacetedScatter` and `FacetGridStats` exercise wrap-fixed,
grid-fixed, shared legends, and empty/statistical panels. Compiler fixtures
cover wrap `free`, `free_x`, and `free_y`, explicit wrapping columns, coord
projection, empty grid combinations, shared legends, and source-emitted helper
parity. `facet_layout_test.ts` covers spacing, strips, minimum geometry, and
responsive resize deterministically.
