# Documentation datasets

The site keeps CSV assets separate from the rendering pipeline. The async loader
in `src/docs/data/real.ts` converts each asset directly to a typed column store;
a static asset is suitable for `RawData`, while changing streams must use the
explicit `GPUStreamingSourceAdapter` rather than emulate ranges through a static
source.

| Asset                          |        Rows | Source                                                                                                                                         | Decision                                                                                                                         |
| ------------------------------ | ----------: | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `mpg.csv`                      |         234 | [`ggplot2::mpg`](https://ggplot2.tidyverse.org/reference/mpg.html), CSV mirror: [`Rdatasets`](https://github.com/vincentarelbundock/Rdatasets) | Vendored for scatter, facets, bars, and smooth examples. ggplot2 is MIT licensed; retain this provenance with the asset.         |
| `mtcars.csv`                   |          32 | R `datasets::mtcars`, CSV mirror: [`Rdatasets`](https://github.com/vincentarelbundock/Rdatasets)                                               | Vendored for compact regression examples.                                                                                        |
| `iris.csv`                     |         150 | R `datasets::iris`, CSV mirror: [`Rdatasets`](https://github.com/vincentarelbundock/Rdatasets)                                                 | Vendored for grouped/faceted examples.                                                                                           |
| `diamonds`                     |      53,940 | ggplot2 data                                                                                                                                   | Do not vendor yet: add a reproducible build-time fetch/generation path and provenance review before introducing the large asset. |
| `economics` / `economics_long` | 574 / 2,870 | ggplot2 data                                                                                                                                   | Deferred until the time-series gallery requires it; retain provenance review.                                                    |
| `msleep`                       |          83 | ggplot2 data                                                                                                                                   | Deferred until the raw-y boxplot/violin examples land.                                                                           |
| `txhousing`                    |       8,602 | ggplot2 data                                                                                                                                   | Deferred until facet free-scale and large-data examples have a declared runtime path.                                            |
| `midwest`                      |         437 | ggplot2 data                                                                                                                                   | Deferred until polygon/map-adjacent geometry is supported.                                                                       |

The package license for ggplot2 is MIT, but dataset provenance remains attached
to each file. The Rdatasets project describes itself as a mirror and explicitly
asks consumers to verify source licensing; it is not the licensing authority.
