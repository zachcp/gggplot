# Statistical product contracts

The distribution stats begin with deterministic CPU-reference products. A GPU
executor is not selected unless it can retain the declared product shape and
feed a mark directly without materializing input-shaped rows.

## Boxplot summary

`stat_boxplot` emits one compact row per effective `x`/aesthetic group: `x`,
grouping columns, `lower`, `middle`, `upper`, `ymin`, and `ymax`. Quartiles use
linear interpolation at probabilities 0.25, 0.5, and 0.75. Whiskers are the most
extreme observed values inside `coef * IQR` (default 1.5); non-finite
observations are omitted. Outliers do not expand the compact product and are not
rendered yet. Pre-aggregated inputs that already map all five summary aesthetics
pass through unchanged.

## Density and violin grid

`stat_density` and `stat_ydensity` emit a dense `[group, sample]` grid with 128
samples per group by default. The sample domain spans each group's finite
observations. Density uses a Gaussian kernel and Silverman's bandwidth unless
`bw` is supplied. Empty groups emit no samples. `geom_violin` normalizes each
group by its own maximum density and consumes the grid as one mirrored polygon
without reconstructing source rows.

## Dotplot topology

`stat_dotplot` emits one instance per finite observation: a deterministic bin
center and a one-based stack offset. Bins are left-closed, use `binwidth` when
provided, and otherwise divide the observed range into 30 equal cells. Empty
cells emit no instances; groups are represented by separate products.

## Point stroke fallback

`stroke` is a continuous semantic aesthetic. Because the current UseGPU Point
contract has no outline-width input, the compiler labels the path
`cpu-outline-fallback` and composes an outer and inner Point. The outer radius
is `size + 2 * stroke`; `strokeColor` wins for the border, then literal `color`,
then black. Literal `fill` controls the inner point; mapped point colors
otherwise retain their normal precedence. This path deliberately does not claim
GPU-native stroke support or expand resident source data.

## Long-tail CPU products

`stat_bin_2d` and `stat_bin_hex` share a dense `[group, y-bin, x-bin]`
count-product contract backed by `groupedHistogram2d`. Non-finite pairs are
omitted and zero cells remain implicit in CPU mark lowering. Rectangular marks
consume four-vertex cells; hex marks consume six-vertex cell topology. The
resident GPU reduction exists separately, but the grammar compiler deliberately
uses the observable CPU-reference path until a direct resident cell consumer is
declared.

`stat_contour` accepts a complete rectangular `x`/`y`/`z` grid and emits
marching-squares segment topology per requested break. Cells with missing
corners are skipped. `stat_contour_filled` assigns each finite grid value to a
stepped band and renders the grid cells directly, preserving the declared grid
instead of materializing source-shaped contour paths.

`stat_qq` sorts finite sample values and pairs them with standard-normal
quantiles; `stat_qq_line` uses the first and third quartiles. `stat_ellipse`
emits a closed covariance ellipse using the requested confidence level, while
`stat_function` evaluates a supplied function on a fixed-size grid over `xlim`
(or the mapped x extent). QQ and ellipse products split on the same effective
group resolver as other grouped stats and preserve those columns for mark
lowering.

Continuous color/fill scales default to a serializable 24-cell `colorbar`.
`guideColoursteps` and `guideBins` emit an explicitly bounded number of stepped
swatches, and `kind: "none"` suppresses the guide. Guide titles prefer the guide
override, then plot labels, then the scale name.
