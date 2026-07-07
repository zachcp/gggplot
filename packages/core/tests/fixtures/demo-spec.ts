// Fixture spec module for cli_test.ts — mirrors examples/emit-demo.ts's shape.
import { geomLine, geomPoint, ggplot } from "../../src/dsl/mod.ts";

const data = {
  wt: [2.6, 3.2, 3.4],
  mpg: [21, 19, 18],
};

export const spec = ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPoint({ size: 6, color: "#3b82f6" }))
  .add(geomLine({ color: "#ef4444" }))
  .build();
