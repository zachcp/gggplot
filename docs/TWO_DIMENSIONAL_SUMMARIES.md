# Two-dimensional summary statistics

`statSummary2d`, `statSummaryBin`, and `statSummaryHex` share one grouped CPU
reference reducer. They require numeric `x`, `y`, and `z`, omit non-finite rows
and empty cells, and emit cell centers plus `value`, `count`, `binwidthX`,
`binwidthY`, and effective grouping columns.

Built-in `mean`, `median`, `sum`, `min`, and `max` reducers are serializable and
work identically in Live and emitted charts. A direct JavaScript reducer is
intentionally CPU-only: compilation and Live rendering work, while source
emission fails clearly because functions are outside the portable spec.

These products are not resident-eligible in V1. A future GPU path must retain a
dense grid with zero counts and `NaN` values for empty cells, and must add a
reducer declaration to the product plan rather than serializing executable
callbacks. Weights and arbitrary multi-column reducers remain unsupported.
