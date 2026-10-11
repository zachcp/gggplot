// Run: `deno task demo` (from repo root) or `deno run -A examples/emit-demo.ts`.
// Builds a component tree in code and prints it as the JSX a user would write
// (printJsx, gggplot-vnh.11): data passes by reference, by name.
import { createElement } from "../src/jsx.ts";
import { GeomLine, GeomPoint, GGPlot, printJsx } from "../src/mod.ts";

const cars = {
  wt: [2.6, 3.2, 3.4, 1.9, 4.1, 2.2],
  mpg: [21, 19, 18, 27, 15, 24],
};

const chart = createElement(
  GGPlot,
  { data: cars, mapping: { x: "wt", y: "mpg" } },
  createElement(GeomPoint, { size: 6, color: "#3b82f6" }),
  createElement(GeomLine, { color: "#ef4444" }),
);

console.log(printJsx(chart, { refs: new Map([[cars, "cars"]]) }).source);
