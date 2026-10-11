/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// Fixture chart module for cli_test.ts: a tree built in code (one line per
// series), which `gggplot print` writes out as literal JSX.
import * as Jsx from "@gggplot/core/jsx";
import { GeomLine, GeomPoint, GGPlot, Labs } from "@gggplot/core";

export const cars = {
  wt: [2.6, 3.2, 3.4, 1.9],
  mpg: [21, 19, 18, 27],
  hp: [110, 95, 123, 66],
};

const SERIES = [["mpg", "#3b82f6"], ["hp", "#ef4444"]] as const;

export const chart = () => (
  <GGPlot data={cars} mapping={{ x: "wt" }}>
    {SERIES.map(([y, color]) => (
      <GeomLine mapping={{ y }} color={color} />
    ))}
    <GeomPoint mapping={{ y: "mpg" }} size={6} />
    <Labs title="Weight against mpg and hp" />
  </GGPlot>
);
