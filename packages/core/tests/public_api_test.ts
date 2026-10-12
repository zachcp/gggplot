// gggplot-vnh.18 (ADR-007 decisions 1, 4, 5): plots are component trees. The
// package exports no GGSpec, no fluent DSL, and no compile/renderTree/
// emitSource; ggsave and the CLI take components.
import { assert, assertEquals } from "@std/assert";
import * as core from "../src/mod.ts";
// @ts-expect-error GGSpec is internal: a plot is a component tree.
import type { GGSpec as _GGSpec } from "../src/mod.ts";
// @ts-expect-error The root's render tree is internal (gggplot-vnh.14).
import type { RenderNode as _RenderNode } from "../src/mod.ts";

const REMOVED = [
  "ggplot",
  "aes",
  "geomPoint",
  "geomHistogram",
  "scaleXContinuous",
  "themeMinimal",
  "labels",
  "facetWrap",
  "coordPolar",
  "camera3dFit",
  "execution",
  "GG",
  "compile",
  "renderTree",
  "emitSource",
  "node",
  "createPackCache",
];

Deno.test("the barrel exports no spec-era API", () => {
  const present = REMOVED.filter((name) => name in core);
  assertEquals(present, []);
});

Deno.test("the component API is what replaces it", () => {
  for (
    const name of [
      "GGPlot",
      "GGData",
      "GeomPoint",
      "ScaleXContinuous",
      "ThemeMinimal",
      "Labs",
      "FacetWrap",
      "CoordPolar",
      "Camera3dFit",
      "Execution",
      "printJsx",
      "ggsave",
    ]
  ) {
    assert(name in core, `${name} is exported`);
  }
});

Deno.test("the package has no ./dsl or ./compile entry point", async () => {
  const config = JSON.parse(
    await Deno.readTextFile(new URL("../deno.json", import.meta.url)),
  );
  assertEquals(Object.keys(config.exports).sort(), [
    ".",
    "./export",
    "./jsx",
    "./plan",
  ]);
});
