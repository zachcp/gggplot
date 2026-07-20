# Geom/stat coverage audit

**Status: historical snapshot (2026-07-17).** This is a point-in-time audit
against the pinned Gribouille inventory; it is not maintained as coverage
lands. For the living coverage picture see `GRAMMAR_ALIGNMENT.md` (the
generated parity matrix, kept honest by its coverage-bijection test) and the
open beads (`bd ready`).

Audit date: 2026-07-17

Upstreams:

- [ggplot2 4.0.3 official package index](https://ggplot2.tidyverse.org/reference/index.html)
- `mcanouil/gribouille@03dbfde6d3a578741b7e66f62c3c184bf41191ad` (the pinned
  129-source inventory in this repository)

Status vocabulary is finite: **absent**, **alias**, **constructor-only**,
**compile-only**, **runtime-only**, **partial-stat**, **full**. “Full” means the
gggplot contract reaches DSL, serializable IR, compiler, Live backend, emitted
backend, and tests; it does not mean every ggplot2 option is implemented.
Gallery coverage is recorded separately.

## Reproducible extraction

```bash
# gggplot public constructors
rg '^export const (geom|stat)' packages/core/src/dsl/mod.ts

# serializable implementation vocabulary
sed -n '/export type GeomKind/,/export type StatKind/p' packages/core/src/ir/types.ts
sed -n '/export type StatKind/,/export type PositionKind/p' packages/core/src/ir/types.ts

# compiler/runtime/emitter/tests/gallery evidence
rg 'layer.geom|layer.stat' packages/core/src/compile packages/core/src/stat
rg 'REGISTRY|renderTree' packages/core/src/render
rg 'PLOT_IMPORTS|emitNode' packages/core/src/emit
rg 'geom_|stat_' packages/core/tests apps/site/src/docs

# pinned Gribouille inventory and generated classification
deno task parity:check
```

The ggplot2 list below is transcribed from the versioned official index, whose
page identifies itself as 4.0.3. Gribouille extraction remains offline and
repeatable from `docs/GRIBOUILLE_03DBFDE6_INVENTORY.txt` and
`docs/GRIBOUILLE_03DBFDE6_GALLERY.yml`.

## Geoms

Legend: D=DSL, I=IR, C=compiler, L=Live, E=emitted, T=test, G=gallery.

| ggplot2 / Gribouille counterpart | gggplot constructor | Status | D | I | C |
L | E | T | G | Gap owner | | --- | --- | --- | --- | --- | --- | --- | --- |
--- | --- | --- | --- | | `geom_abline`, `geom_hline`, `geom_vline` |
`geomAbline/Hline/Vline` | full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | annotations | — | |
`geom_area`, `geom_ribbon` | `geomArea/Ribbon` | full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
representations/stats | — | | `geom_bar`, `geom_col` | `geomBar/Col` | full | ✓
| ✓ | ✓ | ✓ | ✓ | ✓ | stats/positions | — | | `geom_histogram` | `geomHistogram`
| full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | stats | — | | `geom_freqpoly` | — | absent | —
| — | — | — | — | — | — | `gggplot-8e0.16` | | `geom_bin_2d` | `geomBin2d` |
full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | | `geom_hex` | `geomHex` | full | ✓ | ✓ |
✓ | ✓ | ✓ | ✓ | — | — | | `geom_blank` | — | absent | — | — | — | — | — | — | —
| `gggplot-8e0.16` | | `geom_boxplot` | `geomBoxplot` | full | ✓ | ✓ | ✓ | ✓ | ✓
| ✓ | — | — | | `geom_contour`, `geom_contour_filled` |
`geomContour/ContourFilled` | full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | |
`geom_count` | — | absent | — | — | — | — | — | — | — | `gggplot-8e0.17` | |
`geom_density` | `geomDensity` | full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | |
`geom_density_2d`, `geom_density_2d_filled` | — | absent | — | — | — | — | — | —
| — | `gggplot-8e0.18` | | `geom_dotplot` | `geomDotplot` | full | ✓ | ✓ | ✓ | ✓
| ✓ | ✓ | — | — | | `geom_function` | `statFunction` | alias | ✓ | ✓ | ✓ | ✓ | ✓
| ✓ | — | `gggplot-8e0.16` (sugar) | | `geom_jitter` |
`geomPoint({position:"jitter"})` | alias | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | positions |
`gggplot-8e0.16` (sugar) | | `geom_crossbar`, `geom_errorbarh`,
`geom_linerange`, `geom_pointrange` | — | absent | — | — | — | — | — | — | — |
`gggplot-8e0.19` | | `geom_errorbar` | `geomErrorbar` | full | ✓ | ✓ | ✓ | ✓ | ✓
| ✓ | — | — | | `geom_map` | — | absent | — | — | — | — | — | — | — | deferred
with sf/maps | | `geom_path`, `geom_line` | `geomPath/Line` | full | ✓ | ✓ | ✓ |
✓ | ✓ | ✓ | representations | — | | `geom_step` | — | absent | — | — | — | — | —
| — | — | `gggplot-8e0.16` | | `geom_point` | `geomPoint` | full | ✓ | ✓ | ✓ | ✓
| ✓ | ✓ | start/aesthetics | — | | `geom_polygon` | `geomPolygon` | full | ✓ | ✓
| ✓ | ✓ | ✓ | ✓ | representations | — | | `geom_qq`, `geom_qq_line` |
`geomQq/QqLine` | full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | | `geom_quantile` | — |
absent | — | — | — | — | — | — | — | `gggplot-8e0.20` | | `geom_rug` | — |
absent | — | — | — | — | — | — | — | `gggplot-8e0.16` | | `geom_segment` |
`geomSegment` | full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | annotations | — | | `geom_curve`,
`geom_spoke` | — | absent | — | — | — | — | — | — | — | `gggplot-8e0.16` | |
`geom_smooth` | `geomSmooth` | partial-stat | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | stats |
`gggplot-8e0.21` (loess/gam/glm) | | `geom_text` | `geomText` | full | ✓ | ✓ | ✓
| ✓ | ✓ | ✓ | themes | — | | `geom_label` | `geomLabel` | partial-stat | ✓ | ✓ |
✓ | ✓ | ✓ | ✓ | themes | `gggplot-8e0.22` (label box) | | `geom_raster`,
`geom_rect`, `geom_tile` | `geomRaster/Rect/Tile` | full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓
| representations | — | | `geom_violin` | `geomViolin` | full | ✓ | ✓ | ✓ | ✓ |
✓ | ✓ | — | — | | `geom_sf`, `geom_sf_label`, `geom_sf_text` | — | absent | — |
— | — | — | — | — | — | explicitly deferred: no GIS contract |

gggplot additionally exposes ordinary `geomSmooth` and annotation `rect`
constructors using the same IR/runtime path. Gribouille-only specialised
examples are implemented as streamgraph silhouette stacking, reusable bump
connectors, a core waffle geom/stat, and a versioned cluster-mark extension.
Extension usage is exercised by the `@gggplot/mark` and `@gggplot/3d`
packages and their tests. Typst text is rejected by design; gggplot keeps one
`FontResources`-based text layout system and does not evaluate Typst markup.

## Stats

| ggplot2 / Gribouille counterpart | gggplot stat/consumer | Status | D | I | C
| L | E | T | G | Gap owner | | --- | --- | --- | --- | --- | --- | --- | --- |
--- | --- | --- | --- | | `stat_identity` | `identity` | full | ✓ | ✓ | ✓ | ✓ |
✓ | ✓ | broad | — | | `stat_count` | `geomBar` | full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
stats | — | | `stat_bin` | `geomHistogram` | full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
stats | — | | `stat_boxplot` | `geomBoxplot` | full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | —
| — | | `stat_density`, `stat_ydensity` | density/violin | full | ✓ | ✓ | ✓ | ✓
| ✓ | ✓ | — | — | | `stat_bin_2d`, `stat_bin_hex` | bin2d/hex | full | ✓ | ✓ | ✓
| ✓ | ✓ | ✓ | — | — | | `stat_contour`, `stat_contour_filled` | contour geoms |
full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | | `stat_qq`, `stat_qq_line` | QQ geoms |
full | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | | `stat_ellipse` | `statEllipse` | full |
✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | | `stat_function` | `statFunction` | full | ✓ |
✓ | ✓ | ✓ | ✓ | ✓ | — | — | | `stat_summary` | `statSummary` | full | ✓ | ✓ | ✓
| ✓ | ✓ | ✓ | stats | — | | `stat_smooth` | smooth | partial-stat | ✓ | ✓ | ✓ |
✓ | ✓ | ✓ | stats | `gggplot-8e0.21` | | `stat_sum` | — | absent | — | — | — | —
| — | — | — | `gggplot-8e0.17` | | `stat_density_2d`, `stat_density_2d_filled` |
— | absent | — | — | — | — | — | — | — | `gggplot-8e0.18` | | `stat_quantile` |
— | absent | — | — | — | — | — | — | — | `gggplot-8e0.20` | | `stat_ecdf` | — |
absent | — | — | — | — | — | — | — | `gggplot-8e0.24` | | `stat_summary_2d`,
`stat_summary_hex`, `stat_summary_bin` | — | absent | — | — | — | — | — | — | —
| `gggplot-8e0.25` | | `stat_unique` | — | absent | — | — | — | — | — | — | — |
`gggplot-8e0.24` | | `stat_align`, `stat_connect`, `stat_manual` | — | absent |
— | — | — | — | — | — | — | `gggplot-8e0.26` | | `stat_sf`,
`stat_sf_coordinates` | — | absent | — | — | — | — | — | — | — | deferred with
sf/maps |

## Corrected counts and conclusions

- gggplot exposes **27 geom-oriented constructors** plus three reference-line
  constructors; 24 distinct `GeomKind` values are serializable.
- gggplot implements **14 distinct statistical contracts** across 19
  serializable `StatKind` values (paired variants such as contour-filled and
  QQ-line are counted separately in IR, while this summary groups families).
- The previously closed `gggplot-aei` epic genuinely landed distribution,
  2D-bin/hex/contour, QQ/ellipse/function, position, palette, facet-free, theme,
  stroke, linetype, and linewidth work. Earlier “5 stats / 18 geoms” and
  Gribouille gap rows were stale.
- No current feature is `constructor-only`, `compile-only`, or `runtime-only`;
  those statuses remain in the vocabulary so future audits can expose partial
  plumbing rather than calling it supported.
- Gallery absence is not an implementation failure. Rows with G=`—` are
  working/tested contracts that still lack a focused public example.

## Gap policy

The focused beads above are non-duplicates discovered by this audit. GIS is
explicitly deferred until a projection/data contract is requested. All other
stale gaps formerly owned by closed `gggplot-aei.*` are now classified as full,
alias, or partial-stat rather than left attached to closed work.
