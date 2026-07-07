import { coordFlip, coordPolar, facetWrap, geomCol, geomLine, geomPoint, geomText, ggplot, theme } from "@gggplot/core";
import type { GGSpec } from "@gggplot/core";

export interface Example {
  id: string;
  title: string;
  description: string;
  /** DSL source shown to the reader — kept in sync with `spec` by hand. */
  dslSource: string;
  spec: GGSpec;
}

const scatterData = {
  wt: [2.6, 3.2, 3.4, 1.9, 4.1, 2.2, 3.8, 2.9],
  mpg: [21, 19, 18, 27, 15, 24, 16, 22],
};

const rankedData = {
  tier: ["low", "medium", "high", "low", "medium", "high", "high"],
  score: [12, 25, 41, 9, 22, 38, 45],
};

const groupedData = {
  wt: [2.6, 3.2, 3.4, 1.9, 4.1, 2.2, 3.8, 2.9],
  mpg: [21, 19, 18, 27, 15, 24, 16, 22],
  cyl: ["4", "6", "8", "4", "8", "4", "6", "6"],
};

const facetedData = {
  wt: [2.6, 3.2, 3.4, 1.9, 4.1, 2.2, 3.8, 2.9],
  mpg: [21, 19, 18, 27, 15, 24, 16, 22],
  cyl: ["4", "6", "8", "4", "8", "4", "6", "6"],
};

export const examples: Example[] = [
  {
    id: "ScatterLine",
    title: "Scatter + line",
    description: "Continuous x/y scales, two layers over the same mapping.",
    dslSource: `ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPoint({ size: 6, color: "#3b82f6" }))
  .add(geomLine({ color: "#ef4444" }))
  .build();`,
    spec: ggplot(scatterData, { x: "wt", y: "mpg" })
      .add(geomPoint({ size: 6, color: "#3b82f6" }))
      .add(geomLine({ color: "#ef4444" }))
      .build(),
  },
  {
    id: "DiscreteX",
    title: "Discrete x",
    description: "A character column auto-detected as a factor and mapped to level-index positions.",
    dslSource: `ggplot(data, { x: "tier", y: "score" })
  .add(geomPoint({ size: 8, color: "#1baf7a" }))
  .build();`,
    spec: ggplot(rankedData, { x: "tier", y: "score" })
      .add(geomPoint({ size: 8, color: "#1baf7a" }))
      .build(),
  },
  {
    id: "ColorMapped",
    title: "Color-mapped scatter",
    description: "A discrete color aesthetic assigns the fixed categorical palette by factor level.",
    dslSource: `ggplot(data, { x: "wt", y: "mpg", color: "cyl" })
  .add(geomPoint({ size: 8 }))
  .add(theme({ textColor: "#e8e8f0" }))
  .build();`,
    spec: ggplot(groupedData, { x: "wt", y: "mpg", color: "cyl" })
      .add(geomPoint({ size: 8 }))
      .add(theme({ textColor: "#e8e8f0" }))
      .build(),
  },
  {
    id: "FlippedBars",
    title: "Flipped bar chart",
    description: "coord_flip swaps the rendered axes without touching the data or trained domains.",
    dslSource: `ggplot(data, { x: "tier", y: "score" })
  .add(geomCol({ color: "#eb6834" }), coordFlip())
  .build();`,
    spec: ggplot(rankedData, { x: "tier", y: "score" })
      .add(geomCol({ color: "#eb6834" }), coordFlip())
      .build(),
  },
  {
    id: "PolarPoints",
    title: "Polar bars",
    description: "coord_polar bends bars into rose wedges with munched curved edges and polar grid guides.",
    dslSource: `ggplot(data, { x: "tier", y: "score" })
  .add(geomCol({ color: "#4a3aa7" }), coordPolar())
  .build();`,
    spec: ggplot(rankedData, { x: "tier", y: "score" })
      .add(geomCol({ color: "#4a3aa7" }), coordPolar())
      .build(),
  },
  {
    id: "ThemedChart",
    title: "Themed chart",
    description: "theme() draws a panel background while recoloring the grid and axes above it.",
    dslSource: `ggplot(data, { x: "wt", y: "mpg", label: "cyl" })
  .add(geomPoint({ size: 8, color: "#1a1a2e" }))
  .add(geomText({ size: 14 }))
  .add(theme({ background: "#241f45", gridColor: "#a78bfa", axisColor: "#4a3aa7", fontFamily: "Georgia" }))
  .build();`,
    spec: ggplot(groupedData, { x: "wt", y: "mpg", label: "cyl" })
      .add(geomPoint({ size: 8, color: "#1a1a2e" }))
      .add(geomText({ size: 14 }))
      .add(theme({ background: "#241f45", gridColor: "#a78bfa", axisColor: "#4a3aa7", fontFamily: "Georgia" }))
      .build(),
  },
  {
    id: "FacetedScatter",
    title: "Faceted scatter (facet_wrap)",
    description: "facet_wrap partitions the data by cyl into one panel per level, sharing the same " +
      "x/y scales across panels, with a strip label naming each panel.",
    dslSource: `ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPoint({ size: 8, color: "#3b82f6" }), facetWrap(["cyl"]))
  .build();`,
    spec: ggplot(facetedData, { x: "wt", y: "mpg" })
      .add(geomPoint({ size: 8, color: "#3b82f6" }), facetWrap(["cyl"]))
      .build(),
  },
];
