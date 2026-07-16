# Documentation Site Plan: ggplot2-Parity Docs

Goal: grow `apps/site` from the current single-page example gallery into a real
multipage documentation site shaped like ggplot2's pkgdown reference and
Gribouille's example-first docs. The current app is useful because each example
already shows the DSL, emitted UseGPU Live source, and live WebGPU render. The
next step is to organize those examples into pages where readers can explore how
data changes as it flows through stats, scales, groups, facets, and coords.

The site should be backed by real or realistic datasets instead of only tiny
hand-authored fixtures. `apps/site/src/examples.tsx` is still the seed
inventory, not the final docs architecture.

## Current implementation (2026-07-16)

The site now uses hash-addressable page modules in `apps/site/src/docs/pages.ts`
with a shared article shell, navigation, narrative sections, data previews,
DSL/emitted-source panels, and live charts. `mpg`, `mtcars`, and `iris` are
vendored as static CSV assets and fetched only when a real-data example mounts;
the loader lowers each asset directly into `TypedDataFrame` columns and caches
the resulting frame. The active real-data examples intentionally demonstrate the
boundaries readers need to understand:

- mpg and iris are direct typed-column point marks;
- mtcars maps numeric transmission codes as an inherently discrete linetype and
  horsepower to GPU-consumable line widths;
- histogram internals distinguish resident GPU products from named CPU-reference
  stat fallbacks rather than implying all WebGPU-rendered charts are GPU stats.

Datasets without an explicit provenance decision remain deferred; pages must
link their gating coverage Bead instead of inventing a substitute example.

## 1. Page Structure

ggplot2's reference index is useful because it groups the package by how people
think about plots: plot basics, layers/geoms/stats, aesthetics, scales, guides,
facets, coordinates, and articles/FAQ. gggplot should use the same mental map,
but bias the examples toward side-by-side data manipulation: raw input,
post-stat rows, compiled RenderTree, and live output.

Proposed routes:

| Route        | Purpose                                            | First pages                                                          |
| ------------ | -------------------------------------------------- | -------------------------------------------------------------------- |
| `/reference` | Function index grouped by grammar component.       | plot basics, layers, aesthetics, scales, coords, facets, themes      |
| `/examples`  | Visual gallery of complete plots.                  | scatter, grouped line, bars, histograms, smooth, facets, polar       |
| `/stats`     | How data is transformed before rendering.          | count, bin/histogram, summary, smooth/lm                             |
| `/data`      | Data ingestion, typing, grouping, missing values.  | row-store vs column-store, `asFactor`, `asNumeric`, effective groups |
| `/internals` | Contributor docs for the compiler/reductions path. | RenderTree, reductions package, WebGPU stat experiments              |
| `/faq`       | Short task pages.                                  | axes, bars, facets, annotations, grouping, histograms                |

Each page should have a consistent article shell: title, short explanation,
example picker, DSL source, optional data table preview, emitted source, and
rendered chart. Reference pages can then link into deeper narrative pages
without duplicating examples.

## 2. Feature-Tour MVP

The first modular docs site should not try to be a complete ggplot2 clone. It
should be a curated feature tour that exercises as much of gggplot's implemented
core as possible, with one small page per concept. Each page should answer:

1. What data shape goes in?
2. What grammar feature is being exercised?
3. What rows or aesthetics are computed before rendering?
4. What UseGPU/RenderTree representation does the compiler emit?

That makes the docs useful for readers and for contributors debugging the
pipeline.

| Module          | Route              | Examples                                                                     | Core features exercised                                                     |
| --------------- | ------------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Getting started | `/examples/start`  | scatter + line, discrete x                                                   | `ggplot`, `aes`, layered geoms, continuous/discrete position scales         |
| Representations | `/representations` | point, line/path, bars/cols, area/ribbon, tile, polygon, text                | mark lowering to `Point`, `Line`, `Polygon`, `Label`; RenderTree props      |
| Statistics      | `/stats`           | count bar, histogram/bin, grouped histogram, summary mean, smooth lm         | `stat_count`, `stat_bin`, `stat_summary`, `stat_smooth`, reductions package |
| Aesthetics      | `/aesthetics`      | mapped vs literal color, fill grouping, size/shape/alpha, linetype/linewidth | mapped aesthetics, fixed params, legends, effective groups                  |
| Data typing     | `/data`            | row-store input, column-store input, numeric-coded factor, numeric strings   | `ingest`, `asFactor`, `asNumeric`, missing-value behavior                   |
| Scales          | `/scales`          | explicit domains, log/sqrt x, color/fill palettes, size range, shape palette | scale training, transforms, guide titles                                    |
| Positioning     | `/positions`       | stacked/fill/dodged bars, jittered points                                    | `stackBars`, `dodgeBars`, `jitter`, position defaults                       |
| Facets          | `/facets`          | wrap by one variable, grid crossing two variables, stat per panel            | facet partitioning, shared scales, strip labels, plot-level legends         |
| Coordinates     | `/coords`          | flipped bars, polar bars, polar theta y                                      | coord projection, polar view, polygon munching                              |
| Annotations     | `/annotations`     | reference lines, segment, rect, text, point                                  | non-inherited literal layers, hline/vline/abline domain spanning            |
| Themes          | `/themes`          | default/grey/classic/custom theme comparison                                 | panel background, grid/axis style, text defaults                            |
| Internals       | `/internals`       | one example traced raw data -> stat rows -> RenderTree -> emitted source     | compiler stages, reductions boundary, emitted UseGPU Live source            |

Keep each route small at first: two to four examples is enough. Breadth matters
more than exhaustive variants because the immediate goal is to make the core
surface visible and easy to contribute to.

### Seed Example Set

These examples should be available in the first modular pass, using mostly the
small synthetic datasets already in `apps/site/src/examples.tsx`:

| Example id         | Page                              | DSL shape                  | Why it belongs                                              |
| ------------------ | --------------------------------- | -------------------------- | ----------------------------------------------------------- |
| `ScatterLine`      | Getting started / Representations | `geomPoint` + `geomLine`   | proves layered marks, continuous scales, source emission    |
| `DiscreteX`        | Getting started / Data            | `geomPoint` over factor x  | shows factor inference and discrete position scales         |
| `ColorMapped`      | Aesthetics / Scales               | mapped `color`             | shows mapped-vs-literal color and discrete guide generation |
| `HistogramStatBin` | Stats                             | `geomBar({ stat: "bin" })` | shows raw values reduced into count/density rows            |
| `GroupedHistogram` | Stats / Aesthetics                | `x` plus mapped `fill`     | shows effective groups feeding a reducer                    |
| `FlippedBars`      | Coordinates / Positioning         | `geomCol` + `coordFlip`    | shows representation unchanged while projection changes     |
| `PolarPoints`      | Coordinates                       | `geomCol` + `coordPolar`   | shows polar view and polygon munching                       |
| `ThemedChart`      | Themes / Text                     | `geomText` + `theme`       | shows label lowering and theme inheritance                  |
| `FacetedScatter`   | Facets                            | `facetWrap`                | shows panel partitioning and shared scales                  |

Add next, before chasing long-tail parity:

- `CountStackedBar`: `geomBar()` with mapped `fill`, exercising `stat_count` and
  stack/fill positions.
- `SummaryMean`: `geomPoint({ stat: "summary" })` over repeated categories,
  exercising `groupedSummary1d`.
- `SmoothLm`: `geomSmooth({ method: "lm" })` with and without mapped color,
  exercising grouped regression and ribbon output.
- `TileHeatmap`: `geomTile()` over a small rectangular grid, exercising
  rectangular domain widening.
- `AnnotationComposite`: `annotate("segment"|"rect"|"text"|"point")` plus
  `geomHline`/`geomVline`/`geomAbline`.
- `ScaleTransforms`: `scaleXLog10`/`scaleXSqrt` on the same scatter dataset.

### Page Anatomy

Every feature page should use the same reusable sections:

1. **Overview**: two or three sentences about the feature, not a marketing hero.
2. **Examples**: cards or tabs for the page's examples.
3. **Data Preview**: a small table with the columns used by the example.
4. **DSL Source**: the gggplot code.
5. **What Changed**: a compact explanation of stat rows, scale training,
   grouping, or coord projection.
6. **Rendered Plot**: the current `ChartCanvas`.
7. **Emitted Source**: collapsible UseGPU Live output for contributor/debug
   pages; collapsed by default for reader-facing pages.

This lets pages be educational without becoming walls of compiler output.

### Contribution Workflow

Contributors should be able to add a new docs example in four small steps:

1. Add or reuse a dataset in `apps/site/src/docs/data/`.
2. Add a `DocExample` next to the page that owns it.
3. Add one short "What Changed" note describing the grammar operation.
4. Run `deno task dev`,
   `deno check --config apps/site/deno.json
   apps/site/src/examples.tsx apps/site/vite.config.ts`,
   and `deno test -A`.

Once the multipage shell exists, a contributor should not need to touch
`App.tsx` for ordinary docs additions.

## 3. Multipage Site Architecture

The smallest useful architecture change is to split today's `examples` array
into page/content modules while keeping the same rendering component:

```ts
// apps/site/src/docs/types.ts
export interface DocExample {
  id: string;
  title: string;
  description: string;
  dataPreview?: Record<string, unknown[]>;
  dslSource: string;
  spec: GGSpec;
}

export interface DocPage {
  slug: string;
  section: "examples" | "reference" | "stats" | "data" | "internals" | "faq";
  title: string;
  summary: string;
  examples: DocExample[];
}
```

Then `apps/site/src/examples.tsx` can become a compatibility export assembled
from `docs/pages/*.tsx`, and a lightweight router can render pages by slug. A
contributor adding docs should mostly touch one page module and one dataset
module, not the app shell.

Recommended first files:

- `apps/site/src/docs/types.ts`
- `apps/site/src/docs/data/*.ts`
- `apps/site/src/docs/pages/stats-bin.tsx`
- `apps/site/src/docs/pages/stats-count.tsx`
- `apps/site/src/docs/pages/aesthetics-grouping.tsx`
- `apps/site/src/docs/index.ts`

## 4. Contributor Path: Histograms First

`stat_bin` is the best first docs contribution because it is implemented,
tested, reductions-backed, and visually demonstrates "data is transformed before
the geom renders."

Current API:

```ts
ggplot(data, { x: "value" })
  .add(geomBar({ stat: "bin", binwidth: 1, fill: "#3b82f6" }))
  .build();
```

Grouped histogram:

```ts
ggplot(data, { x: "value", fill: "cohort" })
  .add(geomBar({ stat: "bin", binwidth: 1 }))
  .build();
```

Docs should explain the pipeline in reader terms:

1. Raw `value` rows enter the plot.
2. `stat_bin` groups rows by mapped discrete aesthetics such as `fill`.
3. The reductions package counts values per bin and group.
4. The stat emits new rows with bin-center `x`, computed `count`, and `density`.
5. `geomBar` renders those computed rows.

Useful page variants:

| Example           | Shows                                                    |
| ----------------- | -------------------------------------------------------- |
| Basic histogram   | `binwidth`, raw values -> counts                         |
| Grouped histogram | `fill` creates per-group bins                            |
| Bin count control | `bins` vs `binwidth`                                     |
| Density mapping   | computed `density` column once after-stat mapping exists |
| Performance note  | why large histograms are the first WebGPU stat target    |

Near-term sugar worth filing separately: `geomHistogram(opts)` should lower to
`geomBar({ ...opts, stat: "bin" })`. It is not required for the docs, but it
will make the public examples read more like ggplot2.

## 5. Reference Page Categories

One doc-site section per category, each listing the DSL functions that belong to
it plus a gallery of examples:

1. **Layers** — geoms, stats, position adjustments, annotations (this is the
   bulk of the page count — one example per geom at minimum, more for geoms with
   meaningfully different modes, e.g. bar stacked vs. dodged vs. filled).
2. **Aesthetics** — one page explaining `aes()` / mapped-vs-literal, cross
   referencing `docs/GRAMMAR_ALIGNMENT.md`'s already-written mapped-vs-fixed
   explanation.
3. **Scales** — one page per aesthetic family (position, color/fill, size,
   shape, alpha), each showing the available scale variants side by side on the
   same data.
4. **Guides: axes and legends** — legend/guide behavior, once colorbar and
   binned guides exist (`docs/COVERAGE_BACKLOG.md` §9).
5. **Facetting** — facet_wrap vs facet_grid, strip labels, (future) free scales.
6. **Coordinate systems** — cartesian, flip, polar/radial.
7. **Themes** — one example rendered under every built-in theme, side by side,
   once the missing named themes (`docs/COVERAGE_BACKLOG.md` §8) exist.
8. **Annotations** — `annotate()` variants and reference lines
   (`geom_hline`/`vline`/`abline`), added this session.

## 6. Vignette-Equivalent Narrative Pages

ggplot2 ships these as prose articles, not just reference pages. gggplot's
equivalents, in priority order:

1. **"Aesthetic specifications"** equivalent — already substantially covered by
   `docs/GRAMMAR_ALIGNMENT.md`; needs a reader-facing rewrite (that doc is
   currently written for contributors/agents, not end users).
2. **"Extending gggplot"** — how to add a geom/stat/scale, once there's a second
   real contributor besides the pipeline itself.
3. **FAQ-style short pages** — mirroring ggplot2's FAQ series (Axes, Faceting,
   Customising, Annotation, Reordering, Barplots): short task-oriented pages
   rather than API reference.
4. **Architecture** — already exists (`docs/ARCHITECTURE.md`), just needs
   linking from the doc site nav.

## 7. Example Gallery Inventory

Per `docs/COVERAGE_BACKLOG.md`, gate each example on the underlying feature
actually existing — no point drafting a violin-plot example before
`geom_violin`/`stat_density` land. Ready-now (feature already implemented) vs.
blocked (needs backlog work first):

**Ready now:**

- Scatter (`geom_point`), with and without mapped size/shape/alpha
- Line/path over time, single and multi-group
- Bar chart: count-stacked-by-fill, dodge, fill/proportion
- Column chart (pre-aggregated y)
- Area/ribbon, single and stacked
- Boxplot (from pre-computed quartiles — until `stat_boxplot` exists, this
  example has to show the current "bring your own quartiles" requirement
  explicitly, which is itself worth documenting as a known limitation)
- Errorbar over a bar/point chart
- Smooth: single group and multi-group
- Histogram from raw continuous data via `stat_bin`; current gallery examples:
  `HistogramStatBin` and `GroupedHistogram` in `apps/site/src/examples.tsx`
- Summary examples via `stat_summary` built-ins
- Tile/heatmap
- Polygon (grouped, e.g. choropleth-shaped synthetic regions)
- Text/label annotations, plot titles/subtitle/caption via `labels()`
- Facet wrap and facet grid, with and without a legend
- Coord flip, coord polar (bar-to-pie, bar-to-donut wedge)
- Theme gallery: minimal/classic/grey side by side
- `annotate()` gallery: segment, rect, text, point in one composite example
- Reference lines: hline/vline/abline over a scatter

**Blocked on coverage-backlog work (link back to the relevant row/bd issue):**

- Violin / dotplot / density (needs `geom_violin`/`stat_density`)
- Raw-y boxplot (needs public `stat_boxplot`; the reductions package already has
  `groupedBoxplot1d`)
- 2D bin/contour examples (need public geoms/stats; the reductions package
  already has CPU/GPU grouped 2D histogram primitives)
- Diverging/binned color scale examples (needs `gradient2`/`steps`/`viridis`)
- Point-border styling and styled boxplot outliers (needs the separate `stroke`
  primitive; dashed/dotted reference lines and linewidth are available now)
- coord_radial donut/sector chart (needs `coord_radial`)
- Free-scale facets (needs facet free scales)

## 8. Datasets Needed

Today the whole doc site runs on 4 tiny (~7-8 row) inline fixtures loosely
shaped like mtcars. To match ggplot2's own reference examples we need real
datasets — this is a real gap, not just a nice-to-have, since several chart
types only look meaningful at realistic scale (facets need multiple levels per
panel, boxplots need enough rows per group to have a real distribution, 2D
binning needs thousands of points).

**Priority datasets** (mirroring what ggplot2's own reference pages use most):

| Dataset                        | Rows × Cols         | Used for                                                                                    |
| ------------------------------ | ------------------- | ------------------------------------------------------------------------------------------- |
| `mpg`                          | 234 × 11            | scatter, facets, boxplot, bar/col by class, smooth                                          |
| `diamonds`                     | 53,940 × 10         | histogram, 2D binning (bin_2d/hex), large-n performance case                                |
| `economics` / `economics_long` | 574 × 6 / 2,870 × 4 | time series line charts                                                                     |
| `mtcars`                       | 32 × 11             | small-n scatter/regression, the dataset our current inline fixtures already loosely imitate |
| `iris`                         | 150 × 5             | classic grouped-scatter/facet example, 3 clean groups                                       |
| `msleep`                       | 83 × 11             | boxplot/bar with meaningful categorical groups + NAs (good edge-case test data)             |
| `txhousing`                    | 8,602 × 9           | faceted time series (facet by city)                                                         |
| `midwest`                      | 437 × 28            | choropleth-shaped / polygon-adjacent demographic example                                    |
| `presidential`                 | 12 × 4              | tiny annotated timeline example (segments/rects over time)                                  |
| `faithful`                     | 272 × 2             | classic 2-column density/histogram teaching example                                         |

**Sourcing options, in order of preference:**

1. **Hand-derive small synthetic datasets shaped like the real ones** for
   anything used only for a single narrow example (e.g. `presidential`,
   `faithful`) — no licensing question, minimal effort, already the current
   approach for the 4 existing fixtures.
2. **Vendor real CSVs for the datasets where realistic scale/shape actually
   matters** (`mpg`, `diamonds`, `economics`, `mtcars`, `iris`, `msleep`,
   `txhousing`, `midwest`) as static files under something like
   `apps/site/public/data/*.csv`, loaded at build/example time. One verified,
   concrete source: `vincentarelbundock/Rdatasets` on GitHub mirrors CRAN
   package datasets (including ggplot2's and base R's) as plain CSV at
   `https://raw.githubusercontent.com/vincentarelbundock/Rdatasets/master/csv/<package>/<dataset>.csv`
   — confirmed working by fetching `csv/ggplot2/mpg.csv` directly (234 rows,
   correct `manufacturer,model,displ,year,cyl,trans,drv,cty,hwy,fl,class`
   schema). **Caveat**: that project's own maintainer states dataset licensing
   is "unclear... my understanding is these are free to redistribute" — not a
   hard guarantee. `mtcars`/`iris` are old (1974/1936) datasets already freely
   redistributed by essentially every plotting library
   (matplotlib/seaborn/plotly/vega-datasets all bundle equivalents), so those
   are low-risk; `diamonds`/`mpg`/`economics`/`midwest`/`msleep`/ `txhousing`
   are ggplot2's own bundled data (ggplot2 itself is MIT licensed) — worth a
   quick explicit license check on ggplot2's own data documentation before
   vendoring, rather than assuming Rdatasets' mirror inherits that clearly.
3. **`vega-datasets`** (Apache-2.0, actively maintained by the UW Interactive
   Data Lab) is a second, unambiguously-licensed option worth checking for
   overlapping datasets (it's known to include a `cars.json` that's an
   mtcars-style dataset) before committing to option 2 for any given table — not
   yet verified against our specific dataset list, flag as a follow-up check
   rather than a confirmed source here.
4. **Generate at doc-build time from a small script** rather than committing
   large CSVs to git, if repo size becomes a concern (`diamonds` at ~54k rows is
   the only one large enough to matter).

### Current sourcing decision

`mpg`, `mtcars`, and `iris` are now vendored as static CSV assets under
`apps/site/public/data/`, with provenance recorded alongside them. The site
loader turns CSV directly into typed columns, so a static example can mount a
single RawData source without a row-shaped post-stat transfer. `diamonds` is
intentionally not committed until a reproducible generation path and its
provenance review are added. `economics`, `msleep`, `txhousing`, and `midwest`
are deferred until their gated gallery/geometry features need them; this avoids
claiming a data license or GPU execution path before either has been verified.

## 9. Suggested Beads Breakdown

Suggested durable work:

1. Add `geomHistogram()` sugar for reader-facing docs.
2. Split `apps/site/src/examples.tsx` into docs page/data modules.
3. Build the feature-tour MVP shell and navigation around the modules in
   Section 2.
4. Add the `/stats/bin` page with basic and grouped histogram examples.
5. Add the `/data/grouping` page using the same grouped histogram and grouped
   line examples.
6. Add dataset sourcing as its own task because it has licensing and repo-size
   decisions before code.
7. Add one bead per reference category above, gated on the relevant
   coverage-backlog dependencies where examples are still blocked.
