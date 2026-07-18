# Core waffle geom and cluster-mark extension

Waffle charts compose naturally from a statistical transform and ordinary core
tiles. Cluster marks remain an optional package because their enclosure methods
introduce specialized geometry and extension contracts.

## Waffle

`geomWaffle` expands integer group counts into unit cells, column by column from
the bottom-left. Expansion is bounded by `maxCells`; fill, facets, scales,
guides, Live rendering, and emitted source use the regular core pipeline.

```ts
import { geomWaffle, ggplot } from "@gggplot/core";

const chart = ggplot({
  status: ["resolved", "progress", "blocked", "new"],
  count: [58, 27, 9, 6],
}, { fill: "status" }).add(
  geomWaffle({ weight: "count", rows: 10, maxCells: 100 }),
).build();
```

Counts must be non-negative integers. A zero count emits no cells. Row-major
layouts and fractional weights are not silently approximated.

## Cluster marks

`@gggplot/mark` computes one enclosure per group. The supported methods are
`hull`, `ellipse`, `rect`, and `circle`.

```ts
import { compileMarks, MARK_EXTENSION_ID, registerMarks } from "@gggplot/mark";

const registry = registerMarks();
const nodes = compileMarks({
  extension: MARK_EXTENSION_ID,
  data: {
    x: [0, 1, 0, 10, 11, 10],
    y: [0, 0, 1, 10, 10, 11],
    group: ["a", "a", "a", "b", "b", "b"],
  },
  params: {
    method: "hull", // also ellipse, rect, or circle
    expand: 0.5,
    fill: "#93c5fd55",
    stroke: "#1d4ed8",
  },
}, registry);
```

Missing non-finite positions are dropped. Degenerate one-point groups remain
deterministic when `expand` supplies a visible radius. Facet isolation is
achieved by compiling each panel's group rows independently, matching core's
panel-local stat contract.
