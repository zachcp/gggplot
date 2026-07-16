# Coverage Backlog: gggplot vs. ggplot2 4.0.3 and Gribouille

This is a full inventory of the aesthetics, geoms, stats, positions, scales,
coordinate systems, facets, themes, and guides in **ggplot2 4.0.3** (the current
CRAN release, Sept 2025's S3→S7 rewrite) and **Gribouille**
(mcanouil/gribouille, actively developed, v0.4.1, checked 2026-07-06), each
compared against gggplot's current implementation. Use this as the backlog
source for `bd create` — the grouped bd epics filed alongside this doc pick up
its highest-value gaps first; this table is the exhaustive reference underneath
them.

Status values: `yes` (implemented), `partial` (implemented but narrower than the
peer), `missing` (no implementation).

## 1. Aesthetics

| Aesthetic                                     | gggplot | ggplot2                                                  | Gribouille     | Notes                                                                                                                          |
| --------------------------------------------- | ------- | -------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `x`, `y`                                      | yes     | yes                                                      | yes            |                                                                                                                                |
| `xmin/xmax/ymin/ymax`                         | yes     | yes                                                      | yes            |                                                                                                                                |
| `xend/yend`                                   | yes     | yes                                                      | yes            | added this session for segment/rect                                                                                            |
| `lower/middle/upper`                          | yes     | yes (boxplot)                                            | yes            |                                                                                                                                |
| `color`/`fill`                                | yes     | yes (`colour` British spelling canonical, `color` alias) | yes (`colour`) | gggplot: American-only, no alias — open question in GRAMMAR_ALIGNMENT.md                                                       |
| `alpha`                                       | yes     | yes                                                      | yes            |                                                                                                                                |
| `size`                                        | yes     | yes                                                      | yes            |                                                                                                                                |
| `shape`                                       | yes     | yes                                                      | yes            |                                                                                                                                |
| `group`                                       | yes     | yes                                                      | yes            | honors explicit `group` and defaults connected/stat grouping to the interaction of mapped factor aesthetics.                   |
| `label`                                       | yes     | yes                                                      | yes            |                                                                                                                                |
| `linetype`                                    | yes     | yes                                                      | yes            | discrete `scaleLinetype()` maps levels to solid/dashed/dotted/dotdash bindings; connected geoms group by mapped linetype       |
| `linewidth`                                   | yes     | yes (replaced line `size` in 3.4+)                       | yes            | continuous `scaleLinewidth()` maps typed values to use.gpu `Line.widths`; literal `linewidth` supersedes legacy `width`        |
| `stroke`                                      | missing | yes (point border width)                                 | yes            |                                                                                                                                |
| `family`/`fontface`                           | partial | yes                                                      | —              | theme has `fontFamily`, but it's a theme default, not a per-row mapped/literal aes; no fontface (bold/italic) at all           |
| `hjust`/`vjust`/`angle`/`lineheight`          | missing | yes                                                      | —              | no text-anchor or rotation control for geom_text/label                                                                         |
| `weight`                                      | missing | yes (stat input, e.g. weighted density/smooth)           | —              |                                                                                                                                |
| `sample`                                      | missing | yes (`stat_qq`)                                          | yes            | only relevant once stat_qq exists                                                                                              |
| `xintercept`/`yintercept`/`slope`/`intercept` | partial | yes (real aes, mappable to a column)                     | yes            | gggplot only accepts these as literal layer params on `geomHline`/`geomVline`/`geomAbline`, never as a mapped column           |
| `width`/`height`                              | partial | yes (geom_tile/bar; don't respond to scale transforms)   | yes            | gggplot has them as geom params (`layer.params.width`), not aesthetics — fine functionally, but not mappable per-row from data |

## 2. Geoms

45 in ggplot2 v4.0.3. gggplot has 18
(`point line path bar col area ribbon
polygon tile text boxplot errorbar smooth segment rect hline vline abline`).

| Geom                                                     | gggplot                   | ggplot2                                             | Gribouille                                    | Notes                                                                               |
| -------------------------------------------------------- | ------------------------- | --------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| point / line / path / step                               | partial                   | yes                                                 | yes                                           | have point/line/path; missing `step`                                                |
| bar / col / histogram                                    | partial                   | yes                                                 | yes                                           | have bar/col; no distinct `geom_histogram` (stat_bin currently has no geom pairing) |
| area / ribbon                                            | yes                       | yes                                                 | yes                                           |                                                                                     |
| polygon / rect / tile / raster                           | yes (raster aliases tile) | yes (raster is its own optimized geom)              | yes                                           |                                                                                     |
| boxplot / violin / dotplot                               | partial                   | yes                                                 | violin missing in Gribouille too              | boxplot yes; violin and dotplot both missing                                        |
| errorbar / errorbarh / linerange / pointrange / crossbar | partial                   | yes                                                 | yes (no crossbar-equivalent check)            | have errorbar only                                                                  |
| smooth                                                   | yes (lm only)             | yes (lm/loess/gam/glm/custom)                       | yes                                           | loess/gam are a real statistics gap, not just API                                   |
| text / label                                             | partial                   | yes (label draws a background box)                  | yes                                           | text/label render identically today; no label background box                        |
| segment / rect / hline / vline / abline                  | yes                       | yes                                                 | yes                                           | added this session                                                                  |
| curve / spoke / rug                                      | missing                   | yes                                                 | curve yes in Gribouille, rug yes              | curve is an arced segment; spoke is angle+radius; rug is axis-margin tick marks     |
| jitter (as geom)                                         | missing (position only)   | yes (`geom_jitter` = point + position_jitter sugar) | yes                                           | trivial sugar once `geomPoint({position:"jitter"})` exists (it already does)        |
| function                                                 | missing                   | yes (draws a stat_function curve)                   | yes                                           |                                                                                     |
| count                                                    | missing                   | yes (stat_sum sized-point overplot geom)            | yes                                           |                                                                                     |
| density / density_2d(_filled)                            | missing                   | yes                                                 | Gribouille also missing (has contour instead) | needs stat_density first                                                            |
| bin_2d / hex                                             | missing                   | yes                                                 | yes                                           | 2D binning geoms, needs stat_bin_2d/stat_bin_hex                                    |
| contour / contour_filled                                 | missing                   | yes                                                 | yes                                           | needs a grid + marching-squares stat                                                |
| qq / qq_line                                             | missing                   | yes                                                 | yes                                           | needs stat_qq                                                                       |
| quantile                                                 | missing                   | yes                                                 | yes                                           | needs stat_quantile (quantile regression)                                           |
| map / sf / sf_label / sf_text                            | missing (out of scope)    | yes                                                 | missing in Gribouille too                     | geospatial; skip unless a real use case appears                                     |
| blank                                                    | missing                   | yes (no-op geom, used for scale expansion tricks)   | —                                             | cheap to add, low value until someone needs it                                      |

## 3. Stats

5 in gggplot (`identity count bin smooth summary`) vs. ~27 in ggplot2 4.0.3.

| Stat                                                      | gggplot                                                                | ggplot2                                                      | Gribouille                          | Notes                                                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| identity                                                  | yes                                                                    | yes                                                          | yes                                 |                                                                                                            |
| count                                                     | yes                                                                    | yes                                                          | yes                                 | backed by `@gggplot/reductions` `groupedCount1d`; grouped by effective discrete aesthetics.                |
| bin                                                       | yes                                                                    | yes                                                          | yes                                 | backed by `@gggplot/reductions` `groupedHistogram1d`; no dedicated `geom_histogram` sugar yet.             |
| smooth                                                    | partial (lm only)                                                      | yes (lm/loess/gam/glm)                                       | yes                                 | grouped lm is implemented via `groupedLinearRegression1d`; loess/gam are a separate numerical-methods gap. |
| summary                                                   | yes                                                                    | yes                                                          | yes                                 | built-in aggregators backed by `groupedSummary1d`; arbitrary custom JS aggregators stay in core.           |
| boxplot                                                   | missing (we require pre-computed lower/middle/upper/ymin/ymax columns) | yes (computes quartiles from raw y)                          | yes                                 | real gap — ggplot2's `geom_boxplot` computes quantiles itself; ours makes the caller do it                 |
| density / ydensity                                        | missing                                                                | yes                                                          | Gribouille: no ydensity (no violin) | needed for `geom_density`/violin                                                                           |
| bin_2d / bin_hex / summary_2d / summary_bin / summary_hex | missing                                                                | yes                                                          | yes                                 | 2D/binned aggregation family                                                                               |
| ecdf                                                      | missing                                                                | yes                                                          | yes                                 |                                                                                                            |
| ellipse                                                   | missing                                                                | yes                                                          | yes                                 |                                                                                                            |
| function                                                  | missing                                                                | yes                                                          | yes                                 | evaluates a function over a range, no input data needed                                                    |
| contour / contour_filled                                  | missing                                                                | yes                                                          | yes                                 |                                                                                                            |
| qq / qq_line                                              | missing                                                                | yes                                                          | yes                                 |                                                                                                            |
| quantile                                                  | missing                                                                | yes                                                          | yes                                 |                                                                                                            |
| sum                                                       | missing                                                                | yes                                                          | yes                                 | counts overlapping (x,y) pairs, feeds `geom_count`                                                         |
| unique                                                    | missing                                                                | yes                                                          | yes                                 | de-dupes rows                                                                                              |
| align                                                     | missing                                                                | yes (ggplot2 4.0, aligns area/ribbon x-values across groups) | yes                                 |                                                                                                            |
| connect                                                   | missing                                                                | yes (ggplot2 4.0, connects via steps/other interpolation)    | yes                                 |                                                                                                            |
| manual                                                    | missing                                                                | yes (ggplot2 4.0, arbitrary user function stat)              | yes                                 |                                                                                                            |
| sf / sf_coordinates                                       | missing (out of scope)                                                 | yes                                                          | missing                             | geospatial                                                                                                 |

## 4. Positions

4 of 8. Have `identity stack dodge jitter fill`; **actually 5**, matching
everything except:

| Position                                                                        | gggplot | ggplot2 | Gribouille                         |
| ------------------------------------------------------------------------------- | ------- | ------- | ---------------------------------- |
| dodge2 (dodges non-uniform-width bars/boxplots without needing a shared width)  | missing | yes     | missing (Gribouille also lacks it) |
| jitterdodge (dodge + jitter combined, e.g. jittered points on a dodged boxplot) | missing | yes     | yes                                |
| nudge (fixed x/y offset)                                                        | missing | yes     | yes                                |

## 5. Scales

gggplot's `ScaleKind` is `continuous | discrete | log | sqrt | color | identity`
— one generic scale per aesthetic family. ggplot2 has dozens of named scale
constructors layered over a much smaller set of underlying scale _classes_
(continuous/discrete/binned position; continuous/binned/discrete color-or-fill
palette families; continuous size/alpha/linewidth; discrete shape/linetype). The
gap is mostly in **palette/transform variety**, not architecture:

| Family                                                    | gggplot                         | ggplot2                                                              | Gribouille                                    | Notes                                                                                                                  |
| --------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| x/y continuous/discrete                                   | yes                             | yes                                                                  | yes                                           |                                                                                                                        |
| x/y log10/sqrt                                            | yes                             | yes                                                                  | yes                                           |                                                                                                                        |
| x/y reverse                                               | missing                         | yes                                                                  | —                                             | trivial: transform `(v) => -v`                                                                                         |
| x/y binned                                                | missing                         | yes                                                                  | —                                             | bucket continuous data into discrete breaks                                                                            |
| x/y date/datetime/time                                    | missing                         | yes                                                                  | yes                                           | needs a date-aware continuous transform + tick formatting                                                              |
| color/fill: categorical palette                           | yes (one fixed default palette) | yes (`hue`, `manual`, `grey`, `viridis_d`, `brewer`)                 | partial (colour.typ, palette variety unclear) | we only expose one built-in categorical palette, no way to pick brewer/viridis/manual                                  |
| color/fill: sequential gradient                           | partial                         | yes (`gradient`, `gradient2`, `gradientn`, `viridis_c`, `distiller`) | partial                                       | default, `scale*Viridis()`, and `scale*Gradient2()` ramps are available; custom/gradientn/distiller remain future work |
| color/fill: binned                                        | missing                         | yes (`steps`, `stepsn`, `fermenter`, `viridis_b`)                    | —                                             |                                                                                                                        |
| color/fill: identity                                      | missing                         | yes (data values ARE literal colors, no palette lookup)              | —                                             |                                                                                                                        |
| size: continuous/binned/area/manual/identity              | partial (continuous only)       | yes                                                                  | partial                                       |                                                                                                                        |
| shape: discrete/binned/manual/identity                    | partial (discrete only)         | yes                                                                  | partial                                       |                                                                                                                        |
| alpha: continuous/binned/discrete/ordinal/manual/identity | partial (continuous only)       | yes                                                                  | —                                             |                                                                                                                        |
| linetype scale                                            | partial (discrete)              | yes                                                                  | yes                                           | `scaleLinetype()` supports discrete dash patterns; manual/identity variants remain future work                         |
| linewidth scale                                           | partial (continuous)            | yes                                                                  | yes                                           | `scaleLinewidth()` supports continuous interpolation and guide swatches; binned/manual variants remain future work     |

## 6. Coordinate Systems

| Coord                                               | gggplot                | ggplot2                                                                                                   | Gribouille                                    | Notes                                                                            |
| --------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------- |
| cartesian                                           | yes                    | yes                                                                                                       | yes                                           |                                                                                  |
| flip (now a `project` swizzle, see `gggplot-1be.3`) | yes                    | yes (still a distinct function, sugar over the same idea)                                                 | yes                                           |                                                                                  |
| polar                                               | yes                    | yes (legacy, kept for compat)                                                                             | —                                             |                                                                                  |
| radial                                              | missing                | yes (ggplot2 4.0's polar successor: `end`/`donut`/`rotate_angle` params, pairs with `guide_axis_theta()`) | yes (Gribouille has _only_ radial, not polar) | worth prioritizing over polar refinements — this is where both peers are heading |
| fixed (locked aspect ratio)                         | missing                | yes                                                                                                       | yes                                           |                                                                                  |
| trans (arbitrary per-axis transform)                | missing                | yes                                                                                                       | —                                             | broader than our current fixed `log`/`sqrt` scale-kind transforms                |
| map / quickmap / sf                                 | missing (out of scope) | yes                                                                                                       | missing                                       | geospatial                                                                       |

## 7. Facets

| Feature                                         | gggplot                                      | ggplot2                                                | Gribouille              |
| ----------------------------------------------- | -------------------------------------------- | ------------------------------------------------------ | ----------------------- |
| facet_wrap / facet_grid                         | yes                                          | yes                                                    | yes                     |
| facet_null (implicit single panel)              | yes (`facet.kind: "none"`)                   | yes                                                    | yes (implicit)          |
| free scales (`scales="free"/"free_x"/"free_y"`) | missing (always shared/fixed)                | yes                                                    | unclear, likely partial |
| strip.position / strip customization            | missing (strip always top)                   | yes                                                    | yes                     |
| labeller customization beyond variable renaming | partial (`labels()` renames facet variables) | yes (`label_both`, `label_wrap_gen`, custom functions) | yes                     |

## 8. Themes

| Theme                                                           | gggplot | ggplot2                              | Gribouille |
| --------------------------------------------------------------- | ------- | ------------------------------------ | ---------- |
| Flexible `Theme` object (background/grid/axis/font, open-ended) | yes     | (internal; not user-facing this way) | yes        |
| `theme_grey`/`theme_minimal`/`theme_classic` presets            | yes     | yes                                  | yes        |
| `theme_bw`                                                      | missing | yes                                  | yes        |
| `theme_linedraw`                                                | missing | yes                                  | yes        |
| `theme_light`                                                   | missing | yes                                  | yes        |
| `theme_dark`                                                    | missing | yes                                  | yes        |
| `theme_void`                                                    | missing | yes                                  | yes        |
| `theme_test`                                                    | missing | yes                                  | missing    |
| `element_geom()` (theme-level geom defaults, ggplot2 4.0)       | missing | yes                                  | unclear    |

## 9. Guides

| Guide                                                                     | gggplot                                                     | ggplot2                 | Gribouille                       |
| ------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------- | -------------------------------- |
| Inline discrete color/fill/shape legend                                   | yes                                                         | yes (`guide_legend`)    | yes                              |
| Continuous size legend                                                    | yes                                                         | yes                     | yes                              |
| Colorbar (continuous color/fill gradient legend)                          | missing (continuous color/fill isn't legended at all today) | yes (`guide_colourbar`) | likely folded into legend        |
| Binned/stepped legend (`guide_coloursteps`, `guide_bins`)                 | missing                                                     | yes                     | missing                          |
| Axis guide customization (`guide_axis`, log-ticks, stacked labels, theta) | missing (axes are always the plain default)                 | yes                     | yes (has axis-theta, axis-stack) |
| `guide_none` / hiding a specific guide                                    | missing (no per-scale guide suppression)                    | yes                     | yes                              |

## 10. Native @use-gpu Primitives We Can Reuse

Direct source inspection of the installed `@use-gpu/*` packages (v0.19.0:
`core`, `plot`, `workbench`, `parse`, `live`, `traits`, `shader`, `glyph`,
`react`, `scene`, `state`, `wgsl`, `wgsl-loader`, `webgpu` — no `@use-gpu/geo`
or similar exists as a dependency or a real package in this ecosystem), looking
specifically for native support for binning, averaging/summary stats, geospatial
projection, and grouping, since those are exactly the categories where
hand-rolling everything ourselves would be the most work.

**Real find — contour/isosurface extraction is native, and it's a good fit for
`stat_contour`/`geom_contour`/`geom_contour_filled` and `geom_density_2d`'s
contour lines:** `@use-gpu/plot`'s `ImplicitSurface` component
(`layer/implicit-surface.mts`) is a thin trait wrapper around
`@use-gpu/workbench`'s `DualContourLayer` — a real dual-contouring GPU
implementation that extracts isolines/isosurfaces from a scalar field (`values`
tensor over a `range`/`size` grid, with a `level` prop for the isovalue). We
would still need to build the underlying 2D density/count grid ourselves in JS
(that's the "stat" half — no shortcut there), but the actual
contour-line-extraction step can be handed to
`ImplicitSurface`/`DualContourLayer` instead of us implementing marching squares
by hand. Directly relevant to `gggplot-aei.8`.

**Grid-evaluation primitives exist and fit `stat_function`/`geom_function`:**
`@use-gpu/plot`'s `Sampler`/`Tensor` (`source/sampler.mts`, `source/tensor.mts`)
evaluate an arbitrary expression/emitter over an N-D range into a tensor —
exactly the shape of `stat_function` (evaluate `f(x)` over a range, no input
data rows involved) and a natural way to produce the density grid that would
feed `ImplicitSurface` above. These generate data on a regular grid; they do not
aggregate existing scattered data rows (see below).

**No native binning/histogram/group-by/summary-statistics primitive exists
anywhere in the stack — this confirms `stat_count`/`stat_bin`/`stat_summary` and
future density/2D stats have to stay in gggplot-owned reducers rather than
coming from UseGPU directly:** `@use-gpu/workbench`'s `useAggregator` and
`@use-gpu/core`'s `aggregate.mts` (`schemaToAggregate`, `getAggregateSummary`,
etc.) are a false friend — "aggregate" there means _combining multiple render
items' GPU buffers into one draw call_ (the same concept as our own compile.ts
comment about "VirtualLayers aggregator" regrouping draws by shape type), not
statistical aggregation. There is no group-by, count, sum, or mean primitive
over row data anywhere in `@use-gpu/*`. This is a rendering engine, not a
data-analysis library, which matches what `docs/ARCHITECTURE.md` already says
about `@use-gpu/plot` being a grammar-of-graphics _rendering_ engine we lower
onto — the statistical grammar (stats) has always been squarely gggplot's own
responsibility, and this investigation found nothing that changes that.

**No ready-made reduction, but the right low-level toolkit exists if/when
per-row JS binning becomes a real performance problem** (e.g. `diamonds` at ~54k
rows for a histogram): `@use-gpu/workbench`'s `Compute`/`Kernel`/
`compute-pass`/`compute-buffer`/`readback`/`readback-pass` are generic WGSL
compute-shader dispatch primitives — exactly the building blocks a
GPU-accelerated histogram/reduction kernel would be built from, but nobody has
written that kernel. Worth keeping in mind as a future option, not something to
reach for now (our current JS-side aggregation is plenty fast at the row counts
gggplot targets today).

**Geospatial: projection math exists, real GIS does not — `coord_map`/
`coord_sf`/`geom_sf*` remain a real, unaddressed gap.** `@use-gpu/plot`'s
`Spherical` and `Stereographic` view components (`view/spherical.mts`,
`view/stereographic.mts`) are generic N-D→2D nonlinear coordinate warps —
architecturally the same idea as our own `Polar`/`Coord.project` swizzle, just
for projecting onto a sphere or a stereographic plane. Stereographic projection
is in fact a legitimate historical map projection (used for polar-region maps),
so `Stereographic` could plausibly seed a simplified "project onto a
sphere/pole" coord. But neither component — nor anything else in the installed
package set — provides actual cartographic data support: no shapefile/GeoJSON
parsing, no coastline/border geometry, no Mercator/Albers/other named
cartographic projections, no CRS handling. A real
`coord_map`/`coord_sf`/`geom_sf*` would need an external geometry/projection
library brought in on top of these primitives, not something native to
`@use-gpu/*` — this stays a deliberately deferred item in this doc's
prioritization notes below, and this finding doesn't change that recommendation.

**No native date/time domain support.** `@use-gpu/parse`'s `Domain` type
(referenced by `@use-gpu/plot`'s `Scale`/tick-formatting helpers) is just
`'linear' | 'log'` — no date-aware transform or tick formatting anywhere in the
stack. `scale_x_date`/`scale_x_datetime`/`scale_x_time` would need our own
date-math (native `Date`/`Intl.DateTimeFormat`), same as today's plan.

## Prioritization Notes

The grouping/stat-reduction correctness work (`gggplot-48e` and the
`@gggplot/reductions` package) has landed. New stat work should reuse the
effective-group helpers and reductions package instead of adding one-off
aggregation logic in geoms.

Next, in rough value order:

1. `stroke` aesthetic — tracked separately because current use.gpu Point has no
   outline-width primitive; it needs an explicit outline-capable GPU mark
   contract.
2. `geom_violin`/`geom_dotplot`/`stat_density`/`stat_boxplot` (compute quantiles
   from raw y) — the biggest remaining "common chart type" gap.
3. Color/fill scale palette variety (`gradient2`, `gradientn`, `viridis`,
   `brewer`, binned/`steps`) — currently one fixed palette per kind.
4. `coord_radial` (both peers are moving here, not just legacy `coord_polar`)
   and `coord_fixed`.
5. `position_dodge2`/`jitterdodge`/`nudge`.
6. Facet free scales.
7. The long tail: 2D binning (`bin_2d`/`hex`/`contour`), `stat_qq`/`ellipse`/
   `function`, remaining named themes, colorbar/binned guides.
8. Geospatial (`coord_sf`, `geom_sf*`) — explicitly deferred; low value without
   a real mapping use case, and both peers keep it as a separate concern.
   Confirmed via §10's native-primitive research that `@use-gpu/*` has no real
   GIS support to lean on either (only generic projection math), so this would
   be a substantial standalone effort, not a quick win — reinforces staying
   deferred rather than changing the recommendation.
