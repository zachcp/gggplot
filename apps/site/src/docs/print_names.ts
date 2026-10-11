// What the doc site's JSX printer calls things (gggplot-vnh.11): every value
// an example passes by reference, by identity, under the name its module
// exports it as, and the site's wrapper components under the component they
// stand for. Identity, not Function.name, so a minified build prints the same.
import type { PrintJsxOptions } from "@gggplot/core";
import { SitePlot, SitePlot3D } from "../site_plot.tsx";
import * as demo from "./data/demo.ts";
import * as real from "./data/real.ts";
import * as basics from "./examples_basics.tsx";
import * as stats from "./examples_stats.tsx";
import * as intervals from "./geom_examples_intervals.tsx";
import * as shapes from "./geom_examples_shapes.tsx";
import * as threeD from "./example_3d.tsx";

const MODULES: Record<string, unknown>[] = [
  demo,
  real,
  basics,
  stats,
  intervals,
  shapes,
  threeD,
];

/** Printer options for doc examples; extra modules add their exports. */
export function docPrintOptions(
  ...extra: Record<string, unknown>[]
): PrintJsxOptions {
  const refs = new Map<unknown, string>();
  const names = new Map<unknown, string>([
    [SitePlot, "GGPlot"],
    [SitePlot3D, "GGPlot"],
  ]);
  for (const module of [...MODULES, ...extra]) {
    for (const [name, value] of Object.entries(module)) {
      if (typeof value === "function" && /^[A-Z]/.test(name)) {
        if (!names.has(value)) names.set(value, name);
      } else if (value && typeof value === "object" && !("chart" in value)) {
        if (!refs.has(value)) refs.set(value, name);
      } else if (typeof value === "function" && !refs.has(value)) {
        refs.set(value, name);
      }
    }
  }
  return { refs, names };
}
