# ADR 004: align, connect, and manual stat ownership

Status: accepted\
Decision bead: `gggplot-8e0.26`\
Source baseline:
[`mcanouil/gribouille@03dbfde6`](https://github.com/mcanouil/gribouille/tree/03dbfde6d3a578741b7e66f62c3c184bf41191ad)

## `stat-align`: accept as a core stat

The authoritative example resamples groups with mismatched x values onto one
shared x-grid so stacked areas join correctly. Its required aesthetics are
numeric `x` and `y`; proposed parameters are an explicit or inferred grid and an
interpolation policy. Compilation partitions by facet, constructs one grid per
panel, then interpolates each group independently. Output rows contain
deterministic `x`, `y`, group/facet keys and inherited aesthetics, ordered by
panel, group and x.

This is backend-independent and JSON-serializable. A CPU reference is required;
parallel search/interpolation is GPU-feasible later but is not a core-admission
condition. Live and emitted plots resolve the same `StatSpec`. Core owns the
contract because shared-grid alignment is generally useful to stacked ribbons
and areas, not just the source example. `gggplot-2a9` owns implementation and
executable tests. Treating it as a position was rejected because it changes row
cardinality before stacking; making it an extension was rejected because the
primitive is broadly reusable.

## `stat-connect`: alias existing topology, accept sigmoid only

The source inserts vertices between consecutive points. `hv`, `vh`, and `mid`
produce step-like corners; `sigmoid` produces a sampled logistic connector for
bump charts. Inputs are numeric `x`/`y` plus group and facet keys. Parameters
are connection method and, for sampled curves, resolution and steepness.
Processing must sort within each group and facet and must never bridge their
boundaries. Output is endpoint-preserving line vertices with inherited styling
and deterministic order.

The existing `geomStep` contract already owns `hv`, `vh`, and midpoint step
topology, so those names are parity aliases and get no second stat. The missing
sigmoid transform is backend-independent and serializable; a CPU reference is
required and GPU generation is feasible but optional. Live and emitted paths
must use the same parameters and vertices. `gggplot-isp.3` owns the focused core
implementation and tests. A bump-specific geom and a monolithic duplicate
`statConnect` were rejected because both would duplicate existing line/step
semantics.

## `stat-manual`: reject from portable core

The source splices an arbitrary user closure into a layer pipeline; its example
adds a per-row index later mapped to text. There is no bounded set of required
aesthetics or parameters: inputs, grouping behavior, facet behavior, schema,
determinism and side effects are all closure-defined. The output is therefore an
arbitrary row schema rather than a stat product core can validate.

A local Live-only function can execute on CPU, but arbitrary code is neither a
JSON value nor safely reconstructable by emitted plots. GPU feasibility cannot
be promised without a typed kernel contract. Core and the static extension
registry intentionally require declarative, versioned, serializable products, so
`stat-manual` is rejected and gets no implementation bead. Users can preprocess
data before plotting or publish a named extension with an explicit schema and
adapters. A runtime-only core escape hatch was rejected because it would make
Live and emitted semantics disagree; serializing function source was rejected
for security, closure-capture, and reproducibility reasons.

## Consequences

There are no unresolved ownership or method choices: align is core
(`gggplot-2a9`), sigmoid connection is core (`gggplot-isp.3`), existing step
connections are aliases, and manual closures are outside the portable grammar.
